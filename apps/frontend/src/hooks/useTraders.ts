'use client';

import useSWR from 'swr';
import { apiClient, fetcher } from '@/lib/api-client';
import type { Trader, CreateTraderInput, UpdateTraderInput, TraderStats } from '@polymarket-bot/shared';

interface TradersResponse {
  items: Trader[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useTraders(options?: { status?: string; page?: number; limit?: number }) {
  const { status, page = 1, limit = 20 } = options || {};

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, error, mutate, isLoading } = useSWR<TradersResponse>(
    `/traders?${params.toString()}`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const addTrader = async (input: CreateTraderInput): Promise<Trader> => {
    const newTrader = await apiClient.post<Trader>('/traders', input);
    mutate();
    return newTrader;
  };

  const updateTrader = async (id: string, input: UpdateTraderInput): Promise<Trader> => {
    const updated = await apiClient.put<Trader>(`/traders/${id}`, input);
    mutate();
    return updated;
  };

  const deleteTrader = async (id: string): Promise<void> => {
    await apiClient.delete(`/traders/${id}`);
    mutate();
  };

  const startCopying = async (id: string): Promise<Trader> => {
    const trader = await apiClient.post<Trader>(`/traders/${id}/start`);
    mutate();
    return trader;
  };

  const stopCopying = async (id: string): Promise<Trader> => {
    const trader = await apiClient.post<Trader>(`/traders/${id}/stop`);
    mutate();
    return trader;
  };

  const syncPositions = async (id: string): Promise<{ synced: number }> => {
    const result = await apiClient.post<{ synced: number }>(`/traders/${id}/sync`);
    mutate();
    return result;
  };

  return {
    traders: data?.items || [],
    total: data?.total || 0,
    page: data?.page || 1,
    totalPages: data?.totalPages || 0,
    isLoading,
    isError: error,
    addTrader,
    updateTrader,
    deleteTrader,
    startCopying,
    stopCopying,
    syncPositions,
    refresh: mutate,
  };
}

export function useTrader(id: string) {
  const { data, error, mutate, isLoading } = useSWR<Trader>(
    id ? `/traders/${id}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  return {
    trader: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useTraderStats(id: string) {
  const { data, error, isLoading } = useSWR<TraderStats>(
    id ? `/traders/${id}/stats` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    stats: data,
    isLoading,
    isError: error,
  };
}
