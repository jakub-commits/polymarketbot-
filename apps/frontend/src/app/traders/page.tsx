'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTraders } from '@/hooks/useTraders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { formatCurrency, formatPercentage, formatWalletAddress } from '@polymarket-bot/shared';

export default function TradersPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const {
    traders,
    isLoading,
    startCopying,
    stopCopying,
    deleteTrader,
    syncPositions,
    refresh,
  } = useTraders({ status: statusFilter });

  const handleStartCopying = async (id: string) => {
    try {
      await startCopying(id);
    } catch (error) {
      console.error('Failed to start copying:', error);
    }
  };

  const handleStopCopying = async (id: string) => {
    try {
      await stopCopying(id);
    } catch (error) {
      console.error('Failed to stop copying:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this trader?')) {
      try {
        await deleteTrader(id);
      } catch (error) {
        console.error('Failed to delete trader:', error);
      }
    }
  };

  const handleSync = async (id: string) => {
    try {
      await syncPositions(id);
    } catch (error) {
      console.error('Failed to sync positions:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Traders</h1>
          <p className="text-muted-foreground">
            Manage traders you are copying
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/traders/add">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Trader
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === undefined ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(undefined)}
        >
          All
        </Button>
        <Button
          variant={statusFilter === 'ACTIVE' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('ACTIVE')}
        >
          Active
        </Button>
        <Button
          variant={statusFilter === 'PAUSED' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('PAUSED')}
        >
          Paused
        </Button>
      </div>

      {/* Traders Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading traders...
        </div>
      ) : traders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No traders found. Add your first trader to start copy trading.
            </p>
            <Link href="/traders/add">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Trader
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {traders.map((trader) => (
            <Card key={trader.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {trader.name || 'Unnamed Trader'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-mono">
                      {formatWalletAddress(trader.walletAddress)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      trader.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : trader.status === 'PAUSED'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {trader.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total P&L</p>
                    <p
                      className={`font-medium flex items-center gap-1 ${
                        trader.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {trader.totalPnl >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {formatCurrency(trader.totalPnl)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Win Rate</p>
                    <p className="font-medium">
                      {formatPercentage(trader.winRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Trades</p>
                    <p className="font-medium">{trader.totalTrades}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Allocation</p>
                    <p className="font-medium">{trader.allocationPercent}%</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  {trader.status === 'ACTIVE' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStopCopying(trader.id)}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartCopying(trader.id)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSync(trader.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Link href={`/traders/${trader.id}`} className="ml-auto">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(trader.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
