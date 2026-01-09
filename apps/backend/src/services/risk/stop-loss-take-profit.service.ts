// Stop Loss / Take Profit Service
// Monitors positions and automatically closes when SL/TP levels are hit

import { EventEmitter } from 'events';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { clobClientService } from '../polymarket/clob-client.service.js';
import { tradeExecutorService } from '../trade/trade-executor.service.js';
import { io } from '../../server.js';

export interface SLTPConfig {
  positionId: string;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  trailingStopPercent?: number;
}

interface MonitoredPosition {
  positionId: string;
  traderId: string;
  tokenId: string;
  marketId: string;
  outcome: string;
  shares: number;
  entryPrice: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPercent?: number;
  highestPrice: number;
  trailingStopPrice?: number;
}

export interface SLTPTrigger {
  positionId: string;
  traderId: string;
  type: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP';
  triggerPrice: number;
  currentPrice: number;
  entryPrice: number;
  pnlPercent: number;
  shares: number;
}

export class StopLossTakeProfitService extends EventEmitter {
  private isRunning: boolean = false;
  private monitoredPositions: Map<string, MonitoredPosition> = new Map();
  private monitorIntervalId?: NodeJS.Timeout;
  private monitorIntervalMs: number = 5000; // Check every 5 seconds

  /**
   * Start the SL/TP monitor
   */
  async start(intervalMs?: number): Promise<void> {
    if (this.isRunning) {
      logger.warn('SL/TP monitor already running');
      return;
    }

    this.monitorIntervalMs = intervalMs || this.monitorIntervalMs;
    this.isRunning = true;

    // Load existing positions with SL/TP
    await this.loadPositions();

    // Set up periodic monitoring
    this.monitorIntervalId = setInterval(
      () => this.checkAllPositions(),
      this.monitorIntervalMs
    );

    logger.info(
      { intervalMs: this.monitorIntervalMs, positions: this.monitoredPositions.size },
      'SL/TP monitor started'
    );
  }

