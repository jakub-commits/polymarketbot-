// Settings controller

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';

export async function getSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await prisma.settings.findMany();

    // Convert to key-value object
    const settingsObject = settings.reduce(
      (acc, s) => {
        acc[s.key] = s.value;
        return acc;
      },
      {} as Record<string, unknown>
    );

    res.json({ success: true, data: settingsObject });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updates = req.body as Record<string, unknown>;

    // Update each setting
    for (const [key, value] of Object.entries(updates)) {
      await prisma.settings.upsert({
        where: { key },
        update: { value: value as object },
        create: { key, value: value as object },
      });
    }

    // Return updated settings
    const settings = await prisma.settings.findMany();
    const settingsObject = settings.reduce(
      (acc, s) => {
        acc[s.key] = s.value;
        return acc;
      },
      {} as Record<string, unknown>
    );

    res.json({ success: true, data: settingsObject });
  } catch (error) {
    next(error);
  }
}

export async function getWalletInfo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const wallet = await prisma.botWallet.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        address: true,
        network: true,
        usdcBalance: true,
        lastBalanceCheck: true,
        isActive: true,
      },
    });

    if (!wallet) {
      res.json({
        success: true,
        data: {
          configured: false,
          address: config.botWalletAddress || null,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        configured: true,
        ...wallet,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBotStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [activeTraders, openPositions, recentTrades, errors24h] = await Promise.all([
      prisma.trader.count({ where: { status: 'ACTIVE', copyEnabled: true } }),
      prisma.position.count({ where: { status: 'OPEN' } }),
      prisma.trade.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.activityLog.count({
        where: {
          level: 'ERROR',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        isRunning: true, // TODO: Implement actual running state
        activeTraders,
        openPositions,
        lastActivity: recentTrades?.createdAt || null,
        uptime: process.uptime(),
        errors24h,
      },
    });
  } catch (error) {
    next(error);
  }
}
