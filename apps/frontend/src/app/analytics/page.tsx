'use client';

import { useState } from 'react';
import {
  PnLChart,
  PerformanceMetrics,
  TradeHistoryTable,
  TraderComparison,
  PositionOverview,
  TradeDistribution,
} from '@/components/analytics';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTraderPerformance } from '@/hooks/useAnalytics';

export default function AnalyticsPage() {
  const [selectedTraderId, setSelectedTraderId] = useState<string | undefined>(undefined);
  const { traders } = useTraderPerformance();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Performance metrics and trading analysis
          </p>
        </div>
        <Select
          value={selectedTraderId || 'all'}
          onValueChange={(value) => setSelectedTraderId(value === 'all' ? undefined : value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select trader" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Traders</SelectItem>
            {traders.map((trader) => (
              <SelectItem key={trader.traderId} value={trader.traderId}>
                {trader.name || trader.walletAddress.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Performance Metrics */}
      <PerformanceMetrics traderId={selectedTraderId} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PnLChart traderId={selectedTraderId} />
        <TradeDistribution traderId={selectedTraderId} />
      </div>

      {/* Position Overview and Trader Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PositionOverview traderId={selectedTraderId} />
        {!selectedTraderId && <TraderComparison />}
      </div>

      {/* Trade History */}
      <TradeHistoryTable traderId={selectedTraderId} />
    </div>
  );
}
