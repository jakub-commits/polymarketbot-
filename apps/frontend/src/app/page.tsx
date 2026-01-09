'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ConnectionStatus,
  LiveTradeFeed,
  RealtimePnL,
  RiskAlerts,
  RiskAlertBanner,
} from '@/components/dashboard';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Activity,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboard';

export default function DashboardPage() {
  const { stats, isLoading } = useDashboardStats();

  const statCards = [
    {
      title: 'Open Positions',
      value: stats?.openPositions ?? '--',
      change: stats?.positionsChange ?? 0,
      icon: Wallet,
    },
    {
      title: 'Active Traders',
      value: stats?.activeTraders ?? '--',
      change: 0,
      icon: Users,
    },
    {
      title: "Today's Trades",
      value: stats?.todaysTrades ?? '--',
      change: stats?.tradesChange ?? 0,
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your copy trading performance
          </p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Risk Alert Banner */}
      <RiskAlertBanner />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Real-time P&L Card */}
        <RealtimePnL />

        {/* Other Stats */}
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '--' : stat.value}
              </div>
              {stat.change !== 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {stat.change > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={stat.change > 0 ? 'text-green-500' : 'text-red-500'}
                  >
                    {stat.change > 0 ? '+' : ''}
                    {stat.change}
                  </span>
                  {' from yesterday'}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live Trade Feed - Takes 2 columns */}
        <div className="lg:col-span-2">
          <LiveTradeFeed />
        </div>

        {/* Risk Alerts */}
        <div>
          <RiskAlerts />
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>P&L Over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
            Chart will be implemented with Recharts
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trader Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
            Trader comparison chart coming soon
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
