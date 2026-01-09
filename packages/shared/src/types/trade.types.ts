// Trade-related types

export type TradeSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'GTC' | 'FOK';
export type TradeStatus = 'PENDING' | 'EXECUTED' | 'PARTIALLY_FILLED' | 'FAILED' | 'PERMANENTLY_FAILED' | 'CANCELLED';

export interface Trade {
  id: string;
  externalId?: string;
  orderId?: string;

  traderId: string;
  marketId: string;

  tokenId: string;
  side: TradeSide;
  orderType: OrderType;
  status: TradeStatus;

  // Amounts
  requestedAmount: number;
  executedAmount?: number;
  price: number;
  avgFillPrice?: number;
  shares?: number;

  // Costs
  fee: number;
  slippage?: number;

  // Copy tracking
  isSourceTrade: boolean;
  sourceTraderId?: string;
  copiedFromId?: string;

  // Execution info
  executedAt?: Date;
  failureReason?: string;
  retryCount: number;
  nextRetryAt?: Date;

  // Timestamps
  createdAt: Date;
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
  };
}

export interface TradeWithDetails extends Trade {
  trader: {
    id: string;
    name?: string;
    walletAddress: string;
  };
  market: {
    id: string;
    question: string;
    slug?: string;
    outcomes: string[];
  };
}

export interface TradeRequest {
  traderId: string;
  marketId: string;
  tokenId: string;
  side: TradeSide;
  amount: number;
  orderType?: OrderType;
  limitPrice?: number;
}

export interface TradeResult {
  success: boolean;
  tradeId?: string;
  orderId?: string;
  executedAmount?: number;
  avgPrice?: number;
  shares?: number;
  fee?: number;
  error?: string;
}

export interface TradeFilters {
  traderId?: string;
  marketId?: string;
  status?: TradeStatus;
  side?: TradeSide;
  isSourceTrade?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}
