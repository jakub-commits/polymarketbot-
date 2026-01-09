// WebSocket-related types

import type { Trade } from './trade.types.js';
import type { Position } from './position.types.js';

// Connection status
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'error';

// WebSocket message wrapper
export interface WSMessage<T = unknown> {
  event: string;
  data: T;
  timestamp: Date;
}

// Server -> Client events
export interface ServerToClientEvents {
  // Trade events
  'trade:new': (trade: Trade) => void;
  'trade:updated': (trade: Trade) => void;
  'trade:failed': (data: { tradeId: string; error: string }) => void;

  // Position events
  'position:opened': (position: Position) => void;
  'position:updated': (position: Position) => void;
  'position:closed': (position: Position) => void;

  // Market events
  'market:priceUpdate': (data: MarketPriceUpdate) => void;
  'market:resolved': (data: MarketResolved) => void;

  // Trader events
  'trader:statusChange': (data: TraderStatusChange) => void;
  'trader:positionDetected': (data: PositionDetected) => void;

  // Analytics events
  'pnl:updated': (data: PnLUpdate) => void;
  'stats:updated': (data: StatsUpdate) => void;

  // Risk events
  'risk:alert': (alert: RiskAlert) => void;
  'risk:sltp': (trigger: SLTPTriggerEvent) => void;
  'risk:drawdown': (snapshot: DrawdownUpdate) => void;

  // System events
  'notification': (notification: Notification) => void;
  'error': (error: WSError) => void;
  'connection:status': (status: ConnectionStatus) => void;
}

// Client -> Server events
export interface ClientToServerEvents {
  // Subscriptions
  'subscribe:trader': (traderId: string) => void;
  'unsubscribe:trader': (traderId: string) => void;
  'subscribe:market': (marketId: string) => void;
  'unsubscribe:market': (marketId: string) => void;
  'subscribe:all': () => void;
  'unsubscribe:all': () => void;

  // Requests
  'request:sync': (traderId: string) => void;
}

// Event data types
export interface MarketPriceUpdate {
  marketId: string;
  prices: Record<string, number>;
  volume24h?: number;
  timestamp: Date;
}

export interface MarketResolved {
  marketId: string;
  winningOutcome: string;
  timestamp: Date;
}

export interface TraderStatusChange {
  traderId: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
  timestamp: Date;
}

export interface PositionDetected {
  traderId: string;
  walletAddress: string;
  marketId: string;
  outcome: string;
  shares: number;
  price: number;
  action: 'BUY' | 'SELL';
  timestamp: Date;
}

export interface PnLUpdate {
  totalPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dailyPnl: number;
  timestamp: Date;
}

export interface StatsUpdate {
  totalTrades: number;
  successRate: number;
  activePositions: number;
  totalVolume: number;
  timestamp: Date;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export interface WSError {
  code: string;
  message: string;
  details?: unknown;
}

// Risk event types
export interface RiskAlert {
  traderId: string;
  type: 'WARNING' | 'CRITICAL' | 'LIMIT_REACHED';
  currentDrawdown: number;
  maxDrawdown: number;
  currentBalance: number;
  peakBalance: number;
  timestamp: Date;
}

export interface SLTPTriggerEvent {
  positionId: string;
  traderId: string;
  type: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP';
  triggerPrice: number;
  currentPrice: number;
  entryPrice: number;
  pnlPercent: number;
  shares: number;
  success: boolean;
}

export interface DrawdownUpdate {
  traderId: string;
  currentBalance: number;
  peakBalance: number;
  drawdownPercent: number;
  dailyPnl: number;
  timestamp: Date;
}
