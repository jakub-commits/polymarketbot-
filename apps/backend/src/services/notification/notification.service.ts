import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export interface TradeNotification {
  type: 'trade_copied' | 'trade_failed' | 'position_closed';
  traderId: string;
  traderName?: string;
  marketQuestion: string;
  side: 'BUY' | 'SELL';
  outcome: string;
  amount: number;
  price: number;
  pnl?: number;
  error?: string;
}

export interface RiskNotification {
  type: 'drawdown_warning' | 'drawdown_limit' | 'daily_loss_limit';
  currentValue: number;
  threshold: number;
  traderId?: string;
}

export interface DailySummary {
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  topPerformer?: string;
  worstPerformer?: string;
}

interface NotificationSettings {
  discordWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  enableTradeNotifications: boolean;
  enableRiskNotifications: boolean;
  enableDailySummary: boolean;
}

class NotificationService {
  private settings: NotificationSettings | null = null;

  async loadSettings(): Promise<NotificationSettings> {
    const settings = await prisma.settings.findUnique({
      where: { key: 'notifications' },
    });

    this.settings = settings?.value as NotificationSettings || {
      enableTradeNotifications: true,
      enableRiskNotifications: true,
      enableDailySummary: true,
    };

    return this.settings;
  }

  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    const currentSettings = await this.loadSettings();
    const newSettings = { ...currentSettings, ...settings };

    await prisma.settings.upsert({
      where: { key: 'notifications' },
      update: { value: newSettings },
      create: { key: 'notifications', value: newSettings },
    });

