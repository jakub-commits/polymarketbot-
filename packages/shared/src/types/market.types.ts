// Market-related types

export interface Market {
  id: string;
  conditionId: string;
  questionId?: string;
  slug?: string;

  // Market details
  question: string;
  description?: string;
  category?: string;
  endDate?: Date;

  // Outcomes
  outcomes: string[];
  outcomeTokenIds: string[];

  // State
  isActive: boolean;
  isResolved: boolean;
  winningOutcome?: string;

  // Prices (cached)
  prices?: Record<string, number>;
  volume24h?: number;
  liquidity?: number;

  // Metadata
  imageUrl?: string;

  // Timestamps
  lastPriceUpdate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketPrice {
  marketId: string;
  tokenId: string;
  outcome: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: Date;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  marketId: string;
  tokenId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: Date;
}

export interface MarketFilters {
  category?: string;
  isActive?: boolean;
  isResolved?: boolean;
  search?: string;
}

export interface MarketStats {
  totalMarkets: number;
  activeMarkets: number;
  resolvedMarkets: number;
  totalVolume24h: number;
  totalLiquidity: number;
}
