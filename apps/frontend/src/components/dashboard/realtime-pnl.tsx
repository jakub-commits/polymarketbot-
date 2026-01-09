'use client';

import { useRealtimePnL } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@polymarket-bot/shared';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

export function RealtimePnL() {
  const pnl = useRealtimePnL();

  if (!pnl) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total P&L
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-muted-foreground">--</div>
          <p className="text-xs text-muted-foreground">Waiting for updates...</p>
        </CardContent>
      </Card>
    );
  }

  const isPositive = pnl.totalPnl >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Total P&L
          <span className="ml-auto text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
            Live
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold flex items-center gap-2 ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-6 w-6" />
          ) : (
            <TrendingDown className="h-6 w-6" />
          )}
          {formatCurrency(pnl.totalPnl)}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <p className="text-muted-foreground">Unrealized</p>
            <p
              className={`font-medium ${
                pnl.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(pnl.unrealizedPnl)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Today</p>
            <p
              className={`font-medium ${
                pnl.dailyPnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(pnl.dailyPnl)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PnLSummaryBar() {
  const pnl = useRealtimePnL();

  if (!pnl) return null;

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Total:</span>
        <span
          className={`font-medium ${
            pnl.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {formatCurrency(pnl.totalPnl)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Today:</span>
        <span
          className={`font-medium ${
            pnl.dailyPnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {formatCurrency(pnl.dailyPnl)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Unrealized:</span>
        <span
          className={`font-medium ${
            pnl.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {formatCurrency(pnl.unrealizedPnl)}
        </span>
      </div>
    </div>
  );
}
