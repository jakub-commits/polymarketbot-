'use client';

import { useTranslations } from 'next-intl';
import { TradeHistoryTable } from '@/components/analytics';

export default function TradesPage() {
  const t = useTranslations('trades');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <TradeHistoryTable />
    </div>
  );
}
