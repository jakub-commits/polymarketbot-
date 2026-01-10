'use client';

import { useEffect, useState, useCallback } from 'react';
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

// =============================================================================
// SINGLETON SOCKET MANAGER
// =============================================================================

interface SocketManagerState {
  status: ConnectionStatus;
  lastPnL: PnLUpdate | null;
  lastStats: StatsUpdate | null;
  recentTrades: Trade[];
  positions: Position[];
  notifications: Notification[];
  riskAlerts: RiskAlert[];
  sltpTriggers: SLTPTriggerEvent[];
}

type StateListener = () => void;

const MAX_RECENT_TRADES = 50;
const MAX_NOTIFICATIONS = 20;
const MAX_ALERTS = 20;

/**
 * Singleton Socket Manager
 *
 * Manages a single shared Socket.IO connection with reference counting.
 * Connection is created on first subscriber and destroyed when last unsubscribes.
 */
class SocketManager {
  private static instance: SocketManager | null = null;

  private socket: TypedSocket | null = null;
  private subscriberCount = 0;
  private listeners: Set<StateListener> = new Set();
  private traderSubscriptions: Map<string, number> = new Map();
  private marketSubscriptions: Map<string, number> = new Map();

  private state: SocketManagerState = {
    status: 'disconnected',
    lastPnL: null,
    lastStats: null,
    recentTrades: [],
    positions: [],
    notifications: [],
    riskAlerts: [],
    sltpTriggers: [],
  };

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  /**
   * Subscribe to the socket manager.
   * Creates connection on first subscriber.
   * Returns unsubscribe function.
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    this.subscriberCount++;

    if (this.subscriberCount === 1) {
      this.connect();
    }

    return () => {
      this.listeners.delete(listener);
      this.subscriberCount--;

      if (this.subscriberCount === 0) {
        this.disconnect();
      }
    };
  }

  getState(): SocketManagerState {
    return this.state;
  }

  getSocket(): TypedSocket | null {
    return this.socket;
  }

  private setState(updates: Partial<SocketManagerState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  private connect(): void {
    if (this.socket) return;

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
      this.setState({ status: 'connected' });
      // Auto-subscribe to all events
      socket.emit('subscribe:all');

      // Re-subscribe to any trader/market subscriptions
      this.traderSubscriptions.forEach((_, traderId) => {
        socket.emit('subscribe:trader', traderId);
      });
      this.marketSubscriptions.forEach((_, marketId) => {
        socket.emit('subscribe:market', marketId);
      });
    });

    socket.on('disconnect', () => {
      this.setState({ status: 'disconnected' });
    });

    socket.on('connect_error', () => {
      this.setState({ status: 'error' });
    });

    socket.io.on('reconnect_attempt', () => {
      this.setState({ status: 'reconnecting' });
    });

    // Trade events
    socket.on('trade:new', (trade: Trade) => {
      this.setState({
        recentTrades: [trade, ...this.state.recentTrades].slice(0, MAX_RECENT_TRADES),
      });
    });

    socket.on('trade:updated', (trade: Trade) => {
      this.setState({
        recentTrades: this.state.recentTrades.map((t) =>
          t.id === trade.id ? trade : t
        ),
      });
    });

    // Position events
    socket.on('position:opened', (position: Position) => {
      this.setState({
        positions: [...this.state.positions, position],
      });
    });

    socket.on('position:updated', (position: Position) => {
      this.setState({
        positions: this.state.positions.map((p) =>
          p.id === position.id ? position : p
        ),
      });
    });

    socket.on('position:closed', (position: Position) => {
      this.setState({
        positions: this.state.positions.filter((p) => p.id !== position.id),
      });
    });

    // Analytics events
    socket.on('pnl:updated', (pnl: PnLUpdate) => {
      this.setState({ lastPnL: pnl });
    });

    socket.on('stats:updated', (stats: StatsUpdate) => {
      this.setState({ lastStats: stats });
    });

    // Risk events
    socket.on('risk:alert', (alert: RiskAlert) => {
      this.setState({
        riskAlerts: [alert, ...this.state.riskAlerts].slice(0, MAX_ALERTS),
      });
    });

    socket.on('risk:sltp', (trigger: SLTPTriggerEvent) => {
      this.setState({
        sltpTriggers: [trigger, ...this.state.sltpTriggers].slice(0, MAX_ALERTS),
      });
    });

    // Notifications
    socket.on('notification', (notification: Notification) => {
      this.setState({
        notifications: [notification, ...this.state.notifications].slice(0, MAX_NOTIFICATIONS),
      });
    });

    this.socket = socket;
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.setState({
        status: 'disconnected',
        lastPnL: null,
        lastStats: null,
        recentTrades: [],
        positions: [],
        notifications: [],
        riskAlerts: [],
        sltpTriggers: [],
      });
    }
  }

  // Subscription management with ref counting
  subscribeToTrader(traderId: string): void {
    const count = this.traderSubscriptions.get(traderId) || 0;
    this.traderSubscriptions.set(traderId, count + 1);

    if (count === 0 && this.socket?.connected) {
      this.socket.emit('subscribe:trader', traderId);
    }
  }

  unsubscribeFromTrader(traderId: string): void {
    const count = this.traderSubscriptions.get(traderId) || 0;
    if (count <= 1) {
      this.traderSubscriptions.delete(traderId);
      if (this.socket?.connected) {
        this.socket.emit('unsubscribe:trader', traderId);
      }
    } else {
      this.traderSubscriptions.set(traderId, count - 1);
    }
  }

  subscribeToMarket(marketId: string): void {
    const count = this.marketSubscriptions.get(marketId) || 0;
    this.marketSubscriptions.set(marketId, count + 1);

    if (count === 0 && this.socket?.connected) {
      this.socket.emit('subscribe:market', marketId);
    }
  }

  unsubscribeFromMarket(marketId: string): void {
    const count = this.marketSubscriptions.get(marketId) || 0;
    if (count <= 1) {
      this.marketSubscriptions.delete(marketId);
      if (this.socket?.connected) {
        this.socket.emit('unsubscribe:market', marketId);
      }
    } else {
      this.marketSubscriptions.set(marketId, count - 1);
    }
  }

  subscribeToAll(): void {
    this.socket?.emit('subscribe:all');
  }

  clearNotifications(): void {
    this.setState({ notifications: [] });
  }

  clearRiskAlerts(): void {
    this.setState({ riskAlerts: [], sltpTriggers: [] });
  }
}

// Get the singleton instance
const socketManager = SocketManager.getInstance();

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main WebSocket hook - provides full access to socket state and actions.
 * Uses shared singleton connection.
 */
export function useWebSocket() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = socketManager.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  const state = socketManager.getState();

