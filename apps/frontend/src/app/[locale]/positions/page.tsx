'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useTraderPerformance } from '@/hooks/useAnalytics';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Position {
  id: string;
  traderId: string;
  traderName?: string;
  marketId: string;
  marketQuestion?: string;
  outcome: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  value: number;
  createdAt: string;
  updatedAt: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data?.items || [];
};

export default function PositionsPage() {
  const t = useTranslations('positions');
  const tCommon = useTranslations('common');
  const [selectedTraderId, setSelectedTraderId] = useState<string | undefined>(undefined);
  const { traders } = useTraderPerformance();

  const url = selectedTraderId
    ? `${API_URL}/positions?traderId=${selectedTraderId}`
    : `${API_URL}/positions`;

  const { data: positions, isLoading, error, mutate } = useSWR<Position[]>(
    url,
    fetcher,
    { refreshInterval: 30000 }
  );

  const stats = positions ? {
    totalValue: positions.reduce((sum, p) => sum + p.value, 0),
    totalUnrealizedPnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
    totalPositions: positions.length,
    profitablePositions: positions.filter((p) => p.unrealizedPnl > 0).length,
  } : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedTraderId || 'all'}
            onValueChange={(value) => setSelectedTraderId(value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('selectTrader')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTraders')}</SelectItem>
              {traders.map((trader) => (
                <SelectItem key={trader.traderId} value={trader.traderId}>
                  {trader.name || trader.walletAddress.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('totalValue')}</p>
              <p className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('unrealizedPnl')}</p>
              <p className={cn(
                'text-2xl font-bold',
                stats.totalUnrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
              )}>
                {stats.totalUnrealizedPnl >= 0 ? '+' : ''}${stats.totalUnrealizedPnl.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('totalPositions')}</p>
              <p className="text-2xl font-bold">{stats.totalPositions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('profitable')}</p>
              <p className="text-2xl font-bold">
                {stats.profitablePositions} / {stats.totalPositions}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : error ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              {tCommon('error')}
            </div>
          ) : !positions || positions.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              {t('noPositions')}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('market')}</TableHead>
                    <TableHead>{t('trader')}</TableHead>
                    <TableHead>{t('outcome')}</TableHead>
                    <TableHead className="text-right">{t('shares')}</TableHead>
                    <TableHead className="text-right">{t('avgPrice')}</TableHead>
                    <TableHead className="text-right">{t('currentPrice')}</TableHead>
                    <TableHead className="text-right">{t('value')}</TableHead>
                    <TableHead className="text-right">{t('pnl')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="max-w-[250px]">
                        <p className="truncate font-medium" title={position.marketQuestion}>
                          {position.marketQuestion || position.marketId}
                        </p>
                        <div className="mt-1">
                          <Progress
                            value={position.currentPrice * 100}
                            className="h-1.5 w-32"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {position.traderName || position.traderId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={position.outcome === 'YES' ? 'default' : 'secondary'}>
                          {position.outcome}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {position.shares.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(position.avgPrice * 100).toFixed(1)}¢
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(position.currentPrice * 100).toFixed(1)}¢
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${position.value.toFixed(2)}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right font-mono',
                        position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                      )}>
                        <div className="flex items-center justify-end gap-1">
                          {position.unrealizedPnl >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
