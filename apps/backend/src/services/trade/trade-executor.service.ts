// Trade Executor Service
// Handles the actual execution of trades on Polymarket

import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { clobClientService } from '../polymarket/clob-client.service.js';
import { marketDataService } from '../polymarket/market-data.service.js';
import { riskManagerService } from '../risk/risk-manager.service.js';
import { io } from '../../server.js';
import { AppError, ERROR_CODES } from '@polymarket-bot/shared';
import type { TradeSide, OrderType, TradeResult } from '@polymarket-bot/shared';

export interface ExecuteOrderParams {
  traderId: string;
  marketId: string;
  tokenId: string;
  outcome: string;
  side: TradeSide;
  amount: number;
  orderType?: OrderType;
  limitPrice?: number;
  isSourceTrade?: boolean;
  sourceTraderId?: string;
  copiedFromId?: string;
}

export interface ExecutionResult {
  success: boolean;
  tradeId: string;
  orderId?: string;
  executedAmount?: number;
  avgPrice?: number;
  shares?: number;
  fee?: number;
  slippage?: number;
  error?: string;
}

export class TradeExecutorService {
  /**
   * Execute a trade on Polymarket
   */
  async execute(params: ExecuteOrderParams): Promise<ExecutionResult> {
    const {
      traderId,
      marketId,
      tokenId,
      outcome,
      side,
      amount,
      orderType = 'MARKET',
      limitPrice,
      isSourceTrade = false,
      sourceTraderId,
      copiedFromId,
    } = params;

    // Perform risk check before trade
    const riskCheck = await riskManagerService.checkTradeRisk({
      traderId,
      marketId,
      tokenId,
      side,
      amount,
    });

    if (!riskCheck.approved) {
      logger.warn(
        { traderId, tokenId, reason: riskCheck.rejectionReason },
        'Trade rejected by risk manager'
      );

      // Create rejected trade record for audit
      const rejectedTrade = await prisma.trade.create({
        data: {
          traderId,
          marketId,
          tokenId,
          outcome,
          side,
          orderType,
          status: 'CANCELLED',
          requestedAmount: amount,
          price: 0,
          failureReason: `Risk check failed: ${riskCheck.rejectionReason}`,
          isSourceTrade,
          sourceTraderId,
          copiedFromId,
        },
      });

      return {
        success: false,
        tradeId: rejectedTrade.id,
        error: riskCheck.rejectionReason,
      };
    }

    // Use adjusted amount if risk manager reduced it
    const finalAmount = riskCheck.adjustedAmount || amount;

    // Log warnings if any
    if (riskCheck.warnings.length > 0) {
      logger.info({ traderId, warnings: riskCheck.warnings }, 'Trade approved with warnings');
    }

    // Create trade record in PENDING state
    const trade = await prisma.trade.create({
      data: {
        traderId,
        marketId,
        tokenId,
        outcome,
        side,
        orderType,
        status: 'PENDING',
        requestedAmount: finalAmount,
        price: limitPrice || 0,
        isSourceTrade,
        sourceTraderId,
        copiedFromId,
      },
    });

    logger.info(
      { tradeId: trade.id, traderId, side, amount, tokenId },
      'Executing trade'
    );

    try {
      // Check if CLOB client is connected
      if (!clobClientService.isConnected()) {
        throw new AppError(
          ERROR_CODES.WALLET_NOT_CONFIGURED,
          'Trading client not connected'
        );
      }

      // Get current price for slippage calculation
      const priceInfo = await clobClientService.getPrice(tokenId);
      const expectedPrice = side === 'BUY' ? priceInfo.ask : priceInfo.bid;

      // Execute the order
      let orderResult;
      if (orderType === 'LIMIT' && limitPrice) {
        orderResult = await clobClientService.createLimitOrder(
          tokenId,
          side,
          finalAmount / limitPrice, // Convert amount to shares
          limitPrice
        );
      } else {
        orderResult = await clobClientService.createMarketOrder(
          tokenId,
          side,
          finalAmount
        );
      }

      // Calculate actual slippage
      const actualSlippage = orderResult.avgFillPrice
        ? Math.abs(orderResult.avgFillPrice - expectedPrice) / expectedPrice
        : undefined;

      // Update trade record
      const updatedTrade = await prisma.trade.update({
        where: { id: trade.id },
        data: {
          orderId: orderResult.orderId,
          status: orderResult.status === 'filled' ? 'EXECUTED' : 'PARTIALLY_FILLED',
          executedAmount: orderResult.filledSize
            ? orderResult.filledSize * (orderResult.avgFillPrice || expectedPrice)
            : undefined,
          avgFillPrice: orderResult.avgFillPrice,
          shares: orderResult.filledSize,
          slippage: actualSlippage ? actualSlippage * 100 : undefined,
          executedAt: new Date(),
        },
      });

      // Update position
      await this.updatePosition(params, orderResult);

      // Update trader stats
      await this.updateTraderStats(traderId);

      // Broadcast trade event
      this.broadcastTradeEvent(updatedTrade);

      logger.info(
        {
          tradeId: trade.id,
          orderId: orderResult.orderId,
          executedAmount: orderResult.filledSize,
          avgPrice: orderResult.avgFillPrice,
        },
        'Trade executed successfully'
      );

      return {
        success: true,
        tradeId: trade.id,
        orderId: orderResult.orderId,
        executedAmount: orderResult.filledSize
          ? orderResult.filledSize * (orderResult.avgFillPrice || expectedPrice)
          : undefined,
        avgPrice: orderResult.avgFillPrice,
        shares: orderResult.filledSize,
        slippage: actualSlippage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update trade as failed
      await prisma.trade.update({
        where: { id: trade.id },
        data: {
          status: 'FAILED',
          failureReason: errorMessage,
          retryCount: trade.retryCount + 1,
        },
      });

      logger.error(
        { tradeId: trade.id, error: errorMessage },
        'Trade execution failed'
      );

      // Log activity
      await prisma.activityLog.create({
        data: {
          level: 'ERROR',
          category: 'trade',
          message: `Trade execution failed: ${errorMessage}`,
          traderId,
          tradeId: trade.id,
          marketId,
          metadata: { tokenId, side, amount },
        },
      });

      return {
        success: false,
        tradeId: trade.id,
        error: errorMessage,
      };
    }
  }

  /**
   * Update position after trade execution
   */
  private async updatePosition(
    params: ExecuteOrderParams,
    orderResult: { filledSize?: number; avgFillPrice?: number }
  ): Promise<void> {
    const { traderId, marketId, tokenId, outcome, side } = params;
    const shares = orderResult.filledSize || 0;
    const price = orderResult.avgFillPrice || 0;

    if (shares === 0) return;

    const existingPosition = await prisma.position.findFirst({
      where: { traderId, marketId, tokenId },
    });

    if (side === 'BUY') {
      if (existingPosition) {
        // Increase existing position
        const newShares = existingPosition.shares + shares;
        const newAvgPrice =
          (existingPosition.shares * existingPosition.avgEntryPrice + shares * price) /
          newShares;

        await prisma.position.update({
          where: { id: existingPosition.id },
          data: {
            shares: newShares,
            avgEntryPrice: newAvgPrice,
            totalCost: existingPosition.totalCost + shares * price,
            status: 'OPEN',
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new position
        await prisma.position.create({
          data: {
            traderId,
            marketId,
            tokenId,
            outcome,
            side: 'BUY',
            shares,
            avgEntryPrice: price,
            totalCost: shares * price,
            status: 'OPEN',
          },
        });
      }
    } else {
      // SELL - decrease or close position
      if (existingPosition) {
        const remainingShares = existingPosition.shares - shares;
        const realizedPnl =
          shares * (price - existingPosition.avgEntryPrice);

        if (remainingShares <= 0) {
          // Close position
          await prisma.position.update({
            where: { id: existingPosition.id },
            data: {
              shares: 0,
              realizedPnl: existingPosition.realizedPnl + realizedPnl,
              exitPrice: price,
              exitShares: shares,
              status: 'CLOSED',
              closedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        } else {
          // Reduce position
          await prisma.position.update({
            where: { id: existingPosition.id },
            data: {
              shares: remainingShares,
              realizedPnl: existingPosition.realizedPnl + realizedPnl,
              updatedAt: new Date(),
            },
          });
        }
      }
    }
  }

  /**
   * Update trader statistics after trade
   */
  private async updateTraderStats(traderId: string): Promise<void> {
    const trades = await prisma.trade.findMany({
      where: { traderId, status: 'EXECUTED' },
    });

    const totalTrades = trades.length;
    const profitableTrades = trades.filter(
      (t) => (t.executedAmount || 0) > t.requestedAmount
    ).length;
    const winRate = totalTrades > 0 ? profitableTrades / totalTrades : 0;

    await prisma.trader.update({
      where: { id: traderId },
      data: {
        totalTrades,
        profitableTrades,
        winRate,
        lastTradeAt: new Date(),
      },
    });
  }

  /**
   * Broadcast trade event via WebSocket
   */
  private broadcastTradeEvent(trade: {
    id: string;
    traderId: string;
    status: string;
  }): void {
    try {
      io.to(`trader:${trade.traderId}`).emit('trade:new', trade as never);
      io.to('all').emit('trade:new', trade as never);
    } catch (error) {
      logger.debug({ error }, 'Failed to broadcast trade event');
    }
  }

  /**
   * Retry a failed trade
   */
  async retryTrade(tradeId: string): Promise<ExecutionResult> {
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: { market: true },
    });

    if (!trade) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Trade not found');
    }

    if (trade.status !== 'FAILED') {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Only failed trades can be retried'
      );
    }

    if (trade.retryCount >= 3) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Maximum retry attempts reached'
      );
    }

    return this.execute({
      traderId: trade.traderId,
      marketId: trade.marketId,
      tokenId: trade.tokenId,
      outcome: trade.outcome,
      side: trade.side as TradeSide,
      amount: trade.requestedAmount,
      orderType: trade.orderType as OrderType,
      isSourceTrade: trade.isSourceTrade,
      sourceTraderId: trade.sourceTraderId || undefined,
      copiedFromId: trade.copiedFromId || undefined,
    });
  }
}

// Singleton instance
export const tradeExecutorService = new TradeExecutorService();
