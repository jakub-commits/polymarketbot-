'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Trade {
  id: string;
  traderId: string;
  traderName?: string;
  marketId: string;
  marketQuestion?: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  amount: number;
  price: number;
  status: string;
  pnl?: number;
  executedAt: string;
  createdAt: string;
}

interface TradeHistoryResponse {
  trades: Trade[];
  total: number;
  page: number;
  pageSize: number;
}

interface TradeHistoryTableProps {
  traderId?: string;
  className?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data;
};

type SortField = 'executedAt' | 'amount' | 'pnl' | 'price';
type SortOrder = 'asc' | 'desc';

export function TradeHistoryTable({ traderId, className }: TradeHistoryTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('executedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sortBy', sortField);
    params.set('sortOrder', sortOrder);
    if (traderId) params.set('traderId', traderId);
    if (search) params.set('search', search);
    if (sideFilter !== 'all') params.set('side', sideFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    return params.toString();
  }, [page, pageSize, traderId, search, sideFilter, statusFilter, sortField, sortOrder]);

  const { data, isLoading, error } = useSWR<TradeHistoryResponse>(
    `${API_URL}/trades?${queryParams}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      FILLED: 'default',
      PENDING: 'secondary',
      FAILED: 'destructive',
      CANCELLED: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle>Trade History</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search markets..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 w-[200px]"
              />
            </div>
            <Select value={sideFilter} onValueChange={(v) => { setSideFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[100px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sides</SelectItem>
                <SelectItem value="BUY">Buy</SelectItem>
                <SelectItem value="SELL">Sell</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="FILLED">Filled</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Failed to load trade history
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('executedAt')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Amount
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Price
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort('pnl')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        P&L
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No trades found
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.trades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(trade.executedAt || trade.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={trade.marketQuestion}>
                          {trade.marketQuestion || trade.marketId.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={trade.side === 'BUY' ? 'default' : 'secondary'}>
                            {trade.side}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={trade.outcome === 'YES' ? 'outline' : 'secondary'}>
                            {trade.outcome}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${trade.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {(trade.price * 100).toFixed(1)}¢
                        </TableCell>
                        <TableCell className="text-right">
                          {getStatusBadge(trade.status)}
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-mono',
                          trade.pnl !== undefined && trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {trade.pnl !== undefined
                            ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, data?.total || 0)} of {data?.total || 0} trades
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
                    Page {page} of {totalPages}
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
  );
}
