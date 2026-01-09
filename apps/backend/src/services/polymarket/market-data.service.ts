// Market Data Service
// Handles market data fetching, caching, and synchronization

import { prisma } from '../../config/database.js';
import { cache } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import { gammaApiService, type MarketData } from './gamma-api.service.js';
import { clobClientService } from './clob-client.service.js';

const CACHE_TTL = {
  MARKET: 300, // 5 minutes
  PRICES: 30, // 30 seconds
  ACTIVE_MARKETS: 60, // 1 minute
};

export class MarketDataService {
  /**
   * Get market by condition ID (with caching)
   */
  async getMarket(conditionId: string): Promise<MarketData | null> {
    // Try cache first
    const cacheKey = `market:${conditionId}`;
    const cached = await cache.get<MarketData>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const market = await gammaApiService.getMarketByConditionId(conditionId);
    if (market) {
      await cache.set(cacheKey, market, CACHE_TTL.MARKET);
    }

    return market;
  }

  /**
   * Get market prices (with short-lived cache)
   */
  async getMarketPrices(conditionId: string): Promise<Record<string, number> | null> {
    const cacheKey = `prices:${conditionId}`;
    const cached = await cache.get<Record<string, number>>(cacheKey);
    if (cached) {
      return cached;
    }

    const prices = await gammaApiService.getMarketPrices(conditionId);
    if (prices) {
      await cache.set(cacheKey, prices, CACHE_TTL.PRICES);
    }

    return prices;
  }

  /**
   * Get live price from order book
   */
  async getLivePrice(
    tokenId: string
  ): Promise<{ bid: number; ask: number; mid: number } | null> {
    try {
      const price = await clobClientService.getPrice(tokenId);
      return price;
    } catch (error) {
      logger.warn({ tokenId, error }, 'Failed to get live price');
      return null;
    }
  }

  /**
   * Get active markets (cached)
   */
  async getActiveMarkets(limit = 100): Promise<MarketData[]> {
    const cacheKey = `active-markets:${limit}`;
    const cached = await cache.get<MarketData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const markets = await gammaApiService.getActiveMarkets(limit);
    await cache.set(cacheKey, markets, CACHE_TTL.ACTIVE_MARKETS);

    return markets;
  }

  /**
   * Sync market data to database
   */
  async syncMarketToDatabase(conditionId: string): Promise<void> {
    const market = await gammaApiService.getMarketByConditionId(conditionId);
    if (!market) {
      logger.warn({ conditionId }, 'Market not found for sync');
      return;
    }

    await prisma.market.upsert({
      where: { conditionId: market.conditionId },
      update: {
        question: market.question,
        description: market.description,
        category: market.category,
        endDate: market.endDate,
        outcomes: market.outcomes,
        outcomeTokenIds: market.outcomeTokenIds,
        isActive: market.isActive,
        isResolved: market.isResolved,
        prices: market.prices,
        volume24h: market.volume24h,
        liquidity: market.liquidity,
        slug: market.slug,
        imageUrl: market.imageUrl,
        lastPriceUpdate: new Date(),
        updatedAt: new Date(),
      },
      create: {
        conditionId: market.conditionId,
        questionId: market.questionId,
        question: market.question,
        description: market.description,
        category: market.category,
        endDate: market.endDate,
        outcomes: market.outcomes,
        outcomeTokenIds: market.outcomeTokenIds,
        isActive: market.isActive,
        isResolved: market.isResolved,
        prices: market.prices,
        volume24h: market.volume24h,
        liquidity: market.liquidity,
        slug: market.slug,
        imageUrl: market.imageUrl,
        lastPriceUpdate: new Date(),
      },
    });

    logger.debug({ conditionId }, 'Market synced to database');
  }

  /**
   * Batch sync multiple markets
   */
  async syncActiveMarkets(): Promise<number> {
    const markets = await gammaApiService.getActiveMarkets(200);
    let synced = 0;

    for (const market of markets) {
      try {
        await prisma.market.upsert({
          where: { conditionId: market.conditionId },
          update: {
            question: market.question,
            description: market.description,
            category: market.category,
            endDate: market.endDate,
            outcomes: market.outcomes,
            outcomeTokenIds: market.outcomeTokenIds,
            isActive: market.isActive,
            isResolved: market.isResolved,
            prices: market.prices,
            volume24h: market.volume24h,
            liquidity: market.liquidity,
            slug: market.slug,
            imageUrl: market.imageUrl,
            lastPriceUpdate: new Date(),
          },
          create: {
            conditionId: market.conditionId,
            questionId: market.questionId,
            question: market.question,
            description: market.description,
            category: market.category,
            endDate: market.endDate,
            outcomes: market.outcomes,
            outcomeTokenIds: market.outcomeTokenIds,
            isActive: market.isActive,
            isResolved: market.isResolved,
            prices: market.prices,
            volume24h: market.volume24h,
            liquidity: market.liquidity,
            slug: market.slug,
            imageUrl: market.imageUrl,
            lastPriceUpdate: new Date(),
          },
        });
        synced++;
      } catch (error) {
        logger.warn({ conditionId: market.conditionId, error }, 'Failed to sync market');
      }
    }

    logger.info({ synced, total: markets.length }, 'Active markets synced');
    return synced;
  }

  /**
   * Search markets
   */
  async searchMarkets(query: string): Promise<MarketData[]> {
    return gammaApiService.searchMarkets(query);
  }

  /**
   * Get market from database (for already tracked markets)
   */
  async getMarketFromDatabase(conditionId: string) {
    return prisma.market.findUnique({
      where: { conditionId },
    });
  }

  /**
   * Clear market caches
   */
  async clearCaches(): Promise<void> {
    await cache.deletePattern('market:*');
    await cache.deletePattern('prices:*');
    await cache.deletePattern('active-markets:*');
    logger.info('Market caches cleared');
  }
}

// Singleton instance
export const marketDataService = new MarketDataService();
