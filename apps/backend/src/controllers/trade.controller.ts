// Trade controller

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError, ERROR_CODES } from '@polymarket-bot/shared';
import type { TradeFilters, PaginationParams, TradeSide, OrderType } from '@polymarket-bot/shared';
import { tradeExecutorService } from '../services/trade/trade-executor.service.js';
import { tradeCopierService } from '../services/trade/trade-copier.service.js';
import { walletService } from '../services/wallet/wallet.service.js';

export async function getAllTrades(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      traderId,
      marketId,
      status,
      side,
    } = req.query as PaginationParams & TradeFilters;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: Record<string, unknown> = {
      ...(traderId && { traderId: traderId as string }),
      ...(marketId && { marketId: marketId as string }),
      ...(status && { status }),
      ...(side && { side }),
    };

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy as string]: sortOrder },
        include: {
          trader: {
            select: { id: true, name: true, walletAddress: true },
          },
          market: {
            select: { id: true, question: true, slug: true },
          },
        },
      }),
      prisma.trade.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: trades,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / take),
        hasNext: skip + take < total,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getRecentTrades(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { limit = 10 } = req.query;

    const trades = await prisma.trade.findMany({
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        trader: {
          select: { id: true, name: true, walletAddress: true },
        },
        market: {
          select: { id: true, question: true, slug: true },
        },
      },
    });

    res.json({ success: true, data: trades });
  } catch (error) {
    next(error);
  }
}

export async function getTradeById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const trade = await prisma.trade.findUnique({
      where: { id },
      include: {
        trader: true,
        market: true,
      },
    });

    if (!trade) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Trade not found');
    }

    res.json({ success: true, data: trade });
  } catch (error) {
    next(error);
  }
}

export async function executeTrade(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if wallet is ready
    if (!walletService.isReady()) {
      throw new AppError(ERROR_CODES.WALLET_NOT_CONFIGURED, 'Wallet not configured');
    }

    const {
      traderId,
      marketId,
      tokenId,
      outcome,
      side,
      amount,
      orderType = 'MARKET',
      limitPrice,
    } = req.body;

    // Validate required fields
    if (!traderId || !marketId || !tokenId || !outcome || !side || !amount) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Missing required fields: traderId, marketId, tokenId, outcome, side, amount'
      );
    }

    // Execute trade
    const result = await tradeExecutorService.execute({
      traderId,
      marketId,
      tokenId,
      outcome,
      side: side as TradeSide,
      amount: Number(amount),
      orderType: orderType as OrderType,
      limitPrice: limitPrice ? Number(limitPrice) : undefined,
      isSourceTrade: false,
    });

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'TRADE_FAILED',
          message: result.error || 'Trade execution failed',
        },
        data: result,
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function retryTrade(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Check if wallet is ready
    if (!walletService.isReady()) {
      throw new AppError(ERROR_CODES.WALLET_NOT_CONFIGURED, 'Wallet not configured');
    }

    const result = await tradeExecutorService.retryTrade(id);

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'RETRY_FAILED',
          message: result.error || 'Trade retry failed',
        },
        data: result,
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function cancelTrade(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const trade = await prisma.trade.findUnique({
      where: { id },
    });

    if (!trade) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Trade not found');
    }

    if (trade.status !== 'PENDING') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Only pending trades can be cancelled');
    }

    const updated = await prisma.trade.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function getCopierStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = tradeCopierService.getStats();
    const isActive = tradeCopierService.isActive();

    res.json({
      success: true,
      data: {
        isActive,
        stats,
        walletConnected: walletService.isReady(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function startCopier(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!walletService.isReady()) {
      throw new AppError(ERROR_CODES.WALLET_NOT_CONFIGURED, 'Wallet not configured');
    }

    tradeCopierService.start();
    res.json({ success: true, message: 'Copy trading started' });
  } catch (error) {
    next(error);
  }
}

export async function stopCopier(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    tradeCopierService.stop();
    res.json({ success: true, message: 'Copy trading stopped' });
  } catch (error) {
    next(error);
  }
}
