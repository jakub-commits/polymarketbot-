// Analytics Service
// Calculates performance metrics and generates reports

import { prisma } from '../../config/database.js';
import { cache } from '../../config/redis.js';

export interface PerformanceMetrics {
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  roi: number;
}

export interface PnLDataPoint {
  date: string;
  pnl: number;
  cumulativePnl: number;
  trades: number;
}

export interface TraderPerformance {
  traderId: string;
  name: string;
  walletAddress: string;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  avgTradeSize: number;
  profitFactor: number;
  roi: number;
}

export class AnalyticsService {
  private readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Get overall performance metrics
   */
  async getPerformanceMetrics(traderId?: string): Promise<PerformanceMetrics> {
    const cacheKey = `analytics:metrics:${traderId || 'all'}`;
    const cached = await cache.get<PerformanceMetrics>(cacheKey);
    if (cached) return cached;

    const where = traderId ? { traderId } : {};

    // Get all executed trades
    const trades = await prisma.trade.findMany({
      where: { ...where, status: 'EXECUTED' },
      orderBy: { executedAt: 'asc' },
    });

    // Get open positions
    const positions = await prisma.position.findMany({
      where: { ...where, status: 'OPEN' },
    });

    // Calculate basic metrics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(
      (t) => (t.executedAmount || 0) > t.requestedAmount
    ).length;
    const losingTrades = trades.filter(
      (t) => (t.executedAmount || 0) < t.requestedAmount
    ).length;

    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

    // Calculate P&L
    const realizedPnl = trades.reduce((sum, t) => {
      return sum + ((t.executedAmount || 0) - t.requestedAmount);
    }, 0);

    const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const totalPnl = realizedPnl + unrealizedPnl;

    // Calculate period P&L
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyPnl = this.calculatePeriodPnl(trades, dayAgo);
    const weeklyPnl = this.calculatePeriodPnl(trades, weekAgo);
    const monthlyPnl = this.calculatePeriodPnl(trades, monthAgo);

    // Calculate avg win/loss
    const wins = trades.filter((t) => (t.executedAmount || 0) > t.requestedAmount);
    const losses = trades.filter((t) => (t.executedAmount || 0) < t.requestedAmount);

