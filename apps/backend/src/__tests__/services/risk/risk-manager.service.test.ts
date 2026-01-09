// Unit tests for RiskManagerService
// Tests for trade validation, position size limits, drawdown checks

import { RiskManagerService } from '../../../services/risk/risk-manager.service';
import type { RiskCheckParams, RiskLimits } from '../../../services/risk/risk-manager.service';

// Mock Prisma
const mockPrisma = {
  trader: {
    findUnique: jest.fn(),
  },
  position: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  trade: {
    findMany: jest.fn(),
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

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('RiskManagerService', () => {
  let service: RiskManagerService;

  // Default trader mock data
  const defaultTrader = {
    id: 'trader-1',
    walletAddress: '0x1234567890abcdef',
    name: 'Test Trader',
    status: 'ACTIVE',
    maxPositionSize: 500,
    maxDrawdownPercent: 20,
    minTradeAmount: 1,
    slippageTolerance: 5,
    allocationPercent: 10,
    peakBalance: 1000,
    totalPnl: 100,
  };

  // Default test params
  const defaultParams: RiskCheckParams = {
    traderId: 'trader-1',
    marketId: 'market-1',
    tokenId: 'token-1',
    side: 'BUY',
    amount: 50,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RiskManagerService();

    // Default mock setup
    mockPrisma.trader.findUnique.mockResolvedValue(defaultTrader);
    mockWalletService.getBalance.mockResolvedValue(1000);
    mockPrisma.position.findMany.mockResolvedValue([]);
    mockPrisma.position.findFirst.mockResolvedValue(null);
    mockPrisma.position.count.mockResolvedValue(0);
    mockPrisma.trade.findMany.mockResolvedValue([]);
    mockClobClientService.estimateSlippage.mockResolvedValue(0.01); // 1% slippage
  });

  describe('checkTradeRisk', () => {
    it('should approve valid trade with all checks passing', async () => {
      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(true);
      expect(result.rejectionReason).toBeUndefined();
      expect(result.riskMetrics).toBeDefined();
    });

    it('should reject trade when trader not found', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue(null);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toBe('Trader not found');
    });

    it('should include risk metrics in response', async () => {
      const result = await service.checkTradeRisk(defaultParams);

      expect(result.riskMetrics).toHaveProperty('currentDrawdown');
      expect(result.riskMetrics).toHaveProperty('dailyPnl');
      expect(result.riskMetrics).toHaveProperty('openPositionValue');
      expect(result.riskMetrics).toHaveProperty('availableBalance');
      expect(result.riskMetrics).toHaveProperty('estimatedSlippage');
    });
  });

  describe('balance checks', () => {
    it('should reject BUY trade when insufficient balance', async () => {
      mockWalletService.getBalance.mockResolvedValue(30); // Less than amount (50)

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('Insufficient balance');
    });

    it('should add warning when balance is low but sufficient', async () => {
      mockWalletService.getBalance.mockResolvedValue(52); // Amount + less than $5 buffer

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(true);
      expect(result.warnings.some((w) => w.includes('Low balance'))).toBe(true);
    });

    it('should always pass balance check for SELL orders', async () => {
      mockWalletService.getBalance.mockResolvedValue(0);

      const result = await service.checkTradeRisk({
        ...defaultParams,
        side: 'SELL',
      });

      // Should not fail due to balance (may fail other checks)
      expect(result.rejectionReason).not.toContain('Insufficient balance');
    });

    it('should handle wallet service errors gracefully', async () => {
      mockWalletService.getBalance.mockRejectedValue(new Error('Wallet error'));

      const result = await service.checkTradeRisk(defaultParams);

      // Should still process, with 0 balance
      expect(result.riskMetrics.availableBalance).toBe(0);
    });
  });

  describe('position size limits', () => {
    it('should reject when position would exceed max size', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        shares: 1000,
        avgEntryPrice: 0.5,
      });

      const result = await service.checkTradeRisk({
        ...defaultParams,
        amount: 100, // Would exceed 500 max
      });

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('Position size limit reached');
    });

    it('should adjust amount to stay within position limit', async () => {
      mockPrisma.position.findFirst.mockResolvedValue({
        id: 'position-1',
        shares: 800,
        avgEntryPrice: 0.5, // Current value = 400
      });

      const result = await service.checkTradeRisk({
        ...defaultParams,
        amount: 150, // 400 + 150 = 550 > 500 max
      });

      expect(result.approved).toBe(true);
      expect(result.adjustedAmount).toBe(100); // 500 - 400 = 100 remaining
      expect(result.warnings.some((w) => w.includes('adjusted'))).toBe(true);
    });

    it('should allow trade when no existing position', async () => {
      mockPrisma.position.findFirst.mockResolvedValue(null);

      const result = await service.checkTradeRisk({
        ...defaultParams,
        amount: 200,
      });

      expect(result.approved).toBe(true);
      expect(result.adjustedAmount).toBeUndefined();
    });

    it('should use global limits when trader has no custom limits', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        maxPositionSize: null, // No custom limit
      });

      const result = await service.checkTradeRisk(defaultParams);

      // Should use global limit (1000 by default)
      expect(result.approved).toBe(true);
    });
  });

  describe('drawdown checks', () => {
    it('should reject when max drawdown exceeded', async () => {
      // Set up for 25% drawdown (exceeds 20% limit)
      mockWalletService.getBalance.mockResolvedValue(750);
      mockPrisma.position.findMany.mockResolvedValue([]);
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        peakBalance: 1000,
      });

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('drawdown');
    });

    it('should add warning when approaching drawdown limit', async () => {
      // Set up for 17% drawdown (>80% of 20% limit)
      mockWalletService.getBalance.mockResolvedValue(830);
      mockPrisma.position.findMany.mockResolvedValue([]);
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        peakBalance: 1000,
      });

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(true);
      expect(result.warnings.some((w) => w.includes('drawdown'))).toBe(true);
    });

    it('should pass when drawdown is within acceptable range', async () => {
      // Set up for 5% drawdown (well under 20% limit)
      mockWalletService.getBalance.mockResolvedValue(950);
      mockPrisma.position.findMany.mockResolvedValue([]);
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        peakBalance: 1000,
      });

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(true);
      expect(result.riskMetrics.currentDrawdown).toBeCloseTo(5, 0);
    });

    it('should handle zero peak balance', async () => {
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        peakBalance: 0,
      });

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.riskMetrics.currentDrawdown).toBe(0);
    });
  });

  describe('daily loss limit checks', () => {
    it('should reject when daily loss limit exceeded', async () => {
      // Set up trades with -600 P&L (exceeds 500 limit)
      mockPrisma.trade.findMany.mockResolvedValue([
        { executedAmount: 50, requestedAmount: 200 }, // -150 P&L
        { executedAmount: 100, requestedAmount: 300 }, // -200 P&L
        { executedAmount: 50, requestedAmount: 300 }, // -250 P&L
      ]);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('Daily loss limit');
    });

    it('should add warning when approaching daily loss limit', async () => {
      // Set up trades with -420 P&L (>80% of 500 limit)
      mockPrisma.trade.findMany.mockResolvedValue([
        { executedAmount: 50, requestedAmount: 200 }, // -150 P&L
        { executedAmount: 30, requestedAmount: 300 }, // -270 P&L
      ]);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(true);
      expect(result.warnings.some((w) => w.includes('daily loss'))).toBe(true);
    });

    it('should pass with profitable trading day', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([
        { executedAmount: 250, requestedAmount: 200 }, // +50 P&L
        { executedAmount: 350, requestedAmount: 300 }, // +50 P&L
      ]);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(true);
      expect(result.riskMetrics.dailyPnl).toBe(100);
    });
  });

  describe('max open positions check', () => {
    it('should reject when max open positions reached', async () => {
      mockPrisma.position.count.mockResolvedValue(10); // 10 = max default

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('Max open positions');
    });

    it('should allow trade when under position limit', async () => {
      mockPrisma.position.count.mockResolvedValue(5);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(true);
    });
  });

  describe('slippage checks', () => {
    it('should reject when slippage exceeds tolerance', async () => {
      mockClobClientService.estimateSlippage.mockResolvedValue(0.10); // 10% > 5% limit

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('slippage');
    });

    it('should add warning when slippage is high but acceptable', async () => {
      mockClobClientService.estimateSlippage.mockResolvedValue(0.04); // 4% (>70% of 5%)

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(true);
      expect(result.warnings.some((w) => w.includes('slippage'))).toBe(true);
    });

    it('should handle slippage estimation errors gracefully', async () => {
      mockClobClientService.estimateSlippage.mockRejectedValue(
        new Error('API error')
      );

      const result = await service.checkTradeRisk(defaultParams);

      // Should pass with warning
      expect(result.approved).toBe(true);
      expect(result.warnings.some((w) => w.includes('slippage'))).toBe(true);
    });

    it('should record estimated slippage in metrics', async () => {
      mockClobClientService.estimateSlippage.mockResolvedValue(0.02); // 2%

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.riskMetrics.estimatedSlippage).toBe(2);
    });
  });

  describe('minimum trade amount check', () => {
    it('should reject trade below minimum amount', async () => {
      const result = await service.checkTradeRisk({
        ...defaultParams,
        amount: 0.5, // Below 1 minimum
      });

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('below minimum');
    });

    it('should allow trade at exactly minimum amount', async () => {
      const result = await service.checkTradeRisk({
        ...defaultParams,
        amount: 1, // Exactly minimum
      });

      expect(result.approved).toBe(true);
    });
  });

  describe('global limits management', () => {
    it('should allow setting custom global limits', () => {
      const customLimits: Partial<RiskLimits> = {
        maxPositionSize: 2000,
        maxDrawdownPercent: 30,
        dailyLossLimit: 1000,
      };

      service.setGlobalLimits(customLimits);
      const limits = service.getGlobalLimits();

      expect(limits.maxPositionSize).toBe(2000);
      expect(limits.maxDrawdownPercent).toBe(30);
      expect(limits.dailyLossLimit).toBe(1000);
    });

    it('should preserve existing limits when setting partial updates', () => {
      service.setGlobalLimits({ maxPositionSize: 5000 });
      const limits = service.getGlobalLimits();

      expect(limits.maxPositionSize).toBe(5000);
      expect(limits.maxOpenPositions).toBe(10); // Default preserved
    });

    it('should return copy of limits to prevent direct mutation', () => {
      const limits1 = service.getGlobalLimits();
      limits1.maxPositionSize = 9999;

      const limits2 = service.getGlobalLimits();
      expect(limits2.maxPositionSize).not.toBe(9999);
    });
  });

  describe('risk metrics calculation', () => {
    it('should calculate open position value correctly', async () => {
      mockPrisma.position.findMany.mockResolvedValue([
        { shares: 100, avgEntryPrice: 0.5 }, // value = 50
        { shares: 200, avgEntryPrice: 0.6 }, // value = 120
      ]);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.riskMetrics.openPositionValue).toBe(170);
    });

    it('should calculate daily P&L from executed trades', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([
        { executedAmount: 110, requestedAmount: 100 }, // +10
        { executedAmount: 180, requestedAmount: 200 }, // -20
        { executedAmount: 50, requestedAmount: 50 },   // 0
      ]);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.riskMetrics.dailyPnl).toBe(-10);
    });

    it('should handle null executedAmount in trades', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([
        { executedAmount: null, requestedAmount: 100 },
        { executedAmount: 150, requestedAmount: 100 },
      ]);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.riskMetrics.dailyPnl).toBe(-50); // Only count non-null
    });
  });

  describe('warnings accumulation', () => {
    it('should accumulate multiple warnings', async () => {
      // Set up for multiple warnings
      mockWalletService.getBalance.mockResolvedValue(52); // Low balance warning
      mockClobClientService.estimateSlippage.mockResolvedValue(0.04); // High slippage warning

      // 17% drawdown warning
      mockPrisma.trader.findUnique.mockResolvedValue({
        ...defaultTrader,
        peakBalance: 1000,
      });
      mockWalletService.getBalance.mockResolvedValue(830);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero amount trade', async () => {
      const result = await service.checkTradeRisk({
        ...defaultParams,
        amount: 0,
      });

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('below minimum');
    });

    it('should handle very large trade amount', async () => {
      const result = await service.checkTradeRisk({
        ...defaultParams,
        amount: 1000000,
      });

      // Should fail due to balance/position size limits
      expect(result.approved).toBe(false);
    });

    it('should handle negative values gracefully', async () => {
      mockWalletService.getBalance.mockResolvedValue(-100);

      const result = await service.checkTradeRisk(defaultParams);

      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('Insufficient balance');
    });
  });
});
