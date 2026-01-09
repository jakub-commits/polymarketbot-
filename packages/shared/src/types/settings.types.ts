// Settings-related types

import type { Network } from './trader.types.js';

export interface GlobalSettings {
  // Trading limits
  maxTotalExposure: number;
  maxSingleTradeSize: number;
  defaultSlippage: number;
  minTradeAmount: number;

  // Risk management
  globalStopLoss?: number;
  dailyLossLimit?: number;
  maxOpenPositions: number;

  // Monitoring
  pollingIntervalMs: number;
  priceUpdateIntervalMs: number;

  // Notifications
  webhookUrl?: string;
  notifyOnTrade: boolean;
  notifyOnError: boolean;

  // Network
  activeNetwork: Network;
}

export interface BotWallet {
  id: string;
  address: string;
  network: Network;
  usdcBalance: number;
  lastBalanceCheck?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotStatus {
  isRunning: boolean;
  activeTraders: number;
  openPositions: number;
  lastActivity?: Date;
  uptime: number;
  errors24h: number;
}

export interface SettingsUpdate {
  key: string;
  value: unknown;
}

// Configuration for copy trading
export interface CopyConfig {
  // Sizing
  sizingMethod: 'FIXED' | 'PERCENTAGE' | 'PROPORTIONAL';
  fixedAmount?: number;
  percentageOfCapital?: number;
  maxPercentagePerTrade?: number;

  // Execution
  executionDelay: number;
  maxSlippage: number;
  orderType: 'MARKET' | 'LIMIT';

  // Filters
  minOdds?: number;
  maxOdds?: number;
  categoriesWhitelist?: string[];
  categoriesBlacklist?: string[];
  marketsWhitelist?: string[];
  marketsBlacklist?: string[];
}
