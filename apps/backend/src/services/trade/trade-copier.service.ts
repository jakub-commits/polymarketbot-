// Trade Copier Service
// Listens to trader position changes and executes copy trades

import { EventEmitter } from 'events';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { traderMonitorService } from '../trader/trader-monitor.service.js';
import { positionSizingService } from './position-sizing.service.js';
import { tradeExecutorService, ExecutionResult } from './trade-executor.service.js';
import { retryQueueService } from './retry-queue.service.js';
import { marketDataService } from '../polymarket/market-data.service.js';
import type { PositionChange } from '@polymarket-bot/shared';

export interface CopyTradeResult {
  success: boolean;
  traderId: string;
  sourceTradeId?: string;
  copiedTradeId?: string;
  executionResult?: ExecutionResult;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

export interface CopierStats {
  totalCopied: number;
  successfulCopies: number;
  failedCopies: number;
  skippedCopies: number;
  totalVolume: number;
}

export class TradeCopierService extends EventEmitter {
  private isRunning: boolean = false;
  private stats: CopierStats = {
    totalCopied: 0,
    successfulCopies: 0,
    failedCopies: 0,
    skippedCopies: 0,
    totalVolume: 0,
  };
  private processingQueue: Map<string, Promise<void>> = new Map();

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for position changes
   */
  private setupEventListeners(): void {
    traderMonitorService.on('position:change', this.handlePositionChange.bind(this));
    traderMonitorService.on('position:new', this.handleNewPosition.bind(this));
    traderMonitorService.on('position:closed', this.handleClosedPosition.bind(this));
  }

  /**
   * Start the copy trading service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Trade copier already running');
      return;
    }

    this.isRunning = true;
    logger.info('Trade copier service started');
    this.emit('started');
  }

  /**
   * Stop the copy trading service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Trade copier service stopped');
    this.emit('stopped');
  }

  /**
   * Check if copy trading is enabled for a trader
   */
  private async isCopyingEnabled(traderId: string): Promise<boolean> {
    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
      select: { status: true },
    });

