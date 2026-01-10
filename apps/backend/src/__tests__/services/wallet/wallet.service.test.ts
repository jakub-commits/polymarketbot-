// Unit tests for WalletService
// Tests wallet initialization, encryption, balance retrieval, and error handling

// Mock config - must be hoisted, so we define the object first
const mockConfig = {
  botWalletEncryptedKey: 'encrypted-key-base64' as string | undefined,
  botWalletAddress: '0x1234567890abcdef1234567890abcdef12345678' as string | undefined,
  encryptionKey: 'test-encryption-key-32-characters',
  polymarketNetwork: 'testnet' as 'testnet' | 'mainnet',
};

jest.mock('../../../config/index', () => ({
  config: mockConfig,
}));

// Mock ethers
const mockWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';
jest.mock('ethers', () => ({
  ethers: {
    Wallet: jest.fn().mockImplementation(() => ({
      address: mockWalletAddress,
    })),
  },
}));

// Mock Prisma
const mockPrismaUpsert = jest.fn().mockResolvedValue({});
const mockPrismaUpdate = jest.fn().mockResolvedValue({});
const mockPrismaFindUnique = jest.fn();

jest.mock('../../../config/database', () => ({
  prisma: {
    botWallet: {
      upsert: (...args: unknown[]) => mockPrismaUpsert(...args),
      update: (...args: unknown[]) => mockPrismaUpdate(...args),
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
    },
  },
}));

// Mock encryption service
const mockDecryptWithConfigKey = jest.fn();
const mockIsValidPrivateKey = jest.fn();

jest.mock('../../../services/wallet/encryption.service', () => ({
  encryptionService: {
    decryptWithConfigKey: (...args: unknown[]) => mockDecryptWithConfigKey(...args),
    isValidPrivateKey: (...args: unknown[]) => mockIsValidPrivateKey(...args),
  },
}));

// Mock CLOB client service
const mockClobInitialize = jest.fn().mockResolvedValue(undefined);
const mockClobGetBalance = jest.fn();

