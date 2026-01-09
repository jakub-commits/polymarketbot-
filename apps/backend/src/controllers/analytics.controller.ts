// Analytics controller

import type { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics/analytics.service.js';

export async function getPerformanceMetrics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { traderId } = req.query;
    const metrics = await analyticsService.getPerformanceMetrics(
      traderId as string | undefined
    );

    res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
}

export async function getPnLChart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { traderId, days = '30' } = req.query;
    const data = await analyticsService.getPnLChartData(
      traderId as string | undefined,
      parseInt(days as string, 10)
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getTraderPerformance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await analyticsService.getTraderPerformance();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getTradeDistribution(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { traderId } = req.query;
    const data = await analyticsService.getTradeDistribution(
      traderId as string | undefined
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
