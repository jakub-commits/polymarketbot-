'use client';

import { useMemo, useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePnLChart } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';

interface PnLChartProps {
  traderId?: string;
  className?: string;
}

type TimeRange = 7 | 30 | 90 | 365;

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '1Y', value: 365 },
];

export function PnLChart({ traderId, className }: PnLChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const { chartData, isLoading, isError } = usePnLChart(traderId, timeRange);

  const formattedData = useMemo(() => {
    return chartData.map((point) => ({
      ...point,
      date: new Date(point.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      pnlColor: point.pnl >= 0 ? '#22c55e' : '#ef4444',
    }));
  }, [chartData]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const lastPoint = chartData[chartData.length - 1];
    const firstPoint = chartData[0];
    const totalPnL = lastPoint?.cumulativePnl ?? 0;
    const periodChange = totalPnL - (firstPoint?.cumulativePnl ?? 0);
    const winningDays = chartData.filter((d) => d.pnl > 0).length;
    const totalDays = chartData.length;

    return {
      totalPnL,
      periodChange,
      winRate: totalDays > 0 ? (winningDays / totalDays) * 100 : 0,
      totalTrades: chartData.reduce((sum, d) => sum + d.trades, 0),
    };
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>P&L Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>P&L Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Failed to load chart data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>P&L Performance</CardTitle>
          {stats && (
            <div className="flex gap-4 mt-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className={cn(
                  'font-medium',
                  stats.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  ${stats.totalPnL.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Period: </span>
                <span className={cn(
                  'font-medium',
                  stats.periodChange >= 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  {stats.periodChange >= 0 ? '+' : ''}${stats.periodChange.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Win Rate: </span>
                <span className="font-medium">{stats.winRate.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Trades: </span>
                <span className="font-medium">{stats.totalTrades}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              variant={timeRange === range.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range.value)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                yAxisId="pnl"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
                className="text-muted-foreground"
              />
              <YAxis
                yAxisId="trades"
                orientation="right"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => {
                  if (name === 'cumulativePnl') return [`$${value.toFixed(2)}`, 'Cumulative P&L'];
                  if (name === 'pnl') return [`$${value.toFixed(2)}`, 'Daily P&L'];
                  if (name === 'trades') return [value, 'Trades'];
                  return [value, name];
                }}
              />
              <ReferenceLine yAxisId="pnl" y={0} stroke="hsl(var(--muted-foreground))" />
              <Area
                yAxisId="pnl"
                type="monotone"
                dataKey="cumulativePnl"
                fill="hsl(var(--primary) / 0.2)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
              <Bar
                yAxisId="trades"
                dataKey="trades"
                fill="hsl(var(--muted-foreground) / 0.3)"
                radius={[2, 2, 0, 0]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
