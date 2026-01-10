import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = jest.mocked(axios);

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock PrismaClient
const mockPrisma = {
  settings: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Import after mocking
import { notificationService } from '../../../services/notification';

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('should load settings from database', async () => {
      const mockSettings = {
        key: 'notifications',
        value: {
          discordWebhookUrl: 'https://discord.com/webhook',
          enableTradeNotifications: true,
          enableRiskNotifications: true,
          enableDailySummary: true,
        },
      };

      mockPrisma.settings.findUnique.mockResolvedValue(mockSettings);

      const settings = await notificationService.loadSettings();

      expect(settings.discordWebhookUrl).toBe('https://discord.com/webhook');
      expect(settings.enableTradeNotifications).toBe(true);
    });

    it('should return default settings if none exist', async () => {
      mockPrisma.settings.findUnique.mockResolvedValue(null);

      const settings = await notificationService.loadSettings();

      expect(settings.enableTradeNotifications).toBe(true);
      expect(settings.enableRiskNotifications).toBe(true);
      expect(settings.enableDailySummary).toBe(true);
    });
  });

  describe('sendTradeNotification', () => {
    it('should send Discord notification when enabled', async () => {
      const mockSettings = {
        key: 'notifications',
        value: {
          discordWebhookUrl: 'https://discord.com/webhook',
          enableTradeNotifications: true,
        },
      };

      mockPrisma.settings.findUnique.mockResolvedValue(mockSettings);
      mockedAxios.post.mockResolvedValue({ data: {} });

      await notificationService.sendTradeNotification({
        type: 'trade_copied',
        traderId: 'trader-123',
        traderName: 'Test Trader',
        marketQuestion: 'Will BTC reach $100k?',
        side: 'BUY',
        outcome: 'YES',
        amount: 100,
        price: 0.65,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://discord.com/webhook',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Trade Copied'),
            }),
          ]),
        })
      );
    });

    it('should not send notification when disabled', async () => {
      const mockSettings = {
        key: 'notifications',
        value: {
          discordWebhookUrl: 'https://discord.com/webhook',
          enableTradeNotifications: false,
        },
      };

      mockPrisma.settings.findUnique.mockResolvedValue(mockSettings);

      await notificationService.sendTradeNotification({
        type: 'trade_copied',
        traderId: 'trader-123',
        marketQuestion: 'Test market',
        side: 'BUY',
        outcome: 'YES',
        amount: 100,
        price: 0.65,
      });

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('sendRiskNotification', () => {
    it('should send risk alert via Discord', async () => {
      const mockSettings = {
        key: 'notifications',
        value: {
          discordWebhookUrl: 'https://discord.com/webhook',
          enableRiskNotifications: true,
        },
      };

      mockPrisma.settings.findUnique.mockResolvedValue(mockSettings);
      mockedAxios.post.mockResolvedValue({ data: {} });

      await notificationService.sendRiskNotification({
        type: 'drawdown_warning',
        currentValue: 15,
        threshold: 20,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://discord.com/webhook',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Drawdown Warning'),
            }),
          ]),
        })
      );
    });
  });

  describe('testNotification', () => {
    it('should send test notification to Discord', async () => {
      const mockSettings = {
        key: 'notifications',
        value: {
          discordWebhookUrl: 'https://discord.com/webhook',
        },
      };

      mockPrisma.settings.findUnique.mockResolvedValue(mockSettings);
      mockedAxios.post.mockResolvedValue({ data: {} });

      const result = await notificationService.testNotification('discord');

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://discord.com/webhook',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Test Notification'),
            }),
          ]),
        })
      );
    });

    it('should return false if webhook URL is not configured', async () => {
      mockPrisma.settings.findUnique.mockResolvedValue({
        key: 'notifications',
        value: {},
      });

      const result = await notificationService.testNotification('discord');

      expect(result).toBe(false);
    });
  });
});