    const avgWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + ((t.executedAmount || 0) - t.requestedAmount), 0) / wins.length
      : 0;

    const avgLoss = losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + ((t.executedAmount || 0) - t.requestedAmount), 0) / losses.length)
      : 0;

    // Profit factor
    const totalWins = wins.reduce((sum, t) => sum + ((t.executedAmount || 0) - t.requestedAmount), 0);
    const totalLosses = Math.abs(
      losses.reduce((sum, t) => sum + ((t.executedAmount || 0) - t.requestedAmount), 0)
    );
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(trades);

    // Sharpe ratio (simplified - using daily returns)
    const sharpeRatio = this.calculateSharpeRatio(trades);

    // ROI
    const totalInvested = trades.reduce((sum, t) => sum + t.requestedAmount, 0);
    const roi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    const metrics: PerformanceMetrics = {
      totalPnl,
      realizedPnl,
      unrealizedPnl,
      dailyPnl,
      weeklyPnl,
      monthlyPnl,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      roi,
    };

    await cache.set(cacheKey, metrics, this.CACHE_TTL);
    return metrics;
  }

  /**
   * Get P&L chart data
   */
  async getPnLChartData(
    traderId?: string,
    days: number = 30
  ): Promise<PnLDataPoint[]> {
    const cacheKey = `analytics:pnl-chart:${traderId || 'all'}:${days}`;
    const cached = await cache.get<PnLDataPoint[]>(cacheKey);
    if (cached) return cached;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const where = traderId ? { traderId } : {};

    const trades = await prisma.trade.findMany({
      where: {
        ...where,
        status: 'EXECUTED',
        executedAt: { gte: startDate },
      },
      orderBy: { executedAt: 'asc' },
    });

    // Group by date
    const dailyData: Map<string, { pnl: number; trades: number }> = new Map();

    for (const trade of trades) {
      if (!trade.executedAt) continue;

      const dateKey = trade.executedAt.toISOString().split('T')[0];
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;

      const existing = dailyData.get(dateKey) || { pnl: 0, trades: 0 };
      dailyData.set(dateKey, {
        pnl: existing.pnl + pnl,
        trades: existing.trades + 1,
      });
    }

    // Fill in missing dates and calculate cumulative
    const result: PnLDataPoint[] = [];
    let cumulativePnl = 0;

    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const dayData = dailyData.get(dateKey) || { pnl: 0, trades: 0 };
      cumulativePnl += dayData.pnl;

      result.push({
        date: dateKey,
        pnl: dayData.pnl,
        cumulativePnl,
        trades: dayData.trades,
      });
    }

    await cache.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * Get trader performance comparison
   */
  async getTraderPerformance(): Promise<TraderPerformance[]> {
    const cacheKey = 'analytics:trader-performance';
    const cached = await cache.get<TraderPerformance[]>(cacheKey);
    if (cached) return cached;

    const traders = await prisma.trader.findMany({
      where: { status: 'ACTIVE' },
      include: {
        trades: { where: { status: 'EXECUTED' } },
        positions: { where: { status: 'OPEN' } },
      },
    });

    const result: TraderPerformance[] = traders.map((trader) => {
      const trades = trader.trades;
      const totalTrades = trades.length;

      const winningTrades = trades.filter(
        (t) => (t.executedAmount || 0) > t.requestedAmount
      ).length;

      const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

      const realizedPnl = trades.reduce(
        (sum, t) => sum + ((t.executedAmount || 0) - t.requestedAmount),
        0
      );

      const unrealizedPnl = trader.positions.reduce(
        (sum, p) => sum + p.unrealizedPnl,
        0
      );

      const totalPnl = realizedPnl + unrealizedPnl;

      const avgTradeSize = totalTrades > 0
        ? trades.reduce((sum, t) => sum + t.requestedAmount, 0) / totalTrades
        : 0;

      const wins = trades.filter((t) => (t.executedAmount || 0) > t.requestedAmount);
      const losses = trades.filter((t) => (t.executedAmount || 0) < t.requestedAmount);

      const totalWins = wins.reduce(
        (sum, t) => sum + ((t.executedAmount || 0) - t.requestedAmount),
        0
      );
      const totalLosses = Math.abs(
        losses.reduce((sum, t) => sum + ((t.executedAmount || 0) - t.requestedAmount), 0)
      );

      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

      const totalInvested = trades.reduce((sum, t) => sum + t.requestedAmount, 0);
      const roi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

      return {
        traderId: trader.id,
        name: trader.name || 'Unnamed',
        walletAddress: trader.walletAddress,
        totalPnl,
        winRate,
        totalTrades,
        avgTradeSize,
        profitFactor,
        roi,
      };
    });

    // Sort by total P&L
    result.sort((a, b) => b.totalPnl - a.totalPnl);

    await cache.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * Calculate period P&L
   */
  private calculatePeriodPnl(
    trades: Array<{ executedAt: Date | null; executedAmount: number | null; requestedAmount: number }>,
    since: Date
  ): number {
    return trades
      .filter((t) => t.executedAt && t.executedAt >= since)
      .reduce((sum, t) => sum + ((t.executedAmount || 0) - t.requestedAmount), 0);
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(
    trades: Array<{ executedAmount: number | null; requestedAmount: number }>
  ): number {
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const trade of trades) {
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;
      cumulative += pnl;

      if (cumulative > peak) {
        peak = cumulative;
      }

      const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate Sharpe ratio (simplified)
   */
  private calculateSharpeRatio(
    trades: Array<{ executedAt: Date | null; executedAmount: number | null; requestedAmount: number }>
  ): number {
    if (trades.length < 2) return 0;

    // Group by day
    const dailyReturns: Map<string, number> = new Map();

    for (const trade of trades) {
      if (!trade.executedAt) continue;
      const dateKey = trade.executedAt.toISOString().split('T')[0];
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;
      dailyReturns.set(dateKey, (dailyReturns.get(dateKey) || 0) + pnl);
    }

    const returns = Array.from(dailyReturns.values());
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualized (assuming 252 trading days)
    return (avgReturn / stdDev) * Math.sqrt(252);
  }

  /**
   * Get trade distribution by outcome
   */
  async getTradeDistribution(traderId?: string): Promise<{
    byOutcome: Array<{ outcome: string; count: number; pnl: number }>;
    bySide: Array<{ side: string; count: number; pnl: number }>;
    byHour: Array<{ hour: number; count: number; pnl: number }>;
  }> {
    const where = traderId ? { traderId, status: 'EXECUTED' as const } : { status: 'EXECUTED' as const };

    const trades = await prisma.trade.findMany({
      where,
      select: {
        outcome: true,
        side: true,
        executedAt: true,
        executedAmount: true,
        requestedAmount: true,
      },
    });

    // By outcome
    const outcomeMap = new Map<string, { count: number; pnl: number }>();
    for (const trade of trades) {
      const key = trade.outcome;
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;
      const existing = outcomeMap.get(key) || { count: 0, pnl: 0 };
      outcomeMap.set(key, { count: existing.count + 1, pnl: existing.pnl + pnl });
    }

    // By side
    const sideMap = new Map<string, { count: number; pnl: number }>();
    for (const trade of trades) {
      const key = trade.side;
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;
      const existing = sideMap.get(key) || { count: 0, pnl: 0 };
      sideMap.set(key, { count: existing.count + 1, pnl: existing.pnl + pnl });
    }

    // By hour
    const hourMap = new Map<number, { count: number; pnl: number }>();
    for (const trade of trades) {
      if (!trade.executedAt) continue;
      const hour = trade.executedAt.getHours();
      const pnl = (trade.executedAmount || 0) - trade.requestedAmount;
      const existing = hourMap.get(hour) || { count: 0, pnl: 0 };
      hourMap.set(hour, { count: existing.count + 1, pnl: existing.pnl + pnl });
    }

    return {
      byOutcome: Array.from(outcomeMap.entries()).map(([outcome, data]) => ({
        outcome,
        ...data,
      })),
      bySide: Array.from(sideMap.entries()).map(([side, data]) => ({
        side,
        ...data,
      })),
      byHour: Array.from(hourMap.entries())
        .map(([hour, data]) => ({ hour, ...data }))
        .sort((a, b) => a.hour - b.hour),
    };
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();
