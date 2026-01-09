// API-related types

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  timestamp?: Date;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: Date;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    polymarket: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}

// Dashboard stats
export interface DashboardStats {
  // Portfolio
  totalValue: number;
  totalPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dailyPnl: number;
  weeklyPnl: number;

  // Trading
  totalTrades: number;
  todayTrades: number;
  successRate: number;
  avgTradeSize: number;

  // Positions
  openPositions: number;
  closedPositions: number;

  // Traders
  activeTraders: number;
  pausedTraders: number;
}

// Chart data
export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface PnLChartData {
  daily: ChartDataPoint[];
  cumulative: ChartDataPoint[];
}

// Activity log
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ActivityLogEntry {
  id: string;
  level: LogLevel;
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  traderId?: string;
  tradeId?: string;
  marketId?: string;
  createdAt: Date;
}
