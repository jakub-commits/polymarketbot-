'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTraderPerformance } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';

interface TraderComparisonProps {
  className?: string;
}

type MetricType = 'pnl' | 'winRate' | 'trades' | 'roi';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function TraderComparison({ className }: TraderComparisonProps) {
  const { traders, isLoading, isError } = useTraderPerformance();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('pnl');

  const barChartData = useMemo(() => {
    return traders.map((trader) => ({
      name: trader.name || trader.walletAddress.slice(0, 8),
      pnl: trader.totalPnl,
      winRate: trader.winRate,
      trades: trader.totalTrades,
      roi: trader.roi,
      profitFactor: trader.profitFactor,
    }));
  }, [traders]);

  const radarData = useMemo(() => {
    if (traders.length === 0) return [];

    const maxValues = {
      pnl: Math.max(...traders.map((t) => Math.abs(t.totalPnl)), 1),
      winRate: 100,
      trades: Math.max(...traders.map((t) => t.totalTrades), 1),
      roi: Math.max(...traders.map((t) => Math.abs(t.roi)), 1),
      profitFactor: Math.max(...traders.map((t) => t.profitFactor), 1),
    };

    return [
      { metric: 'P&L', fullMark: 100 },
      { metric: 'Win Rate', fullMark: 100 },
      { metric: 'Trades', fullMark: 100 },
      { metric: 'ROI', fullMark: 100 },
      { metric: 'Profit Factor', fullMark: 100 },
    ].map((item) => {
      const result: Record<string, number | string> = { metric: item.metric, fullMark: item.fullMark };
      traders.slice(0, 5).forEach((trader, index) => {
        const key = trader.name || `Trader ${index + 1}`;
        switch (item.metric) {
          case 'P&L':
            result[key] = (Math.abs(trader.totalPnl) / maxValues.pnl) * 100;
            break;
          case 'Win Rate':
            result[key] = trader.winRate;
            break;
          case 'Trades':
            result[key] = (trader.totalTrades / maxValues.trades) * 100;
            break;
          case 'ROI':
            result[key] = (Math.abs(trader.roi) / maxValues.roi) * 100;
            break;
          case 'Profit Factor':
            result[key] = (trader.profitFactor / maxValues.profitFactor) * 100;
            break;
        }
      });
      return result;
    });
  }, [traders]);

  const getMetricLabel = (metric: MetricType) => {
    switch (metric) {
      case 'pnl': return 'Total P&L ($)';
      case 'winRate': return 'Win Rate (%)';
      case 'trades': return 'Total Trades';
      case 'roi': return 'ROI (%)';
    }
  };

  const formatValue = (value: number, metric: MetricType) => {
    switch (metric) {
      case 'pnl': return `$${value.toFixed(2)}`;
      case 'winRate': return `${value.toFixed(1)}%`;
      case 'trades': return value.toString();
      case 'roi': return `${value.toFixed(1)}%`;
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Trader Comparison</CardTitle>
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
          <CardTitle>Trader Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Failed to load trader data
          </div>
        </CardContent>
      </Card>
    );
  }

  if (traders.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Trader Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No traders to compare
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Trader Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bar">
          <TabsList className="mb-4">
            <TabsTrigger value="bar">Bar Chart</TabsTrigger>
            <TabsTrigger value="radar">Radar Chart</TabsTrigger>
          </TabsList>

          <TabsContent value="bar">
            <div className="flex gap-2 mb-4">
              {(['pnl', 'winRate', 'trades', 'roi'] as MetricType[]).map((metric) => (
                <Button
                  key={metric}
                  variant={selectedMetric === metric ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric(metric)}
                >
                  {metric === 'pnl' ? 'P&L' : metric === 'winRate' ? 'Win Rate' : metric === 'roi' ? 'ROI' : 'Trades'}
                </Button>
              ))}
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatValue(value, selectedMetric)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number) => [formatValue(value, selectedMetric), getMetricLabel(selectedMetric)]}
                  />
                  <Bar dataKey={selectedMetric} radius={[0, 4, 4, 0]}>
                    {barChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          selectedMetric === 'pnl' || selectedMetric === 'roi'
                            ? entry[selectedMetric] >= 0 ? '#22c55e' : '#ef4444'
                            : COLORS[index % COLORS.length]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="radar">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                  />
                  {traders.slice(0, 5).map((trader, index) => (
                    <Radar
                      key={trader.traderId}
                      name={trader.name || `Trader ${index + 1}`}
                      dataKey={trader.name || `Trader ${index + 1}`}
                      stroke={COLORS[index % COLORS.length]}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
