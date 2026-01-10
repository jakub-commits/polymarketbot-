'use client';

import { Card, CardContent } from '@/components/ui/card';
import { usePerformanceMetrics } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Percent,
  DollarSign,
} from 'lucide-react';

interface PerformanceMetricsProps {
  traderId?: string;
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn(
              'text-2xl font-bold',
              trend === 'up' && 'text-green-500',
              trend === 'down' && 'text-red-500'
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            'p-3 rounded-full',
            trend === 'up' && 'bg-green-500/10 text-green-500',
            trend === 'down' && 'bg-red-500/10 text-red-500',
            trend === 'neutral' && 'bg-muted text-muted-foreground'
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceMetrics({ traderId, className }: PerformanceMetricsProps) {
  const { metrics, isLoading, isError } = usePerformanceMetrics(traderId);

  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-8 bg-muted rounded w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load performance metrics
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4', className)}>
      <MetricCard
        title="Total P&L"
        value={`$${metrics.totalPnl.toFixed(2)}`}
        subtitle={`Realized: $${metrics.realizedPnl.toFixed(2)}`}
        icon={<DollarSign className="h-5 w-5" />}
        trend={metrics.totalPnl >= 0 ? 'up' : 'down'}
      />
      <MetricCard
        title="Daily P&L"
        value={`$${metrics.dailyPnl.toFixed(2)}`}
        subtitle={`Weekly: $${metrics.weeklyPnl.toFixed(2)}`}
        icon={metrics.dailyPnl >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
        trend={metrics.dailyPnl >= 0 ? 'up' : 'down'}
      />
      <MetricCard
        title="Win Rate"
        value={`${metrics.winRate.toFixed(1)}%`}
        subtitle={`${metrics.winningTrades}W / ${metrics.losingTrades}L`}
        icon={<Target className="h-5 w-5" />}
        trend={metrics.winRate >= 50 ? 'up' : 'down'}
      />
      <MetricCard
        title="Profit Factor"
        value={metrics.profitFactor.toFixed(2)}
        subtitle={`Avg Win: $${metrics.avgWin.toFixed(2)}`}
        icon={<BarChart3 className="h-5 w-5" />}
        trend={metrics.profitFactor >= 1 ? 'up' : 'down'}
      />
      <MetricCard
        title="Max Drawdown"
        value={`${metrics.maxDrawdown.toFixed(1)}%`}
        subtitle={`Sharpe: ${metrics.sharpeRatio.toFixed(2)}`}
        icon={<TrendingDown className="h-5 w-5" />}
        trend={metrics.maxDrawdown <= 20 ? 'up' : 'down'}
      />
      <MetricCard
        title="ROI"
        value={`${metrics.roi.toFixed(1)}%`}
        subtitle={`${metrics.totalTrades} trades`}
        icon={<Percent className="h-5 w-5" />}
        trend={metrics.roi >= 0 ? 'up' : 'down'}
      />
    </div>
  );
}
