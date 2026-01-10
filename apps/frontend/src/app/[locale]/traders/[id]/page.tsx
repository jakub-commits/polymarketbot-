'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useTrader, useTraderStats, useTraders } from '@/hooks/useTraders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import {
  formatCurrency,
  formatPercentage,
  formatWalletAddress,
  formatRelativeTime,
} from '@polymarket-bot/shared';

export default function TraderDetailPage() {
  const t = useTranslations('traders');
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('settings');
  const params = useParams();
  const id = params.id as string;

  const { trader, isLoading: traderLoading } = useTrader(id);
  const { stats, isLoading: statsLoading } = useTraderStats(id);
  const { startCopying, stopCopying, syncPositions } = useTraders();

  const handleStartCopying = async () => {
    try {
      await startCopying(id);
    } catch (error) {
      console.error('Failed to start copying:', error);
    }
  };

  const handleStopCopying = async () => {
    try {
      await stopCopying(id);
    } catch (error) {
      console.error('Failed to stop copying:', error);
    }
  };

  const handleSync = async () => {
    try {
      await syncPositions(id);
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  if (traderLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{tCommon('loading')}</div>
      </div>
    );
  }

  if (!trader) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{t('notFound')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/traders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {trader.name || t('unnamed')}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono">
                {formatWalletAddress(trader.walletAddress)}
              </span>
              <a
                href={`https://polygonscan.com/address/${trader.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSync}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('sync')}
          </Button>
          {trader.status === 'ACTIVE' ? (
            <Button variant="outline" onClick={handleStopCopying}>
              <Pause className="h-4 w-4 mr-2" />
              {t('pause')}
            </Button>
          ) : (
            <Button onClick={handleStartCopying}>
              <Play className="h-4 w-4 mr-2" />
              {t('startCopying')}
            </Button>
          )}
          <Link href={`/traders/${id}/edit`}>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              {tSettings('title')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            trader.status === 'ACTIVE'
              ? 'bg-green-100 text-green-700'
              : trader.status === 'PAUSED'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {trader.status === 'ACTIVE' ? tCommon('active') : tCommon('paused')}
        </span>
        {trader.lastSyncAt && (
          <span className="text-sm text-muted-foreground">
            {t('lastSynced', { time: formatRelativeTime(trader.lastSyncAt) })}
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalPnl')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold flex items-center gap-1 ${
                (stats?.totalPnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(stats?.totalPnl || 0) >= 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {formatCurrency(stats?.totalPnl || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('winRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(stats?.winRate || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.profitableTrades || 0} / {stats?.totalTrades || 0} {t('trades')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('openPositions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.openPositions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('unrealized')}: {formatCurrency(stats?.unrealizedPnl || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('allocation')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trader.allocationPercent}%
            </div>
            {trader.maxPositionSize && (
              <p className="text-xs text-muted-foreground">
                Max: {formatCurrency(trader.maxPositionSize)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('addNew.copySettings')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('detail.minTrade')}</p>
              <p className="font-medium">
                {formatCurrency(trader.minTradeAmount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('detail.slippageTolerance')}</p>
              <p className="font-medium">{trader.slippageTolerance}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('detail.maxDrawdown')}</p>
              <p className="font-medium">{trader.maxDrawdownPercent}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('detail.stopLoss')}</p>
              <p className="font-medium">
                {trader.stopLossPercent ? `${trader.stopLossPercent}%` : t('detail.none')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Open Positions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('openPositions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {trader.positions && trader.positions.length > 0 ? (
            <div className="space-y-4">
              {trader.positions.map((position: {
                id: string;
                outcome: string;
                shares: number;
                avgEntryPrice: number;
                currentPrice?: number;
                unrealizedPnl: number;
                market?: { question: string };
              }) => (
                <div
                  key={position.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">
                      {position.market?.question || t('detail.unknownMarket')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {position.outcome} · {position.shares.toFixed(2)} {t('detail.shares')} @{' '}
                      {(position.avgEntryPrice * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-medium ${
                        position.unrealizedPnl >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(position.unrealizedPnl)}
                    </p>
                    {position.currentPrice && (
                      <p className="text-sm text-muted-foreground">
                        {t('detail.current')}: {(position.currentPrice * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              {t('noOpenPositions')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
