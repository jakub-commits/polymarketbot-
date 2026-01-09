'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Position {
  id: string;
  traderId: string;
  traderName?: string;
  marketId: string;
  marketQuestion?: string;
  outcome: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  value: number;
}

interface PositionOverviewProps {
  traderId?: string;
  className?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data;
};

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

export function PositionOverview({ traderId, className }: PositionOverviewProps) {
  const url = traderId
    ? `${API_URL}/positions?traderId=${traderId}`
    : `${API_URL}/positions`;

  const { data: positions, isLoading, error } = useSWR<Position[]>(
    url,
    fetcher,
    { refreshInterval: 30000 }
  );

  const stats = useMemo(() => {
    if (!positions || positions.length === 0) return null;

    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const profitablePositions = positions.filter((p) => p.unrealizedPnl > 0).length;

    return {
      totalValue,
      totalUnrealizedPnl,
      profitablePositions,
      totalPositions: positions.length,
    };
  }, [positions]);

  const pieData = useMemo(() => {
    if (!positions || positions.length === 0) return [];

    return positions.slice(0, 6).map((position, index) => ({
      name: position.marketQuestion?.slice(0, 30) || position.marketId.slice(0, 8),
      value: Math.abs(position.value),
      pnl: position.unrealizedPnl,
      color: COLORS[index % COLORS.length],
    }));
  }, [positions]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Position Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Position Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Failed to load positions
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Position Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No open positions
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Position Overview</CardTitle>
          {stats && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Value: </span>
                <span className="font-medium">${stats.totalValue.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unrealized: </span>
                <span className={cn(
                  'font-medium',
                  stats.totalUnrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  {stats.totalUnrealizedPnl >= 0 ? '+' : ''}${stats.totalUnrealizedPnl.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: number, name: string, props) => {
                    const pnl = (props?.payload as { pnl?: number })?.pnl ?? 0;
                    return [
                      `$${value.toFixed(2)} (P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`,
                      name,
                    ];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Position List */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {positions.slice(0, 8).map((position) => (
              <div
                key={position.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={position.marketQuestion}>
                      {position.marketQuestion || position.marketId}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={position.outcome === 'YES' ? 'default' : 'secondary'} className="text-xs">
                        {position.outcome}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {position.shares.toFixed(2)} shares @ {(position.avgPrice * 100).toFixed(1)}¢
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-sm font-medium">${position.value.toFixed(2)}</p>
                    <p className={cn(
                      'text-xs flex items-center justify-end gap-1',
                      position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {position.unrealizedPnl >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={position.currentPrice * 100}
                    className="h-1.5"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {(position.currentPrice * 100).toFixed(1)}¢
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
