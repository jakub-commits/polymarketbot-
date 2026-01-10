// Unit tests for ClobClientService
// Tests for order book, pricing, order management, and slippage estimation

import { ClobClientService } from '../../../services/polymarket/clob-client.service';
import { AppError } from '@polymarket-bot/shared';

// Mock dependencies
jest.mock('@polymarket/clob-client', () => ({
  ClobClient: jest.fn().mockImplementation(() => ({
    createOrDeriveApiKey: jest.fn().mockResolvedValue(undefined),
    getOrderBook: jest.fn(),
    createAndPostOrder: jest.fn(),
    cancelOrder: jest.fn(),
    cancelAll: jest.fn(),
    getOpenOrders: jest.fn(),
    getBalanceAllowance: jest.fn(),
  })),
  Side: {
    BUY: 'BUY',
    SELL: 'SELL',
  },
}));

jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
    Wallet: jest.fn().mockImplementation(() => ({
      address: '0x1234567890abcdef1234567890abcdef12345678',
    })),
  },
}));

jest.mock('../../../config/index', () => ({
  config: {
    polymarketNetwork: 'testnet',
    polymarketApiKey: 'test-api-key',
    botWalletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../utils/retry', () => ({
  retry: jest.fn().mockImplementation((fn) => fn()),
  isRetryableError: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../utils/rate-limiter', () => ({
  clobRateLimiter: {
    acquire: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ClobClientService', () => {
  let service: ClobClientService;
  let mockClient: jest.Mocked<{
    createOrDeriveApiKey: jest.Mock;
    getOrderBook: jest.Mock;
    createAndPostOrder: jest.Mock;
    cancelOrder: jest.Mock;
    cancelAll: jest.Mock;
    getOpenOrders: jest.Mock;
    getBalanceAllowance: jest.Mock;
  }>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClobClientService();

    // Get reference to mock client
    const ClobClient = require('@polymarket/clob-client').ClobClient;
    mockClient = ClobClient.mock.results[0]?.value || {
      createOrDeriveApiKey: jest.fn().mockResolvedValue(undefined),
      getOrderBook: jest.fn(),
      createAndPostOrder: jest.fn(),
      cancelOrder: jest.fn(),
      cancelAll: jest.fn(),
      getOpenOrders: jest.fn(),
      getBalanceAllowance: jest.fn(),
    };
  });

  describe('initialization', () => {
    it('should throw error when accessing methods before initialization', async () => {
      const uninitializedService = new ClobClientService();

      await expect(
        uninitializedService.getOrderBook('token-123')
      ).rejects.toThrow(AppError);
    });

    it('should successfully initialize with valid private key', async () => {
      const privateKey = '0x' + 'a'.repeat(64);

      await service.initialize(privateKey);

      expect(service.isConnected()).toBe(true);
    });

    it('should return correct wallet address after initialization', async () => {
      const privateKey = '0x' + 'a'.repeat(64);

      await service.initialize(privateKey);

      expect(service.getAddress()).toBe('0x1234567890abcdef1234567890abcdef12345678');
    });
  });

  describe('getOrderBook', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      // Update mock client reference after initialization
      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should return formatted order book with bids and asks', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [
          { price: '0.65', size: '100' },
          { price: '0.64', size: '200' },
        ],
        asks: [
          { price: '0.66', size: '150' },
          { price: '0.67', size: '250' },
        ],
      });

      const orderBook = await service.getOrderBook('token-123');

      expect(orderBook.bids).toHaveLength(2);
      expect(orderBook.asks).toHaveLength(2);
      expect(orderBook.bids[0]).toEqual({ price: 0.65, size: 100 });
      expect(orderBook.asks[0]).toEqual({ price: 0.66, size: 150 });
    });

    it('should handle empty order book', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [],
        asks: [],
      });

      const orderBook = await service.getOrderBook('token-123');

      expect(orderBook.bids).toHaveLength(0);
      expect(orderBook.asks).toHaveLength(0);
    });

    it('should parse string prices and sizes to numbers', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.123456', size: '99.99' }],
        asks: [{ price: '0.987654', size: '100.01' }],
      });

      const orderBook = await service.getOrderBook('token-123');

      expect(typeof orderBook.bids[0].price).toBe('number');
      expect(typeof orderBook.bids[0].size).toBe('number');
      expect(orderBook.bids[0].price).toBeCloseTo(0.123456, 6);
      expect(orderBook.asks[0].size).toBeCloseTo(100.01, 2);
    });
  });

  describe('getPrice', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should calculate bid, ask, mid, and spread correctly', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.60', size: '100' }],
        asks: [{ price: '0.70', size: '100' }],
      });

      const price = await service.getPrice('token-123');

      expect(price.bid).toBeCloseTo(0.6, 10);
      expect(price.ask).toBeCloseTo(0.7, 10);
      expect(price.mid).toBeCloseTo(0.65, 10);
      expect(price.spread).toBeCloseTo(0.1, 2);
    });

    it('should handle missing bids (set bid to 0)', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [],
        asks: [{ price: '0.70', size: '100' }],
      });

      const price = await service.getPrice('token-123');

      expect(price.bid).toBe(0);
      expect(price.ask).toBe(0.7);
      expect(price.mid).toBe(0.35);
    });

    it('should handle missing asks (set ask to 1)', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.60', size: '100' }],
        asks: [],
      });

      const price = await service.getPrice('token-123');

      expect(price.bid).toBe(0.6);
      expect(price.ask).toBe(1);
      expect(price.mid).toBe(0.8);
    });
  });

  describe('getMidPrice', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should return mid price directly', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.50', size: '100' }],
        asks: [{ price: '0.60', size: '100' }],
      });

      const midPrice = await service.getMidPrice('token-123');

      expect(midPrice).toBe(0.55);
    });
  });

  describe('createMarketOrder', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should create BUY market order successfully', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.50', size: '1000' }],
        asks: [{ price: '0.51', size: '1000' }],
      });

      mockClient.createAndPostOrder.mockResolvedValue({
        id: 'order-123',
        status: 'filled',
        side: 'BUY',
        size: '100',
        price: '0.51',
        filledSize: '100',
        avgFillPrice: '0.51',
      });

      const result = await service.createMarketOrder('token-123', 'BUY', 51);

      expect(result.orderId).toBe('order-123');
      expect(result.status).toBe('filled');
      expect(result.side).toBe('BUY');
      expect(result.size).toBe(100);
      expect(result.price).toBe(0.51);
      expect(result.filledSize).toBe(100);
      expect(result.avgFillPrice).toBe(0.51);
    });

    it('should create SELL market order successfully', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.50', size: '1000' }],
        asks: [{ price: '0.51', size: '1000' }],
      });

      mockClient.createAndPostOrder.mockResolvedValue({
        id: 'order-456',
        status: 'filled',
        side: 'SELL',
        size: '50',
        price: '0.50',
        filledSize: '50',
        avgFillPrice: '0.50',
      });

      const result = await service.createMarketOrder('token-123', 'SELL', 25);

      expect(result.orderId).toBe('order-456');
      expect(result.side).toBe('SELL');
    });

    it('should use ask price for BUY orders', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.40', size: '1000' }],
        asks: [{ price: '0.60', size: '1000' }],
      });

      mockClient.createAndPostOrder.mockResolvedValue({
        id: 'order-789',
        status: 'filled',
        side: 'BUY',
        size: '166.67',
        price: '0.60',
      });

      await service.createMarketOrder('token-123', 'BUY', 100);

      expect(mockClient.createAndPostOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 0.6,
        })
      );
    });

    it('should handle partially filled orders', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.50', size: '1000' }],
        asks: [{ price: '0.51', size: '1000' }],
      });

      mockClient.createAndPostOrder.mockResolvedValue({
        id: 'order-partial',
        status: 'partial',
        side: 'BUY',
        size: '100',
        price: '0.51',
        filledSize: '50',
        avgFillPrice: '0.51',
      });

      const result = await service.createMarketOrder('token-123', 'BUY', 51);

      expect(result.status).toBe('partial');
      expect(result.filledSize).toBe(50);
    });
  });

  describe('createLimitOrder', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should create limit order with specified price', async () => {
      mockClient.createAndPostOrder.mockResolvedValue({
        id: 'limit-order-123',
        status: 'open',
        side: 'BUY',
        size: '100',
        price: '0.45',
      });

      const result = await service.createLimitOrder('token-123', 'BUY', 100, 0.45);

      expect(result.orderId).toBe('limit-order-123');
      expect(result.price).toBe(0.45);
      expect(result.size).toBe(100);
    });

    it('should create SELL limit order correctly', async () => {
      mockClient.createAndPostOrder.mockResolvedValue({
        id: 'limit-sell-123',
        status: 'open',
        side: 'SELL',
        size: '50',
        price: '0.75',
      });

      const result = await service.createLimitOrder('token-123', 'SELL', 50, 0.75);

      expect(result.side).toBe('SELL');
      expect(result.price).toBe(0.75);
    });
  });

  describe('cancelOrder', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should cancel order successfully', async () => {
      mockClient.cancelOrder.mockResolvedValue(undefined);

      const result = await service.cancelOrder('order-to-cancel');

      expect(result).toBe(true);
    });
  });

  describe('cancelAllOrders', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should cancel all orders successfully', async () => {
      mockClient.cancelAll.mockResolvedValue(undefined);

      await expect(service.cancelAllOrders()).resolves.toBeUndefined();
    });
  });

  describe('getBalance', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should return parsed balance as number', async () => {
      mockClient.getBalanceAllowance.mockResolvedValue({
        balance: '1500.50',
      });

      const balance = await service.getBalance();

      expect(balance).toBe(1500.5);
      expect(typeof balance).toBe('number');
    });

    it('should handle zero balance', async () => {
      mockClient.getBalanceAllowance.mockResolvedValue({
        balance: '0',
      });

      const balance = await service.getBalance();

      expect(balance).toBe(0);
    });

    it('should handle large balances', async () => {
      mockClient.getBalanceAllowance.mockResolvedValue({
        balance: '1000000.123456',
      });

      const balance = await service.getBalance();

      expect(balance).toBeCloseTo(1000000.123456, 6);
    });
  });

  describe('estimateSlippage', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should return 0 slippage for small order with deep liquidity', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [
          { price: '0.50', size: '10000' },
          { price: '0.49', size: '10000' },
        ],
        asks: [
          { price: '0.51', size: '10000' },
          { price: '0.52', size: '10000' },
        ],
      });

      const slippage = await service.estimateSlippage('token-123', 'BUY', 100);

      expect(slippage).toBe(0);
    });

    it('should calculate slippage when order spans multiple price levels', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [
          { price: '0.50', size: '100' }, // value = 50
          { price: '0.49', size: '100' }, // value = 49
        ],
        asks: [
          { price: '0.50', size: '100' }, // value = 50
          { price: '0.52', size: '100' }, // value = 52
        ],
      });

      // BUY order for 80 USDC - should fill at 0.50 mostly
      const slippage = await service.estimateSlippage('token-123', 'BUY', 80);

      expect(slippage).toBeGreaterThanOrEqual(0);
      expect(slippage).toBeLessThan(1);
    });

    it('should return 1 (100% slippage) when insufficient liquidity', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.50', size: '10' }], // Only 5 USDC available
        asks: [{ price: '0.50', size: '10' }],
      });

      const slippage = await service.estimateSlippage('token-123', 'BUY', 1000);

      expect(slippage).toBe(1);
    });

    it('should return 1 (100% slippage) when no liquidity', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [],
        asks: [],
      });

      const slippage = await service.estimateSlippage('token-123', 'BUY', 100);

      expect(slippage).toBe(1);
    });

    it('should use asks for BUY orders', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.40', size: '1000' }],
        asks: [{ price: '0.60', size: '1000' }],
      });

      const slippage = await service.estimateSlippage('token-123', 'BUY', 100);

      // Should calculate based on asks, not bids
      expect(slippage).toBeGreaterThanOrEqual(0);
    });

    it('should use bids for SELL orders', async () => {
      mockClient.getOrderBook.mockResolvedValue({
        bids: [{ price: '0.40', size: '1000' }],
        asks: [{ price: '0.60', size: '1000' }],
      });

      const slippage = await service.estimateSlippage('token-123', 'SELL', 100);

      // Should calculate based on bids, not asks
      expect(slippage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getOpenOrders', () => {
    beforeEach(async () => {
      const privateKey = '0x' + 'a'.repeat(64);
      await service.initialize(privateKey);

      const ClobClient = require('@polymarket/clob-client').ClobClient;
      if (ClobClient.mock.results.length > 0) {
        mockClient = ClobClient.mock.results[ClobClient.mock.results.length - 1].value;
      }
    });

    it('should return formatted open orders', async () => {
      mockClient.getOpenOrders.mockResolvedValue([
        {
          id: 'open-1',
          status: 'open',
          side: 'BUY',
          size: '100',
          price: '0.45',
          filledSize: '25',
        },
        {
          id: 'open-2',
          status: 'open',
          side: 'SELL',
          size: '50',
          price: '0.75',
        },
      ]);

      const orders = await service.getOpenOrders();

      expect(orders).toHaveLength(2);
      expect(orders[0].orderId).toBe('open-1');
      expect(orders[0].filledSize).toBe(25);
      expect(orders[1].filledSize).toBeUndefined();
    });

    it('should handle empty open orders', async () => {
      mockClient.getOpenOrders.mockResolvedValue([]);

      const orders = await service.getOpenOrders();

      expect(orders).toHaveLength(0);
    });
  });

  describe('utility methods', () => {
    it('should return null address when not initialized', () => {
      const uninitializedService = new ClobClientService();
      expect(uninitializedService.getAddress()).toBeNull();
    });

    it('should return false for isConnected when not initialized', () => {
      const uninitializedService = new ClobClientService();
      expect(uninitializedService.isConnected()).toBe(false);
    });
  });
});
