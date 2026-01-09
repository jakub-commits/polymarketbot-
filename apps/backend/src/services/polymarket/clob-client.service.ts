// Polymarket CLOB Client Service
// Wrapper around @polymarket/clob-client for order execution

import { ClobClient, Side } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { retry, isRetryableError } from '../../utils/retry.js';
import { clobRateLimiter } from '../../utils/rate-limiter.js';
import {
  POLYMARKET_URLS,
  CHAIN_IDS,
  AppError,
  ERROR_CODES,
} from '@polymarket-bot/shared';
import type { TradeSide } from '@polymarket-bot/shared';

// Types for CLOB API responses
interface OrderBookResponse {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

interface OrderResponse {
  id: string;
  status: string;
  side: string;
  size: string;
  price: string;
  filledSize?: string;
  avgFillPrice?: string;
}

interface BalanceResponse {
  balance: string;
}

export interface OrderParams {
  tokenId: string;
  side: TradeSide;
  size: number;
  price?: number;
}

export interface OrderResult {
  orderId: string;
  status: string;
  side: string;
  size: number;
  price: number;
  filledSize?: number;
  avgFillPrice?: number;
}

export interface PriceInfo {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
}

export class ClobClientService {
  private client: ClobClient | null = null;
  private signer: ethers.Wallet | null = null;
  private isInitialized = false;
  private network: 'mainnet' | 'testnet';

  constructor() {
    this.network = config.polymarketNetwork as 'mainnet' | 'testnet';
  }

