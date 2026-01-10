// Gamma API Service
// For fetching market data and user positions from Polymarket

import axios, { AxiosInstance } from 'axios';
import { config } from '../../config/index.js';
import { retry, isRetryableError } from '../../utils/retry.js';
import { gammaRateLimiter } from '../../utils/rate-limiter.js';
import { cache } from '../../config/redis.js';
import { POLYMARKET_URLS } from '@polymarket-bot/shared';

// Gamma API response types
interface GammaMarket {
  id: string;
  condition_id: string;
  question_id: string;
  question: string;
  description: string;
  category: string;
  end_date_iso: string;
  game_start_time: string | null;
  active: boolean;
  closed: boolean;
  archived: boolean;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
  volume: string;
  liquidity: string;
  slug: string;
  image: string;
  icon: string;
}

interface GammaPosition {
  asset: string;
  condition_id: string;
  token_id: string;
  outcome: string;
  size: string;
  avg_price: string;
  market: {
    question: string;
    slug: string;
  };
}

interface GammaUserHistory {
  id: string;
  type: string;
  timestamp: string;
  token_id: string;
  outcome: string;
  size: string;
  price: string;
  market: {
    condition_id: string;
    question: string;
  };
}

export interface MarketData {
  id: string;
  conditionId: string;
  questionId: string;
  question: string;
  description: string;
  category: string;
  endDate: Date | null;
  isActive: boolean;
  isResolved: boolean;
  outcomes: string[];
  outcomeTokenIds: string[];
  prices: Record<string, number>;
  volume24h: number;
  liquidity: number;
  slug: string;
  imageUrl: string;
}

export interface UserPosition {
  conditionId: string;
  tokenId: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  marketQuestion: string;
  marketSlug: string;
}

export interface UserTrade {
  id: string;
  type: string;
  timestamp: Date;
  tokenId: string;
  outcome: string;
  size: number;
  price: number;
  conditionId: string;
  marketQuestion: string;
}

export class GammaApiService {
  private client: AxiosInstance;
  private network: 'mainnet' | 'testnet';

  constructor() {
    this.network = config.polymarketNetwork as 'mainnet' | 'testnet';
    const urls = POLYMARKET_URLS[this.network.toUpperCase() as 'MAINNET' | 'TESTNET'];

    this.client = axios.create({
      baseURL: urls.GAMMA,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch all active markets
   */
  async getActiveMarkets(limit = 100, offset = 0): Promise<MarketData[]> {
    return retry(
      async () => {
        await gammaRateLimiter.acquire();

        const response = await this.client.get<GammaMarket[]>('/markets', {
          params: {
            active: true,
            closed: false,
            limit,
            offset,
          },
        });

        return response.data.map(this.transformMarket);
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Fetch market by condition ID
   */
  async getMarketByConditionId(conditionId: string): Promise<MarketData | null> {
    // Check cache first
    const cacheKey = `market:${conditionId}`;
    const cached = await cache.get<MarketData>(cacheKey);
    if (cached) {
      return cached;
    }

    return retry(
      async () => {
        await gammaRateLimiter.acquire();

        try {
          const response = await this.client.get<GammaMarket>(
            `/markets/${conditionId}`
          );
          const market = this.transformMarket(response.data);

          // Cache for 5 minutes
          await cache.set(cacheKey, market, 300);

          return market;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null;
          }
          throw error;
        }
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Fetch market by slug
   */
  async getMarketBySlug(slug: string): Promise<MarketData | null> {
    return retry(
      async () => {
        await gammaRateLimiter.acquire();

        try {
          const response = await this.client.get<GammaMarket[]>('/markets', {
            params: { slug },
          });

          if (response.data.length === 0) {
            return null;
          }

          return this.transformMarket(response.data[0]);
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null;
          }
          throw error;
        }
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Search markets
   */
  async searchMarkets(query: string, limit = 20): Promise<MarketData[]> {
    return retry(
      async () => {
        await gammaRateLimiter.acquire();

        const response = await this.client.get<GammaMarket[]>('/markets', {
          params: {
            _q: query,
            limit,
            active: true,
          },
        });

        return response.data.map(this.transformMarket);
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Fetch user positions by wallet address
   */
  async getUserPositions(walletAddress: string): Promise<UserPosition[]> {
    return retry(
      async () => {
        await gammaRateLimiter.acquire();

        const response = await this.client.get<GammaPosition[]>(
          `/users/${walletAddress.toLowerCase()}/positions`
        );

        return response.data
          .filter((p) => parseFloat(p.size) > 0)
          .map((position) => ({
            conditionId: position.condition_id,
            tokenId: position.token_id,
            outcome: position.outcome,
            shares: parseFloat(position.size),
            avgPrice: parseFloat(position.avg_price),
            marketQuestion: position.market?.question || '',
            marketSlug: position.market?.slug || '',
          }));
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Fetch user trade history
   */
  async getUserTrades(
    walletAddress: string,
    limit = 50
  ): Promise<UserTrade[]> {
    return retry(
      async () => {
        await gammaRateLimiter.acquire();

        const response = await this.client.get<GammaUserHistory[]>(
          `/users/${walletAddress.toLowerCase()}/history`,
          {
            params: { limit },
          }
        );

        return response.data.map((trade) => ({
          id: trade.id,
          type: trade.type,
          timestamp: new Date(trade.timestamp),
          tokenId: trade.token_id,
          outcome: trade.outcome,
          size: parseFloat(trade.size),
          price: parseFloat(trade.price),
          conditionId: trade.market.condition_id,
          marketQuestion: trade.market.question,
        }));
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Get current prices for a market
   */
  async getMarketPrices(
    conditionId: string
  ): Promise<Record<string, number> | null> {
    const market = await this.getMarketByConditionId(conditionId);
    return market?.prices || null;
  }

  /**
   * Refresh market prices (bypass cache)
   */
  async refreshMarketPrices(conditionId: string): Promise<Record<string, number> | null> {
    await cache.delete(`market:${conditionId}`);
    return this.getMarketPrices(conditionId);
  }

  /**
   * Transform Gamma market response to our format
   */
  private transformMarket(market: GammaMarket): MarketData {
    const prices: Record<string, number> = {};
    const outcomes: string[] = [];
    const outcomeTokenIds: string[] = [];

    for (const token of market.tokens || []) {
      prices[token.outcome] = token.price;
      outcomes.push(token.outcome);
      outcomeTokenIds.push(token.token_id);
    }

    return {
      id: market.id,
      conditionId: market.condition_id,
      questionId: market.question_id,
      question: market.question,
      description: market.description || '',
      category: market.category || '',
      endDate: market.end_date_iso ? new Date(market.end_date_iso) : null,
      isActive: market.active && !market.closed && !market.archived,
      isResolved: market.closed,
      outcomes,
      outcomeTokenIds,
      prices,
      volume24h: parseFloat(market.volume || '0'),
      liquidity: parseFloat(market.liquidity || '0'),
      slug: market.slug || '',
      imageUrl: market.image || market.icon || '',
    };
  }
}

// Singleton instance
export const gammaApiService = new GammaApiService();
