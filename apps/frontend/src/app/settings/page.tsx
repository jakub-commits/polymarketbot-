'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  CheckCircle2,
  Wallet,
  Key,
  Bell,
  Shield,
  RefreshCw,
  Save,
} from 'lucide-react';
import { fetcher } from '@/lib/api-client';

interface HealthStatus {
  status: string;
  version: string;
  uptime: number;
  services: {
    database: { status: string; latency: number };
    redis: { status: string; latency: number };
    polymarket: { status: string };
  };
}

interface Settings {
  copyTrading: {
    enabled: boolean;
    maxPositionSize: number;
    maxDailyTrades: number;
    slippageTolerance: number;
    minTradeAmount: number;
  };
  notifications: {
    tradeExecuted: boolean;
    tradesFailed: boolean;
    dailySummary: boolean;
    webhookUrl?: string;
  };
}

const healthFetcher = async (url: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}${url}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function SettingsPage() {
  const { data: health, isLoading: statusLoading } = useSWR<HealthStatus>(
    '/health',
    healthFetcher,
    { refreshInterval: 10000 }
  );

  const { data: settings, mutate: mutateSettings } = useSWR<Settings>(
    '/settings',
    fetcher
  );

  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);

  const currentSettings = localSettings || settings;

  const handleSave = async () => {
    if (!currentSettings) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/settings`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentSettings),
        }
      );
      if (response.ok) {
        mutateSettings();
        setLocalSettings(null);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof Settings>(
    category: K,
    key: keyof Settings[K],
    value: Settings[K][keyof Settings[K]]
  ) => {
    const newSettings = {
      ...currentSettings,
      [category]: {
        ...currentSettings?.[category],
        [key]: value,
      },
    } as Settings;
    setLocalSettings(newSettings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your bot and trading preferences
        </p>
      </div>

      {/* Bot Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Bot Status
          </CardTitle>
          <CardDescription>
            Current connection and wallet status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Database</p>
                    <p className="text-sm text-muted-foreground">
                      {health?.services.database.latency}ms latency
                    </p>
                  </div>
                </div>
                {health?.services.database.status === 'healthy' ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Redis</p>
                    <p className="text-sm text-muted-foreground">
                      {health?.services.redis.latency}ms latency
                    </p>
                  </div>
                </div>
                {health?.services.redis.status === 'healthy' ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Polymarket API</p>
                    <p className="text-sm text-muted-foreground">
                      v{health?.version}
                    </p>
                  </div>
                </div>
                {health?.services.polymarket.status === 'healthy' ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Disconnected
                  </Badge>
                )}
              </div>

              <div className="md:col-span-3 p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">System Status</p>
                    <p className="text-lg font-semibold capitalize">{health?.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Uptime</p>
                    <p className="text-lg font-semibold">
                      {health?.uptime ? Math.floor(health.uptime / 60) : 0} min
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Copy Trading Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Copy Trading</CardTitle>
          <CardDescription>
            Configure how trades are copied from tracked traders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Copy Trading</Label>
              <p className="text-sm text-muted-foreground">
                Automatically copy trades from active traders
              </p>
            </div>
            <Switch
              checked={currentSettings?.copyTrading?.enabled ?? false}
              onCheckedChange={(checked) =>
                updateSetting('copyTrading', 'enabled', checked)
              }
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxPositionSize">Max Position Size ($)</Label>
              <Input
                id="maxPositionSize"
                type="number"
                value={currentSettings?.copyTrading?.maxPositionSize ?? 100}
                onChange={(e) =>
                  updateSetting('copyTrading', 'maxPositionSize', Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum amount per single position
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxDailyTrades">Max Daily Trades</Label>
              <Input
                id="maxDailyTrades"
                type="number"
                value={currentSettings?.copyTrading?.maxDailyTrades ?? 50}
                onChange={(e) =>
                  updateSetting('copyTrading', 'maxDailyTrades', Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum trades to execute per day
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slippageTolerance">Slippage Tolerance (%)</Label>
              <Input
                id="slippageTolerance"
                type="number"
                step="0.1"
                value={currentSettings?.copyTrading?.slippageTolerance ?? 2}
                onChange={(e) =>
                  updateSetting('copyTrading', 'slippageTolerance', Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum acceptable price slippage
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minTradeAmount">Min Trade Amount ($)</Label>
              <Input
                id="minTradeAmount"
                type="number"
                value={currentSettings?.copyTrading?.minTradeAmount ?? 5}
                onChange={(e) =>
                  updateSetting('copyTrading', 'minTradeAmount', Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum trade size to copy
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure alerts and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Trade Executed</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when a trade is successfully executed
                </p>
              </div>
              <Switch
                checked={currentSettings?.notifications?.tradeExecuted ?? true}
                onCheckedChange={(checked) =>
                  updateSetting('notifications', 'tradeExecuted', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Trade Failed</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when a trade fails to execute
                </p>
              </div>
              <Switch
                checked={currentSettings?.notifications?.tradesFailed ?? true}
                onCheckedChange={(checked) =>
                  updateSetting('notifications', 'tradesFailed', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Daily Summary</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily performance summary
                </p>
              </div>
              <Switch
                checked={currentSettings?.notifications?.dailySummary ?? false}
                onCheckedChange={(checked) =>
                  updateSetting('notifications', 'dailySummary', checked)
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
            <Input
              id="webhookUrl"
              type="url"
              placeholder="https://your-webhook-url.com/notify"
              value={currentSettings?.notifications?.webhookUrl ?? ''}
              onChange={(e) =>
                updateSetting('notifications', 'webhookUrl', e.target.value || undefined)
              }
            />
            <p className="text-xs text-muted-foreground">
              Send notifications to a custom webhook endpoint (Discord, Slack, etc.)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {localSettings && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