  const subscribeToTrader = useCallback((traderId: string) => {
    socketManager.subscribeToTrader(traderId);
  }, []);

  const unsubscribeFromTrader = useCallback((traderId: string) => {
    socketManager.unsubscribeFromTrader(traderId);
  }, []);

  const subscribeToMarket = useCallback((marketId: string) => {
    socketManager.subscribeToMarket(marketId);
  }, []);

  const unsubscribeFromMarket = useCallback((marketId: string) => {
    socketManager.unsubscribeFromMarket(marketId);
  }, []);

  const subscribeToAll = useCallback(() => {
    socketManager.subscribeToAll();
  }, []);

  const clearNotifications = useCallback(() => {
    socketManager.clearNotifications();
  }, []);

  const clearRiskAlerts = useCallback(() => {
    socketManager.clearRiskAlerts();
  }, []);

  return {
    socket: socketManager.getSocket(),
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

/**
 * Hook for real-time trades.
 * Uses shared socket connection.
 */
export function useRealtimeTrades(traderId?: string): Trade[] {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = socketManager.subscribe(() => {
      forceUpdate({});
    });

    if (traderId) {
      socketManager.subscribeToTrader(traderId);
    }

    return () => {
      unsubscribe();
      if (traderId) {
        socketManager.unsubscribeFromTrader(traderId);
      }
    };
  }, [traderId]);

  const trades = socketManager.getState().recentTrades;

  // Filter by traderId if provided
  if (traderId) {
    return trades.filter((trade) => trade.traderId === traderId);
  }

  return trades;
}

/**
 * Hook for real-time positions.
 * Uses shared socket connection.
 */
export function useRealtimePositions(traderId?: string): Position[] {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = socketManager.subscribe(() => {
      forceUpdate({});
    });

    if (traderId) {
      socketManager.subscribeToTrader(traderId);
    }

    return () => {
      unsubscribe();
      if (traderId) {
        socketManager.unsubscribeFromTrader(traderId);
      }
    };
  }, [traderId]);

  const positions = socketManager.getState().positions;

  // Filter by traderId if provided
  if (traderId) {
    return positions.filter((position) => position.traderId === traderId);
  }

  return positions;
}

/**
 * Hook for P&L updates.
 * Uses shared socket connection.
 */
export function useRealtimePnL(): PnLUpdate | null {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = socketManager.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  return socketManager.getState().lastPnL;
}

/**
 * Hook for risk alerts.
 * Uses shared socket connection.
 */
export function useRiskAlerts(): { alerts: RiskAlert[]; sltpTriggers: SLTPTriggerEvent[] } {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = socketManager.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  const state = socketManager.getState();
  return {
    alerts: state.riskAlerts,
    sltpTriggers: state.sltpTriggers,
  };
}

/**
 * Simple hook for connection status only.
 * Uses shared socket connection.
 */
export function useConnectionStatus(): ConnectionStatus {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = socketManager.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  return socketManager.getState().status;
}

/**
 * Hook for notifications.
 * Uses shared socket connection.
 */
export function useNotifications(): {
  notifications: Notification[];
  clearNotifications: () => void;
} {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = socketManager.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  return {
    notifications: socketManager.getState().notifications,
    clearNotifications: () => socketManager.clearNotifications(),
  };
}
