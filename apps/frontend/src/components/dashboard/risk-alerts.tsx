'use client';

import { useRiskAlerts } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  Shield,
  TrendingDown,
  Target,
  X,
  LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

// Helper for currency formatting
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

type AlertType = 'WARNING' | 'CRITICAL' | 'LIMIT_REACHED';
type SLTPType = 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP';

interface AlertConfig {
  icon: LucideIcon;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

interface SLTPConfig extends AlertConfig {
  label: string;
}

export function RiskAlerts() {
  const { alerts, sltpTriggers } = useRiskAlerts();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const visibleAlerts = alerts.filter(
    (a) => !dismissedAlerts.has(`${a.traderId}-${a.timestamp}`)
  );

  const dismissAlert = (alertKey: string) => {
    setDismissedAlerts((prev) => {
      const newSet = new Set(prev);
      newSet.add(alertKey);
      return newSet;
    });
  };

  if (visibleAlerts.length === 0 && sltpTriggers.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-500/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-yellow-600">
          <Shield className="h-5 w-5" />
          Risk Alerts
          <span className="ml-auto text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full">
            {visibleAlerts.length + sltpTriggers.length} active
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drawdown Alerts */}
        {visibleAlerts.map((alert) => {
          const alertKey = `${alert.traderId}-${alert.timestamp}`;
          const alertConfig: Record<AlertType, AlertConfig> = {
            WARNING: {
              icon: AlertTriangle,
              bgColor: 'bg-yellow-500/10',
              borderColor: 'border-yellow-500/50',
              textColor: 'text-yellow-600',
            },
            CRITICAL: {
              icon: AlertCircle,
              bgColor: 'bg-orange-500/10',
              borderColor: 'border-orange-500/50',
              textColor: 'text-orange-600',
            },
            LIMIT_REACHED: {
              icon: XCircle,
              bgColor: 'bg-red-500/10',
              borderColor: 'border-red-500/50',
              textColor: 'text-red-600',
            },
          };
          const config = alertConfig[alert.type as AlertType];
          const Icon = config.icon;

          return (
            <div
              key={alertKey}
              className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}
            >
              <Icon className={`h-5 w-5 mt-0.5 ${config.textColor}`} />
              <div className="flex-1">
                <p className={`font-medium text-sm ${config.textColor}`}>
                  {alert.type === 'LIMIT_REACHED'
                    ? 'Drawdown Limit Reached'
                    : alert.type === 'CRITICAL'
                    ? 'Critical Drawdown Warning'
                    : 'Drawdown Warning'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {alert.currentDrawdown.toFixed(1)}% | Limit:{' '}
                  {alert.maxDrawdown}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Balance: {formatCurrency(alert.currentBalance)} (Peak:{' '}
                  {formatCurrency(alert.peakBalance)})
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => dismissAlert(alertKey)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {/* SL/TP Triggers */}
        {sltpTriggers.slice(0, 5).map((trigger, idx) => {
          const triggerConfig: Record<SLTPType, SLTPConfig> = {
            STOP_LOSS: {
              icon: TrendingDown,
              bgColor: 'bg-red-500/10',
              borderColor: 'border-red-500/50',
              textColor: 'text-red-600',
              label: 'Stop Loss Triggered',
            },
            TAKE_PROFIT: {
              icon: Target,
              bgColor: 'bg-green-500/10',
              borderColor: 'border-green-500/50',
              textColor: 'text-green-600',
              label: 'Take Profit Triggered',
            },
            TRAILING_STOP: {
              icon: TrendingDown,
              bgColor: 'bg-orange-500/10',
              borderColor: 'border-orange-500/50',
              textColor: 'text-orange-600',
              label: 'Trailing Stop Triggered',
            },
          };
          const config = triggerConfig[trigger.type as SLTPType];
          const Icon = config.icon;

          return (
            <div
              key={`${trigger.positionId}-${idx}`}
              className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}
            >
              <Icon className={`h-5 w-5 mt-0.5 ${config.textColor}`} />
              <div className="flex-1">
                <p className={`font-medium text-sm ${config.textColor}`}>
                  {config.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  P&L: {trigger.pnlPercent >= 0 ? '+' : ''}
                  {trigger.pnlPercent.toFixed(2)}% | Shares: {trigger.shares.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Entry: {(trigger.entryPrice * 100).toFixed(1)}% | Exit:{' '}
                  {(trigger.currentPrice * 100).toFixed(1)}%
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  trigger.success
                    ? 'bg-green-500/20 text-green-600'
                    : 'bg-red-500/20 text-red-600'
                }`}
              >
                {trigger.success ? 'Executed' : 'Failed'}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function RiskAlertBanner() {
  const { alerts } = useRiskAlerts();
  const criticalAlerts = alerts.filter(
    (a) => a.type === 'CRITICAL' || a.type === 'LIMIT_REACHED'
  );

  if (criticalAlerts.length === 0) return null;

  const latestAlert = criticalAlerts[0];

  return (
    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">
          {latestAlert.type === 'LIMIT_REACHED'
            ? 'Trading Paused - Drawdown Limit Reached'
            : 'Critical Drawdown Warning'}
        </span>
        <span className="ml-auto text-sm">
          {latestAlert.currentDrawdown.toFixed(1)}% drawdown
        </span>
      </div>
    </div>
  );
}
