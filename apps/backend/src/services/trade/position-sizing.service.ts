// Position Sizing Service
// Calculates appropriate trade sizes based on trader settings and risk parameters

import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { walletService } from '../wallet/wallet.service.js';
import { clobClientService } from '../polymarket/clob-client.service.js';
import { calculatePositionSize, calculateCopySize } from '@polymarket-bot/shared';

export interface SizingParams {
  traderId: string;
  sourceTradeSize: number;
  tokenId: string;
  side: 'BUY' | 'SELL';
}

export interface SizingResult {
  recommendedSize: number;
  adjustedSize: number;
  reasons: string[];
  canExecute: boolean;
  estimatedSlippage: number;
}

export class PositionSizingService {
  /**
   * Calculate the optimal position size for a copy trade
   */
  async calculateSize(params: SizingParams): Promise<SizingResult> {
    const { traderId, sourceTradeSize, tokenId, side } = params;
    const reasons: string[] = [];

    // Get trader settings
    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
    });

    if (!trader) {
      return {
        recommendedSize: 0,
        adjustedSize: 0,
        reasons: ['Trader not found'],
        canExecute: false,
        estimatedSlippage: 0,
      };
    }

    // Get available balance
    let availableBalance = 0;
    try {
      availableBalance = await walletService.getBalance();
    } catch (error) {
      logger.warn({ error }, 'Failed to get wallet balance');
      return {
        recommendedSize: 0,
        adjustedSize: 0,
        reasons: ['Failed to get wallet balance'],
        canExecute: false,
        estimatedSlippage: 0,
      };
    }

    // Calculate base size from allocation percentage
    const allocationSize = calculatePositionSize(
      availableBalance,
      trader.allocationPercent,
      trader.maxPositionSize || undefined
    );

    // Calculate copy size based on source trade
    const copySize = calculateCopySize(
      sourceTradeSize,
      100, // Copy 100% of the calculated allocation
      trader.maxPositionSize || undefined
    );

    // Use the smaller of allocation-based or source-proportional size
    let recommendedSize = Math.min(allocationSize, copySize);

    // Apply minimum trade amount
    if (recommendedSize < trader.minTradeAmount) {
      if (recommendedSize > 0) {
        reasons.push(`Size ${recommendedSize.toFixed(2)} below minimum ${trader.minTradeAmount}`);
      }
      recommendedSize = 0;
    }

    // Check against max position size
    if (trader.maxPositionSize && recommendedSize > trader.maxPositionSize) {
      reasons.push(`Capped at max position size ${trader.maxPositionSize}`);
      recommendedSize = trader.maxPositionSize;
    }

    // Check available balance
    if (recommendedSize > availableBalance) {
      reasons.push(`Reduced due to available balance ${availableBalance.toFixed(2)}`);
      recommendedSize = Math.max(0, availableBalance - 1); // Keep $1 buffer
    }

    // Estimate slippage
    let estimatedSlippage = 0;
    try {
      estimatedSlippage = await clobClientService.estimateSlippage(
        tokenId,
        side,
        recommendedSize
      );
    } catch (error) {
      logger.warn({ error }, 'Failed to estimate slippage');
    }

    // Check slippage tolerance
    const slippagePercent = estimatedSlippage * 100;
    let adjustedSize = recommendedSize;

    if (slippagePercent > trader.slippageTolerance) {
      // Reduce size to stay within slippage tolerance
      const reductionFactor = trader.slippageTolerance / slippagePercent;
      adjustedSize = recommendedSize * reductionFactor;
      reasons.push(
        `Reduced from ${recommendedSize.toFixed(2)} to ${adjustedSize.toFixed(2)} due to slippage`
      );
    }

    // Final validation
    const canExecute =
      adjustedSize >= trader.minTradeAmount && adjustedSize <= availableBalance;

    if (!canExecute && adjustedSize > 0) {
      reasons.push('Final size validation failed');
    }

    logger.debug(
      {
        traderId,
        sourceTradeSize,
        availableBalance,
        allocationSize,
        copySize,
        recommendedSize,
        adjustedSize,
        estimatedSlippage,
        canExecute,
      },
      'Position size calculated'
    );

    return {
      recommendedSize,
      adjustedSize,
      reasons,
      canExecute,
      estimatedSlippage,
    };
  }

  /**
   * Check if we have existing position in this market
   */
  async getExistingPosition(traderId: string, marketId: string, tokenId: string) {
    return prisma.position.findFirst({
      where: {
        traderId,
        marketId,
        tokenId,
        status: 'OPEN',
      },
    });
  }

  /**
   * Calculate size for increasing existing position
   */
  async calculateIncreaseSize(
    traderId: string,
    existingShares: number,
    additionalAmount: number
  ): Promise<number> {
    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
    });

    if (!trader || !trader.maxPositionSize) {
      return additionalAmount;
    }

    // Get current position value
    const currentValue = existingShares; // Simplified - should multiply by price

    // Calculate remaining capacity
    const remainingCapacity = trader.maxPositionSize - currentValue;

    return Math.min(additionalAmount, Math.max(0, remainingCapacity));
  }

  /**
   * Calculate size for decreasing position (selling)
   */
  async calculateDecreaseSize(
    traderId: string,
    tokenId: string,
    requestedShares: number
  ): Promise<number> {
    // Get our current position
    const position = await prisma.position.findFirst({
      where: {
        traderId,
        tokenId,
        status: 'OPEN',
      },
    });

    if (!position) {
      return 0; // No position to sell
    }

    // Can only sell what we have
    return Math.min(requestedShares, position.shares);
  }
}

// Singleton instance
export const positionSizingService = new PositionSizingService();
