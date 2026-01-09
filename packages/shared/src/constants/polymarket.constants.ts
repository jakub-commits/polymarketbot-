// Polymarket API constants

// API URLs
export const POLYMARKET_URLS = {
  MAINNET: {
    CLOB: 'https://clob.polymarket.com',
    GAMMA: 'https://gamma-api.polymarket.com',
    STRAPI: 'https://strapi-matic.poly.market',
  },
  TESTNET: {
    CLOB: 'https://clob.polymarket.com', // Same URL, different chain
    GAMMA: 'https://gamma-api.polymarket.com',
    STRAPI: 'https://strapi-matic.poly.market',
  },
} as const;

// Chain IDs
export const CHAIN_IDS = {
  MAINNET: 137, // Polygon Mainnet
  TESTNET: 80002, // Polygon Amoy Testnet
} as const;

// Contract addresses
export const CONTRACTS = {
  MAINNET: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
    NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
    NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
  },
  TESTNET: {
    USDC: '0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97',
    CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
    NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
    NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
  },
} as const;

// Rate limits
export const RATE_LIMITS = {
  // Polymarket API limits
  CLOB_REQUESTS_PER_SECOND: 10,
  GAMMA_REQUESTS_PER_SECOND: 5,

  // Internal limits
  POSITION_POLL_INTERVAL_MS: 1000,
  PRICE_UPDATE_INTERVAL_MS: 5000,
  MARKET_REFRESH_INTERVAL_MS: 30000,
} as const;

// Trading defaults
export const TRADING_DEFAULTS = {
  MIN_TRADE_AMOUNT_USDC: 1,
  MAX_SLIPPAGE_PERCENT: 2,
  DEFAULT_ALLOCATION_PERCENT: 10,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// Order types
export const ORDER_TYPES = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  GTC: 'GTC', // Good Till Cancelled
  FOK: 'FOK', // Fill Or Kill
} as const;

// Position status
export const POSITION_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  REDEEMED: 'REDEEMED',
} as const;

// Trade status
export const TRADE_STATUS = {
  PENDING: 'PENDING',
  EXECUTED: 'EXECUTED',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
