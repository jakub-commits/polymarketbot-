'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Market {
  id: string;
  conditionId: string;
  question: string;
  description?: string;
  category?: string;
  endDate?: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MarketsResponse {
  items: Market[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const marketsFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data;
};

export default function MarketsPage() {
  const t = useTranslations('markets');
  const tCommon = useTranslations('common');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const limit = 20;

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(limit));
  if (search) queryParams.set('search', search);
  if (category !== 'all') queryParams.set('category', category);
  if (status === 'active') queryParams.set('active', 'true');
  if (status === 'closed') queryParams.set('closed', 'true');

  const { data, isLoading, error, mutate } = useSWR<MarketsResponse>(
    `${API_URL}/markets?${queryParams.toString()}`,
    marketsFetcher,
    { refreshInterval: 60000 }
  );

  const totalPages = data?.totalPages || 0;

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getYesPrice = (market: Market) => {
    const yesIndex = market.outcomes.findIndex(o => o.toLowerCase() === 'yes');
    return yesIndex >= 0 ? market.outcomePrices[yesIndex] : market.outcomePrices[0] || 0;
  };

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
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {tCommon('refresh')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tCommon('search')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('categories.all')}</SelectItem>
                <SelectItem value="politics">{t('categories.politics')}</SelectItem>
                <SelectItem value="sports">{t('categories.sports')}</SelectItem>
                <SelectItem value="crypto">{t('categories.crypto')}</SelectItem>
                <SelectItem value="entertainment">{t('categories.entertainment')}</SelectItem>
                <SelectItem value="science">{t('categories.science')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={tCommon('status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all')}</SelectItem>
                <SelectItem value="active">{tCommon('active')}</SelectItem>
                <SelectItem value="closed">{tCommon('closed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('totalMarkets')}</p>
              <p className="text-2xl font-bold">{data.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('showing')}</p>
              <p className="text-2xl font-bold">{data.items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{tCommon('page')}</p>
              <p className="text-2xl font-bold">{page} / {totalPages || 1}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t('perPage')}</p>
              <p className="text-2xl font-bold">{limit}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Markets Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              {tCommon('error')}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
              <p>{t('noMarkets')}</p>
              <p className="text-sm mt-1">{t('noMarketsDesc')}</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[300px]">{t('title')}</TableHead>
                      <TableHead>{t('category')}</TableHead>
                      <TableHead className="text-center">Price</TableHead>
                      <TableHead className="text-right">{t('volume')}</TableHead>
                      <TableHead className="text-right">{t('liquidity')}</TableHead>
                      <TableHead>{t('endDate')}</TableHead>
                      <TableHead className="text-center">{tCommon('status')}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((market) => {
                      const yesPrice = getYesPrice(market);
                      return (
                        <TableRow key={market.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium line-clamp-2" title={market.question}>
                                {market.question}
                              </p>
                              <Progress value={yesPrice * 100} className="h-1.5 w-32" />
                            </div>
                          </TableCell>
                          <TableCell>
                            {market.category ? (
                              <Badge variant="outline" className="capitalize">
                                {market.category}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {yesPrice >= 0.5 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-mono font-medium">
                                {(yesPrice * 100).toFixed(1)}¢
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatVolume(market.volume)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatVolume(market.liquidity)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="text-sm">{formatDate(market.endDate)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {market.closed ? (
                              <Badge variant="secondary">{tCommon('closed')}</Badge>
                            ) : market.active ? (
                              <Badge variant="default" className="bg-green-500">{tCommon('active')}</Badge>
                            ) : (
                              <Badge variant="outline">{tCommon('paused')}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <a
                              href={`https://polymarket.com/event/${market.conditionId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {tCommon('showing')} {((page - 1) * limit) + 1} {tCommon('to')} {Math.min(page * limit, data.total)} {tCommon('of')} {data.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {tCommon('page')} {page} {tCommon('of')} {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
