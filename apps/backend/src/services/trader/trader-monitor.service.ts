// Trader Monitor Service
// Real-time monitoring of trader positions for copy trading

import { EventEmitter } from 'events';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { gammaApiService, type UserPosition } from '../polymarket/gamma-api.service.js';
import { io } from '../../server.js';
import type { PositionChange } from '@polymarket-bot/shared';

interface MonitoredTrader {
  id: string;
  walletAddress: string;
  intervalId: NodeJS.Timeout;
  lastPositions: Map<string, UserPosition>;
}

export class TraderMonitorService extends EventEmitter {
  private monitoredTraders: Map<string, MonitoredTrader> = new Map();
  private defaultIntervalMs = 2000; // Check every 2 seconds
  private isRunning = false;

  /**
   * Start monitoring a trader
   */
  async startMonitoring(traderId: string, intervalMs?: number): Promise<void> {
    if (this.monitoredTraders.has(traderId)) {
      logger.debug({ traderId }, 'Trader already being monitored');
      return;
    }

    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
    });

    if (!trader) {
      logger.warn({ traderId }, 'Trader not found for monitoring');
      return;
    }

    // Get initial positions
    const positions = await gammaApiService.getUserPositions(trader.walletAddress);
    const positionMap = new Map<string, UserPosition>();
    for (const pos of positions) {
      positionMap.set(pos.tokenId, pos);
    }

    // Set up interval
    const interval = intervalMs || this.defaultIntervalMs;
    const intervalId = setInterval(
      () => this.checkPositions(traderId),
      interval
    );

    this.monitoredTraders.set(traderId, {
      id: traderId,
      walletAddress: trader.walletAddress,
      intervalId,
      lastPositions: positionMap,
    });

    logger.info({ traderId, interval }, 'Started monitoring trader');
    this.isRunning = true;
  }

  /**
   * Stop monitoring a trader
   */
  stopMonitoring(traderId: string): void {
    const monitored = this.monitoredTraders.get(traderId);
    if (monitored) {
      clearInterval(monitored.intervalId);
      this.monitoredTraders.delete(traderId);
      logger.info({ traderId }, 'Stopped monitoring trader');
    }

    if (this.monitoredTraders.size === 0) {
      this.isRunning = false;
    }
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    for (const [traderId] of this.monitoredTraders) {
      this.stopMonitoring(traderId);
    }
    this.isRunning = false;
    logger.info('Stopped all trader monitoring');
  }

  /**
   * Check positions for changes
   */
  private async checkPositions(traderId: string): Promise<void> {
    const monitored = this.monitoredTraders.get(traderId);
    if (!monitored) return;

    try {
      const currentPositions = await gammaApiService.getUserPositions(
        monitored.walletAddress
      );

      const changes = this.detectChanges(
        traderId,
        monitored.walletAddress,
        monitored.lastPositions,
        currentPositions
      );

      // Process changes
      for (const change of changes) {
        this.emit('position:change', change);
        this.broadcastChange(change);

        logger.info(
          {
            traderId,
            type: change.type,
            tokenId: change.tokenId,
            delta: change.delta,
          },
          'Position change detected'
        );
      }

      // Update last known positions
      const newMap = new Map<string, UserPosition>();
      for (const pos of currentPositions) {
        newMap.set(pos.tokenId, pos);
      }
      monitored.lastPositions = newMap;
    } catch (error) {
      logger.error({ traderId, error }, 'Error checking positions');
      this.emit('error', { traderId, error });
    }
  }

  /**
   * Detect position changes
   */
  private detectChanges(
    traderId: string,
    walletAddress: string,
    previous: Map<string, UserPosition>,
    current: UserPosition[]
  ): PositionChange[] {
    const changes: PositionChange[] = [];
    const currentMap = new Map<string, UserPosition>();

    // Check for new or increased positions
    for (const pos of current) {
      currentMap.set(pos.tokenId, pos);
      const prev = previous.get(pos.tokenId);

      if (!prev) {
        // New position
        changes.push({
          type: 'NEW',
          traderId,
          walletAddress,
          marketId: pos.conditionId,
          tokenId: pos.tokenId,
          outcome: pos.outcome,
          previousShares: 0,
          currentShares: pos.shares,
          delta: pos.shares,
          price: pos.avgPrice,
          timestamp: new Date(),
        });
      } else if (pos.shares > prev.shares) {
        // Increased position
        changes.push({
          type: 'INCREASED',
          traderId,
          walletAddress,
          marketId: pos.conditionId,
          tokenId: pos.tokenId,
          outcome: pos.outcome,
          previousShares: prev.shares,
          currentShares: pos.shares,
          delta: pos.shares - prev.shares,
          price: pos.avgPrice,
          timestamp: new Date(),
        });
      } else if (pos.shares < prev.shares) {
        // Decreased position
        changes.push({
          type: 'DECREASED',
          traderId,
          walletAddress,
          marketId: pos.conditionId,
          tokenId: pos.tokenId,
          outcome: pos.outcome,
          previousShares: prev.shares,
          currentShares: pos.shares,
          delta: prev.shares - pos.shares,
          price: pos.avgPrice,
          timestamp: new Date(),
        });
      }
    }

    // Check for closed positions
    for (const [tokenId, prev] of previous) {
      if (!currentMap.has(tokenId)) {
        changes.push({
          type: 'CLOSED',
          traderId,
          walletAddress,
          marketId: prev.conditionId,
          tokenId: prev.tokenId,
          outcome: prev.outcome,
          previousShares: prev.shares,
          currentShares: 0,
          delta: prev.shares,
          price: prev.avgPrice,
          timestamp: new Date(),
        });
      }
    }

    return changes;
  }

  /**
   * Broadcast change via WebSocket
   */
  private broadcastChange(change: PositionChange): void {
    try {
      // Broadcast to trader room
      io.to(`trader:${change.traderId}`).emit('trader:positionDetected', {
        traderId: change.traderId,
        walletAddress: change.walletAddress,
        marketId: change.marketId,
        outcome: change.outcome,
        shares: change.currentShares,
        price: change.price,
        action: change.type === 'DECREASED' || change.type === 'CLOSED' ? 'SELL' : 'BUY',
        timestamp: change.timestamp,
      });

      // Broadcast to all subscribers
      io.to('all').emit('trader:positionDetected', {
        traderId: change.traderId,
        walletAddress: change.walletAddress,
        marketId: change.marketId,
        outcome: change.outcome,
        shares: change.currentShares,
        price: change.price,
        action: change.type === 'DECREASED' || change.type === 'CLOSED' ? 'SELL' : 'BUY',
        timestamp: change.timestamp,
      });
    } catch (error) {
      // IO may not be initialized yet
      logger.debug({ error }, 'Failed to broadcast position change');
    }
  }

  /**
   * Start monitoring all active traders
   */
  async startAll(): Promise<void> {
    const activeTraders = await prisma.trader.findMany({
      where: {
        status: 'ACTIVE',
        copyEnabled: true,
      },
    });

    for (const trader of activeTraders) {
      await this.startMonitoring(trader.id);
    }

    logger.info({ count: activeTraders.length }, 'Started monitoring all active traders');
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isRunning: boolean;
    monitoredCount: number;
    traders: Array<{ id: string; walletAddress: string }>;
  } {
    return {
      isRunning: this.isRunning,
      monitoredCount: this.monitoredTraders.size,
      traders: Array.from(this.monitoredTraders.values()).map((t) => ({
        id: t.id,
        walletAddress: t.walletAddress,
      })),
    };
  }
}

// Singleton instance
export const traderMonitorService = new TraderMonitorService();
