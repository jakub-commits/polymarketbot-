// Unit tests for TradeCopierService
// Tests for copy trade logic, event handling, and error handling

import { EventEmitter } from 'events';
import { TradeCopierService } from '../../../services/trade/trade-copier.service';
import type { PositionChange } from '@polymarket-bot/shared';

// Mock dependencies
const mockPrisma = {
  trader: {
    findUnique: jest.fn(),
  },
  position: {
    findFirst: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
};

jest.mock('../../../config/database', () => ({
  prisma: mockPrisma,
}));

// Mock trader monitor service
const mockTraderMonitor = new EventEmitter();
jest.mock('../../../services/trader/trader-monitor.service', () => ({
  traderMonitorService: mockTraderMonitor,
}));

// Mock position sizing service
const mockPositionSizingService = {
  calculateSize: jest.fn(),
  getExistingPosition: jest.fn(),
  calculateDecreaseSize: jest.fn(),
};

jest.mock('../../../services/trade/position-sizing.service', () => ({
  positionSizingService: mockPositionSizingService,
}));

// Mock trade executor service
const mockTradeExecutorService = {
  execute: jest.fn(),
};

jest.mock('../../../services/trade/trade-executor.service', () => ({
  tradeExecutorService: mockTradeExecutorService,
}));

// Mock retry queue service
const mockRetryQueueService = {
  scheduleRetry: jest.fn(),
};

jest.mock('../../../services/trade/retry-queue.service', () => ({
  retryQueueService: mockRetryQueueService,
}));

// Mock market data service
const mockMarketDataService = {
  getMarket: jest.fn(),
};

jest.mock('../../../services/polymarket/market-data.service', () => ({
  marketDataService: mockMarketDataService,
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TradeCopierService', () => {
  let service: TradeCopierService;

  // Default trader
  const defaultTrader = {
    id: 'trader-1',
    walletAddress: '0x1234567890abcdef',
    name: 'Test Trader',
    status: 'ACTIVE',
  };

  // Default position change event
  const defaultPositionChange: PositionChange = {
    type: 'NEW',
    traderId: 'trader-1',
    walletAddress: '0x1234567890abcdef',
    marketId: 'market-1',
    tokenId: 'token-1',
    outcome: 'Yes',
    previousShares: 0,
    currentShares: 100,
    delta: 100,
    price: 0.5,
    timestamp: new Date(),
  };

  // Default execution result
  const defaultExecutionResult = {
    success: true,
    tradeId: 'trade-123',
    orderId: 'order-123',
    executedAmount: 50,
    avgPrice: 0.5,
    shares: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset event listeners on mock
    mockTraderMonitor.removeAllListeners();

    // Create new service instance
    service = new TradeCopierService();

    // Default mock setup
    mockPrisma.trader.findUnique.mockResolvedValue(defaultTrader);
    mockPositionSizingService.calculateSize.mockResolvedValue({
      recommendedSize: 50,
      adjustedSize: 50,
      reasons: [],
      canExecute: true,
      estimatedSlippage: 0.01,
    });
    mockPositionSizingService.getExistingPosition.mockResolvedValue(null);
    mockPositionSizingService.calculateDecreaseSize.mockResolvedValue(50);
    mockTradeExecutorService.execute.mockResolvedValue(defaultExecutionResult);
    mockMarketDataService.getMarket.mockResolvedValue({
      id: 'market-1',
      outcomes: ['Yes', 'No'],
    });
    mockPrisma.activityLog.create.mockResolvedValue({});
  });

  describe('service lifecycle', () => {
    it('should start in stopped state', () => {
      expect(service.isActive()).toBe(false);
    });

    it('should transition to running state on start', () => {
      service.start();
      expect(service.isActive()).toBe(true);
    });

    it('should transition to stopped state on stop', () => {
      service.start();
      service.stop();
      expect(service.isActive()).toBe(false);
    });

    it('should emit started event on start', () => {
      const startedHandler = jest.fn();
      service.on('started', startedHandler);

      service.start();

      expect(startedHandler).toHaveBeenCalled();
    });

    it('should emit stopped event on stop', () => {
      const stoppedHandler = jest.fn();
      service.on('stopped', stoppedHandler);

      service.start();
      service.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should not start if already running', () => {
      const startedHandler = jest.fn();
      service.on('started', startedHandler);

      service.start();
      service.start();

      expect(startedHandler).toHaveBeenCalledTimes(1);
    });

    it('should not stop if already stopped', () => {
      const stoppedHandler = jest.fn();
      service.on('stopped', stoppedHandler);

      service.stop();

      expect(stoppedHandler).not.toHaveBeenCalled();
    });
  });

  describe('position change handling', () => {
    beforeEach(() => {
      service.start();
    });

    it('should not process events when service is stopped', async () => {
      service.stop();

      mockTraderMonitor.emit('position:change', defaultPositionChange);

      // Wait for any async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTradeExecutorService.execute).not.toHaveBeenCalled();
    });

    it('should process position:change events when running', async () => {
      mockTraderMonitor.emit('position:change', defaultPositionChange);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPositionSizingService.calculateSize).toHaveBeenCalled();
    });

    it('should process position:new events as NEW type', async () => {
      mockTraderMonitor.emit('position:new', {
        ...defaultPositionChange,
        type: 'INCREASED', // Will be changed to NEW
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPositionSizingService.calculateSize).toHaveBeenCalled();
    });

    it('should process position:closed events as CLOSED type', async () => {
      mockTraderMonitor.emit('position:closed', defaultPositionChange);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPositionSizingService.calculateSize).toHaveBeenCalled();
    });
  });

  describe('copy trade execution', () => {
    beforeEach(() => {
      service.start();
    });

    it('should skip copy when trader is not active', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        status: 'PAUSED',
      });

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).not.toHaveBeenCalled();
    });

    it('should skip copy when trader not found', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue(null);

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).not.toHaveBeenCalled();
    });

    it('should skip copy when position sizing fails', async () => {
      mockPositionSizingService.calculateSize.mockResolvedValue({
        recommendedSize: 0,
        adjustedSize: 0,
        reasons: ['Insufficient balance'],
        canExecute: false,
        estimatedSlippage: 0,
      });

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).not.toHaveBeenCalled();
    });

    it('should execute BUY trade for NEW position', async () => {
      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        type: 'NEW',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'BUY',
          traderId: 'trader-1',
          tokenId: 'token-1',
        })
      );
    });

    it('should execute BUY trade for INCREASED position', async () => {
      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        type: 'INCREASED',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'BUY',
        })
      );
    });

    it('should execute SELL trade for DECREASED position', async () => {
      mockPositionSizingService.getExistingPosition.mockResolvedValue({
        id: 'position-1',
        shares: 100,
      });

      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        type: 'DECREASED',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'SELL',
        })
      );
    });

    it('should execute SELL trade for CLOSED position', async () => {
      mockPositionSizingService.getExistingPosition.mockResolvedValue({
        id: 'position-1',
        shares: 100,
      });

      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        type: 'CLOSED',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'SELL',
        })
      );
    });

    it('should skip SELL when no existing position to sell', async () => {
      mockPositionSizingService.getExistingPosition.mockResolvedValue(null);

      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        type: 'DECREASED',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).not.toHaveBeenCalled();
    });

    it('should skip SELL when existing position has zero shares', async () => {
      mockPositionSizingService.getExistingPosition.mockResolvedValue({
        id: 'position-1',
        shares: 0,
      });

      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        type: 'DECREASED',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).not.toHaveBeenCalled();
    });

    it('should skip SELL when no shares available to sell', async () => {
      mockPositionSizingService.getExistingPosition.mockResolvedValue({
        id: 'position-1',
        shares: 100,
      });
      mockPositionSizingService.calculateDecreaseSize.mockResolvedValue(0);

      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        type: 'DECREASED',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).not.toHaveBeenCalled();
    });

    it('should use adjusted size from position sizing', async () => {
      mockPositionSizingService.calculateSize.mockResolvedValue({
        recommendedSize: 100,
        adjustedSize: 75, // Reduced due to slippage
        reasons: ['Adjusted for slippage'],
        canExecute: true,
        estimatedSlippage: 0.02,
      });

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 75,
        })
      );
    });

    it('should use market order type', async () => {
      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          orderType: 'MARKET',
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      service.start();
    });

    it('should handle trade execution errors', async () => {
      mockTradeExecutorService.execute.mockRejectedValue(
        new Error('Execution failed')
      );

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should update stats
      const stats = service.getStats();
      expect(stats.failedCopies).toBeGreaterThan(0);
    });

    it('should schedule retry for failed trades', async () => {
      mockTradeExecutorService.execute.mockResolvedValue({
        ...defaultExecutionResult,
        success: false,
        tradeId: 'failed-trade-123',
        error: 'Order rejected',
      });

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockRetryQueueService.scheduleRetry).toHaveBeenCalledWith(
        'failed-trade-123'
      );
    });

    it('should log copy activity on success', async () => {
      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            level: 'INFO',
            category: 'trade',
          }),
        })
      );
    });

    it('should log copy activity on failure', async () => {
      mockTradeExecutorService.execute.mockResolvedValue({
        ...defaultExecutionResult,
        success: false,
        error: 'Execution failed',
      });

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            level: 'WARN',
          }),
        })
      );
    });

    it('should handle activity logging errors gracefully', async () => {
      mockPrisma.activityLog.create.mockRejectedValue(
        new Error('Database error')
      );

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not throw, service continues running
      expect(service.isActive()).toBe(true);
    });
  });

  describe('statistics tracking', () => {
    beforeEach(() => {
      service.start();
    });

    it('should track successful copies', async () => {
      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = service.getStats();
      expect(stats.successfulCopies).toBe(1);
      expect(stats.totalCopied).toBe(1);
    });

    it('should track failed copies', async () => {
      mockTradeExecutorService.execute.mockResolvedValue({
        ...defaultExecutionResult,
        success: false,
      });

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = service.getStats();
      expect(stats.failedCopies).toBe(1);
    });

    it('should track skipped copies', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        status: 'PAUSED',
      });

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = service.getStats();
      expect(stats.skippedCopies).toBe(1);
    });

    it('should track total volume', async () => {
      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = service.getStats();
      expect(stats.totalVolume).toBe(50); // executedAmount
    });

    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getStats();

      expect(stats.totalCopied).toBe(0);
      expect(stats.successfulCopies).toBe(0);
      expect(stats.failedCopies).toBe(0);
      expect(stats.skippedCopies).toBe(0);
      expect(stats.totalVolume).toBe(0);
    });

    it('should return copy of stats to prevent mutation', () => {
      const stats1 = service.getStats();
      stats1.totalCopied = 999;

      const stats2 = service.getStats();
      expect(stats2.totalCopied).not.toBe(999);
    });
  });

  describe('event emission', () => {
    beforeEach(() => {
      service.start();
    });

    it('should emit trade:copied event on successful copy', async () => {
      const copiedHandler = jest.fn();
      service.on('trade:copied', copiedHandler);

      mockTraderMonitor.emit('position:change', defaultPositionChange);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(copiedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          traderId: 'trader-1',
          result: expect.objectContaining({
            success: true,
          }),
        })
      );
    });
  });

  describe('manualCopy', () => {
    it('should execute manual copy trade', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        marketId: 'market-1',
        outcome: 'Yes',
        market: { id: 'market-1' },
      });

      const result = await service.manualCopy('trader-1', 'token-1', 'BUY', 100);

      expect(result.success).toBe(true);
      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          traderId: 'trader-1',
          tokenId: 'token-1',
          side: 'BUY',
          amount: 100,
        })
      );
    });

    it('should return skip result when trader not found', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue(null);

      const result = await service.manualCopy('trader-1', 'token-1', 'BUY', 100);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('Trader not found');
    });

    it('should handle execution errors in manual copy', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        marketId: 'market-1',
        outcome: 'Yes',
      });
      mockTradeExecutorService.execute.mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.manualCopy('trader-1', 'token-1', 'BUY', 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should work with SELL side', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        marketId: 'market-1',
        outcome: 'Yes',
      });

      await service.manualCopy('trader-1', 'token-1', 'SELL', 50);

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'SELL',
          amount: 50,
        })
      );
    });

    it('should use position market and outcome info', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        marketId: 'custom-market',
        outcome: 'No',
      });

      await service.manualCopy('trader-1', 'token-1', 'BUY', 100);

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: 'custom-market',
          outcome: 'No',
        })
      );
    });

    it('should handle missing position gracefully', async () => {
      mockPrisma.position.findFirst.mockResolvedValue(null);

      const result = await service.manualCopy('trader-1', 'token-1', 'BUY', 100);

      expect(result.success).toBe(true);
      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: '',
          outcome: 'Yes',
        })
      );
    });
  });

  describe('concurrent execution handling', () => {
    beforeEach(() => {
      service.start();
    });

    it('should handle rapid successive events', async () => {
      mockTraderMonitor.emit('position:change', defaultPositionChange);
      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        tokenId: 'token-2',
      });
      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        tokenId: 'token-3',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // All should be processed
      expect(mockTradeExecutorService.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('market data integration', () => {
    beforeEach(() => {
      service.start();
    });

    it('should use market outcomes from market data', async () => {
      mockMarketDataService.getMarket.mockResolvedValue({
        id: 'market-1',
        outcomes: ['Yes', 'No'],
      });

      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        outcome: undefined, // No outcome in change
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'Yes', // First outcome from market
        })
      );
    });

    it('should use change outcome if provided', async () => {
      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        outcome: 'No',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'No',
        })
      );
    });

    it('should default to Yes if no outcome available', async () => {
      mockMarketDataService.getMarket.mockResolvedValue(null);

      mockTraderMonitor.emit('position:change', {
        ...defaultPositionChange,
        outcome: undefined,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTradeExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'Yes',
        })
      );
    });
  });
});
