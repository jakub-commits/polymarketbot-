// Trader-related types

import type { Position } from './position.types.js';

export type Network = 'MAINNET' | 'TESTNET';
export type TraderStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';

export interface Trader {
  id: string;
  walletAddress: string;
  name?: string;
  description?: string;
  status: TraderStatus;
  network: Network;

  // Copy settings
  copyEnabled: boolean;
  allocationPercent: number;
  maxPositionSize?: number;
  minTradeAmount: number;
  slippageTolerance: number;

  // Risk settings
  maxDrawdownPercent: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;

  // Performance metrics
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;

  // Timestamps
  addedAt: Date;
  lastSyncAt?: Date;
  lastTradeAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Populated relations (optional)
  positions?: Position[];
}

export interface TraderSettings {
  copyEnabled: boolean;
  allocationPercent: number;
  maxPositionSize?: number;
  minTradeAmount: number;
  slippageTolerance: number;
  maxDrawdownPercent: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export interface TraderStats {
  totalPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  openPositions: number;
  avgTradeSize: number;
  largestWin: number;
  largestLoss: number;
  sharpeRatio?: number;
  maxDrawdown: number;
}

export interface CreateTraderInput {
  walletAddress: string;
  name?: string;
  description?: string;
  network?: Network;
  copyEnabled?: boolean;
  allocationPercent?: number;
  maxPositionSize?: number;
  minTradeAmount?: number;
  slippageTolerance?: number;
  maxDrawdownPercent?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export interface UpdateTraderInput {
  name?: string;
  description?: string;
  status?: TraderStatus;
  copyEnabled?: boolean;
  allocationPercent?: number;
  maxPositionSize?: number;
  minTradeAmount?: number;
  slippageTolerance?: number;
  maxDrawdownPercent?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}
