// WebSocket Service
// Handles real-time event broadcasting to connected clients

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  Trade,
  Position,
  PnLUpdate,
  StatsUpdate,
  RiskAlert,
  SLTPTriggerEvent,
  Notification,
} from '@polymarket-bot/shared';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class WebSocketService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;
  private connectedClients: Map<string, Set<string>> = new Map(); // room -> socketIds

  /**
   * Initialize the WebSocket service with Socket.IO server
   */
  initialize(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>): void {
    this.io = io;
    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: TypedSocket) => {
      logger.info({ socketId: socket.id }, 'Client connected');

      // Track connection
      this.trackConnection('all', socket.id);

      // Subscription handlers
      socket.on('subscribe:trader', (traderId) => {
        socket.join(`trader:${traderId}`);
        this.trackConnection(`trader:${traderId}`, socket.id);
        logger.debug({ socketId: socket.id, traderId }, 'Subscribed to trader');
      });

      socket.on('unsubscribe:trader', (traderId) => {
        socket.leave(`trader:${traderId}`);
        this.untrackConnection(`trader:${traderId}`, socket.id);
        logger.debug({ socketId: socket.id, traderId }, 'Unsubscribed from trader');
      });

      socket.on('subscribe:market', (marketId) => {
        socket.join(`market:${marketId}`);
        this.trackConnection(`market:${marketId}`, socket.id);
        logger.debug({ socketId: socket.id, marketId }, 'Subscribed to market');
      });

      socket.on('unsubscribe:market', (marketId) => {
        socket.leave(`market:${marketId}`);
        this.untrackConnection(`market:${marketId}`, socket.id);
        logger.debug({ socketId: socket.id, marketId }, 'Unsubscribed from market');
      });

      socket.on('subscribe:all', () => {
        socket.join('all');
        this.trackConnection('all', socket.id);
        logger.debug({ socketId: socket.id }, 'Subscribed to all events');
      });

      socket.on('unsubscribe:all', () => {
        socket.leave('all');
        this.untrackConnection('all', socket.id);
      });

      socket.on('disconnect', () => {
        this.removeFromAllRooms(socket.id);
        logger.info({ socketId: socket.id }, 'Client disconnected');
      });
    });
  }

  /**
   * Track connection in a room
   */
  private trackConnection(room: string, socketId: string): void {
    if (!this.connectedClients.has(room)) {
      this.connectedClients.set(room, new Set());
    }
    this.connectedClients.get(room)!.add(socketId);
  }

  /**
   * Untrack connection from a room
   */
  private untrackConnection(room: string, socketId: string): void {
    this.connectedClients.get(room)?.delete(socketId);
  }

  /**
   * Remove socket from all rooms
   */
  private removeFromAllRooms(socketId: string): void {
    for (const [, sockets] of this.connectedClients) {
      sockets.delete(socketId);
    }
  }

  /**
   * Get connection stats
   */
  getStats(): { totalConnections: number; rooms: Record<string, number> } {
    const rooms: Record<string, number> = {};
    let total = 0;

    for (const [room, sockets] of this.connectedClients) {
      rooms[room] = sockets.size;
      if (room === 'all') total = sockets.size;
    }

    return { totalConnections: total, rooms };
  }

  // ==================== Trade Events ====================

  /**
   * Broadcast new trade
   */
  broadcastNewTrade(trade: Trade): void {
    if (!this.io) return;

    this.io.to(`trader:${trade.traderId}`).emit('trade:new', trade);
    this.io.to('all').emit('trade:new', trade);

    logger.debug({ tradeId: trade.id }, 'Broadcasted new trade');
  }

  /**
   * Broadcast trade update
   */
  broadcastTradeUpdate(trade: Trade): void {
    if (!this.io) return;

    this.io.to(`trader:${trade.traderId}`).emit('trade:updated', trade);
    this.io.to('all').emit('trade:updated', trade);
  }

  /**
   * Broadcast trade failure
   */
  broadcastTradeFailed(traderId: string, tradeId: string, error: string): void {
    if (!this.io) return;

    const data = { tradeId, error };
    this.io.to(`trader:${traderId}`).emit('trade:failed', data);
    this.io.to('all').emit('trade:failed', data);
  }

  // ==================== Position Events ====================

  /**
   * Broadcast position opened
   */
  broadcastPositionOpened(position: Position): void {
    if (!this.io) return;

    this.io.to(`trader:${position.traderId}`).emit('position:opened', position);
    this.io.to(`market:${position.marketId}`).emit('position:opened', position);
    this.io.to('all').emit('position:opened', position);
  }

  /**
   * Broadcast position update
   */
  broadcastPositionUpdate(position: Position): void {
    if (!this.io) return;

    this.io.to(`trader:${position.traderId}`).emit('position:updated', position);
    this.io.to(`market:${position.marketId}`).emit('position:updated', position);
    this.io.to('all').emit('position:updated', position);
  }

  /**
   * Broadcast position closed
   */
  broadcastPositionClosed(position: Position): void {
    if (!this.io) return;

    this.io.to(`trader:${position.traderId}`).emit('position:closed', position);
    this.io.to(`market:${position.marketId}`).emit('position:closed', position);
    this.io.to('all').emit('position:closed', position);
  }

  // ==================== Analytics Events ====================

  /**
   * Broadcast P&L update
   */
  broadcastPnLUpdate(data: PnLUpdate): void {
    if (!this.io) return;

    this.io.to('all').emit('pnl:updated', data);
  }

  /**
   * Broadcast stats update
   */
  broadcastStatsUpdate(data: StatsUpdate): void {
    if (!this.io) return;

    this.io.to('all').emit('stats:updated', data);
  }

  // ==================== Risk Events ====================

  /**
   * Broadcast risk alert
   */
  broadcastRiskAlert(alert: RiskAlert): void {
    if (!this.io) return;

    this.io.to(`trader:${alert.traderId}`).emit('risk:alert', alert);
    this.io.to('all').emit('risk:alert', alert);

    logger.info({ traderId: alert.traderId, type: alert.type }, 'Broadcasted risk alert');
  }

  /**
   * Broadcast SL/TP trigger
   */
  broadcastSLTPTrigger(trigger: SLTPTriggerEvent): void {
    if (!this.io) return;

    this.io.to(`trader:${trigger.traderId}`).emit('risk:sltp', trigger);
    this.io.to('all').emit('risk:sltp', trigger);
  }

  // ==================== System Events ====================

  /**
   * Send notification to all clients
   */
  broadcastNotification(notification: Notification): void {
    if (!this.io) return;

    this.io.to('all').emit('notification', notification);
  }

  /**
   * Send notification to specific trader subscribers
   */
  sendTraderNotification(traderId: string, notification: Notification): void {
    if (!this.io) return;

    this.io.to(`trader:${traderId}`).emit('notification', notification);
  }

  /**
   * Broadcast error
   */
  broadcastError(code: string, message: string, details?: unknown): void {
    if (!this.io) return;

    this.io.to('all').emit('error', { code, message, details });
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
