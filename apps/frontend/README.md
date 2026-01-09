# Polymarket Copy Trading Bot - Frontend

The frontend dashboard for the Polymarket Copy Trading Bot. A Next.js 14 application providing real-time monitoring, trader management, and analytics visualization.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **UI Library**: React 18
- **Styling**: Tailwind CSS 3.3
- **Components**: shadcn/ui (Radix UI primitives)
- **Charts**: Recharts 2.10
- **State Management**: Zustand 4.4
- **Data Fetching**: SWR 2.2
- **WebSocket**: Socket.IO Client 4.7
- **Icons**: Lucide React

## Project Structure

```
apps/frontend/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Dashboard home
│   │   └── traders/              # Trader management
│   │       ├── page.tsx          # Traders list
│   │       ├── add/
│   │       │   └── page.tsx      # Add trader form
│   │       └── [id]/
│   │           └── page.tsx      # Trader details
│   │
│   ├── components/               # React components
│   │   ├── analytics/            # Analytics components
│   │   │   ├── index.ts
│   │   │   ├── pnl-chart.tsx           # P&L line chart
│   │   │   ├── performance-metrics.tsx  # Key metrics cards
│   │   │   ├── trade-history-table.tsx  # Trade history
│   │   │   └── trader-comparison.tsx    # Trader comparison
│   │   │
│   │   ├── dashboard/            # Dashboard widgets
│   │   │   ├── index.ts
│   │   │   ├── live-trade-feed.tsx     # Real-time trade feed
│   │   │   └── realtime-pnl.tsx        # Live P&L display
│   │   │
│   │   ├── layout/               # Layout components
│   │   │   ├── header.tsx        # App header
│   │   │   └── sidebar.tsx       # Navigation sidebar
│   │   │
│   │   └── ui/                   # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── ...               # Other UI primitives
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAnalytics.ts       # Analytics data fetching
│   │   ├── useDashboard.ts       # Dashboard data & WebSocket
│   │   └── useTraders.ts         # Trader CRUD operations
│   │
│   ├── lib/                      # Utilities
│   │   ├── api-client.ts         # API client wrapper
│   │   └── utils.ts              # Helper functions (cn, etc.)
│   │
│   └── styles/
│       └── globals.css           # Global styles & Tailwind
│
├── public/                       # Static assets
├── .env.example                  # Environment template
├── next.config.js                # Next.js configuration
├── tailwind.config.js            # Tailwind configuration
├── postcss.config.js             # PostCSS configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Running backend server (see backend README)

### Development Setup

1. **Install dependencies** (from monorepo root):
   ```bash
   pnpm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**:
   ```bash
   pnpm dev
   ```

The dashboard will be available at `http://localhost:3000`.

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes | `http://localhost:3001/api` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | Yes | `ws://localhost:3001` |

## Features

### Dashboard

The main dashboard displays:

- **Summary Statistics**: Total P&L, active positions, win rate
- **Live Trade Feed**: Real-time stream of executed trades
- **Real-time P&L**: Live profit/loss tracking with visual indicators
- **Quick Actions**: Start/stop copying, sync traders

### Trader Management

- **Traders List**: View all monitored traders with status indicators
- **Add Trader**: Form to add new wallets to monitor
- **Trader Details**: Individual trader settings and performance
- **Copy Settings**: Configure allocation, risk limits per trader

### Analytics

- **P&L Chart**: Historical profit/loss visualization
- **Performance Metrics**: Win rate, Sharpe ratio, max drawdown
- **Trade History**: Filterable trade log table
- **Trader Comparison**: Side-by-side trader performance

## Components

### UI Components (shadcn/ui)

Pre-built accessible components from shadcn/ui:

- `Button` - Primary actions
- `Card` - Content containers
- `Dialog` - Modal dialogs
- `DropdownMenu` - Action menus
- `Label` - Form labels
- `Progress` - Progress indicators
- `Select` - Dropdown selects
- `Separator` - Visual dividers
- `Switch` - Toggle switches
- `Tabs` - Tab navigation
- `Toast` - Notifications
- `Tooltip` - Hover tooltips

### Dashboard Components

```tsx
import { LiveTradeFeed, RealtimePnL } from '@/components/dashboard';

// Real-time trade feed with WebSocket
<LiveTradeFeed />

// Live P&L display
<RealtimePnL />
```

### Analytics Components

```tsx
import {
  PnLChart,
  PerformanceMetrics,
  TradeHistoryTable,
  TraderComparison
} from '@/components/analytics';

// P&L line chart
<PnLChart data={pnlData} />

// Key metrics cards
<PerformanceMetrics metrics={metrics} />

// Trade history with pagination
<TradeHistoryTable trades={trades} />

// Compare multiple traders
<TraderComparison traders={traders} />
```

