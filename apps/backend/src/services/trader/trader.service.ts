// Trader Service
// Business logic for managing tracked traders

import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { gammaApiService } from '../polymarket/gamma-api.service.js';
import { marketDataService } from '../polymarket/market-data.service.js';
import {
  AppError,
  ERROR_CODES,
  isValidWalletAddress,
  validateTraderSettings,
  calculateWinRate,
} from '@polymarket-bot/shared';
import type {
  CreateTraderInput,
  UpdateTraderInput,
  TraderStats,
  Trader,
} from '@polymarket-bot/shared';

export class TraderService {
  /**
   * Get all traders
   */
  async getAll(options?: {
    status?: 'ACTIVE' | 'PAUSED' | 'DISABLED';
    network?: 'MAINNET' | 'TESTNET';
    page?: number;
    limit?: number;
  }) {
    const { status, network, page = 1, limit = 20 } = options || {};
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(network && { network }),
    };

    const [traders, total] = await Promise.all([
      prisma.trader.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { trades: true, positions: true },
          },
        },
      }),
      prisma.trader.count({ where }),
    ]);

    return {
      items: traders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get trader by ID
   */
  async getById(id: string) {
    const trader = await prisma.trader.findUnique({
      where: { id },
      include: {
        positions: {
          where: { status: 'OPEN' },
          include: { market: true },
        },
        _count: {
          select: { trades: true, positions: true },
        },
      },
    });

    if (!trader) {
      throw new AppError(ERROR_CODES.TRADER_NOT_FOUND);
    }

    return trader;
  }

  /**
   * Get trader by wallet address
   */
  async getByWalletAddress(walletAddress: string) {
    return prisma.trader.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
  }

  /**
   * Create a new trader
   */
  async create(input: CreateTraderInput) {
    // Validate wallet address
    if (!isValidWalletAddress(input.walletAddress)) {
      throw new AppError(ERROR_CODES.INVALID_WALLET_ADDRESS);
    }

    // Check for duplicate
    const existing = await this.getByWalletAddress(input.walletAddress);
    if (existing) {
      throw new AppError(ERROR_CODES.TRADER_ALREADY_EXISTS);
    }

    // Validate settings
    const validation = validateTraderSettings({
      allocationPercent: input.allocationPercent,
      maxPositionSize: input.maxPositionSize,
      minTradeAmount: input.minTradeAmount,
      slippageTolerance: input.slippageTolerance,
      maxDrawdownPercent: input.maxDrawdownPercent,
      stopLossPercent: input.stopLossPercent,
      takeProfitPercent: input.takeProfitPercent,
    });

    if (!validation.valid) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, validation.errors.join(', '));
    }

    // Create trader
    const trader = await prisma.trader.create({
      data: {
        walletAddress: input.walletAddress.toLowerCase(),
        name: input.name,
        description: input.description,
        network: input.network || 'MAINNET',
        copyEnabled: input.copyEnabled ?? true,
        allocationPercent: input.allocationPercent ?? 10,
        maxPositionSize: input.maxPositionSize,
        minTradeAmount: input.minTradeAmount ?? 1,
        slippageTolerance: input.slippageTolerance ?? 2,
        maxDrawdownPercent: input.maxDrawdownPercent ?? 20,
        stopLossPercent: input.stopLossPercent,
        takeProfitPercent: input.takeProfitPercent,
      },
    });

    logger.info({ traderId: trader.id, walletAddress: trader.walletAddress }, 'Trader created');

    // Sync initial positions
    await this.syncPositions(trader.id);

    return trader;
  }

  /**
   * Update trader
   */
  async update(id: string, input: UpdateTraderInput) {
    // Check exists
    await this.getById(id);

    // Validate settings if provided
    const validation = validateTraderSettings(input);
    if (!validation.valid) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, validation.errors.join(', '));
    }

    const trader = await prisma.trader.update({
      where: { id },
      data: {
        ...input,
        updatedAt: new Date(),
      },
    });

    logger.info({ traderId: id }, 'Trader updated');
    return trader;
  }

  /**
   * Delete trader
   */
  async delete(id: string) {
    await this.getById(id);

    await prisma.trader.delete({
      where: { id },
    });

    logger.info({ traderId: id }, 'Trader deleted');
  }

  /**
   * Start copying trader
   */
  async startCopying(id: string) {
    const trader = await prisma.trader.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        copyEnabled: true,
      },
    });

    logger.info({ traderId: id }, 'Started copying trader');
    return trader;
  }

  /**
   * Stop copying trader
   */
  async stopCopying(id: string) {
    const trader = await prisma.trader.update({
      where: { id },
      data: {
        status: 'PAUSED',
        copyEnabled: false,
      },
    });

    logger.info({ traderId: id }, 'Stopped copying trader');
    return trader;
  }

  /**
   * Sync trader positions from Polymarket
   */
  async syncPositions(id: string) {
    const trader = await this.getById(id);

    try {
      // Fetch positions from Gamma API
      const positions = await gammaApiService.getUserPositions(trader.walletAddress);

      // Sync each position
      for (const pos of positions) {
        // Ensure market exists in database
        await marketDataService.syncMarketToDatabase(pos.conditionId);

        // Get market from database
        const market = await prisma.market.findUnique({
          where: { conditionId: pos.conditionId },
        });

        if (!market) {
          logger.warn({ conditionId: pos.conditionId }, 'Market not found for position sync');
          continue;
        }

        // Upsert position
        await prisma.position.upsert({
          where: {
            traderId_marketId_tokenId: {
              traderId: id,
              marketId: market.id,
              tokenId: pos.tokenId,
            },
          },
          update: {
            shares: pos.shares,
            avgEntryPrice: pos.avgPrice,
            status: pos.shares > 0 ? 'OPEN' : 'CLOSED',
            updatedAt: new Date(),
          },
          create: {
            traderId: id,
            marketId: market.id,
            tokenId: pos.tokenId,
            outcome: pos.outcome,
            side: 'BUY', // Positions are always long
            shares: pos.shares,
            avgEntryPrice: pos.avgPrice,
            totalCost: pos.shares * pos.avgPrice,
            isSourcePosition: true,
            sourceWallet: trader.walletAddress,
          },
        });
      }

      // Update last sync time
      await prisma.trader.update({
        where: { id },
        data: { lastSyncAt: new Date() },
      });

      logger.info({ traderId: id, positionCount: positions.length }, 'Positions synced');
      return positions.length;
    } catch (error) {
      logger.error({ traderId: id, error }, 'Failed to sync positions');
      throw error;
    }
  }

  /**
   * Get trader statistics
   */
  async getStats(id: string): Promise<TraderStats> {
    const trader = await this.getById(id);

    // Get trades
    const trades = await prisma.trade.findMany({
      where: { traderId: id, status: 'EXECUTED' },
    });

    // Get positions
    const positions = await prisma.position.findMany({
      where: { traderId: id },
    });

    const openPositions = positions.filter((p) => p.status === 'OPEN');

    // Calculate stats
    const profitableTrades = trades.filter((t) => (t.executedAmount || 0) > 0).length;
    const winRate = calculateWinRate(profitableTrades, trades.length);

    const totalVolume = trades.reduce((sum, t) => sum + (t.executedAmount || 0), 0);
    const avgTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;

    // Calculate P&L from positions
    const unrealizedPnl = openPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const realizedPnl = positions.reduce((sum, p) => sum + p.realizedPnl, 0);

    return {
      totalPnl: trader.totalPnl,
      unrealizedPnl,
      realizedPnl,
      winRate,
      totalTrades: trades.length,
      profitableTrades,
      openPositions: openPositions.length,
      avgTradeSize,
      largestWin: 0, // TODO: Calculate from closed positions
      largestLoss: 0, // TODO: Calculate from closed positions
      maxDrawdown: trader.maxDrawdownPercent,
    };
  }

  /**
   * Get active traders for monitoring
   */
  async getActiveTraders() {
    return prisma.trader.findMany({
      where: {
        status: 'ACTIVE',
        copyEnabled: true,
      },
    });
  }

  /**
   * Update trader performance metrics
   */
  async updatePerformance(id: string) {
    const stats = await this.getStats(id);

    await prisma.trader.update({
      where: { id },
      data: {
        totalPnl: stats.totalPnl,
        unrealizedPnl: stats.unrealizedPnl,
        realizedPnl: stats.realizedPnl,
        winRate: stats.winRate,
        totalTrades: stats.totalTrades,
        profitableTrades: stats.profitableTrades,
      },
    });
  }
}

// Singleton instance
export const traderService = new TraderService();
