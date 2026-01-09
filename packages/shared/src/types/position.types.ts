// Position-related types

import type { TradeSide } from './trade.types.js';

export type PositionStatus = 'OPEN' | 'CLOSED' | 'REDEEMED';

export interface Position {
  id: string;
  traderId: string;
  marketId: string;

  tokenId: string;
  outcome: string;
  side: TradeSide;
  status: PositionStatus;

  // Amounts
  shares: number;
  avgEntryPrice: number;
  currentPrice?: number;
  totalCost: number;

  // P&L
  unrealizedPnl: number;
  realizedPnl: number;

  // Exit info
  exitPrice?: number;
  exitShares?: number;
  closedAt?: Date;

  // Source tracking
  isSourcePosition: boolean;
  sourceWallet?: string;

  // Timestamps
  openedAt: Date;
  updatedAt: Date;

  // Populated relations (optional)
  trader?: {
    id: string;
    name?: string;
    walletAddress: string;
  };
  market?: {
    id: string;
    question: string;
    slug?: string;
    outcomes: string[];
  };
}

export interface PositionWithPnL extends Position {
  currentValue: number;
  pnlPercent: number;
  daysOpen: number;
}

export interface PositionSummary {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalValue: number;
  totalCost: number;
}

export interface PositionFilters {
  traderId?: string;
  marketId?: string;
  status?: PositionStatus;
  minValue?: number;
  outcome?: string;
}

// Position change detected from monitoring
export interface PositionChange {
  type: 'NEW' | 'INCREASED' | 'DECREASED' | 'CLOSED';
  traderId: string;
  walletAddress: string;
  marketId: string;
  tokenId: string;
  outcome: string;
  previousShares: number;
  currentShares: number;
  delta: number;
  price: number;
  timestamp: Date;
}