## Custom Hooks

### useTraders

Manages trader data and CRUD operations:

```tsx
const {
  traders,
  isLoading,
  error,
  addTrader,
  updateTrader,
  deleteTrader,
  startCopying,
  stopCopying,
  syncTrader,
} = useTraders();
```

### useDashboard

Dashboard data with WebSocket real-time updates:

```tsx
const {
  stats,
  recentTrades,
  openPositions,
  isConnected,
  pnl,
} = useDashboard();
```

### useAnalytics

Analytics and performance data:

```tsx
const {
  metrics,
  pnlChart,
  traderPerformance,
  distribution,
  isLoading,
} = useAnalytics({ timeRange: '7d' });
```

## API Client

The `api-client.ts` module provides a typed API client:

```tsx
import { api } from '@/lib/api-client';

// GET request
const traders = await api.get('/traders');

// POST request
const newTrader = await api.post('/traders', {
  walletAddress: '0x...',
  name: 'Whale Trader',
  allocationPercent: 10,
});

// PUT request
await api.put(`/traders/${id}`, updates);

// DELETE request
await api.delete(`/traders/${id}`);
```

## WebSocket Integration

Real-time updates via Socket.IO:

```tsx
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_WS_URL);

// Subscribe to events
socket.on('trade:new', (trade) => {
  console.log('New trade:', trade);
});

socket.on('pnl:updated', (pnl) => {
  console.log('P&L updated:', pnl);
});

// Subscribe to specific trader
socket.emit('subscribe:trader', traderId);
```

### Available Events

| Event | Description |
|-------|-------------|
| `trade:new` | New trade executed |
| `trade:updated` | Trade status changed |
| `trade:failed` | Trade execution failed |
| `position:opened` | Position opened |
| `position:updated` | Position updated |
| `position:closed` | Position closed |
| `pnl:updated` | P&L figures updated |
| `stats:updated` | Statistics updated |
| `risk:alert` | Risk alert triggered |
| `risk:sltp` | Stop-loss/take-profit triggered |
| `notification` | System notification |

## Styling

### Tailwind CSS

Custom theme configuration in `tailwind.config.js`:

```js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // ... more colors
      },
    },
  },
};
```

### CSS Variables

Theme colors are defined as CSS variables in `globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

### Utility Functions

```tsx
import { cn } from '@/lib/utils';

// Merge class names with conflict resolution
<div className={cn('base-class', isActive && 'active-class')} />
```

## Scripts

```bash
# Development
pnpm dev          # Start with hot reload (port 3000)

# Build
pnpm build        # Production build
pnpm start        # Start production server

# Linting
pnpm lint         # Run Next.js linter

# Clean
pnpm clean        # Remove .next directory
```

## Pages

### Dashboard (`/`)

Main dashboard with:
- Summary stats cards
- Live trade feed
- Real-time P&L display
- Quick actions

### Traders (`/traders`)

List of monitored traders:
- Status indicators (Active/Paused/Disabled)
- Performance summary per trader
- Quick actions (start/stop/delete)

### Add Trader (`/traders/add`)

Form to add new trader:
- Wallet address input
- Display name
- Allocation settings
- Risk management options

### Trader Details (`/traders/[id]`)

Individual trader view:
- Full settings panel
- Performance metrics
- Position history
- Trade log

## State Management

### Zustand Store

Global state for user preferences and UI state:

```tsx
import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
```

### SWR for Data Fetching

Server state management with SWR:

```tsx
import useSWR from 'swr';
import { api } from '@/lib/api-client';

function useTraders() {
  const { data, error, mutate } = useSWR('/traders', api.get);

  return {
    traders: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}
```

## Charts

Using Recharts for data visualization:

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={pnlData}>
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Line
      type="monotone"
      dataKey="pnl"
      stroke="#10b981"
      strokeWidth={2}
    />
  </LineChart>
</ResponsiveContainer>
```

## Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

Or use Docker:
```bash
docker-compose -f docker/docker-compose.yml --profile full up frontend
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Optimizations

- **Code Splitting**: Automatic with Next.js App Router
- **Image Optimization**: Next.js Image component
- **Font Optimization**: Next.js font optimization
- **Bundle Analysis**: `ANALYZE=true pnpm build`

## Accessibility

- Keyboard navigation support
- Screen reader compatible (Radix UI)
- ARIA labels on interactive elements
- Focus indicators
- Color contrast compliance
