'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTradeDistribution } from '@/hooks/useAnalytics';

interface TradeDistributionProps {
  traderId?: string;
  className?: string;
}

const OUTCOME_COLORS = {
  YES: '#22c55e',
  NO: '#ef4444',
};

const SIDE_COLORS = {
  BUY: '#3b82f6',
  SELL: '#f59e0b',
};

const HOUR_COLOR = 'hsl(var(--primary))';

export function TradeDistribution({ traderId, className }: TradeDistributionProps) {
  const { distribution, isLoading, isError } = useTradeDistribution(traderId);

  const outcomeData = useMemo(() => {
    if (!distribution?.byOutcome) return [];
    return distribution.byOutcome.map((item) => ({
      name: item.outcome,
      count: item.count,
      pnl: item.pnl,
      color: OUTCOME_COLORS[item.outcome as keyof typeof OUTCOME_COLORS] || '#8b5cf6',
    }));
  }, [distribution]);

  const sideData = useMemo(() => {
    if (!distribution?.bySide) return [];
    return distribution.bySide.map((item) => ({
      name: item.side,
      count: item.count,
      pnl: item.pnl,
      color: SIDE_COLORS[item.side as keyof typeof SIDE_COLORS] || '#8b5cf6',
    }));
  }, [distribution]);

  const hourData = useMemo(() => {
    if (!distribution?.byHour) return [];
    return distribution.byHour.map((item) => ({
      hour: `${item.hour}:00`,
      count: item.count,
      pnl: item.pnl,
    }));
  }, [distribution]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Trade Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !distribution) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Trade Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Failed to load distribution data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Trade Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="outcome">
          <TabsList className="mb-4">
            <TabsTrigger value="outcome">By Outcome</TabsTrigger>
            <TabsTrigger value="side">By Side</TabsTrigger>
            <TabsTrigger value="hour">By Hour</TabsTrigger>
          </TabsList>

          <TabsContent value="outcome">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {outcomeData.map((entry, index) => (
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
                      return [`${value} trades (P&L: $${pnl.toFixed(2)})`, name];
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="side">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sideData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {sideData.map((entry, index) => (
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
                      return [`${value} trades (P&L: $${pnl.toFixed(2)})`, name];
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="hour">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10 }}
                    interval={2}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number, name: string, props) => {
                      const pnl = (props?.payload as { pnl?: number })?.pnl ?? 0;
                      if (name === 'count') {
                        return [`${value} trades (P&L: $${pnl.toFixed(2)})`, 'Trades'];
                      }
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="count" fill={HOUR_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
