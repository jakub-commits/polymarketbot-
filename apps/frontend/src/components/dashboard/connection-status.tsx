'use client';

import { useConnectionStatus } from '@/hooks/useWebSocket';
import { Wifi, WifiOff, RefreshCw, AlertCircle, LucideIcon } from 'lucide-react';

type ConnectionStatusType = 'connected' | 'disconnected' | 'reconnecting' | 'error';

interface StatusConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  label: string;
}

export function ConnectionStatus() {
  const status = useConnectionStatus() as ConnectionStatusType;

  const statusConfig: Record<ConnectionStatusType, StatusConfig> = {
    connected: {
      icon: Wifi,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      label: 'Connected',
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
      label: 'Disconnected',
    },
    reconnecting: {
      icon: RefreshCw,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      label: 'Reconnecting...',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      label: 'Connection Error',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${config.bgColor}`}
    >
      <Icon
        className={`h-4 w-4 ${config.color} ${
          status === 'reconnecting' ? 'animate-spin' : ''
        }`}
      />
      <span className={config.color}>{config.label}</span>
    </div>
  );
}

export function ConnectionDot() {
  const status = useConnectionStatus() as ConnectionStatusType;

  const dotColors: Record<ConnectionStatusType, string> = {
    connected: 'bg-green-500',
    disconnected: 'bg-gray-500',
    reconnecting: 'bg-yellow-500 animate-pulse',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${dotColors[status]}`} />
      <span className="text-xs text-muted-foreground capitalize">{status}</span>
    </div>
  );
}
