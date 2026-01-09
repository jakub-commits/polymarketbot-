// Drawdown Monitor Service
// Monitors portfolio drawdown and triggers protective actions

import { EventEmitter } from 'events';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { walletService } from '../wallet/wallet.service.js';
import { io } from '../../server.js';

export interface DrawdownAlert {
  traderId: string;
  type: 'WARN' | 'CRITICAL' | 'LIMIT_REACHED';
  currentDrawdown: number;
  maxDrawdown: number;
  currentBalance: number;
  peakBalance: number;
  timestamp: Date;
}

export interface DrawdownSnapshot {
  traderId: string;
  currentBalance: number;
  peakBalance: number;
  drawdownPercent: number;
  dailyPnl: number;
  weeklyPnl: number;
  openPositionValue: number;
}

export class DrawdownMonitorService extends EventEmitter {
  private isRunning: boolean = false;
  private monitorIntervalId?: NodeJS.Timeout;
  private monitorIntervalMs: number = 30000; // Check every 30 seconds
  private lastAlerts: Map<string, DrawdownAlert['type']> = new Map();

  /**
   * Start the drawdown monitor
   */
  start(intervalMs?: number): void {
    if (this.isRunning) {
      logger.warn('Drawdown monitor already running');
      return;
    }

    this.monitorIntervalMs = intervalMs || this.monitorIntervalMs;
    this.isRunning = true;

    // Initial check
    this.checkAllTraders();

    // Set up periodic monitoring
    this.monitorIntervalId = setInterval(
      () => this.checkAllTraders(),
      this.monitorIntervalMs
    );

    logger.info({ intervalMs: this.monitorIntervalMs }, 'Drawdown monitor started');
  }

  /**
   * Stop the drawdown monitor
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
    }
    this.lastAlerts.clear();

    logger.info('Drawdown monitor stopped');
  }

  /**
   * Check all active traders for drawdown
   */
  private async checkAllTraders(): Promise<void> {
    try {
      const activeTraders = await prisma.trader.findMany({
        where: { status: 'ACTIVE' },
      });

      for (const trader of activeTraders) {
        await this.checkTraderDrawdown(trader.id);
      }
    } catch (error) {
      logger.error({ error }, 'Error in drawdown check cycle');
    }
  }

  /**
   * Check drawdown for a specific trader
   */
  async checkTraderDrawdown(traderId: string): Promise<DrawdownSnapshot | null> {
    try {
      const trader = await prisma.trader.findUnique({
        where: { id: traderId },
        include: {
          positions: { where: { status: 'OPEN' } },
        },
      });

      if (!trader) return null;

      // Calculate current portfolio value
      let walletBalance = 0;
      try {
        walletBalance = await walletService.getBalance();
      } catch {
        walletBalance = 0;
      }

      const openPositionValue = trader.positions.reduce(
        (sum, pos) => sum + pos.shares * pos.avgEntryPrice,
        0
      );

      const currentBalance = walletBalance + openPositionValue;

      // Get or set peak balance
      let peakBalance = trader.peakBalance || currentBalance;
      if (currentBalance > peakBalance) {
        peakBalance = currentBalance;
        await prisma.trader.update({
          where: { id: traderId },
          data: { peakBalance: currentBalance },
        });
      }

      // Calculate drawdown
      const drawdownPercent = peakBalance > 0
        ? ((peakBalance - currentBalance) / peakBalance) * 100
        : 0;

      // Calculate P&L periods
      const dailyPnl = await this.calculatePeriodPnl(traderId, 1);
      const weeklyPnl = await this.calculatePeriodPnl(traderId, 7);

      const snapshot: DrawdownSnapshot = {
        traderId,
        currentBalance,
        peakBalance,
        drawdownPercent: Math.max(0, drawdownPercent),
        dailyPnl,
        weeklyPnl,
        openPositionValue,
      };

      // Check for alerts
      await this.checkAlerts(trader, snapshot);

      return snapshot;
    } catch (error) {
      logger.error({ error, traderId }, 'Error checking trader drawdown');
      return null;
    }
  }

  /**
   * Calculate P&L for a time period
   */
  private async calculatePeriodPnl(traderId: string, days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const trades = await prisma.trade.findMany({
      where: {
        traderId,
        status: 'EXECUTED',
        executedAt: { gte: startDate },
      },
    });

    return trades.reduce((sum, trade) => {
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;
      return sum + pnl;
    }, 0);
  }