jest.mock('../../../services/polymarket/clob-client.service', () => ({
  clobClientService: {
    initialize: (...args: unknown[]) => mockClobInitialize(...args),
    getBalance: () => mockClobGetBalance(),
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

// Import after all mocks are set up
import { WalletService } from '../../../services/wallet/wallet.service';
import { AppError, ERROR_CODES } from '@polymarket-bot/shared';

describe('WalletService', () => {
  let service: WalletService;
  const validPrivateKey = '0x' + 'a'.repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset config to default values
    mockConfig.botWalletEncryptedKey = 'encrypted-key-base64';
    mockConfig.botWalletAddress = mockWalletAddress;
    mockConfig.encryptionKey = 'test-encryption-key-32-characters';
    mockConfig.polymarketNetwork = 'testnet';

    // Reset mock implementations to defaults
    mockDecryptWithConfigKey.mockResolvedValue(validPrivateKey);
    mockIsValidPrivateKey.mockReturnValue(true);
    mockClobInitialize.mockResolvedValue(undefined);
    mockClobGetBalance.mockResolvedValue(1000);
    mockPrismaUpsert.mockResolvedValue({});
    mockPrismaUpdate.mockResolvedValue({});
    mockPrismaFindUnique.mockResolvedValue(null);

    // Create a new service instance for each test
    service = new WalletService();
  });

  describe('initialization', () => {
    describe('with valid encrypted key', () => {
      it('should initialize successfully with valid encrypted private key', async () => {
        await service.initialize();

        expect(service.isReady()).toBe(true);
        expect(mockDecryptWithConfigKey).toHaveBeenCalledWith('encrypted-key-base64');
        expect(mockIsValidPrivateKey).toHaveBeenCalledWith(validPrivateKey);
        expect(mockClobInitialize).toHaveBeenCalledWith(validPrivateKey);
      });

      it('should set wallet address after initialization', async () => {
        await service.initialize();

        expect(service.getAddress()).toBe(mockWalletAddress);
      });

      it('should update wallet info in database after initialization', async () => {
        await service.initialize();

        expect(mockPrismaUpsert).toHaveBeenCalledWith({
          where: { address: mockWalletAddress.toLowerCase() },
          update: {
            isActive: true,
            network: 'TESTNET',
          },
          create: {
            address: mockWalletAddress.toLowerCase(),
            network: 'TESTNET',
            isActive: true,
            usdcBalance: 0,
          },
        });
      });

      it('should set network to MAINNET when config is mainnet', async () => {
        mockConfig.polymarketNetwork = 'mainnet';

        await service.initialize();

        expect(mockPrismaUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              network: 'MAINNET',
            }),
            create: expect.objectContaining({
              network: 'MAINNET',
            }),
          })
        );
      });

      it('should initialize CLOB client with decrypted private key', async () => {
        await service.initialize();

        expect(mockClobInitialize).toHaveBeenCalledWith(validPrivateKey);
      });
    });

    describe('with invalid/corrupted encrypted key', () => {
      it('should throw error when decrypted key is not a valid private key', async () => {
        mockIsValidPrivateKey.mockReturnValue(false);

        await expect(service.initialize()).rejects.toThrow(AppError);
        await expect(service.initialize()).rejects.toMatchObject({
          code: ERROR_CODES.WALLET_DECRYPTION_ERROR,
        });
      });

      it('should throw error when decryption fails', async () => {
        mockDecryptWithConfigKey.mockRejectedValue(
          new AppError(ERROR_CODES.WALLET_DECRYPTION_ERROR, 'Decryption failed')
        );

        await expect(service.initialize()).rejects.toThrow(AppError);
        expect(service.isReady()).toBe(false);
      });

      it('should not be ready after failed initialization', async () => {
        mockIsValidPrivateKey.mockReturnValue(false);

        try {
          await service.initialize();
        } catch {
          // Expected to fail
        }

        expect(service.isReady()).toBe(false);
      });
    });

    describe('with missing config values', () => {
      it('should return early when no encrypted wallet key is configured', async () => {
        mockConfig.botWalletEncryptedKey = undefined;

        await service.initialize();

        expect(mockDecryptWithConfigKey).not.toHaveBeenCalled();
        expect(service.isReady()).toBe(false);
      });

      it('should return early with empty encrypted wallet key', async () => {
        mockConfig.botWalletEncryptedKey = '';

        await service.initialize();

        expect(mockDecryptWithConfigKey).not.toHaveBeenCalled();
        expect(service.isReady()).toBe(false);
      });
    });

    describe('address verification', () => {
      it('should throw error when wallet address does not match configured address', async () => {
        mockConfig.botWalletAddress = '0xdifferentaddress1234567890abcdef12345678';

        await expect(service.initialize()).rejects.toThrow(AppError);
        await expect(service.initialize()).rejects.toMatchObject({
          code: ERROR_CODES.WALLET_NOT_CONFIGURED,
        });
      });

      it('should succeed when addresses match case-insensitively', async () => {
        mockConfig.botWalletAddress = mockWalletAddress.toUpperCase();

        await service.initialize();

        expect(service.isReady()).toBe(true);
      });

      it('should succeed when no address is configured in config', async () => {
        mockConfig.botWalletAddress = undefined;

        await service.initialize();

        expect(service.isReady()).toBe(true);
      });
    });

    describe('multiple initialization attempts', () => {
      it('should reinitialize on second call', async () => {
        await service.initialize();
        await service.initialize();

        expect(mockDecryptWithConfigKey).toHaveBeenCalledTimes(2);
        expect(mockClobInitialize).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('getAddress', () => {
    it('should return wallet address after initialization', async () => {
      await service.initialize();

      expect(service.getAddress()).toBe(mockWalletAddress);
    });

    it('should return config address when wallet not initialized', () => {
      const uninitializedService = new WalletService();

      expect(uninitializedService.getAddress()).toBe(mockWalletAddress);
    });

    it('should return null when neither wallet nor config address available', () => {
      mockConfig.botWalletAddress = undefined;
      const uninitializedService = new WalletService();

      expect(uninitializedService.getAddress()).toBeNull();
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await service.initialize();

      expect(service.isReady()).toBe(true);
    });

    it('should return false after failed initialization', async () => {
      mockIsValidPrivateKey.mockReturnValue(false);

      try {
        await service.initialize();
      } catch {
        // Expected to fail
      }

      expect(service.isReady()).toBe(false);
    });
  });

  describe('getBalance', () => {
    it('should return USDC balance when wallet is initialized', async () => {
      mockClobGetBalance.mockResolvedValue(1500.5);
      await service.initialize();

      const balance = await service.getBalance();

      expect(balance).toBe(1500.5);
    });

    it('should throw error when wallet is not initialized', async () => {
      await expect(service.getBalance()).rejects.toThrow(AppError);
      await expect(service.getBalance()).rejects.toMatchObject({
        code: ERROR_CODES.WALLET_NOT_CONFIGURED,
        message: 'Wallet not initialized',
      });
    });

    it('should update cached balance in database', async () => {
      mockClobGetBalance.mockResolvedValue(2000);
      await service.initialize();

      await service.getBalance();

      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { address: mockWalletAddress.toLowerCase() },
        data: {
          usdcBalance: 2000,
          lastBalanceCheck: expect.any(Date),
        },
      });
    });

    it('should handle zero balance', async () => {
      mockClobGetBalance.mockResolvedValue(0);
      await service.initialize();

      const balance = await service.getBalance();

      expect(balance).toBe(0);
    });

    it('should handle large balances', async () => {
      mockClobGetBalance.mockResolvedValue(1000000.123456);
      await service.initialize();

      const balance = await service.getBalance();

      expect(balance).toBeCloseTo(1000000.123456, 6);
    });

    it('should propagate CLOB client errors', async () => {
      mockClobGetBalance.mockRejectedValue(new Error('CLOB API error'));
      await service.initialize();

      await expect(service.getBalance()).rejects.toThrow('CLOB API error');
    });
  });

  describe('getWalletInfo', () => {
    it('should return full wallet info when initialized', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        address: mockWalletAddress.toLowerCase(),
        usdcBalance: 500,
        lastBalanceCheck: new Date('2024-01-01'),
      });
      await service.initialize();

      const info = await service.getWalletInfo();

      expect(info).toEqual({
        address: mockWalletAddress,
        network: 'testnet',
        isConnected: true,
        balance: 500,
        lastBalanceCheck: new Date('2024-01-01'),
      });
    });

    it('should return disconnected info when not initialized', async () => {
      const uninitializedService = new WalletService();

      const info = await uninitializedService.getWalletInfo();

      expect(info).toEqual({
        address: mockWalletAddress,
        network: 'testnet',
        isConnected: false,
        balance: undefined,
        lastBalanceCheck: undefined,
      });
    });

    it('should return null address when no address available', async () => {
      mockConfig.botWalletAddress = undefined;
      const uninitializedService = new WalletService();

      const info = await uninitializedService.getWalletInfo();

      expect(info).toEqual({
        address: null,
        network: 'testnet',
        isConnected: false,
      });
    });

    it('should handle missing database record', async () => {
      mockPrismaFindUnique.mockResolvedValue(null);
      await service.initialize();

      const info = await service.getWalletInfo();

      expect(info.balance).toBeUndefined();
      expect(info.lastBalanceCheck).toBeUndefined();
    });

    it('should return mainnet network when configured', async () => {
      mockConfig.polymarketNetwork = 'mainnet';
      const mainnetService = new WalletService();

      const info = await mainnetService.getWalletInfo();

      expect(info.network).toBe('mainnet');
    });
  });

  describe('error handling', () => {
    it('should log error when initialization fails', async () => {
      const { logger } = require('../../../utils/logger');
      const error = new Error('Init error');
      mockDecryptWithConfigKey.mockRejectedValue(error);

      await expect(service.initialize()).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        { error },
        'Failed to initialize wallet'
      );
    });

    it('should log warning when no encrypted key configured', async () => {
      const { logger } = require('../../../utils/logger');
      mockConfig.botWalletEncryptedKey = undefined;

      await service.initialize();

      expect(logger.warn).toHaveBeenCalledWith('No encrypted wallet key configured');
    });

    it('should log info on successful initialization', async () => {
      const { logger } = require('../../../utils/logger');

      await service.initialize();

      expect(logger.info).toHaveBeenCalledWith(
        { address: mockWalletAddress },
        'Wallet initialized'
      );
    });
  });

  describe('database operations', () => {
    it('should not update database when address is not available', async () => {
      // Override getAddress to return null for this test
      mockConfig.botWalletAddress = undefined;
      mockConfig.botWalletEncryptedKey = undefined;
      const service2 = new WalletService();

      await service2.initialize();

      // Since there's no encrypted key, initialization returns early
      // and no database update should happen
      expect(mockPrismaUpsert).not.toHaveBeenCalled();
    });

    it('should handle database upsert errors gracefully', async () => {
      mockPrismaUpsert.mockRejectedValue(new Error('Database error'));

      await expect(service.initialize()).rejects.toThrow('Database error');
    });

    it('should handle database update errors in getBalance', async () => {
      mockPrismaUpdate.mockRejectedValue(new Error('Database update error'));
      await service.initialize();

      await expect(service.getBalance()).rejects.toThrow('Database update error');
    });
  });

  describe('edge cases', () => {
    it('should handle private key without 0x prefix', async () => {
      const keyWithoutPrefix = 'a'.repeat(64);
      mockDecryptWithConfigKey.mockResolvedValue(keyWithoutPrefix);
      mockIsValidPrivateKey.mockReturnValue(true);

      await service.initialize();

      expect(service.isReady()).toBe(true);
    });

    it('should handle concurrent initialization calls', async () => {
      // Start two initialization calls concurrently
      const [result1, result2] = await Promise.allSettled([
        service.initialize(),
        service.initialize(),
      ]);

      // Both should complete (either succeed or show state consistency)
      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('fulfilled');
      expect(service.isReady()).toBe(true);
    });

    it('should normalize address to lowercase in database operations', async () => {
      const mixedCaseAddress = '0x1234567890AbCdEf1234567890aBcDeF12345678';
      const { ethers } = require('ethers');
      ethers.Wallet.mockImplementation(() => ({
        address: mixedCaseAddress,
      }));

      const service3 = new WalletService();
      mockConfig.botWalletAddress = mixedCaseAddress.toLowerCase();
      await service3.initialize();

      expect(mockPrismaUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { address: mixedCaseAddress.toLowerCase() },
        })
      );
    });
  });
});
