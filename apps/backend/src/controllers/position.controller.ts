// Position controller

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError, ERROR_CODES } from '@polymarket-bot/shared';
import type { PositionFilters, PaginationParams } from '@polymarket-bot/shared';

export async function getAllPositions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      page = 1,
      limit = 20,
      traderId,
      marketId,
      status,
    } = req.query as PaginationParams & PositionFilters;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {
      ...(traderId && { traderId: traderId as string }),
      ...(marketId && { marketId: marketId as string }),
      ...(status && { status: status as 'OPEN' | 'CLOSED' | 'REDEEMED' }),
    };

    const [positions, total] = await Promise.all([
      prisma.position.findMany({
        where,
        skip,
        take,
        orderBy: { openedAt: 'desc' },
        include: {
          trader: {
            select: { id: true, name: true, walletAddress: true },
          },
          market: {
            select: { id: true, question: true, slug: true, outcomes: true },
          },
        },
      }),
      prisma.position.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: positions,
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

export async function getOpenPositions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const positions = await prisma.position.findMany({
      where: { status: 'OPEN' },
      include: {
        trader: {
          select: { id: true, name: true, walletAddress: true },
        },
        market: {
          select: { id: true, question: true, slug: true, outcomes: true, prices: true },
        },
      },
      orderBy: { openedAt: 'desc' },
    });

    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
}

export async function getPositionSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [openPositions, closedPositions, aggregates] = await Promise.all([
      prisma.position.count({ where: { status: 'OPEN' } }),
      prisma.position.count({ where: { status: 'CLOSED' } }),
      prisma.position.aggregate({
        _sum: {
          unrealizedPnl: true,
          realizedPnl: true,
          totalCost: true,
        },
      }),
    ]);

    // Calculate total value of open positions
    const openPositionData = await prisma.position.findMany({
      where: { status: 'OPEN' },
      select: { shares: true, currentPrice: true },
    });

    const totalValue = openPositionData.reduce(
      (sum, p) => sum + p.shares * (p.currentPrice || 0),
      0
    );

    res.json({
      success: true,
      data: {
        totalPositions: openPositions + closedPositions,
        openPositions,
        closedPositions,
        totalUnrealizedPnl: aggregates._sum.unrealizedPnl || 0,
        totalRealizedPnl: aggregates._sum.realizedPnl || 0,
        totalValue,
        totalCost: aggregates._sum.totalCost || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPositionById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        trader: true,
        market: true,
      },
    });

    if (!position) {
      throw new AppError(ERROR_CODES.POSITION_NOT_FOUND);
    }

    res.json({ success: true, data: position });
  } catch (error) {
    next(error);
  }
}

export async function closePosition(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const position = await prisma.position.findUnique({
      where: { id },
    });

    if (!position) {
      throw new AppError(ERROR_CODES.POSITION_NOT_FOUND);
    }

    if (position.status !== 'OPEN') {
      throw new AppError(ERROR_CODES.POSITION_ALREADY_CLOSED);
    }

    // TODO: Implement position closing via Polymarket

    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Position closing not yet implemented',
      },
    });
  } catch (error) {
    next(error);
  }
}
