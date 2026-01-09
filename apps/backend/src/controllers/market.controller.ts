// Market controller

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError, ERROR_CODES } from '@polymarket-bot/shared';
import type { MarketFilters, PaginationParams } from '@polymarket-bot/shared';

export async function getAllMarkets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      isActive,
      search,
    } = req.query as PaginationParams & MarketFilters;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {
      ...(category && { category: category as string }),
      ...(isActive !== undefined && { isActive: String(isActive) === 'true' }),
      ...(search && {
        OR: [
          { question: { contains: search as string, mode: 'insensitive' as const } },
          { description: { contains: search as string, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.market.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: markets,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getActiveMarkets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { limit = 50 } = req.query;

    const markets = await prisma.market.findMany({
      where: { isActive: true, isResolved: false },
      take: Number(limit),
      orderBy: { volume24h: 'desc' },
    });

    res.json({ success: true, data: markets });
  } catch (error) {
    next(error);
  }
}

export async function getMarketById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        _count: {
          select: { trades: true, positions: true },
        },
      },
    });

    if (!market) {
      throw new AppError(ERROR_CODES.MARKET_NOT_FOUND);
    }

    res.json({ success: true, data: market });
  } catch (error) {
    next(error);
  }
}

export async function getOrderBook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const market = await prisma.market.findUnique({
      where: { id },
    });

    if (!market) {
      throw new AppError(ERROR_CODES.MARKET_NOT_FOUND);
    }

    // TODO: Fetch order book from Polymarket CLOB

    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Order book fetching not yet implemented',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshMarkets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // TODO: Refresh market data from Polymarket

    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Market refresh not yet implemented',
      },
    });
  } catch (error) {
    next(error);
  }
}