  /**
   * Stop the SL/TP monitor
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
    }
    this.monitoredPositions.clear();

    logger.info('SL/TP monitor stopped');
  }

  /**
   * Load positions that need SL/TP monitoring
   */
  private async loadPositions(): Promise<void> {
    const traders = await prisma.trader.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { stopLossPercent: { not: null } },
          { takeProfitPercent: { not: null } },
        ],
      },
      include: {
        positions: { where: { status: 'OPEN' } },
      },
    });

    for (const trader of traders) {
      for (const position of trader.positions) {
        this.addPosition(position.id, {
          stopLossPercent: trader.stopLossPercent || undefined,
          takeProfitPercent: trader.takeProfitPercent || undefined,
        });
      }
    }

    logger.info(
      { count: this.monitoredPositions.size },
      'Loaded positions for SL/TP monitoring'
    );
  }

  /**
   * Add a position to monitor
   */
  async addPosition(positionId: string, config: Partial<SLTPConfig>): Promise<boolean> {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position || position.status !== 'OPEN') {
      return false;
    }

    const entryPrice = position.avgEntryPrice;
    const monitored: MonitoredPosition = {
      positionId,
      traderId: position.traderId,
      tokenId: position.tokenId,
      marketId: position.marketId,
      outcome: position.outcome,
      shares: position.shares,
      entryPrice,
      highestPrice: entryPrice,
    };

    // Calculate stop loss price
    if (config.stopLossPercent) {
      monitored.stopLossPrice = entryPrice * (1 - config.stopLossPercent / 100);
    }

    // Calculate take profit price
    if (config.takeProfitPercent) {
      monitored.takeProfitPrice = entryPrice * (1 + config.takeProfitPercent / 100);
    }

    // Setup trailing stop
    if (config.trailingStopPercent) {
      monitored.trailingStopPercent = config.trailingStopPercent;
      monitored.trailingStopPrice = entryPrice * (1 - config.trailingStopPercent / 100);
    }

    this.monitoredPositions.set(positionId, monitored);

    logger.debug(
      { positionId, stopLoss: monitored.stopLossPrice, takeProfit: monitored.takeProfitPrice },
      'Position added to SL/TP monitor'
    );

    return true;
  }

  /**
   * Remove a position from monitoring
   */
  removePosition(positionId: string): boolean {
    return this.monitoredPositions.delete(positionId);
  }

  /**
   * Update SL/TP levels for a position
   */
  updateLevels(positionId: string, config: Partial<SLTPConfig>): boolean {
    const monitored = this.monitoredPositions.get(positionId);
    if (!monitored) return false;

    if (config.stopLossPercent !== undefined) {
      monitored.stopLossPrice = config.stopLossPercent
        ? monitored.entryPrice * (1 - config.stopLossPercent / 100)
        : undefined;
    }

    if (config.takeProfitPercent !== undefined) {
      monitored.takeProfitPrice = config.takeProfitPercent
        ? monitored.entryPrice * (1 + config.takeProfitPercent / 100)
        : undefined;
    }

    if (config.trailingStopPercent !== undefined) {
      monitored.trailingStopPercent = config.trailingStopPercent;
      if (config.trailingStopPercent) {
        monitored.trailingStopPrice = monitored.highestPrice * (1 - config.trailingStopPercent / 100);
      } else {
        monitored.trailingStopPrice = undefined;
      }
    }

    return true;
  }

  /**
   * Check all monitored positions
   */
  private async checkAllPositions(): Promise<void> {
    if (!this.isRunning) return;

    for (const [positionId, monitored] of this.monitoredPositions) {
      try {
        await this.checkPosition(positionId, monitored);
      } catch (error) {
        logger.error({ error, positionId }, 'Error checking position SL/TP');
      }
    }
  }

  /**
   * Check a single position for SL/TP triggers
   */
  private async checkPosition(positionId: string, monitored: MonitoredPosition): Promise<void> {
    // Get current price
    let currentPrice: number;
    try {
      const priceInfo = await clobClientService.getPrice(monitored.tokenId);
      currentPrice = priceInfo.bid; // Use bid for selling
    } catch (error) {
      logger.debug({ error, positionId }, 'Failed to get price for SL/TP check');
      return;
    }

    // Update trailing stop if price made new high
    if (monitored.trailingStopPercent && currentPrice > monitored.highestPrice) {
      monitored.highestPrice = currentPrice;
      monitored.trailingStopPrice = currentPrice * (1 - monitored.trailingStopPercent / 100);
    }

    const pnlPercent = ((currentPrice - monitored.entryPrice) / monitored.entryPrice) * 100;

    // Check stop loss
    if (monitored.stopLossPrice && currentPrice <= monitored.stopLossPrice) {
      await this.triggerClose(monitored, 'STOP_LOSS', currentPrice, pnlPercent);
      return;
    }

    // Check trailing stop
    if (monitored.trailingStopPrice && currentPrice <= monitored.trailingStopPrice) {
      await this.triggerClose(monitored, 'TRAILING_STOP', currentPrice, pnlPercent);
      return;
    }

    // Check take profit
    if (monitored.takeProfitPrice && currentPrice >= monitored.takeProfitPrice) {
      await this.triggerClose(monitored, 'TAKE_PROFIT', currentPrice, pnlPercent);
      return;
    }
  }

  /**
   * Trigger position close
   */
  private async triggerClose(
    monitored: MonitoredPosition,
    type: SLTPTrigger['type'],
    currentPrice: number,
    pnlPercent: number
  ): Promise<void> {
    const trigger: SLTPTrigger = {
      positionId: monitored.positionId,
      traderId: monitored.traderId,
      type,
      triggerPrice: type === 'STOP_LOSS'
        ? monitored.stopLossPrice!
        : type === 'TRAILING_STOP'
        ? monitored.trailingStopPrice!
        : monitored.takeProfitPrice!,
      currentPrice,
      entryPrice: monitored.entryPrice,
      pnlPercent,
      shares: monitored.shares,
    };

    logger.info({ trigger }, `${type} triggered`);

    // Remove from monitoring first
    this.monitoredPositions.delete(monitored.positionId);

    // Emit event
    this.emit('trigger', trigger);

    // Execute sell order
    try {
      const result = await tradeExecutorService.execute({
        traderId: monitored.traderId,
        marketId: monitored.marketId,
        tokenId: monitored.tokenId,
        outcome: monitored.outcome,
        side: 'SELL',
        amount: monitored.shares * currentPrice,
        orderType: 'MARKET',
        isSourceTrade: false,
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          level: 'INFO',
          category: 'risk',
          message: `${type} executed: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`,
          traderId: monitored.traderId,
          tradeId: result.tradeId,
          metadata: {
            type,
            entryPrice: monitored.entryPrice,
            exitPrice: currentPrice,
            pnlPercent,
            shares: monitored.shares,
          },
        },
      });

      // Broadcast via WebSocket
      this.broadcastTrigger(trigger, result.success);

      if (result.success) {
        logger.info({ positionId: monitored.positionId, type, pnlPercent }, 'SL/TP close executed');
      } else {
        logger.error({ positionId: monitored.positionId, error: result.error }, 'SL/TP close failed');
      }
    } catch (error) {
      logger.error({ error, positionId: monitored.positionId }, 'Failed to execute SL/TP close');
    }
  }

  /**
   * Broadcast trigger event via WebSocket
   */
  private broadcastTrigger(trigger: SLTPTrigger, success: boolean): void {
    try {
      const event = { ...trigger, success };
      io.to(`trader:${trigger.traderId}`).emit('risk:sltp', event as never);
      io.to('all').emit('risk:sltp', event as never);
    } catch (error) {
      logger.debug({ error }, 'Failed to broadcast SL/TP trigger');
    }
  }

  /**
   * Get all monitored positions
   */
  getMonitoredPositions(): MonitoredPosition[] {
    return Array.from(this.monitoredPositions.values());
  }

  /**
   * Get status
   */
  getStatus(): { isRunning: boolean; positionCount: number } {
    return {
      isRunning: this.isRunning,
      positionCount: this.monitoredPositions.size,
    };
  }
}

// Singleton instance
export const stopLossTakeProfitService = new StopLossTakeProfitService();
