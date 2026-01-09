// Server entry point

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { config } from './config/index.js';
import { polymarketConfig, getNetworkName } from './config/polymarket.js';
import { prisma, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { logger } from './utils/logger.js';
import { walletService } from './services/wallet/index.js';
import { traderMonitorService } from './services/trader/trader-monitor.service.js';
import { tradeCopierService } from './services/trade/trade-copier.service.js';
import { retryQueueService } from './services/trade/retry-queue.service.js';
import { drawdownMonitorService } from './services/risk/drawdown-monitor.service.js';
import { stopLossTakeProfitService } from './services/risk/stop-loss-take-profit.service.js';
import type { ServerToClientEvents, ClientToServerEvents } from '@polymarket-bot/shared';

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('subscribe:trader', (traderId) => {
    socket.join(`trader:${traderId}`);
    logger.debug({ socketId: socket.id, traderId }, 'Subscribed to trader');
  });

  socket.on('unsubscribe:trader', (traderId) => {
    socket.leave(`trader:${traderId}`);
    logger.debug({ socketId: socket.id, traderId }, 'Unsubscribed from trader');
  });

  socket.on('subscribe:market', (marketId) => {
    socket.join(`market:${marketId}`);
    logger.debug({ socketId: socket.id, marketId }, 'Subscribed to market');
  });

  socket.on('unsubscribe:market', (marketId) => {
    socket.leave(`market:${marketId}`);
    logger.debug({ socketId: socket.id, marketId }, 'Unsubscribed from market');
  });

  socket.on('subscribe:all', () => {
    socket.join('all');
    logger.debug({ socketId: socket.id }, 'Subscribed to all events');
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

// Export io for use in other modules
export { io };

// Graceful shutdown handler
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal');

  // Stop all trading services
  stopLossTakeProfitService.stop();
  drawdownMonitorService.stop();
  retryQueueService.stop();
  tradeCopierService.stop();
  traderMonitorService.stopAll();
  logger.info('Trading services stopped');

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close Socket.IO
  io.close(() => {
    logger.info('Socket.IO server closed');
  });

  // Disconnect from databases
  await Promise.all([
    disconnectDatabase().then(() => logger.info('Database disconnected')),
    disconnectRedis().then(() => logger.info('Redis disconnected')),
  ]);

  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function start(): Promise<void> {
  try {
    // Connect to Redis
    await connectRedis();
    logger.info('Connected to Redis');

    // Verify database connection
    await prisma.$connect();
    logger.info('Connected to database');

    // Initialize wallet (optional - can run without wallet for dashboard only)
    if (config.botWalletEncryptedKey) {
      try {
        await walletService.initialize();
        logger.info(
          { address: walletService.getAddress() },
          'Wallet initialized'
        );

        // Start all trading services if wallet is ready
        tradeCopierService.start();
        retryQueueService.start();
        drawdownMonitorService.start();
        await stopLossTakeProfitService.start();
        await traderMonitorService.startAll();
        logger.info(
          {
            monitorStatus: traderMonitorService.getStatus(),
            sltpStatus: stopLossTakeProfitService.getStatus(),
          },
          'Trading services started'
        );
      } catch (error) {
        logger.warn({ error }, 'Failed to initialize wallet - running in read-only mode');
      }
    } else {
      logger.info('No wallet configured - running in read-only mode');
    }

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(
        {
          port: config.port,
          env: config.nodeEnv,
          network: getNetworkName(),
          chainId: polymarketConfig.chainId,
          walletConnected: walletService.isReady(),
        },
        `Server started on port ${config.port}`
      );
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Run server
start();