    return trader?.status === 'ACTIVE';
  }

  /**
   * Handle position change events (increase/decrease)
   */
  private async handlePositionChange(change: PositionChange): Promise<void> {
    if (!this.isRunning) return;

    const { traderId, tokenId } = change;

    // Prevent duplicate processing
    const queueKey = `${traderId}:${tokenId}:${Date.now()}`;
    if (this.processingQueue.has(queueKey)) {
      return;
    }

    const processPromise = this.processPositionChange(change).then(() => {});
    this.processingQueue.set(queueKey, processPromise);

    try {
      await processPromise;
    } finally {
      this.processingQueue.delete(queueKey);
    }
  }

  /**
   * Process a position change and execute copy trade if appropriate
   */
  private async processPositionChange(change: PositionChange): Promise<CopyTradeResult> {
    const { traderId, tokenId, marketId, type, delta, price, outcome } = change;

    logger.info(
      { traderId, tokenId, type, delta, price },
      'Processing position change for copy'
    );

    // Check if copying is enabled
    if (!(await this.isCopyingEnabled(traderId))) {
      return this.createSkipResult(traderId, 'Copying not enabled for trader');
    }

    // Get trader settings
    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
    });

    if (!trader) {
      return this.createSkipResult(traderId, 'Trader not found');
    }

    // Determine trade side based on change type
    const side = (type === 'NEW' || type === 'INCREASED') ? 'BUY' : 'SELL';
    const sourceTradeSize = delta * price;

    // Calculate appropriate position size
    const sizing = await positionSizingService.calculateSize({
      traderId,
      sourceTradeSize,
      tokenId,
      side,
    });

    if (!sizing.canExecute) {
      const reason = sizing.reasons.join('; ') || 'Position sizing check failed';
      return this.createSkipResult(traderId, reason);
    }

    // Check for existing position if selling
    if (side === 'SELL') {
      const existingPosition = await positionSizingService.getExistingPosition(
        traderId,
        marketId,
        tokenId
      );

      if (!existingPosition || existingPosition.shares <= 0) {
        return this.createSkipResult(traderId, 'No position to sell');
      }

      // Adjust size based on what we actually have
      const adjustedShares = await positionSizingService.calculateDecreaseSize(
        traderId,
        tokenId,
        delta
      );

      if (adjustedShares <= 0) {
        return this.createSkipResult(traderId, 'No shares available to sell');
      }
    }

    // Get market info for outcome
    const market = await marketDataService.getMarket(marketId);
    const outcomeToUse = outcome || market?.outcomes?.[0] || 'Yes';

    // Execute the copy trade
    try {
      const executionResult = await tradeExecutorService.execute({
        traderId,
        marketId,
        tokenId,
        outcome: outcomeToUse,
        side,
        amount: sizing.adjustedSize,
        orderType: 'MARKET',
        isSourceTrade: false,
        sourceTraderId: traderId,
      });

      // Update stats
      this.stats.totalCopied++;
      if (executionResult.success) {
        this.stats.successfulCopies++;
        this.stats.totalVolume += executionResult.executedAmount || 0;
      } else {
        this.stats.failedCopies++;
        // Schedule retry for failed trade
        if (executionResult.tradeId) {
          retryQueueService.scheduleRetry(executionResult.tradeId);
        }
      }

      // Log activity
      await this.logCopyActivity(traderId, executionResult, sizing);

      // Emit event
      this.emit('trade:copied', {
        traderId,
        change,
        result: executionResult,
      });

      return {
        success: executionResult.success,
        traderId,
        copiedTradeId: executionResult.tradeId,
        executionResult,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, traderId, tokenId }, 'Copy trade execution failed');

      this.stats.totalCopied++;
      this.stats.failedCopies++;

      return {
        success: false,
        traderId,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle new position events
   */
  private async handleNewPosition(change: PositionChange): Promise<void> {
    // New positions are handled the same as increase
    await this.handlePositionChange({
      ...change,
      type: 'NEW',
    });
  }

  /**
   * Handle closed position events
   */
  private async handleClosedPosition(change: PositionChange): Promise<void> {
    // Closed positions are handled as decrease with full shares
    await this.handlePositionChange({
      ...change,
      type: 'CLOSED',
    });
  }

  /**
   * Create a skip result
   */
  private createSkipResult(traderId: string, reason: string): CopyTradeResult {
    logger.debug({ traderId, reason }, 'Skipping copy trade');
    this.stats.skippedCopies++;

    return {
      success: false,
      traderId,
      skipped: true,
      skipReason: reason,
    };
  }

  /**
   * Log copy activity to database
   */
  private async logCopyActivity(
    traderId: string,
    result: ExecutionResult,
    sizing: { recommendedSize: number; adjustedSize: number; reasons: string[] }
  ): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          level: result.success ? 'INFO' : 'WARN',
          category: 'trade',
          message: result.success
            ? `Copied trade executed: ${sizing.adjustedSize.toFixed(2)} USDC`
            : `Copy trade failed: ${result.error}`,
          traderId,
          tradeId: result.tradeId,
          metadata: {
            recommendedSize: sizing.recommendedSize,
            adjustedSize: sizing.adjustedSize,
            sizingReasons: sizing.reasons,
            executedAmount: result.executedAmount,
            avgPrice: result.avgPrice,
            slippage: result.slippage,
          },
        },
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to log copy activity');
    }
  }

  /**
   * Manually trigger a copy trade
   */
  async manualCopy(
    traderId: string,
    tokenId: string,
    side: 'BUY' | 'SELL',
    amount: number
  ): Promise<CopyTradeResult> {
    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
    });

    if (!trader) {
      return this.createSkipResult(traderId, 'Trader not found');
    }

    // Get market info
    const position = await prisma.position.findFirst({
      where: { traderId, tokenId },
      include: { market: true },
    });

    const marketId = position?.marketId || '';
    const outcome = position?.outcome || 'Yes';

    try {
      const executionResult = await tradeExecutorService.execute({
        traderId,
        marketId,
        tokenId,
        outcome,
        side,
        amount,
        orderType: 'MARKET',
        isSourceTrade: false,
      });

      return {
        success: executionResult.success,
        traderId,
        copiedTradeId: executionResult.tradeId,
        executionResult,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        traderId,
        error: errorMessage,
      };
    }
  }

  /**
   * Get copier statistics
   */
  getStats(): CopierStats {
    return { ...this.stats };
  }

  /**
   * Reset copier statistics
   */
  resetStats(): void {
    this.stats = {
      totalCopied: 0,
      successfulCopies: 0,
      failedCopies: 0,
      skippedCopies: 0,
      totalVolume: 0,
    };
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const tradeCopierService = new TradeCopierService();
