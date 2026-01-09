// Risk Manager Service
// Pre-trade risk checks and validation

import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { walletService } from '../wallet/wallet.service.js';
import { clobClientService } from '../polymarket/clob-client.service.js';

export interface RiskCheckParams {
  traderId: string;
  marketId: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  amount: number;
  estimatedPrice?: number;
}

export interface RiskCheckResult {
  approved: boolean;
  adjustedAmount?: number;
  warnings: string[];
  rejectionReason?: string;
  riskMetrics: {
    currentDrawdown: number;
    dailyPnl: number;
    openPositionValue: number;
    availableBalance: number;
    estimatedSlippage: number;
  };
}

export interface RiskLimits {
  maxPositionSize: number;
  maxDrawdownPercent: number;
  dailyLossLimit: number;
  maxOpenPositions: number;
  maxSlippagePercent: number;
  minTradeAmount: number;
}

const DEFAULT_LIMITS: RiskLimits = {
  maxPositionSize: 1000,
  maxDrawdownPercent: 20,
  dailyLossLimit: 500,
  maxOpenPositions: 10,
  maxSlippagePercent: 5,
  minTradeAmount: 1,
};

export class RiskManagerService {
  private globalLimits: RiskLimits = DEFAULT_LIMITS;

  /**
   * Perform comprehensive pre-trade risk checks
   */
  async checkTradeRisk(params: RiskCheckParams): Promise<RiskCheckResult> {
    const { traderId, marketId, tokenId, side, amount } = params;
    const warnings: string[] = [];

    logger.debug({ traderId, tokenId, side, amount }, 'Performing risk check');

    // Get trader settings
    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
    });

    if (!trader) {
      return this.createRejection('Trader not found', this.getEmptyMetrics());
    }

    // Get trader-specific limits
    const limits = this.getTraderLimits(trader);

    // Calculate current risk metrics
    const metrics = await this.calculateRiskMetrics(traderId);

    // Check 1: Wallet balance
    const balanceCheck = await this.checkBalance(amount, side, metrics.availableBalance);
    if (!balanceCheck.passed) {
      return this.createRejection(balanceCheck.reason!, metrics);
    }
    if (balanceCheck.warning) warnings.push(balanceCheck.warning);

    // Check 2: Max position size
    const positionCheck = await this.checkMaxPositionSize(
      traderId,
      marketId,
      tokenId,
      amount,
      limits.maxPositionSize
    );
    if (!positionCheck.passed) {
      return this.createRejection(positionCheck.reason!, metrics);
    }
    if (positionCheck.warning) warnings.push(positionCheck.warning);

    // Check 3: Drawdown limit
    const drawdownCheck = this.checkDrawdownLimit(
      metrics.currentDrawdown,
      limits.maxDrawdownPercent
    );
    if (!drawdownCheck.passed) {
      return this.createRejection(drawdownCheck.reason!, metrics);
    }
    if (drawdownCheck.warning) warnings.push(drawdownCheck.warning);

    // Check 4: Daily loss limit
    const dailyLossCheck = this.checkDailyLossLimit(
      metrics.dailyPnl,
      limits.dailyLossLimit
    );
    if (!dailyLossCheck.passed) {
      return this.createRejection(dailyLossCheck.reason!, metrics);
    }
    if (dailyLossCheck.warning) warnings.push(dailyLossCheck.warning);

    // Check 5: Max open positions
    const openPositionsCheck = await this.checkMaxOpenPositions(
      traderId,
      limits.maxOpenPositions
    );
    if (!openPositionsCheck.passed) {
      return this.createRejection(openPositionsCheck.reason!, metrics);
    }

    // Check 6: Slippage estimate
    const slippageCheck = await this.checkSlippage(
      tokenId,
      side,
      amount,
      limits.maxSlippagePercent
    );
    if (!slippageCheck.passed) {
      return this.createRejection(slippageCheck.reason!, metrics);
    }
    if (slippageCheck.warning) warnings.push(slippageCheck.warning);
    metrics.estimatedSlippage = slippageCheck.slippage || 0;

    // Check 7: Minimum trade amount
    if (amount < limits.minTradeAmount) {
      return this.createRejection(
        `Trade amount ${amount} below minimum ${limits.minTradeAmount}`,
        metrics
      );
    }

    // Calculate adjusted amount if needed
    let adjustedAmount = amount;
    if (positionCheck.adjustedAmount) {
      adjustedAmount = positionCheck.adjustedAmount;
      warnings.push(`Amount adjusted from ${amount} to ${adjustedAmount} due to position limit`);
    }

    logger.info(
      { traderId, approved: true, warnings, metrics },
      'Risk check passed'
    );

    return {
      approved: true,
      adjustedAmount: adjustedAmount !== amount ? adjustedAmount : undefined,
      warnings,
      riskMetrics: metrics,
    };
  }

  /**
   * Get trader-specific risk limits
   */
  private getTraderLimits(trader: {
    maxPositionSize: number | null;
    maxDrawdownPercent: number;
    minTradeAmount: number;
    slippageTolerance: number;
  }): RiskLimits {
    return {
      maxPositionSize: trader.maxPositionSize || this.globalLimits.maxPositionSize,
      maxDrawdownPercent: trader.maxDrawdownPercent || this.globalLimits.maxDrawdownPercent,
      dailyLossLimit: this.globalLimits.dailyLossLimit,
      maxOpenPositions: this.globalLimits.maxOpenPositions,
      maxSlippagePercent: trader.slippageTolerance || this.globalLimits.maxSlippagePercent,
      minTradeAmount: trader.minTradeAmount || this.globalLimits.minTradeAmount,
    };
  }

  /**
   * Calculate current risk metrics for a trader
   */
  private async calculateRiskMetrics(traderId: string): Promise<RiskCheckResult['riskMetrics']> {
    // Get available balance
    let availableBalance = 0;
    try {
      availableBalance = await walletService.getBalance();
    } catch (error) {
      logger.warn({ error }, 'Failed to get balance for risk check');
    }

    // Get open positions value
    const openPositions = await prisma.position.findMany({
      where: { traderId, status: 'OPEN' },
    });
    const openPositionValue = openPositions.reduce(
      (sum, pos) => sum + pos.shares * pos.avgEntryPrice,
      0
    );

    // Calculate daily P&L
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysTrades = await prisma.trade.findMany({
      where: {
        traderId,
        status: 'EXECUTED',
        executedAt: { gte: today },
      },
    });

    const dailyPnl = todaysTrades.reduce((sum, trade) => {
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;
      return sum + pnl;
    }, 0);

    // Calculate current drawdown
    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
      select: { peakBalance: true, totalPnl: true },
    });

    const currentBalance = availableBalance + openPositionValue;
    const peakBalance = trader?.peakBalance || currentBalance;
    const currentDrawdown = peakBalance > 0
      ? ((peakBalance - currentBalance) / peakBalance) * 100
      : 0;

    return {
      currentDrawdown: Math.max(0, currentDrawdown),
      dailyPnl,
      openPositionValue,
      availableBalance,
      estimatedSlippage: 0,
    };
  }

  /**
   * Check if sufficient balance exists
   */
  private async checkBalance(
    amount: number,
    side: 'BUY' | 'SELL',
    availableBalance: number
  ): Promise<{ passed: boolean; reason?: string; warning?: string }> {
    if (side === 'SELL') {
      return { passed: true };
    }

    const bufferAmount = 5; // Keep $5 buffer
    if (amount > availableBalance - bufferAmount) {
      if (amount > availableBalance) {
        return {
          passed: false,
          reason: `Insufficient balance: need ${amount}, have ${availableBalance.toFixed(2)}`,
        };
      }
      return {
        passed: true,
        warning: `Low balance warning: ${availableBalance.toFixed(2)} remaining after trade`,
      };
    }

    return { passed: true };
  }

  /**
   * Check max position size limit
   */
  private async checkMaxPositionSize(
    traderId: string,
    marketId: string,
    tokenId: string,
    amount: number,
    maxSize: number
  ): Promise<{ passed: boolean; reason?: string; warning?: string; adjustedAmount?: number }> {
    const existingPosition = await prisma.position.findFirst({
      where: { traderId, marketId, tokenId, status: 'OPEN' },
    });

    const currentValue = existingPosition
      ? existingPosition.shares * existingPosition.avgEntryPrice
      : 0;

    const newTotalValue = currentValue + amount;

    if (newTotalValue > maxSize) {
      const adjustedAmount = Math.max(0, maxSize - currentValue);
      if (adjustedAmount < 1) {
        return {
          passed: false,
          reason: `Position size limit reached: current ${currentValue.toFixed(2)}, max ${maxSize}`,
        };
      }
      return {
        passed: true,
        warning: `Amount reduced to stay within position limit`,
        adjustedAmount,
      };
    }

    return { passed: true };
  }

  /**
   * Check drawdown limit
   */
  private checkDrawdownLimit(
    currentDrawdown: number,
    maxDrawdown: number
  ): { passed: boolean; reason?: string; warning?: string } {
    if (currentDrawdown >= maxDrawdown) {
      return {
        passed: false,
        reason: `Max drawdown reached: ${currentDrawdown.toFixed(1)}% (limit: ${maxDrawdown}%)`,
      };
    }

    if (currentDrawdown >= maxDrawdown * 0.8) {
      return {
        passed: true,
        warning: `Approaching drawdown limit: ${currentDrawdown.toFixed(1)}% of ${maxDrawdown}%`,
      };
    }

    return { passed: true };
  }

  /**
   * Check daily loss limit
   */
  private checkDailyLossLimit(
    dailyPnl: number,
    dailyLimit: number
  ): { passed: boolean; reason?: string; warning?: string } {
    if (dailyPnl <= -dailyLimit) {
      return {
        passed: false,
        reason: `Daily loss limit reached: ${dailyPnl.toFixed(2)} (limit: -${dailyLimit})`,
      };
    }

    if (dailyPnl <= -dailyLimit * 0.8) {
      return {
        passed: true,
        warning: `Approaching daily loss limit: ${dailyPnl.toFixed(2)} of -${dailyLimit}`,
      };
    }

    return { passed: true };
  }

  /**
   * Check max open positions limit
   */
  private async checkMaxOpenPositions(
    traderId: string,
    maxPositions: number
  ): Promise<{ passed: boolean; reason?: string }> {
    const openCount = await prisma.position.count({
      where: { traderId, status: 'OPEN' },
    });

    if (openCount >= maxPositions) {
      return {
        passed: false,
        reason: `Max open positions reached: ${openCount} (limit: ${maxPositions})`,
      };
    }

    return { passed: true };
  }

  /**
   * Check estimated slippage
   */
  private async checkSlippage(
    tokenId: string,
    side: 'BUY' | 'SELL',
    amount: number,
    maxSlippage: number
  ): Promise<{ passed: boolean; reason?: string; warning?: string; slippage?: number }> {
    try {
      const slippage = await clobClientService.estimateSlippage(tokenId, side, amount);
      const slippagePercent = slippage * 100;

      if (slippagePercent > maxSlippage) {
        return {
          passed: false,
          reason: `Estimated slippage too high: ${slippagePercent.toFixed(2)}% (max: ${maxSlippage}%)`,
          slippage: slippagePercent,
        };
      }

      if (slippagePercent > maxSlippage * 0.7) {
        return {
          passed: true,
          warning: `High slippage warning: ${slippagePercent.toFixed(2)}%`,
          slippage: slippagePercent,
        };
      }

      return { passed: true, slippage: slippagePercent };
    } catch (error) {
      logger.warn({ error }, 'Failed to estimate slippage');
      return { passed: true, warning: 'Could not estimate slippage' };
    }
  }

  /**
   * Create rejection result
   */
  private createRejection(
    reason: string,
    metrics: RiskCheckResult['riskMetrics']
  ): RiskCheckResult {
    logger.warn({ reason, metrics }, 'Risk check rejected trade');

    return {
      approved: false,
      warnings: [],
      rejectionReason: reason,
      riskMetrics: metrics,
    };
  }

  /**
   * Get empty metrics for error cases
   */
  private getEmptyMetrics(): RiskCheckResult['riskMetrics'] {
    return {
      currentDrawdown: 0,
      dailyPnl: 0,
      openPositionValue: 0,
      availableBalance: 0,
      estimatedSlippage: 0,
    };
  }

  /**
   * Update global risk limits
   */
  setGlobalLimits(limits: Partial<RiskLimits>): void {
    this.globalLimits = { ...this.globalLimits, ...limits };
    logger.info({ limits: this.globalLimits }, 'Global risk limits updated');
  }

  /**
   * Get current global limits
   */
  getGlobalLimits(): RiskLimits {
    return { ...this.globalLimits };
  }
}

// Singleton instance
export const riskManagerService = new RiskManagerService();
