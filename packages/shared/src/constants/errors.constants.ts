// Error codes and messages

export const ERROR_CODES = {
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // Trader errors
  TRADER_NOT_FOUND: 'TRADER_NOT_FOUND',
  TRADER_DISABLED: 'TRADER_DISABLED',
  TRADER_ALREADY_EXISTS: 'TRADER_ALREADY_EXISTS',
  INVALID_WALLET_ADDRESS: 'INVALID_WALLET_ADDRESS',

  // Trade errors
  TRADE_FAILED: 'TRADE_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  SLIPPAGE_TOO_HIGH: 'SLIPPAGE_TOO_HIGH',
  MARKET_NOT_ACTIVE: 'MARKET_NOT_ACTIVE',
  ORDER_REJECTED: 'ORDER_REJECTED',
  POSITION_SIZE_EXCEEDED: 'POSITION_SIZE_EXCEEDED',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
  DRAWDOWN_LIMIT_EXCEEDED: 'DRAWDOWN_LIMIT_EXCEEDED',

  // Position errors
  POSITION_NOT_FOUND: 'POSITION_NOT_FOUND',
  POSITION_ALREADY_CLOSED: 'POSITION_ALREADY_CLOSED',

  // Market errors
  MARKET_NOT_FOUND: 'MARKET_NOT_FOUND',
  MARKET_RESOLVED: 'MARKET_RESOLVED',
  LOW_LIQUIDITY: 'LOW_LIQUIDITY',

  // API errors
  POLYMARKET_API_ERROR: 'POLYMARKET_API_ERROR',
  POLYMARKET_RATE_LIMITED: 'POLYMARKET_RATE_LIMITED',
  POLYMARKET_UNAVAILABLE: 'POLYMARKET_UNAVAILABLE',

  // Wallet errors
  WALLET_NOT_CONFIGURED: 'WALLET_NOT_CONFIGURED',
  WALLET_ENCRYPTION_ERROR: 'WALLET_ENCRYPTION_ERROR',
  WALLET_DECRYPTION_ERROR: 'WALLET_DECRYPTION_ERROR',

  // WebSocket errors
  WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
  WS_SUBSCRIPTION_FAILED: 'WS_SUBSCRIPTION_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.INTERNAL_ERROR]: 'An internal error occurred',
  [ERROR_CODES.VALIDATION_ERROR]: 'Validation error',
  [ERROR_CODES.NOT_FOUND]: 'Resource not found',
  [ERROR_CODES.UNAUTHORIZED]: 'Unauthorized',
  [ERROR_CODES.FORBIDDEN]: 'Forbidden',
  [ERROR_CODES.RATE_LIMITED]: 'Rate limit exceeded',

  [ERROR_CODES.TRADER_NOT_FOUND]: 'Trader not found',
  [ERROR_CODES.TRADER_DISABLED]: 'Trader is disabled',
  [ERROR_CODES.TRADER_ALREADY_EXISTS]: 'Trader with this wallet address already exists',
  [ERROR_CODES.INVALID_WALLET_ADDRESS]: 'Invalid wallet address',

  [ERROR_CODES.TRADE_FAILED]: 'Trade execution failed',
  [ERROR_CODES.INSUFFICIENT_BALANCE]: 'Insufficient balance',
  [ERROR_CODES.SLIPPAGE_TOO_HIGH]: 'Slippage exceeds tolerance',
  [ERROR_CODES.MARKET_NOT_ACTIVE]: 'Market is not active',
  [ERROR_CODES.ORDER_REJECTED]: 'Order was rejected',
  [ERROR_CODES.POSITION_SIZE_EXCEEDED]: 'Position size limit exceeded',
  [ERROR_CODES.DAILY_LIMIT_EXCEEDED]: 'Daily trading limit exceeded',
  [ERROR_CODES.DRAWDOWN_LIMIT_EXCEEDED]: 'Maximum drawdown limit exceeded',

  [ERROR_CODES.POSITION_NOT_FOUND]: 'Position not found',
  [ERROR_CODES.POSITION_ALREADY_CLOSED]: 'Position is already closed',

  [ERROR_CODES.MARKET_NOT_FOUND]: 'Market not found',
  [ERROR_CODES.MARKET_RESOLVED]: 'Market has already resolved',
  [ERROR_CODES.LOW_LIQUIDITY]: 'Insufficient market liquidity',

  [ERROR_CODES.POLYMARKET_API_ERROR]: 'Polymarket API error',
  [ERROR_CODES.POLYMARKET_RATE_LIMITED]: 'Polymarket API rate limited',
  [ERROR_CODES.POLYMARKET_UNAVAILABLE]: 'Polymarket API unavailable',

  [ERROR_CODES.WALLET_NOT_CONFIGURED]: 'Wallet not configured',
  [ERROR_CODES.WALLET_ENCRYPTION_ERROR]: 'Wallet encryption failed',
  [ERROR_CODES.WALLET_DECRYPTION_ERROR]: 'Wallet decryption failed',

  [ERROR_CODES.WS_CONNECTION_FAILED]: 'WebSocket connection failed',
  [ERROR_CODES.WS_SUBSCRIPTION_FAILED]: 'WebSocket subscription failed',
};

// Custom error class
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public details?: unknown
  ) {
    super(message || ERROR_MESSAGES[code]);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
