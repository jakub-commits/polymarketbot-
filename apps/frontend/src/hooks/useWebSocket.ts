'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ConnectionStatus,
  Trade,
  Position,
  PnLUpdate,
  StatsUpdate,
  RiskAlert,
  SLTPTriggerEvent,
  Notification,
} from '@polymarket-bot/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface WebSocketState {
  status: ConnectionStatus;
  lastPnL: PnLUpdate | null;
  lastStats: StatsUpdate | null;
  recentTrades: Trade[];
  notifications: Notification[];
  riskAlerts: RiskAlert[];
}

const MAX_RECENT_TRADES = 50;
const MAX_NOTIFICATIONS = 20;

export function useWebSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    lastPnL: null,
    lastStats: null,
    recentTrades: [],
    notifications: [],
    riskAlerts: [],
  });

  useEffect(() => {
    const socket: TypedSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Connection events
    socket.on('connect', () => {
      setState((prev) => ({ ...prev, status: 'connected' }));
      // Auto-subscribe to all events
      socket.emit('subscribe:all');
    });

    socket.on('disconnect', () => {
      setState((prev) => ({ ...prev, status: 'disconnected' }));
    });

    socket.on('connect_error', () => {
      setState((prev) => ({ ...prev, status: 'error' }));
    });

    // Trade events
    socket.on('trade:new', (trade: Trade) => {
      setState((prev) => ({
        ...prev,
        recentTrades: [trade, ...prev.recentTrades].slice(0, MAX_RECENT_TRADES),
      }));
    });

    socket.on('trade:updated', (trade: Trade) => {
      setState((prev) => ({
        ...prev,
        recentTrades: prev.recentTrades.map((t) =>
          t.id === trade.id ? trade : t
        ),
      }));
    });

    // Analytics events
    socket.on('pnl:updated', (pnl: PnLUpdate) => {
      setState((prev) => ({ ...prev, lastPnL: pnl }));
    });

    socket.on('stats:updated', (stats: StatsUpdate) => {
      setState((prev) => ({ ...prev, lastStats: stats }));
    });

    // Risk events
    socket.on('risk:alert', (alert: RiskAlert) => {
      setState((prev) => ({
        ...prev,
        riskAlerts: [alert, ...prev.riskAlerts].slice(0, 10),
      }));
    });

    // Notifications
    socket.on('notification', (notification: Notification) => {
      setState((prev) => ({
        ...prev,
        notifications: [notification, ...prev.notifications].slice(0, MAX_NOTIFICATIONS),
      }));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribeToTrader = useCallback((traderId: string) => {
    socketRef.current?.emit('subscribe:trader', traderId);
  }, []);

  const unsubscribeFromTrader = useCallback((traderId: string) => {
    socketRef.current?.emit('unsubscribe:trader', traderId);
  }, []);

  const subscribeToMarket = useCallback((marketId: string) => {
    socketRef.current?.emit('subscribe:market', marketId);
  }, []);

  const unsubscribeFromMarket = useCallback((marketId: string) => {
    socketRef.current?.emit('unsubscribe:market', marketId);
  }, []);

  const subscribeToAll = useCallback(() => {
    socketRef.current?.emit('subscribe:all');
  }, []);

  const clearNotifications = useCallback(() => {
    setState((prev) => ({ ...prev, notifications: [] }));
  }, []);

  const clearRiskAlerts = useCallback(() => {
    setState((prev) => ({ ...prev, riskAlerts: [] }));
  }, []);

  return {
    socket: socketRef.current,
    ...state,
    isConnected: state.status === 'connected',
    subscribeToTrader,
    unsubscribeFromTrader,
    subscribeToMarket,
    unsubscribeFromMarket,
    subscribeToAll,
    clearNotifications,
    clearRiskAlerts,
  };
}

// Hook for real-time trades
export function useRealtimeTrades(traderId?: string) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    const socket: TypedSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      if (traderId) {
        socket.emit('subscribe:trader', traderId);
      } else {
        socket.emit('subscribe:all');
      }
    });

    socket.on('trade:new', (trade: Trade) => {
      if (!traderId || trade.traderId === traderId) {
        setTrades((prev) => [trade, ...prev].slice(0, MAX_RECENT_TRADES));
      }
    });

    socket.on('trade:updated', (trade: Trade) => {
      setTrades((prev) =>
        prev.map((t) => (t.id === trade.id ? trade : t))
      );
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [traderId]);

  return trades;
}

// Hook for real-time positions
export function useRealtimePositions(traderId?: string) {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    const socket: TypedSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      if (traderId) {
        socket.emit('subscribe:trader', traderId);
      } else {
        socket.emit('subscribe:all');
      }
    });

    socket.on('position:opened', (position: Position) => {
      if (!traderId || position.traderId === traderId) {
        setPositions((prev) => [...prev, position]);
      }
    });

    socket.on('position:updated', (position: Position) => {
      setPositions((prev) =>
        prev.map((p) => (p.id === position.id ? position : p))
      );
    });

    socket.on('position:closed', (position: Position) => {
      setPositions((prev) => prev.filter((p) => p.id !== position.id));
    });

    return () => {
      socket.disconnect();
    };
  }, [traderId]);

  return positions;
}

// Hook for P&L updates
export function useRealtimePnL() {
  const [pnl, setPnL] = useState<PnLUpdate | null>(null);

  useEffect(() => {
    const socket: TypedSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('subscribe:all');
    });

    socket.on('pnl:updated', (data: PnLUpdate) => {
      setPnL(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return pnl;
}

// Hook for risk alerts
export function useRiskAlerts() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [sltpTriggers, setSltpTriggers] = useState<SLTPTriggerEvent[]>([]);

  useEffect(() => {
    const socket: TypedSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('subscribe:all');
    });

    socket.on('risk:alert', (alert: RiskAlert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 20));
    });

    socket.on('risk:sltp', (trigger: SLTPTriggerEvent) => {
      setSltpTriggers((prev) => [trigger, ...prev].slice(0, 20));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { alerts, sltpTriggers };
}

// Simple hook for connection status only
export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));

    return () => {
      socket.disconnect();
    };
  }, []);

  return status;
}
