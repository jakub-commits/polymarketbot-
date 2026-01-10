// Unit tests for TraderMonitorService
// Tests for trader monitoring, position detection, and event emission

import type { UserPosition } from '../../../services/polymarket/gamma-api.service';

// Mock dependencies - define inline to avoid hoisting issues
jest.mock('../../../config/database', () => ({
  prisma: {
    trader: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../services/polymarket/gamma-api.service', () => ({
  gammaApiService: {
    getUserPositions: jest.fn(),
  },
}));

jest.mock('../../../server', () => ({
  io: {
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
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

// Import after mocks are set up
import { TraderMonitorService } from '../../../services/trader/trader-monitor.service';
import { prisma } from '../../../config/database';
import { gammaApiService } from '../../../services/polymarket/gamma-api.service';
import { io } from '../../../server';
import { logger } from '../../../utils/logger';

// Get mocked references
const mockPrisma = jest.mocked(prisma);
const mockGammaApiService = jest.mocked(gammaApiService);
const mockIo = jest.mocked(io);
const mockLogger = jest.mocked(logger);

// Helper to wait for a short period (for real timer tests)
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('TraderMonitorService', () => {
  let service: TraderMonitorService;

  // Default trader mock data
  const defaultTrader = {
    id: 'trader-1',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Test Trader',
    status: 'ACTIVE',
    copyEnabled: true,
  };

  // Default user position from Gamma API
  const createPosition = (overrides: Partial<UserPosition> = {}): UserPosition => ({
    conditionId: 'condition-1',
    tokenId: 'token-1',
    outcome: 'Yes',
    shares: 100,
    avgPrice: 0.5,
    marketQuestion: 'Will BTC reach $100k?',
    marketSlug: 'btc-100k',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create new service instance for each test
    service = new TraderMonitorService();

    // Default mock setup
    mockPrisma.trader.findUnique.mockResolvedValue(defaultTrader);
    mockPrisma.trader.findMany.mockResolvedValue([defaultTrader]);
    mockGammaApiService.getUserPositions.mockResolvedValue([]);

    // Setup io mock
    mockIo.to.mockReturnValue({
      emit: jest.fn(),
    } as any);
  });

  afterEach(() => {
    // Clean up all monitoring
    service.stopAll();
  });

  describe('startMonitoring', () => {
    it('should start monitoring a trader successfully', async () => {
      const positions = [createPosition()];
      mockGammaApiService.getUserPositions.mockResolvedValue(positions);

      await service.startMonitoring('trader-1');

      const status = service.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.monitoredCount).toBe(1);
      expect(status.traders).toContainEqual({
        id: 'trader-1',
        walletAddress: defaultTrader.walletAddress,
      });
    });

    it('should fetch initial positions when starting monitoring', async () => {
      const positions = [createPosition(), createPosition({ tokenId: 'token-2' })];
      mockGammaApiService.getUserPositions.mockResolvedValue(positions);

      await service.startMonitoring('trader-1');

      expect(mockGammaApiService.getUserPositions).toHaveBeenCalledWith(
        defaultTrader.walletAddress
      );
    });

    it('should not start monitoring if trader already being monitored', async () => {
      await service.startMonitoring('trader-1');

      // Reset mock to track second call
      mockGammaApiService.getUserPositions.mockClear();

      await service.startMonitoring('trader-1');

      // Should not fetch positions again
      expect(mockGammaApiService.getUserPositions).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { traderId: 'trader-1' },
        'Trader already being monitored'
      );
    });

    it('should not start monitoring if trader not found', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue(null);

      await service.startMonitoring('non-existent-trader');

      const status = service.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.monitoredCount).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { traderId: 'non-existent-trader' },
        'Trader not found for monitoring'
      );
    });

    it('should use default interval when not specified', async () => {
      await service.startMonitoring('trader-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        { traderId: 'trader-1', interval: 2000 },
        'Started monitoring trader'
      );
    });

    it('should use custom interval when specified', async () => {
      await service.startMonitoring('trader-1', 5000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { traderId: 'trader-1', interval: 5000 },
        'Started monitoring trader'
      );
    });

    it('should set isRunning to true when monitoring starts', async () => {
      expect(service.getStatus().isRunning).toBe(false);

      await service.startMonitoring('trader-1');

      expect(service.getStatus().isRunning).toBe(true);
    });

    it('should handle API error during initial position fetch', async () => {
      mockGammaApiService.getUserPositions.mockRejectedValue(new Error('API unavailable'));

      await expect(service.startMonitoring('trader-1')).rejects.toThrow('API unavailable');
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring a specific trader', async () => {
      await service.startMonitoring('trader-1');
      expect(service.getStatus().monitoredCount).toBe(1);

      service.stopMonitoring('trader-1');

      const status = service.getStatus();
      expect(status.monitoredCount).toBe(0);
      expect(status.traders).toHaveLength(0);
    });

    it('should log when stopping monitoring', async () => {
      await service.startMonitoring('trader-1');

      service.stopMonitoring('trader-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        { traderId: 'trader-1' },
        'Stopped monitoring trader'
      );
    });

    it('should set isRunning to false when all traders stopped', async () => {
      await service.startMonitoring('trader-1');
      expect(service.getStatus().isRunning).toBe(true);

      service.stopMonitoring('trader-1');

      expect(service.getStatus().isRunning).toBe(false);
    });

    it('should handle stopping non-existent trader gracefully', () => {
      // Should not throw
      expect(() => service.stopMonitoring('non-existent')).not.toThrow();
    });

    it('should clean up intervals on stopMonitoring', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await service.startMonitoring('trader-1');
      service.stopMonitoring('trader-1');

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('stopAll', () => {
    it('should stop all monitored traders', async () => {
      // Setup multiple traders
      mockPrisma.trader.findUnique
        .mockResolvedValueOnce(defaultTrader)
        .mockResolvedValueOnce({
          ...defaultTrader,
          id: 'trader-2',
          walletAddress: '0xabcdef1234567890',
        });

      await service.startMonitoring('trader-1');
      await service.startMonitoring('trader-2');

      expect(service.getStatus().monitoredCount).toBe(2);

      service.stopAll();

      const status = service.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.monitoredCount).toBe(0);
    });

    it('should log when stopping all monitoring', async () => {
      await service.startMonitoring('trader-1');

      service.stopAll();

      expect(mockLogger.info).toHaveBeenCalledWith('Stopped all trader monitoring');
    });

    it('should set isRunning to false', async () => {
      await service.startMonitoring('trader-1');

      service.stopAll();

      expect(service.getStatus().isRunning).toBe(false);
    });

    it('should clean up all intervals on stopAll', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const trader2 = {
        ...defaultTrader,
        id: 'trader-2',
        walletAddress: '0xabc',
      };

      mockPrisma.trader.findUnique
        .mockResolvedValueOnce(defaultTrader)
        .mockResolvedValueOnce(trader2);

      await service.startMonitoring('trader-1');
      await service.startMonitoring('trader-2');

      service.stopAll();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
      clearIntervalSpy.mockRestore();
    });
  });

  describe('position change detection (with real timers)', () => {
    it('should detect new positions', async () => {
      // Start with no positions
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50); // Very short interval for tests

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      // Now return a new position
      const newPosition = createPosition();
      mockGammaApiService.getUserPositions.mockResolvedValue([newPosition]);

      // Wait for interval to trigger
      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NEW',
          traderId: 'trader-1',
          tokenId: 'token-1',
          previousShares: 0,
          currentShares: 100,
          delta: 100,
        })
      );
    });

    it('should detect increased positions', async () => {
      // Start with existing position
      const initialPosition = createPosition({ shares: 100 });
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([initialPosition]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      // Now return increased position
      const increasedPosition = createPosition({ shares: 150 });
      mockGammaApiService.getUserPositions.mockResolvedValue([increasedPosition]);

      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INCREASED',
          traderId: 'trader-1',
          tokenId: 'token-1',
          previousShares: 100,
          currentShares: 150,
          delta: 50,
        })
      );
    });

    it('should detect decreased positions', async () => {
      // Start with existing position
      const initialPosition = createPosition({ shares: 100 });
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([initialPosition]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      // Now return decreased position
      const decreasedPosition = createPosition({ shares: 60 });
      mockGammaApiService.getUserPositions.mockResolvedValue([decreasedPosition]);

      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DECREASED',
          traderId: 'trader-1',
          tokenId: 'token-1',
          previousShares: 100,
          currentShares: 60,
          delta: 40,
        })
      );
    });

    it('should detect closed positions', async () => {
      // Start with existing position
      const initialPosition = createPosition();
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([initialPosition]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      // Now return no positions (position closed)
      mockGammaApiService.getUserPositions.mockResolvedValue([]);

      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLOSED',
          traderId: 'trader-1',
          tokenId: 'token-1',
          previousShares: 100,
          currentShares: 0,
          delta: 100,
        })
      );
    });

    it('should not emit event when position unchanged', async () => {
      const position = createPosition({ shares: 100 });
      mockGammaApiService.getUserPositions.mockResolvedValue([position]);

      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      // Wait for interval - position should be same
      await wait(100);

      expect(positionChangeHandler).not.toHaveBeenCalled();
    });

    it('should include correct market and price info in position change', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      const newPosition = createPosition({
        conditionId: 'market-123',
        tokenId: 'token-abc',
        outcome: 'No',
        avgPrice: 0.75,
      });
      mockGammaApiService.getUserPositions.mockResolvedValue([newPosition]);

      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: 'market-123',
          tokenId: 'token-abc',
          outcome: 'No',
          price: 0.75,
          walletAddress: defaultTrader.walletAddress,
        })
      );
    });

    it('should include timestamp in position change', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      mockGammaApiService.getUserPositions.mockResolvedValue([createPosition()]);

      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('API error handling', () => {
    it('should emit error event on API failure', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      const errorHandler = jest.fn();
      service.on('error', errorHandler);

      const apiError = new Error('API rate limit exceeded');
      mockGammaApiService.getUserPositions.mockRejectedValue(apiError);

      await wait(100);

      expect(errorHandler).toHaveBeenCalledWith({
        traderId: 'trader-1',
        error: apiError,
      });
    });

    it('should log error on API failure', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      // Add error handler to prevent unhandled error
      service.on('error', () => {});

      const apiError = new Error('Network timeout');
      mockGammaApiService.getUserPositions.mockRejectedValue(apiError);

      await wait(100);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { traderId: 'trader-1', error: apiError },
        'Error checking positions'
      );
    });

    it('should continue monitoring after API error', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      // Add error handler to prevent unhandled error
      service.on('error', () => {});

      // First check fails
      mockGammaApiService.getUserPositions.mockRejectedValueOnce(new Error('Temporary error'));

      await wait(100);

      expect(service.getStatus().isRunning).toBe(true);
      expect(service.getStatus().monitoredCount).toBe(1);
    });
  });

  describe('multiple traders monitoring simultaneously', () => {
    it('should monitor multiple traders independently', async () => {
      const trader2 = {
        ...defaultTrader,
        id: 'trader-2',
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      };

      mockPrisma.trader.findUnique
        .mockResolvedValueOnce(defaultTrader)
        .mockResolvedValueOnce(trader2);

      await service.startMonitoring('trader-1', 1000);
      await service.startMonitoring('trader-2', 1000);

      const status = service.getStatus();
      expect(status.monitoredCount).toBe(2);
      expect(status.traders).toHaveLength(2);
    });

    it('should allow stopping one trader while others continue', async () => {
      const trader2 = {
        ...defaultTrader,
        id: 'trader-2',
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      };

      mockPrisma.trader.findUnique
        .mockResolvedValueOnce(defaultTrader)
        .mockResolvedValueOnce(trader2);

      mockGammaApiService.getUserPositions.mockResolvedValue([]);

      await service.startMonitoring('trader-1', 1000);
      await service.startMonitoring('trader-2', 1000);

      service.stopMonitoring('trader-1');

      const status = service.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.monitoredCount).toBe(1);
      expect(status.traders).toContainEqual({
        id: 'trader-2',
        walletAddress: trader2.walletAddress,
      });
    });
  });

  describe('event emission on position changes', () => {
    it('should emit position:change event with correct payload', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      const newPosition = createPosition({
        conditionId: 'market-xyz',
        tokenId: 'token-xyz',
        outcome: 'Yes',
        shares: 250,
        avgPrice: 0.65,
      });
      mockGammaApiService.getUserPositions.mockResolvedValue([newPosition]);

      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith({
        type: 'NEW',
        traderId: 'trader-1',
        walletAddress: defaultTrader.walletAddress,
        marketId: 'market-xyz',
        tokenId: 'token-xyz',
        outcome: 'Yes',
        previousShares: 0,
        currentShares: 250,
        delta: 250,
        price: 0.65,
        timestamp: expect.any(Date),
      });
    });

    it('should log position change detection', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      mockGammaApiService.getUserPositions.mockResolvedValue([createPosition()]);

      await wait(100);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          traderId: 'trader-1',
          type: 'NEW',
          tokenId: 'token-1',
          delta: 100,
        }),
        'Position change detected'
      );
    });

    it('should broadcast change via WebSocket to trader room', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit } as any);

      mockGammaApiService.getUserPositions.mockResolvedValue([createPosition()]);

      await wait(100);

      expect(mockIo.to).toHaveBeenCalledWith('trader:trader-1');
      expect(mockEmit).toHaveBeenCalledWith(
        'trader:positionDetected',
        expect.objectContaining({
          traderId: 'trader-1',
          marketId: 'condition-1',
          outcome: 'Yes',
          action: 'BUY',
        })
      );
    });

    it('should broadcast change via WebSocket to all subscribers', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit } as any);

      mockGammaApiService.getUserPositions.mockResolvedValue([createPosition()]);

      await wait(100);

      expect(mockIo.to).toHaveBeenCalledWith('all');
    });

    it('should set action to SELL for DECREASED positions', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([createPosition({ shares: 100 })]);
      await service.startMonitoring('trader-1', 50);

      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit } as any);

      mockGammaApiService.getUserPositions.mockResolvedValue([createPosition({ shares: 50 })]);

      await wait(100);

      expect(mockEmit).toHaveBeenCalledWith(
        'trader:positionDetected',
        expect.objectContaining({
          action: 'SELL',
        })
      );
    });

    it('should set action to SELL for CLOSED positions', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([createPosition()]);
      await service.startMonitoring('trader-1', 50);

      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit } as any);

      mockGammaApiService.getUserPositions.mockResolvedValue([]);

      await wait(100);

      expect(mockEmit).toHaveBeenCalledWith(
        'trader:positionDetected',
        expect.objectContaining({
          action: 'SELL',
        })
      );
    });

    it('should handle WebSocket broadcast errors gracefully', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      // Make io.to throw
      mockIo.to.mockImplementation(() => {
        throw new Error('WebSocket error');
      });

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      mockGammaApiService.getUserPositions.mockResolvedValue([createPosition()]);

      await wait(100);

      // Should still emit the event even if broadcast fails
      expect(positionChangeHandler).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to broadcast position change'
      );
    });
  });

  describe('startAll', () => {
    it('should start monitoring all active traders with copyEnabled', async () => {
      const activeTraders = [
        { ...defaultTrader, id: 'trader-1' },
        { ...defaultTrader, id: 'trader-2', walletAddress: '0xabc123' },
        { ...defaultTrader, id: 'trader-3', walletAddress: '0xdef456' },
      ];

      mockPrisma.trader.findMany.mockResolvedValue(activeTraders);
      mockPrisma.trader.findUnique
        .mockResolvedValueOnce(activeTraders[0])
        .mockResolvedValueOnce(activeTraders[1])
        .mockResolvedValueOnce(activeTraders[2]);
      mockGammaApiService.getUserPositions.mockResolvedValue([]);

      await service.startAll();

      expect(mockPrisma.trader.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          copyEnabled: true,
        },
      });
      expect(service.getStatus().monitoredCount).toBe(3);
    });

    it('should log the count of started traders', async () => {
      mockPrisma.trader.findMany.mockResolvedValue([defaultTrader]);
      mockPrisma.trader.findUnique.mockResolvedValue(defaultTrader);
      mockGammaApiService.getUserPositions.mockResolvedValue([]);

      await service.startAll();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { count: 1 },
        'Started monitoring all active traders'
      );
    });

    it('should handle empty trader list', async () => {
      mockPrisma.trader.findMany.mockResolvedValue([]);

      await service.startAll();

      expect(service.getStatus().monitoredCount).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { count: 0 },
        'Started monitoring all active traders'
      );
    });
  });

  describe('getStatus', () => {
    it('should return correct status when not running', () => {
      const status = service.getStatus();

      expect(status).toEqual({
        isRunning: false,
        monitoredCount: 0,
        traders: [],
      });
    });

    it('should return correct status when monitoring traders', async () => {
      await service.startMonitoring('trader-1');

      const status = service.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.monitoredCount).toBe(1);
      expect(status.traders).toEqual([
        {
          id: 'trader-1',
          walletAddress: defaultTrader.walletAddress,
        },
      ]);
    });

    it('should return correct count with multiple traders', async () => {
      const traders = [
        defaultTrader,
        { ...defaultTrader, id: 'trader-2', walletAddress: '0xabc' },
        { ...defaultTrader, id: 'trader-3', walletAddress: '0xdef' },
      ];

      for (let i = 0; i < traders.length; i++) {
        mockPrisma.trader.findUnique.mockResolvedValueOnce(traders[i]);
        await service.startMonitoring(traders[i].id);
      }

      const status = service.getStatus();

      expect(status.monitoredCount).toBe(3);
      expect(status.traders).toHaveLength(3);
    });
  });

  describe('cleanup on stop', () => {
    it('should remove trader from monitored map on stop', async () => {
      await service.startMonitoring('trader-1');
      expect(service.getStatus().monitoredCount).toBe(1);

      service.stopMonitoring('trader-1');

      expect(service.getStatus().monitoredCount).toBe(0);
      expect(service.getStatus().traders).toHaveLength(0);
    });

    it('should allow re-monitoring after stop', async () => {
      await service.startMonitoring('trader-1');
      service.stopMonitoring('trader-1');

      mockGammaApiService.getUserPositions.mockClear();

      await service.startMonitoring('trader-1');

      expect(service.getStatus().monitoredCount).toBe(1);
      expect(mockGammaApiService.getUserPositions).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle trader with no wallet address', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        walletAddress: '',
      });

      await service.startMonitoring('trader-1');

      expect(mockGammaApiService.getUserPositions).toHaveBeenCalledWith('');
    });

    it('should handle very large position changes', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      const largePosition = createPosition({ shares: 1000000 });
      mockGammaApiService.getUserPositions.mockResolvedValue([largePosition]);

      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          currentShares: 1000000,
          delta: 1000000,
        })
      );
    });

    it('should handle zero-share positions from API', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      // API returns position with 0 shares (should still be treated as new)
      const zeroPosition = createPosition({ shares: 0 });
      mockGammaApiService.getUserPositions.mockResolvedValue([zeroPosition]);

      await wait(100);

      // Should detect as new position
      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NEW',
          currentShares: 0,
          delta: 0,
        })
      );
    });

    it('should handle position with decimal shares', async () => {
      mockGammaApiService.getUserPositions.mockResolvedValueOnce([
        createPosition({ shares: 100.5 }),
      ]);
      await service.startMonitoring('trader-1', 50);

      const positionChangeHandler = jest.fn();
      service.on('position:change', positionChangeHandler);

      mockGammaApiService.getUserPositions.mockResolvedValue([
        createPosition({ shares: 150.75 }),
      ]);

      await wait(100);

      expect(positionChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          previousShares: 100.5,
          currentShares: 150.75,
          delta: 50.25,
        })
      );
    });
  });
});
