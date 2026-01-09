'use client';

import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface PerformanceMetrics {
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  roi: number;
}

interface PnLDataPoint {
  date: string;
  pnl: number;
  cumulativePnl: number;
  trades: number;
}

interface TraderPerformance {
  traderId: string;
  name: string;
  walletAddress: string;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  avgTradeSize: number;
  profitFactor: number;
  roi: number;
}

interface TradeDistribution {
  byOutcome: Array<{ outcome: string; count: number; pnl: number }>;
  bySide: Array<{ side: string; count: number; pnl: number }>;
  byHour: Array<{ hour: number; count: number; pnl: number }>;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data;
};

export function usePerformanceMetrics(traderId?: string) {
  const url = traderId
    ? `${API_URL}/analytics/metrics?traderId=${traderId}`
    : `${API_URL}/analytics/metrics`;

  const { data, error, isLoading, mutate } = useSWR<PerformanceMetrics>(
    url,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    metrics: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function usePnLChart(traderId?: string, days: number = 30) {
  const url = traderId
    ? `${API_URL}/analytics/pnl-chart?traderId=${traderId}&days=${days}`
    : `${API_URL}/analytics/pnl-chart?days=${days}`;

  const { data, error, isLoading, mutate } = useSWR<PnLDataPoint[]>(
    url,
    fetcher,
    { refreshInterval: 300000 } // 5 minutes
  );

  return {
    chartData: data || [],
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useTraderPerformance() {
  const { data, error, isLoading, mutate } = useSWR<TraderPerformance[]>(
    `${API_URL}/analytics/trader-performance`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    traders: data || [],
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useTradeDistribution(traderId?: string) {
  const url = traderId
    ? `${API_URL}/analytics/distribution?traderId=${traderId}`
    : `${API_URL}/analytics/distribution`;

  const { data, error, isLoading, mutate } = useSWR<TradeDistribution>(
    url,
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    distribution: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
