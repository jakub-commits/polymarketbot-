// Trader controller

import type { Request, Response, NextFunction } from 'express';
import { traderService, traderMonitorService } from '../services/trader/index.js';
import type { CreateTraderInput, UpdateTraderInput, PaginationParams } from '@polymarket-bot/shared';

export async function getAllTraders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      network,
    } = req.query as PaginationParams & { status?: string; network?: string };

    const result = await traderService.getAll({
      status: status as 'ACTIVE' | 'PAUSED' | 'DISABLED' | undefined,
      network: network as 'MAINNET' | 'TESTNET' | undefined,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getTraderById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const trader = await traderService.getById(id);
    res.json({ success: true, data: trader });
  } catch (error) {
    next(error);
  }
}

export async function createTrader(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as CreateTraderInput;
    const trader = await traderService.create(input);
    res.status(201).json({ success: true, data: trader });
  } catch (error) {
    next(error);
  }
}

export async function updateTrader(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const input = req.body as UpdateTraderInput;
    const trader = await traderService.update(id, input);
    res.json({ success: true, data: trader });
  } catch (error) {
    next(error);
  }
}

export async function deleteTrader(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Stop monitoring if active
    traderMonitorService.stopMonitoring(id);

    await traderService.delete(id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function startCopying(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const trader = await traderService.startCopying(id);

    // Start monitoring
    await traderMonitorService.startMonitoring(id);

    res.json({ success: true, data: trader });
  } catch (error) {
    next(error);
  }
}

export async function stopCopying(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Stop monitoring
    traderMonitorService.stopMonitoring(id);

    const trader = await traderService.stopCopying(id);
    res.json({ success: true, data: trader });
  } catch (error) {
    next(error);
  }
}

export async function syncPositions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const count = await traderService.syncPositions(id);
    res.json({ success: true, data: { synced: count } });
  } catch (error) {
    next(error);
  }
}

export async function getTraderStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const stats = await traderService.getStats(id);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}

export async function getTraderTrades(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Import prisma here to avoid circular dependency
    const { prisma } = await import('../config/database.js');

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where: { traderId: id },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { market: true },
      }),
      prisma.trade.count({ where: { traderId: id } }),
    ]);

    res.json({
      success: true,
      data: {
        items: trades,
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

export async function getTraderPositions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const { prisma } = await import('../config/database.js');

    const positions = await prisma.position.findMany({
      where: {
        traderId: id,
        ...(status && { status: status as 'OPEN' | 'CLOSED' | 'REDEEMED' }),
      },
      include: { market: true },
      orderBy: { openedAt: 'desc' },
    });

    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
}