  /**
   * Initialize the CLOB client with credentials
   */
  async initialize(privateKey: string): Promise<void> {
    try {
      const urls = POLYMARKET_URLS[this.network.toUpperCase() as 'MAINNET' | 'TESTNET'];
      const chainId = CHAIN_IDS[this.network.toUpperCase() as 'MAINNET' | 'TESTNET'];

      // Create wallet signer
      const provider = new ethers.JsonRpcProvider(
        this.network === 'mainnet'
          ? 'https://polygon-rpc.com'
          : 'https://rpc-amoy.polygon.technology'
      );
      this.signer = new ethers.Wallet(privateKey, provider);

      // Initialize CLOB client
      this.client = new ClobClient(
        urls.CLOB,
        chainId,
        this.signer as never,
        undefined, // creds - will use derived API key
        undefined, // signatureType
        config.botWalletAddress // funder
      );

      // Derive API credentials if not provided
      if (!config.polymarketApiKey) {
        logger.info('Deriving API credentials from wallet...');
        await this.client.createOrDeriveApiKey();
      }

      this.isInitialized = true;
      logger.info(
        { network: this.network, address: this.signer.address },
        'CLOB client initialized'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize CLOB client');
      throw new AppError(
        ERROR_CODES.POLYMARKET_API_ERROR,
        'Failed to initialize CLOB client'
      );
    }
  }

  /**
   * Check if client is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.client) {
      throw new AppError(
        ERROR_CODES.WALLET_NOT_CONFIGURED,
        'CLOB client not initialized'
      );
    }
  }

  /**
   * Get order book for a token
   */
  async getOrderBook(tokenId: string): Promise<{
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
  }> {
    this.ensureInitialized();

    return retry(
      async () => {
        await clobRateLimiter.acquire();
        const book = (await this.client!.getOrderBook(tokenId)) as OrderBookResponse;

        return {
          bids: book.bids.map((b) => ({
            price: parseFloat(b.price),
            size: parseFloat(b.size),
          })),
          asks: book.asks.map((a) => ({
            price: parseFloat(a.price),
            size: parseFloat(a.size),
          })),
        };
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Get current price for a token
   */
  async getPrice(tokenId: string): Promise<PriceInfo> {
    const orderBook = await this.getOrderBook(tokenId);

    const bestBid = orderBook.bids.length > 0 ? orderBook.bids[0].price : 0;
    const bestAsk = orderBook.asks.length > 0 ? orderBook.asks[0].price : 1;
    const mid = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;

    return { bid: bestBid, ask: bestAsk, mid, spread };
  }

  /**
   * Get mid price for a token
   */
  async getMidPrice(tokenId: string): Promise<number> {
    const price = await this.getPrice(tokenId);
    return price.mid;
  }

  /**
   * Create a market order
   */
  async createMarketOrder(
    tokenId: string,
    side: TradeSide,
    amount: number
  ): Promise<OrderResult> {
    this.ensureInitialized();

    return retry(
      async () => {
        await clobRateLimiter.acquire();

        const price = await this.getPrice(tokenId);
        const executionPrice = side === 'BUY' ? price.ask : price.bid;

        // Calculate size based on amount and price
        const size = amount / executionPrice;

        logger.info(
          { tokenId, side, amount, size, price: executionPrice },
          'Creating market order'
        );

        const order = (await this.client!.createAndPostOrder({
          tokenID: tokenId,
          side: side === 'BUY' ? Side.BUY : Side.SELL,
          size,
          price: executionPrice,
        })) as OrderResponse;

        return {
          orderId: order.id,
          status: order.status,
          side: order.side,
          size: parseFloat(order.size),
          price: parseFloat(order.price),
          filledSize: order.filledSize ? parseFloat(order.filledSize) : undefined,
          avgFillPrice: order.avgFillPrice ? parseFloat(order.avgFillPrice) : undefined,
        };
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Create a limit order
   */
  async createLimitOrder(
    tokenId: string,
    side: TradeSide,
    size: number,
    price: number
  ): Promise<OrderResult> {
    this.ensureInitialized();

    return retry(
      async () => {
        await clobRateLimiter.acquire();

        logger.info({ tokenId, side, size, price }, 'Creating limit order');

        const order = (await this.client!.createAndPostOrder({
          tokenID: tokenId,
          side: side === 'BUY' ? Side.BUY : Side.SELL,
          size,
          price,
        })) as OrderResponse;

        return {
          orderId: order.id,
          status: order.status,
          side: order.side,
          size: parseFloat(order.size),
          price: parseFloat(order.price),
          filledSize: order.filledSize ? parseFloat(order.filledSize) : undefined,
          avgFillPrice: order.avgFillPrice ? parseFloat(order.avgFillPrice) : undefined,
        };
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    this.ensureInitialized();

    return retry(
      async () => {
        await clobRateLimiter.acquire();
        await (this.client as ClobClient).cancelOrder({ orderID: orderId } as never);
        logger.info({ orderId }, 'Order cancelled');
        return true;
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Cancel all open orders
   */
  async cancelAllOrders(): Promise<void> {
    this.ensureInitialized();

    await retry(
      async () => {
        await clobRateLimiter.acquire();
        await this.client!.cancelAll();
        logger.info('All orders cancelled');
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Get open orders
   */
  async getOpenOrders(): Promise<OrderResult[]> {
    this.ensureInitialized();

    return retry(
      async () => {
        await clobRateLimiter.acquire();
        const orders = (await this.client!.getOpenOrders()) as unknown as OrderResponse[];

        return orders.map((order) => ({
          orderId: order.id,
          status: order.status,
          side: order.side,
          size: parseFloat(order.size),
          price: parseFloat(order.price),
          filledSize: order.filledSize ? parseFloat(order.filledSize) : undefined,
          avgFillPrice: order.avgFillPrice ? parseFloat(order.avgFillPrice) : undefined,
        }));
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Get USDC balance
   */
  async getBalance(): Promise<number> {
    this.ensureInitialized();

    return retry(
      async () => {
        await clobRateLimiter.acquire();
        const balance = (await this.client!.getBalanceAllowance()) as BalanceResponse;
        return parseFloat(balance.balance);
      },
      { retryCondition: isRetryableError }
    );
  }

  /**
   * Estimate slippage for a trade
   */
  async estimateSlippage(
    tokenId: string,
    side: TradeSide,
    amount: number
  ): Promise<number> {
    const orderBook = await this.getOrderBook(tokenId);
    const levels = side === 'BUY' ? orderBook.asks : orderBook.bids;

    if (levels.length === 0) {
      return 1; // 100% slippage if no liquidity
    }

    let remainingAmount = amount;
    let totalCost = 0;
    const bestPrice = levels[0].price;

    for (const level of levels) {
      const levelValue = level.size * level.price;

      if (remainingAmount <= levelValue) {
        totalCost += remainingAmount;
        remainingAmount = 0;
        break;
      }

      totalCost += levelValue;
      remainingAmount -= levelValue;
    }

    if (remainingAmount > 0) {
      // Not enough liquidity
      return 1;
    }

    const avgPrice = totalCost / amount;
    const slippage = Math.abs(avgPrice - bestPrice) / bestPrice;

    return slippage;
  }

  /**
   * Get wallet address
   */
  getAddress(): string | null {
    return this.signer?.address || null;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const clobClientService = new ClobClientService();
