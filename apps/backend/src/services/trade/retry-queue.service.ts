// Retry Queue Service
// Handles automatic retry of failed trades with exponential backoff

import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { tradeExecutorService } from './trade-executor.service.js';

interface RetryJob {
  tradeId: string;
  attempt: number;
  nextRetryAt: Date;
  timeoutId?: NodeJS.Timeout;
}

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 5000, // 5 seconds
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
};

export class RetryQueueService {
  private queue: Map<string, RetryJob> = new Map();
  private config: RetryConfig;
  private isRunning: boolean = false;
  private checkIntervalId?: NodeJS.Timeout;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the retry queue processor
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Check for failed trades that need retry on startup
    this.loadPendingRetries();

    // Periodic check for stale retries
    this.checkIntervalId = setInterval(
      () => this.checkStaleRetries(),
      60000 // Check every minute
    );

    logger.info('Retry queue service started');
  }

  /**
   * Stop the retry queue processor
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Clear all pending timeouts
    for (const job of this.queue.values()) {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
    }
    this.queue.clear();

    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    logger.info('Retry queue service stopped');
  }

  /**
   * Add a failed trade to the retry queue
   */
  async scheduleRetry(tradeId: string): Promise<boolean> {
    if (!this.isRunning) {
      logger.warn({ tradeId }, 'Retry queue not running, cannot schedule');
      return false;
    }

    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      logger.warn({ tradeId }, 'Trade not found for retry');
      return false;
    }

    if (trade.status !== 'FAILED') {
      logger.debug({ tradeId, status: trade.status }, 'Trade not in FAILED state');
      return false;
    }

    const attempt = trade.retryCount + 1;
    if (attempt > this.config.maxAttempts) {
      logger.info({ tradeId, attempts: attempt }, 'Max retry attempts reached');
      await this.markPermanentlyFailed(tradeId);
      return false;
    }

    // Calculate delay with exponential backoff
    const delay = this.calculateDelay(attempt);
    const nextRetryAt = new Date(Date.now() + delay);

    const job: RetryJob = {
      tradeId,
      attempt,
      nextRetryAt,
    };

    // Schedule the retry
    job.timeoutId = setTimeout(
      () => this.executeRetry(tradeId),
      delay
    );

    this.queue.set(tradeId, job);

    logger.info(
      { tradeId, attempt, delayMs: delay, nextRetryAt },
      'Scheduled trade retry'
    );

    // Update trade with next retry time
    await prisma.trade.update({
      where: { id: tradeId },
      data: {
        nextRetryAt,
      },
    });

    return true;
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Execute a retry
   */
  private async executeRetry(tradeId: string): Promise<void> {
    const job = this.queue.get(tradeId);
    if (!job) return;

    this.queue.delete(tradeId);

    logger.info({ tradeId, attempt: job.attempt }, 'Executing trade retry');

    try {
      const result = await tradeExecutorService.retryTrade(tradeId);

      if (result.success) {
        logger.info({ tradeId }, 'Trade retry successful');

        await prisma.activityLog.create({
          data: {
            level: 'INFO',
            category: 'trade',
            message: `Trade retry successful on attempt ${job.attempt}`,
            tradeId,
            metadata: {
              attempt: job.attempt,
              executedAmount: result.executedAmount,
            },
          },
        });
      } else {
        logger.warn({ tradeId, error: result.error }, 'Trade retry failed');

        // Schedule next retry if within limits
        if (job.attempt < this.config.maxAttempts) {
          await this.scheduleRetry(tradeId);
        } else {
          await this.markPermanentlyFailed(tradeId);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ tradeId, error: errorMessage }, 'Trade retry threw exception');

      // Schedule next retry
      if (job.attempt < this.config.maxAttempts) {
        await this.scheduleRetry(tradeId);
      } else {
        await this.markPermanentlyFailed(tradeId);
      }
    }
  }

  /**
   * Mark a trade as permanently failed
   */
  private async markPermanentlyFailed(tradeId: string): Promise<void> {
    await prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'PERMANENTLY_FAILED',
        failureReason: 'Max retry attempts exceeded',
      },
    });

    await prisma.activityLog.create({
      data: {
        level: 'ERROR',
        category: 'trade',
        message: 'Trade permanently failed after max retries',
        tradeId,
        metadata: {
          maxAttempts: this.config.maxAttempts,
        },
      },
    });

    logger.error({ tradeId }, 'Trade permanently failed');
  }

  /**
   * Load pending retries from database on startup
   */
  private async loadPendingRetries(): Promise<void> {
    try {
      const failedTrades = await prisma.trade.findMany({
        where: {
          status: 'FAILED',
          retryCount: { lt: this.config.maxAttempts },
        },
        orderBy: { createdAt: 'asc' },
        take: 100, // Limit to prevent overwhelming
      });

      for (const trade of failedTrades) {
        await this.scheduleRetry(trade.id);
      }

      logger.info(
        { count: failedTrades.length },
        'Loaded pending retries from database'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to load pending retries');
    }
  }

  /**
   * Check for stale retries that may have been missed
   */
  private async checkStaleRetries(): Promise<void> {
    try {
      const staleRetries = await prisma.trade.findMany({
        where: {
          status: 'FAILED',
          retryCount: { lt: this.config.maxAttempts },
          nextRetryAt: { lt: new Date() },
        },
        take: 10,
      });

      for (const trade of staleRetries) {
        if (!this.queue.has(trade.id)) {
          logger.info({ tradeId: trade.id }, 'Found stale retry, rescheduling');
          await this.scheduleRetry(trade.id);
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to check stale retries');
    }
  }

  /**
   * Cancel a scheduled retry
   */
  cancelRetry(tradeId: string): boolean {
    const job = this.queue.get(tradeId);
    if (!job) return false;

    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }
    this.queue.delete(tradeId);

    logger.info({ tradeId }, 'Retry cancelled');
    return true;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    isRunning: boolean;
    queueSize: number;
    pendingRetries: Array<{ tradeId: string; attempt: number; nextRetryAt: Date }>;
  } {
    return {
      isRunning: this.isRunning,
      queueSize: this.queue.size,
      pendingRetries: Array.from(this.queue.values()).map((job) => ({
        tradeId: job.tradeId,
        attempt: job.attempt,
        nextRetryAt: job.nextRetryAt,
      })),
    };
  }
}

// Singleton instance
export const retryQueueService = new RetryQueueService();
