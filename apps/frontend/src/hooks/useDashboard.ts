'use client';

import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface DashboardStats {
  totalPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dailyPnl: number;
  openPositions: number;
  activeTraders: number;
  todaysTrades: number;
  totalTrades: number;
  winRate: number;
  positionsChange: number;
  tradesChange: number;
}

interface DashboardOverview {
  stats: DashboardStats;
  recentTrades: Array<{
    id: string;
    side: string;
    amount: number;
    status: string;
    createdAt: string;
    market?: { question: string };
    trader?: { name: string; walletAddress: string };
  }>;
  topTraders: Array<{
    id: string;
    name: string;
    walletAddress: string;
    totalPnl: number;
    winRate: number;
    totalTrades: number;
  }>;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  const json = await res.json();
  return json.data;
};

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    `${API_URL}/dashboard/stats`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    stats: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useDashboardOverview() {
  const { data, error, isLoading, mutate } = useSWR<DashboardOverview>(
    `${API_URL}/dashboard/overview`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  return {
    overview: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useRecentTrades(limit = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_URL}/trades/recent?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 10000, // More frequent for trades
    }
  );

  return {
    trades: data || [],
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useCopierStatus() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_URL}/trades/copier/status`,
    fetcher,
    {
      refreshInterval: 5000,
    }
  );

  return {
    status: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