    this.settings = newSettings;
  }

  async sendTradeNotification(notification: TradeNotification): Promise<void> {
    const settings = await this.loadSettings();
    if (!settings.enableTradeNotifications) return;

    const promises: Promise<void>[] = [];

    if (settings.discordWebhookUrl) {
      promises.push(this.sendDiscordTradeNotification(settings.discordWebhookUrl, notification));
    }

    if (settings.telegramBotToken && settings.telegramChatId) {
      promises.push(this.sendTelegramTradeNotification(
        settings.telegramBotToken,
        settings.telegramChatId,
        notification
      ));
    }

    await Promise.allSettled(promises);
  }

  async sendRiskNotification(notification: RiskNotification): Promise<void> {
    const settings = await this.loadSettings();
    if (!settings.enableRiskNotifications) return;

    const promises: Promise<void>[] = [];

    if (settings.discordWebhookUrl) {
      promises.push(this.sendDiscordRiskNotification(settings.discordWebhookUrl, notification));
    }

    if (settings.telegramBotToken && settings.telegramChatId) {
      promises.push(this.sendTelegramRiskNotification(
        settings.telegramBotToken,
        settings.telegramChatId,
        notification
      ));
    }

    await Promise.allSettled(promises);
  }

  async sendDailySummary(summary: DailySummary): Promise<void> {
    const settings = await this.loadSettings();
    if (!settings.enableDailySummary) return;

    const promises: Promise<void>[] = [];

    if (settings.discordWebhookUrl) {
      promises.push(this.sendDiscordDailySummary(settings.discordWebhookUrl, summary));
    }

    if (settings.telegramBotToken && settings.telegramChatId) {
      promises.push(this.sendTelegramDailySummary(
        settings.telegramBotToken,
        settings.telegramChatId,
        summary
      ));
    }

    await Promise.allSettled(promises);
  }

  async testNotification(channel: 'discord' | 'telegram'): Promise<boolean> {
    const settings = await this.loadSettings();

    try {
      if (channel === 'discord' && settings.discordWebhookUrl) {
        await axios.post(settings.discordWebhookUrl, {
          embeds: [{
            title: '🔔 Test Notification',
            description: 'Polymarket Bot notifications are working correctly!',
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
          }],
        });
        return true;
      }

      if (channel === 'telegram' && settings.telegramBotToken && settings.telegramChatId) {
        await axios.post(
          `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
          {
            chat_id: settings.telegramChatId,
            text: '🔔 *Test Notification*\n\nPolymarket Bot notifications are working correctly!',
            parse_mode: 'Markdown',
          }
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.error({ error, channel }, 'Failed to send test notification');
      return false;
    }
  }

  // Discord implementations
  private async sendDiscordTradeNotification(
    webhookUrl: string,
    notification: TradeNotification
  ): Promise<void> {
    const isProfit = notification.pnl !== undefined && notification.pnl > 0;
    const color = notification.type === 'trade_failed' ? 0xff0000 :
                  notification.type === 'position_closed' ? (isProfit ? 0x00ff00 : 0xff0000) :
                  0x3498db;

    const title = notification.type === 'trade_copied' ? '📈 Trade Copied' :
                  notification.type === 'trade_failed' ? '❌ Trade Failed' :
                  '📊 Position Closed';

    const embed = {
      title,
      color,
      fields: [
        {
          name: 'Trader',
          value: notification.traderName || notification.traderId.slice(0, 8),
          inline: true,
        },
        {
          name: 'Market',
          value: notification.marketQuestion.slice(0, 100),
          inline: false,
        },
        {
          name: 'Side',
          value: notification.side,
          inline: true,
        },
        {
          name: 'Outcome',
          value: notification.outcome,
          inline: true,
        },
        {
          name: 'Amount',
          value: `$${notification.amount.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Price',
          value: `${(notification.price * 100).toFixed(1)}¢`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    if (notification.pnl !== undefined) {
      embed.fields.push({
        name: 'P&L',
        value: `${notification.pnl >= 0 ? '+' : ''}$${notification.pnl.toFixed(2)}`,
        inline: true,
      });
    }

    if (notification.error) {
      embed.fields.push({
        name: 'Error',
        value: notification.error,
        inline: false,
      });
    }

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
    } catch (error) {
      logger.error({ error }, 'Failed to send Discord trade notification');
    }
  }

  private async sendDiscordRiskNotification(
    webhookUrl: string,
    notification: RiskNotification
  ): Promise<void> {
    const title = notification.type === 'drawdown_warning' ? '⚠️ Drawdown Warning' :
                  notification.type === 'drawdown_limit' ? '🛑 Drawdown Limit Reached' :
                  '⚠️ Daily Loss Limit Warning';

    const embed = {
      title,
      color: notification.type === 'drawdown_limit' ? 0xff0000 : 0xffa500,
      description: `Current: ${notification.currentValue.toFixed(1)}% | Threshold: ${notification.threshold.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
    } catch (error) {
      logger.error({ error }, 'Failed to send Discord risk notification');
    }
  }

  private async sendDiscordDailySummary(
    webhookUrl: string,
    summary: DailySummary
  ): Promise<void> {
    const winRate = summary.totalTrades > 0
      ? ((summary.winningTrades / summary.totalTrades) * 100).toFixed(1)
      : '0';

    const embed = {
      title: '📊 Daily Trading Summary',
      color: summary.totalPnl >= 0 ? 0x00ff00 : 0xff0000,
      fields: [
        {
          name: 'Total P&L',
          value: `${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Total Trades',
          value: summary.totalTrades.toString(),
          inline: true,
        },
        {
          name: 'Win Rate',
          value: `${winRate}%`,
          inline: true,
        },
        {
          name: 'Winning',
          value: summary.winningTrades.toString(),
          inline: true,
        },
        {
          name: 'Losing',
          value: summary.losingTrades.toString(),
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    if (summary.topPerformer) {
      embed.fields.push({
        name: 'Top Performer',
        value: summary.topPerformer,
        inline: false,
      });
    }

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
    } catch (error) {
      logger.error({ error }, 'Failed to send Discord daily summary');
    }
  }

  // Telegram implementations
  private async sendTelegramTradeNotification(
    botToken: string,
    chatId: string,
    notification: TradeNotification
  ): Promise<void> {
    const emoji = notification.type === 'trade_copied' ? '📈' :
                  notification.type === 'trade_failed' ? '❌' : '📊';

    const title = notification.type === 'trade_copied' ? 'Trade Copied' :
                  notification.type === 'trade_failed' ? 'Trade Failed' :
                  'Position Closed';

    let message = `${emoji} *${title}*\n\n`;
    message += `👤 Trader: ${notification.traderName || notification.traderId.slice(0, 8)}\n`;
    message += `📌 Market: ${notification.marketQuestion.slice(0, 80)}\n`;
    message += `📊 ${notification.side} ${notification.outcome}\n`;
    message += `💰 Amount: $${notification.amount.toFixed(2)}\n`;
    message += `💵 Price: ${(notification.price * 100).toFixed(1)}¢\n`;

    if (notification.pnl !== undefined) {
      const pnlEmoji = notification.pnl >= 0 ? '✅' : '❌';
      message += `${pnlEmoji} P&L: ${notification.pnl >= 0 ? '+' : ''}$${notification.pnl.toFixed(2)}\n`;
    }

    if (notification.error) {
      message += `\n⚠️ Error: ${notification.error}`;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to send Telegram trade notification');
    }
  }

  private async sendTelegramRiskNotification(
    botToken: string,
    chatId: string,
    notification: RiskNotification
  ): Promise<void> {
    const emoji = notification.type === 'drawdown_limit' ? '🛑' : '⚠️';
    const title = notification.type === 'drawdown_warning' ? 'Drawdown Warning' :
                  notification.type === 'drawdown_limit' ? 'Drawdown Limit Reached' :
                  'Daily Loss Limit Warning';

    const message = `${emoji} *${title}*\n\n` +
      `Current: ${notification.currentValue.toFixed(1)}%\n` +
      `Threshold: ${notification.threshold.toFixed(1)}%`;

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to send Telegram risk notification');
    }
  }

  private async sendTelegramDailySummary(
    botToken: string,
    chatId: string,
    summary: DailySummary
  ): Promise<void> {
    const winRate = summary.totalTrades > 0
      ? ((summary.winningTrades / summary.totalTrades) * 100).toFixed(1)
      : '0';

    const pnlEmoji = summary.totalPnl >= 0 ? '✅' : '❌';

    let message = `📊 *Daily Trading Summary*\n\n`;
    message += `${pnlEmoji} Total P&L: ${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl.toFixed(2)}\n`;
    message += `📈 Total Trades: ${summary.totalTrades}\n`;
    message += `🎯 Win Rate: ${winRate}%\n`;
    message += `✅ Winning: ${summary.winningTrades}\n`;
    message += `❌ Losing: ${summary.losingTrades}\n`;

    if (summary.topPerformer) {
      message += `\n🏆 Top Performer: ${summary.topPerformer}`;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to send Telegram daily summary');
    }
  }
}

export const notificationService = new NotificationService();
