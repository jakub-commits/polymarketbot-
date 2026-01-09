'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatRelativeTime, formatWalletAddress } from '@polymarket-bot/shared';
import { Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';

export function LiveTradeFeed() {
  const { recentTrades, isConnected } = useWebSocket();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Trade Feed
          </CardTitle>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recentTrades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Waiting for trades...</p>
            <p className="text-xs mt-1">New trades will appear here in real-time</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {recentTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      trade.side === 'BUY'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {trade.side === 'BUY' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {trade.side} {trade.market?.question?.slice(0, 40) || 'Unknown Market'}
                      {(trade.market?.question?.length || 0) > 40 ? '...' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {trade.trader?.name || formatWalletAddress(trade.trader?.walletAddress || '')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">
                    {formatCurrency(trade.executedAmount || trade.requestedAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(trade.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CompactTradeFeed({ limit = 5 }: { limit?: number }) {
  const { recentTrades, isConnected } = useWebSocket();
  const displayTrades = recentTrades.slice(0, limit);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Recent Trades</span>
        <div className="flex items-center gap-1">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {displayTrades.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No recent trades</p>
      ) : (
        <div className="space-y-1.5">
          {displayTrades.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-medium ${
                    trade.side === 'BUY' ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {trade.side}
                </span>
                <span className="text-muted-foreground truncate max-w-[120px]">
                  {trade.market?.question?.slice(0, 20) || 'Unknown'}...
                </span>
              </div>
              <span className="font-medium">
                {formatCurrency(trade.executedAmount || trade.requestedAmount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
