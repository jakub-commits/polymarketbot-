// Dashboard controller

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { walletService } from '../services/wallet/wallet.service.js';
import { tradeCopierService } from '../services/trade/trade-copier.service.js';

export async function getDashboardStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get counts in parallel
    const [
      openPositions,
      yesterdayPositions,
      activeTraders,
      todaysTrades,
      yesterdayTrades,
      totalTrades,
      executedTrades,
    ] = await Promise.all([
      prisma.position.count({ where: { status: 'OPEN' } }),
      prisma.position.count({
        where: { status: 'OPEN', openedAt: { lt: today } },
      }),
      prisma.trader.count({ where: { status: 'ACTIVE' } }),
      prisma.trade.count({ where: { createdAt: { gte: today } } }),
      prisma.trade.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      prisma.trade.count(),
      prisma.trade.count({ where: { status: 'EXECUTED' } }),
    ]);

    // Calculate P&L
    const positions = await prisma.position.findMany({
      where: { status: 'OPEN' },
    });

    const unrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    const realizedPnl = positions.reduce((sum, pos) => sum + pos.realizedPnl, 0);

    // Daily P&L from trades
    const todaysExecutedTrades = await prisma.trade.findMany({
      where: {
        status: 'EXECUTED',
        executedAt: { gte: today },
      },
    });

    const dailyPnl = todaysExecutedTrades.reduce((sum, trade) => {
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;
      return sum + pnl;
    }, 0);

    // Win rate - fetch executed trades and count profitable ones in memory
    // (Prisma doesn't support comparing two columns directly in a where clause)
    const executedTradesForWinRate = await prisma.trade.findMany({
      where: { status: 'EXECUTED' },
      select: { executedAmount: true, requestedAmount: true },
    });
    const profitableTrades = executedTradesForWinRate.filter(
      (trade) => (trade.executedAmount || 0) > trade.requestedAmount
    ).length;
    const winRate = executedTrades > 0 ? profitableTrades / executedTrades : 0;

    res.json({
      success: true,
      data: {
        totalPnl: unrealizedPnl + realizedPnl,
        unrealizedPnl,
        realizedPnl,
        dailyPnl,
        openPositions,
        activeTraders,
        todaysTrades,
        totalTrades,
        winRate,
        positionsChange: openPositions - yesterdayPositions,
        tradesChange: todaysTrades - yesterdayTrades,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDashboardOverview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get stats, recent trades, and top traders in parallel
    const [
      openPositions,
      activeTraders,
      todaysTrades,
      recentTrades,
      topTraders,
      copierStats,
    ] = await Promise.all([
      prisma.position.count({ where: { status: 'OPEN' } }),
      prisma.trader.count({ where: { status: 'ACTIVE' } }),
      prisma.trade.count({ where: { createdAt: { gte: today } } }),
      prisma.trade.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          trader: { select: { id: true, name: true, walletAddress: true } },
          market: { select: { id: true, question: true } },
        },
      }),
      prisma.trader.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { totalPnl: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          walletAddress: true,
          totalPnl: true,
          winRate: true,
          totalTrades: true,
        },
      }),
      Promise.resolve(tradeCopierService.getStats()),
    ]);

    // Get wallet balance
    let walletBalance = 0;
    try {
      walletBalance = await walletService.getBalance();
    } catch {
      walletBalance = 0;
    }

    res.json({
      success: true,
      data: {
        stats: {
          openPositions,
          activeTraders,
          todaysTrades,
          walletBalance,
          copierStats,
        },
        recentTrades,
        topTraders,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getWalletStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isConnected = walletService.isReady();
    let balance = 0;
    let address: string | null = null;

    if (isConnected) {
      try {
        balance = await walletService.getBalance();
        address = walletService.getAddress();
      } catch {
        balance = 0;
      }
    }

    res.json({
      success: true,
      data: {
        isConnected,
        address,
        balance,
      },
    });
  } catch (error) {
    next(error);
  }
}
