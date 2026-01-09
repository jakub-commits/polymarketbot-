// Health check controller

import type { Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database.js';
import { checkRedisHealth } from '../config/redis.js';
import type { HealthCheckResponse } from '@polymarket-bot/shared';

const startTime = Date.now();

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const response: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      polymarket: { status: 'healthy' }, // TODO: Add actual Polymarket health check
    },
  };

  // Determine overall health
  if (dbHealth.status === 'unhealthy' || redisHealth.status === 'unhealthy') {
    response.status = 'unhealthy';
    res.status(503).json(response);
    return;
  }

  res.json(response);
}

export async function readinessCheck(_req: Request, res: Response): Promise<void> {
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.status === 'unhealthy') {
    res.status(503).json({ ready: false });
    return;
  }

  res.json({ ready: true });
}

export function livenessCheck(_req: Request, res: Response): void {
  res.json({ alive: true });
}