  /**
   * Check and emit alerts based on drawdown levels
   */
  private async checkAlerts(
    trader: { id: string; maxDrawdownPercent: number; status: string },
    snapshot: DrawdownSnapshot
  ): Promise<void> {
    const { drawdownPercent } = snapshot;
    const maxDrawdown = trader.maxDrawdownPercent;
    const lastAlertType = this.lastAlerts.get(trader.id);

    let alertType: DrawdownAlert['type'] | null = null;

    // Determine alert level
    if (drawdownPercent >= maxDrawdown) {
      alertType = 'LIMIT_REACHED';
    } else if (drawdownPercent >= maxDrawdown * 0.9) {
      alertType = 'CRITICAL';
    } else if (drawdownPercent >= maxDrawdown * 0.7) {
      alertType = 'WARN';
    }

    // Only emit if alert level changed or is limit reached
    if (alertType && (alertType !== lastAlertType || alertType === 'LIMIT_REACHED')) {
      const alert: DrawdownAlert = {
        traderId: trader.id,
        type: alertType,
        currentDrawdown: drawdownPercent,
        maxDrawdown,
        currentBalance: snapshot.currentBalance,
        peakBalance: snapshot.peakBalance,
        timestamp: new Date(),
      };

      this.lastAlerts.set(trader.id, alertType);
      this.emit('alert', alert);

      // Log alert
      await prisma.activityLog.create({
        data: {
          level: alertType === 'LIMIT_REACHED' ? 'ERROR' : 'WARN',
          category: 'risk',
          message: `Drawdown ${alertType}: ${drawdownPercent.toFixed(1)}% (limit: ${maxDrawdown}%)`,
          traderId: trader.id,
          metadata: JSON.parse(JSON.stringify(snapshot)),
        },
      });

      // Broadcast via WebSocket
      this.broadcastAlert(alert);

      // Take action if limit reached
      if (alertType === 'LIMIT_REACHED') {
        await this.handleDrawdownLimitReached(trader.id);
      }

      logger.warn({ alert }, 'Drawdown alert triggered');
    }

    // Clear alert if drawdown recovered
    if (!alertType && lastAlertType) {
      this.lastAlerts.delete(trader.id);
      logger.info({ traderId: trader.id }, 'Drawdown recovered, alert cleared');
    }
  }

  /**
   * Handle drawdown limit reached - pause trading
   */
  private async handleDrawdownLimitReached(traderId: string): Promise<void> {
    try {
      await prisma.trader.update({
        where: { id: traderId },
        data: { status: 'PAUSED' },
      });

      await prisma.activityLog.create({
        data: {
          level: 'WARN',
          category: 'risk',
          message: 'Trading paused due to max drawdown limit reached',
          traderId,
        },
      });

      this.emit('trader:paused', { traderId, reason: 'drawdown_limit' });

      logger.warn({ traderId }, 'Trader paused due to drawdown limit');
    } catch (error) {
      logger.error({ error, traderId }, 'Failed to pause trader on drawdown limit');
    }
  }

  /**
   * Broadcast alert via WebSocket
   */
  private broadcastAlert(alert: DrawdownAlert): void {
    try {
      io.to(`trader:${alert.traderId}`).emit('risk:alert', alert as never);
      io.to('all').emit('risk:alert', alert as never);
    } catch (error) {
      logger.debug({ error }, 'Failed to broadcast drawdown alert');
    }
  }

  /**
   * Get current snapshot for a trader
   */
  async getSnapshot(traderId: string): Promise<DrawdownSnapshot | null> {
    return this.checkTraderDrawdown(traderId);
  }

  /**
   * Get all current snapshots
   */
  async getAllSnapshots(): Promise<DrawdownSnapshot[]> {
    const traders = await prisma.trader.findMany({
      where: { status: 'ACTIVE' },
    });

    const snapshots: DrawdownSnapshot[] = [];
    for (const trader of traders) {
      const snapshot = await this.checkTraderDrawdown(trader.id);
      if (snapshot) snapshots.push(snapshot);
    }

    return snapshots;
  }

  /**
   * Reset peak balance for a trader
   */
  async resetPeakBalance(traderId: string): Promise<void> {
    let currentBalance = 0;
    try {
      currentBalance = await walletService.getBalance();
    } catch {
      currentBalance = 0;
    }

    await prisma.trader.update({
      where: { id: traderId },
      data: { peakBalance: currentBalance },
    });

    this.lastAlerts.delete(traderId);
    logger.info({ traderId, newPeak: currentBalance }, 'Peak balance reset');
  }

  /**
   * Check if monitor is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const drawdownMonitorService = new DrawdownMonitorService();
