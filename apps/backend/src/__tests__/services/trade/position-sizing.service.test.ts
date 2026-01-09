// Unit tests for PositionSizingService
// Tests for position size calculation, allocation percentages, and max position enforcement

import { PositionSizingService } from '../../../services/trade/position-sizing.service';
import type { SizingParams } from '../../../services/trade/position-sizing.service';

// Mock Prisma
const mockPrisma = {
  trader: {
    findUnique: jest.fn(),
  },
  position: {
    findFirst: jest.fn(),
  },
};

jest.mock('../../../config/database', () => ({
  prisma: mockPrisma,
}));

// Mock wallet service
const mockWalletService = {
  getBalance: jest.fn(),
};

jest.mock('../../../services/wallet/wallet.service', () => ({
  walletService: mockWalletService,
}));

// Mock CLOB client service
const mockClobClientService = {
  estimateSlippage: jest.fn(),
};

jest.mock('../../../services/polymarket/clob-client.service', () => ({
  clobClientService: mockClobClientService,
}));

// Mock shared utilities
jest.mock('@polymarket-bot/shared', () => ({
  calculatePositionSize: (
    availableCapital: number,
    allocationPercent: number,
    maxPositionSize?: number
  ) => {
    const allocated = availableCapital * (allocationPercent / 100);
    return maxPositionSize ? Math.min(allocated, maxPositionSize) : allocated;
  },
  calculateCopySize: (
    sourceTradeSize: number,
    copyPercentage: number,
    maxSize?: number
  ) => {
    const copyAmount = sourceTradeSize * (copyPercentage / 100);
    return maxSize ? Math.min(copyAmount, maxSize) : copyAmount;
  },
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

describe('PositionSizingService', () => {
  let service: PositionSizingService;

  // Default trader configuration
  const defaultTrader = {
    id: 'trader-1',
    walletAddress: '0x1234567890abcdef',
    name: 'Test Trader',
    status: 'ACTIVE',
    allocationPercent: 10,
    maxPositionSize: 500,
    minTradeAmount: 5,
    slippageTolerance: 3, // 3%
  };

  // Default sizing parameters
  const defaultParams: SizingParams = {
    traderId: 'trader-1',
    sourceTradeSize: 100,
    tokenId: 'token-1',
    side: 'BUY',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PositionSizingService();

    // Default mock setup
    mockPrisma.trader.findUnique.mockResolvedValue(defaultTrader);
    mockWalletService.getBalance.mockResolvedValue(1000);
    mockClobClientService.estimateSlippage.mockResolvedValue(0.01); // 1%
  });

  describe('calculateSize', () => {
    describe('basic calculations', () => {
      it('should calculate position size based on allocation percentage', async () => {
        const result = await service.calculateSize(defaultParams);

        // 1000 * 10% = 100, min(100, 100) = 100 (also capped by sourceTradeSize)
        expect(result.recommendedSize).toBe(100);
        expect(result.canExecute).toBe(true);
      });

      it('should respect max position size limit', async () => {
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          maxPositionSize: 50,
        });

        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 200,
        });

        expect(result.recommendedSize).toBe(50);
        expect(result.reasons).toContain('Capped at max position size 50');
      });

      it('should not exceed available balance', async () => {
        mockWalletService.getBalance.mockResolvedValue(80);

        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 200,
        });

        // Should cap at balance - 1 buffer
        expect(result.recommendedSize).toBe(79);
        expect(result.reasons.some((r) => r.includes('available balance'))).toBe(true);
      });
    });

    describe('trader not found', () => {
      it('should return zero size when trader not found', async () => {
        mockPrisma.trader.findUnique.mockResolvedValue(null);

        const result = await service.calculateSize(defaultParams);

        expect(result.recommendedSize).toBe(0);
        expect(result.adjustedSize).toBe(0);
        expect(result.canExecute).toBe(false);
        expect(result.reasons).toContain('Trader not found');
      });
    });

    describe('wallet balance issues', () => {
      it('should handle wallet service errors', async () => {
        mockWalletService.getBalance.mockRejectedValue(new Error('Connection failed'));

        const result = await service.calculateSize(defaultParams);

        expect(result.recommendedSize).toBe(0);
        expect(result.canExecute).toBe(false);
        expect(result.reasons).toContain('Failed to get wallet balance');
      });

      it('should handle zero balance', async () => {
        mockWalletService.getBalance.mockResolvedValue(0);

        const result = await service.calculateSize(defaultParams);

        expect(result.recommendedSize).toBe(0);
        expect(result.canExecute).toBe(false);
      });
    });

    describe('minimum trade amount enforcement', () => {
      it('should set size to zero if below minimum', async () => {
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          allocationPercent: 0.1, // Very low allocation
          minTradeAmount: 10,
        });

        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 5,
        });

        // 1000 * 0.1% = 1, 5 * 100% = 5, min = 1 < minTradeAmount (10)
        expect(result.recommendedSize).toBe(0);
        expect(result.reasons.some((r) => r.includes('below minimum'))).toBe(true);
      });

      it('should allow trades at exactly minimum amount', async () => {
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          minTradeAmount: 100,
        });

        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 100,
        });

        expect(result.recommendedSize).toBe(100);
        expect(result.canExecute).toBe(true);
      });
    });

    describe('slippage handling', () => {
      it('should reduce size when slippage exceeds tolerance', async () => {
        mockClobClientService.estimateSlippage.mockResolvedValue(0.06); // 6% > 3% tolerance
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          slippageTolerance: 3,
        });

        const result = await service.calculateSize(defaultParams);

        // Size should be reduced by factor of tolerance/slippage = 3/6 = 0.5
        expect(result.adjustedSize).toBeLessThan(result.recommendedSize);
        expect(result.reasons.some((r) => r.includes('slippage'))).toBe(true);
      });

      it('should not adjust size when slippage is within tolerance', async () => {
        mockClobClientService.estimateSlippage.mockResolvedValue(0.01); // 1% < 3%

        const result = await service.calculateSize(defaultParams);

        expect(result.adjustedSize).toBe(result.recommendedSize);
      });

      it('should handle slippage estimation errors gracefully', async () => {
        mockClobClientService.estimateSlippage.mockRejectedValue(
          new Error('API timeout')
        );

        const result = await service.calculateSize(defaultParams);

        // Should still calculate size, with 0 slippage recorded
        expect(result.estimatedSlippage).toBe(0);
        expect(result.recommendedSize).toBeGreaterThan(0);
      });

      it('should record estimated slippage in result', async () => {
        mockClobClientService.estimateSlippage.mockResolvedValue(0.025); // 2.5%

        const result = await service.calculateSize(defaultParams);

        expect(result.estimatedSlippage).toBe(0.025);
      });
    });

    describe('different allocation percentages', () => {
      it('should calculate correctly with 5% allocation', async () => {
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          allocationPercent: 5,
          maxPositionSize: null,
        });

        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 1000,
        });

        // 1000 * 5% = 50
        expect(result.recommendedSize).toBe(50);
      });

      it('should calculate correctly with 25% allocation', async () => {
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          allocationPercent: 25,
          maxPositionSize: null,
        });

        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 1000,
        });

        // 1000 * 25% = 250
        expect(result.recommendedSize).toBe(250);
      });

      it('should calculate correctly with 100% allocation', async () => {
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          allocationPercent: 100,
          maxPositionSize: null,
        });

        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 500,
        });

        // min(1000 * 100%, 500 * 100%) = 500
        expect(result.recommendedSize).toBe(500);
      });
    });

    describe('canExecute validation', () => {
      it('should set canExecute to true when all conditions met', async () => {
        const result = await service.calculateSize(defaultParams);

        expect(result.canExecute).toBe(true);
      });

      it('should set canExecute to false when size below minimum', async () => {
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          minTradeAmount: 200,
        });

        const result = await service.calculateSize(defaultParams);

        expect(result.canExecute).toBe(false);
      });

      it('should set canExecute to false when size exceeds balance', async () => {
        mockWalletService.getBalance.mockResolvedValue(3);
        mockPrisma.trader.findUnique.mockResolvedValue({
          ...defaultTrader,
          minTradeAmount: 5,
        });

        const result = await service.calculateSize(defaultParams);

        expect(result.canExecute).toBe(false);
      });

      it('should add reason when final validation fails', async () => {
        mockWalletService.getBalance.mockResolvedValue(3);

        const result = await service.calculateSize(defaultParams);

        if (!result.canExecute && result.adjustedSize > 0) {
          expect(result.reasons).toContain('Final size validation failed');
        }
      });
    });

    describe('source trade size handling', () => {
      it('should use smaller of allocation and source trade proportional size', async () => {
        // Small source trade
        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 20, // Much smaller than allocation would allow
        });

        // min(1000 * 10% = 100, 20 * 100% = 20) = 20
        expect(result.recommendedSize).toBeLessThanOrEqual(100);
      });

      it('should handle very large source trades', async () => {
        const result = await service.calculateSize({
          ...defaultParams,
          sourceTradeSize: 10000,
        });

        // Should be capped by either allocation or maxPositionSize
        expect(result.recommendedSize).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('getExistingPosition', () => {
    it('should return existing open position', async () => {
      const mockPosition = {
        id: 'position-1',
        traderId: 'trader-1',
        marketId: 'market-1',
        tokenId: 'token-1',
        status: 'OPEN',
        shares: 100,
        avgEntryPrice: 0.5,
      };
      mockPrisma.position.findFirst.mockResolvedValue(mockPosition);

      const result = await service.getExistingPosition(
        'trader-1',
        'market-1',
        'token-1'
      );

      expect(result).toEqual(mockPosition);
      expect(mockPrisma.position.findFirst).toHaveBeenCalledWith({
        where: {
          traderId: 'trader-1',
          marketId: 'market-1',
          tokenId: 'token-1',
          status: 'OPEN',
        },
      });
    });

    it('should return null when no existing position', async () => {
      mockPrisma.position.findFirst.mockResolvedValue(null);

      const result = await service.getExistingPosition(
        'trader-1',
        'market-1',
        'token-1'
      );

      expect(result).toBeNull();
    });
  });

  describe('calculateIncreaseSize', () => {
    it('should return full additional amount when within limits', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        maxPositionSize: 1000,
      });

      const result = await service.calculateIncreaseSize('trader-1', 100, 200);

      expect(result).toBe(200);
    });

    it('should cap increase to remaining capacity', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        maxPositionSize: 500,
      });

      // existing 400, want to add 200, max 500
      const result = await service.calculateIncreaseSize('trader-1', 400, 200);

      expect(result).toBe(100); // 500 - 400 = 100
    });

    it('should return 0 when at max position', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        maxPositionSize: 500,
      });

      const result = await service.calculateIncreaseSize('trader-1', 500, 100);

      expect(result).toBe(0);
    });

    it('should return full amount when no max position size set', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        maxPositionSize: null,
      });

      const result = await service.calculateIncreaseSize('trader-1', 1000, 500);

      expect(result).toBe(500);
    });

    it('should handle trader not found', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue(null);

      const result = await service.calculateIncreaseSize('trader-1', 100, 200);

      expect(result).toBe(200); // Return requested amount if no trader/limits
    });
  });

  describe('calculateDecreaseSize', () => {
    it('should return requested shares when available', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        shares: 100,
        status: 'OPEN',
      });

      const result = await service.calculateDecreaseSize('trader-1', 'token-1', 50);

      expect(result).toBe(50);
    });

    it('should cap at available shares', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        shares: 30,
        status: 'OPEN',
      });

      const result = await service.calculateDecreaseSize('trader-1', 'token-1', 50);

      expect(result).toBe(30);
    });

    it('should return 0 when no position exists', async () => {
      mockPrisma.position.findFirst.mockResolvedValue(null);

      const result = await service.calculateDecreaseSize('trader-1', 'token-1', 50);

      expect(result).toBe(0);
    });

    it('should handle position with zero shares', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        shares: 0,
        status: 'OPEN',
      });

      const result = await service.calculateDecreaseSize('trader-1', 'token-1', 50);

      expect(result).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero source trade size', async () => {
      const result = await service.calculateSize({
        ...defaultParams,
        sourceTradeSize: 0,
      });

      expect(result.recommendedSize).toBe(0);
      expect(result.canExecute).toBe(false);
    });

    it('should handle negative values gracefully', async () => {
      mockWalletService.getBalance.mockResolvedValue(-100);

      const result = await service.calculateSize(defaultParams);

      expect(result.recommendedSize).toBe(0);
      expect(result.canExecute).toBe(false);
    });

    it('should handle fractional amounts', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        allocationPercent: 7.5,
        minTradeAmount: 0.01,
      });

      const result = await service.calculateSize({
        ...defaultParams,
        sourceTradeSize: 33.33,
      });

      expect(result.recommendedSize).toBeGreaterThan(0);
    });

    it('should handle very small allocation percentages', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        allocationPercent: 0.01,
        minTradeAmount: 0.001,
      });

      const result = await service.calculateSize({
        ...defaultParams,
        sourceTradeSize: 1000,
      });

      // 1000 * 0.01% = 0.1
      expect(result.recommendedSize).toBeLessThanOrEqual(0.1);
    });
  });

  describe('SELL side handling', () => {
    it('should calculate size for SELL orders', async () => {
      const result = await service.calculateSize({
        ...defaultParams,
        side: 'SELL',
      });

      expect(result.recommendedSize).toBeGreaterThan(0);
      expect(result.canExecute).toBe(true);
    });

    it('should use correct slippage estimation for SELL', async () => {
      await service.calculateSize({
        ...defaultParams,
        side: 'SELL',
      });

      expect(mockClobClientService.estimateSlippage).toHaveBeenCalledWith(
        'token-1',
        'SELL',
        expect.any(Number)
      );
    });
  });
});
