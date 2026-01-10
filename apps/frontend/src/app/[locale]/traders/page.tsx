'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
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
import { toast } from 'sonner';
import { formatCurrency, formatPercentage, formatWalletAddress } from '@polymarket-bot/shared';

export default function TradersPage() {
  const t = useTranslations('traders');
  const tCommon = useTranslations('common');
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
    } catch {
      toast.error('Failed to start copying');
    }
  };

  const handleStopCopying = async (id: string) => {
    try {
      await stopCopying(id);
    } catch {
      toast.error('Failed to stop copying');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        await deleteTrader(id);
      } catch {
        toast.error('Failed to delete trader');
      }
    }
  };

  const handleSync = async (id: string) => {
    try {
      await syncPositions(id);
    } catch {
      toast.error('Failed to sync positions');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {tCommon('refresh')}
          </Button>
          <Link href="/traders/add">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('addTrader')}
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
          {tCommon('all')}
        </Button>
        <Button
          variant={statusFilter === 'ACTIVE' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('ACTIVE')}
        >
          {tCommon('active')}
        </Button>
        <Button
          variant={statusFilter === 'PAUSED' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('PAUSED')}
        >
          {tCommon('paused')}
        </Button>
      </div>

      {/* Traders Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          {tCommon('loading')}
        </div>
      ) : traders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {t('noTraders')}
            </p>
            <Link href="/traders/add">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('addTrader')}
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
                      {trader.name || t('unnamed')}
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
                    {trader.status === 'ACTIVE' ? tCommon('active') : tCommon('paused')}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('totalPnl')}</p>
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
                    <p className="text-muted-foreground">{t('winRate')}</p>
                    <p className="font-medium">
                      {formatPercentage(trader.winRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('trades')}</p>
                    <p className="font-medium">{trader.totalTrades}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('allocation')}</p>
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
                      {t('pause')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartCopying(trader.id)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      {t('start')}
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
