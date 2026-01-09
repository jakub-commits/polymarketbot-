'use client';

import { TradeHistoryTable } from '@/components/analytics';

export default function TradesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trade History</h1>
        <p className="text-muted-foreground">
          View all executed trades and their outcomes
        </p>
      </div>

      <TradeHistoryTable />
    </div>
  );
}
