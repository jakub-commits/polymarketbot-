// Health check controller

import type { Request, Response } from 'express';
import axios from 'axios';
import { checkDatabaseHealth } from '../config/database.js';
import { checkRedisHealth } from '../config/redis.js';
import type { HealthCheckResponse, ServiceHealth } from '@polymarket-bot/shared';
import { POLYMARKET_URLS } from '@polymarket-bot/shared';
import { config } from '../config/index.js';

const startTime = Date.now();

// Health check timeout for Polymarket API (5 seconds)
const POLYMARKET_HEALTH_TIMEOUT_MS = 5000;

/**
 * Check Polymarket API connectivity by pinging the Gamma API
 * Uses a simple markets endpoint with limit=1 to minimize response size
 */
async function checkPolymarketHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  const networkKey = (config.polymarketNetwork?.toUpperCase() || 'MAINNET') as 'MAINNET' | 'TESTNET';
  const gammaUrl = POLYMARKET_URLS[networkKey].GAMMA;

  try {
    await axios.get(`${gammaUrl}/markets`, {
      params: { limit: 1, active: true },
      timeout: POLYMARKET_HEALTH_TIMEOUT_MS,
    });

    return {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const [dbHealth, redisHealth, polymarketHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkPolymarketHealth(),
  ]);

  const response: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      polymarket: polymarketHealth,
    },
  };

  // Determine overall health
  // Note: Polymarket being unhealthy doesn't make the whole service unhealthy
  // since we can still serve cached data and queue operations
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
