# Polymarket Copy Trading Bot

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

A production-ready copy trading bot for [Polymarket](https://polymarket.com) prediction markets. Automatically copy trades from successful traders with comprehensive risk management, real-time monitoring, and detailed analytics.

## Features

### Copy Trading
- **Multi-Trader Monitoring**: Track and copy multiple Polymarket traders simultaneously
- **Configurable Allocation**: Set individual allocation percentages per trader
- **Position Sizing**: Automatic position sizing based on your capital and risk tolerance
- **Trade Filtering**: Whitelist/blacklist specific markets per trader
- **Slippage Protection**: Configurable slippage tolerance for trade execution

### Risk Management
- **Stop-Loss Orders**: Automatic position closing at configurable loss thresholds
- **Take-Profit Orders**: Lock in gains with automatic profit-taking
- **Trailing Stop**: Dynamic stop-loss that follows profitable positions
- **Maximum Drawdown**: Per-trader drawdown limits to protect capital
- **Position Limits**: Maximum position size constraints

### Real-Time Dashboard
- **Live Trade Feed**: Real-time updates as trades are detected and executed
- **P&L Tracking**: Live profit/loss monitoring with visual indicators
- **WebSocket Integration**: Instant updates without page refresh
- **Responsive Design**: Full mobile and desktop support

### Analytics & Reporting
- **Performance Metrics**: Win rate, total P&L, realized/unrealized gains
- **P&L Charts**: Historical performance visualization with Recharts
- **Trader Comparison**: Compare performance across monitored traders
- **Trade History**: Detailed trade logs with filtering and export
- **Daily Statistics**: Aggregated daily performance summaries

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3
- **Framework**: Express.js
- **ORM**: Prisma with PostgreSQL
- **Cache**: Redis (ioredis)
- **WebSocket**: Socket.IO
- **API Client**: @polymarket/clob-client
- **Validation**: Zod
- **Logging**: Pino

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI primitives)
- **Charts**: Recharts
- **State Management**: Zustand + SWR
- **WebSocket Client**: Socket.IO Client
- **Icons**: Lucide React

### Infrastructure
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Container**: Docker & Docker Compose
- **Build System**: Turborepo
- **Package Manager**: pnpm 9

## Screenshots

> Screenshots of the dashboard will be added here.

```
[Dashboard Overview]     [Trader Management]     [Analytics Page]
      (TODO)                  (TODO)                 (TODO)
```

## Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 9+** - Install with `npm install -g pnpm`
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop/)
- **Polymarket API Credentials** - [Get API Access](https://docs.polymarket.com/)
- **Ethereum Wallet** - With USDC for trading

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/polymarket-copy-trader.git
cd polymarket-copy-trader

# Install dependencies
pnpm install
```

### 2. Environment Setup

```bash
# Copy environment templates
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp docker/.env.example docker/.env
```

Edit the `.env` files with your configuration. See [Configuration](#configuration) for details.

### 3. Encrypt Your Private Key

**IMPORTANT**: Never store raw private keys in configuration files.

```bash
# Use the encryption script to safely encrypt your wallet's private key
npx tsx scripts/encrypt-key.ts
```

This will prompt you for your private key and encryption password, then output the encrypted key to use in your configuration.

### 4. Start Infrastructure

```bash
# Start PostgreSQL and Redis containers
pnpm docker:up

# Verify containers are running
docker ps
```

### 5. Initialize Database

```bash
# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate
```

### 6. Start Development Server

```bash
# Start all services in development mode (with hot reload)
pnpm dev
```

### 7. Access the Dashboard

Open your browser and navigate to:

| Service | URL |
|---------|-----|
| **Dashboard** | http://localhost:3000 |
| **API** | http://localhost:3001/api |
| **Health Check** | http://localhost:3001/health |
| **Database UI** | `pnpm db:studio` (opens Prisma Studio) |

## Configuration

### Environment Variables

#### Root Configuration (`.env`)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `POSTGRES_USER` | PostgreSQL username | Yes | `polymarket` |
| `POSTGRES_PASSWORD` | PostgreSQL password | Yes | - |
| `POSTGRES_DB` | Database name | Yes | `polymarket_bot` |
| `POSTGRES_PORT` | PostgreSQL port | No | `5432` |
| `REDIS_PASSWORD` | Redis password | Yes | - |
| `REDIS_PORT` | Redis port | No | `6379` |

#### Backend Configuration (`apps/backend/.env`)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | `development` |
| `PORT` | Backend server port | No | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `POLYMARKET_NETWORK` | Network (`mainnet` or `testnet`) | No | `mainnet` |
| `POLYMARKET_CLOB_URL` | Polymarket CLOB API URL | No | `https://clob.polymarket.com` |
| `POLYMARKET_GAMMA_URL` | Polymarket Gamma API URL | No | `https://gamma-api.polymarket.com` |
| `POLYMARKET_API_KEY` | Your Polymarket API key | Yes | - |
| `POLYMARKET_API_SECRET` | Your Polymarket API secret | Yes | - |
| `POLYMARKET_API_PASSPHRASE` | Your Polymarket API passphrase | Yes | - |
| `BOT_WALLET_ADDRESS` | Your bot's wallet address | Yes | - |
| `BOT_WALLET_ENCRYPTED_KEY` | Encrypted private key | Yes | - |
| `ENCRYPTION_KEY` | Key for decrypting private key | Yes | - |
| `FRONTEND_URL` | Frontend URL for CORS | No | `http://localhost:3000` |
| `WEBHOOK_URL` | Discord/Slack webhook for notifications | No | - |

#### Frontend Configuration (`apps/frontend/.env`)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes | `http://localhost:3001/api` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | Yes | `ws://localhost:3001` |

### Polymarket API Setup

1. **Create API Credentials**: Visit [Polymarket](https://polymarket.com) and navigate to your account settings to generate API credentials.

2. **Fund Your Wallet**: Ensure your bot wallet has sufficient USDC on Polygon for trading.

3. **Approve USDC Spending**: The bot wallet must approve the Polymarket contracts to spend USDC.

### Trader Settings

When adding a trader to monitor, you can configure:

```typescript
{
  walletAddress: string;      // Trader's Polygon wallet address
  name: string;               // Display name (optional)

  // Allocation Settings
  allocationPercent: number;  // % of your capital to allocate (default: 10)
  maxPositionSize: number;    // Maximum USDC per position (optional)
  minTradeAmount: number;     // Minimum trade size in USDC (default: 1)
  slippageTolerance: number;  // Maximum slippage % (default: 2)

  // Risk Management
  stopLossPercent: number;    // Stop loss trigger % (optional)
  takeProfitPercent: number;  // Take profit trigger % (optional)
  maxDrawdownPercent: number; // Maximum drawdown % (default: 20)

  // Market Filters
  marketsWhitelist: string[]; // Only copy these markets (optional)
  marketsBlacklist: string[]; // Never copy these markets (optional)
}
```

## Architecture

### Project Structure

```
polymarket-copy-trader/
├── apps/
│   ├── backend/                 # Express.js API server
│   │   ├── prisma/
│   │   │   └── schema.prisma    # Database schema
│   │   └── src/
│   │       ├── config/          # Configuration (database, redis)
│   │       ├── controllers/     # Route handlers
│   │       ├── middleware/      # Express middleware
│   │       ├── routes/          # API route definitions
│   │       ├── services/        # Business logic
│   │       │   ├── analytics/   # Performance analytics
│   │       │   ├── polymarket/  # Polymarket API integration
│   │       │   ├── risk/        # Risk management (SL/TP)
│   │       │   ├── trade/       # Trade execution
│   │       │   ├── trader/      # Trader monitoring
│   │       │   └── wallet/      # Wallet management
│   │       ├── utils/           # Utilities (logger, retry)
│   │       ├── websocket/       # Socket.IO setup
│   │       ├── app.ts           # Express app configuration
│   │       └── server.ts        # Server entry point
│   │
│   └── frontend/                # Next.js dashboard
│       └── src/
│           ├── app/             # Next.js App Router pages
│           │   ├── traders/     # Trader management pages
│           │   └── page.tsx     # Dashboard home
│           ├── components/      # React components
│           │   ├── analytics/   # Chart & metrics components
│           │   ├── dashboard/   # Dashboard widgets
│           │   ├── layout/      # Layout components
│           │   └── ui/          # shadcn/ui components
│           ├── hooks/           # Custom React hooks
│           ├── lib/             # Utilities & API client
│           └── styles/          # Global styles
│
├── packages/
│   └── shared/                  # Shared code between apps
│       └── src/
│           ├── constants/       # Shared constants
│           ├── types/           # TypeScript type definitions
│           └── utils/           # Shared utility functions
│
├── docker/                      # Docker configuration
│   ├── docker-compose.yml       # Production compose file
│   └── docker-compose.dev.yml   # Development compose file
│
└── scripts/                     # Utility scripts
    └── encrypt-key.ts           # Private key encryption tool
```

### Key Services

| Service | Description |
|---------|-------------|
| **TraderMonitorService** | Monitors tracked wallets for new positions/trades |
| **TradeExecutorService** | Executes copy trades on Polymarket |
| **StopLossTakeProfitService** | Monitors positions for SL/TP triggers |
| **PositionSizingService** | Calculates appropriate position sizes |
| **RetryQueueService** | Handles failed trade retries |
| **AnalyticsService** | Computes performance metrics |
| **WebSocketService** | Real-time event broadcasting |

### Database Schema

The bot uses PostgreSQL with the following core models:

| Model | Description |
|-------|-------------|
| `Trader` | Monitored traders with copy settings |
| `Trade` | Executed trades (both source and copied) |
| `Position` | Current and historical positions |
| `Market` | Cached Polymarket market data |
| `TraderSnapshot` | Historical trader performance snapshots |
| `DailyStats` | Aggregated daily statistics |
| `BotWallet` | Bot wallet configuration and balance |
| `Settings` | Key-value configuration storage |
| `ActivityLog` | Audit log for all activities |

## API Documentation

### Base URL

```
http://localhost:3001/api
```

### Health Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Full health check (database, redis, services) |
| `GET` | `/health/ready` | Kubernetes readiness probe |
| `GET` | `/health/live` | Kubernetes liveness probe |

### Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/stats` | Summary statistics |
| `GET` | `/api/dashboard/overview` | Dashboard overview data |
| `GET` | `/api/dashboard/wallet` | Bot wallet status |

### Trader Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/traders` | List all monitored traders |
| `POST` | `/api/traders` | Add new trader to monitor |
| `GET` | `/api/traders/:id` | Get trader details |
| `PUT` | `/api/traders/:id` | Update trader settings |
| `DELETE` | `/api/traders/:id` | Remove trader |
| `POST` | `/api/traders/:id/start` | Start copying trader |
| `POST` | `/api/traders/:id/stop` | Stop copying trader |
| `POST` | `/api/traders/:id/sync` | Force sync trader positions |

### Trade Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/trades` | List all trades |
| `GET` | `/api/trades/recent` | Recent trades with pagination |
| `GET` | `/api/trades/:id` | Trade details |
| `POST` | `/api/trades/:id/retry` | Retry failed trade |

### Position Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/positions` | All positions |
| `GET` | `/api/positions/open` | Open positions only |
| `GET` | `/api/positions/summary` | Position summary by trader |
| `POST` | `/api/positions/:id/close` | Manually close position |

### Market Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/markets` | List cached markets |
| `GET` | `/api/markets/active` | Active markets only |
| `GET` | `/api/markets/:id` | Market details |
| `POST` | `/api/markets/refresh` | Refresh market data |

### Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/metrics` | Performance metrics |
| `GET` | `/api/analytics/pnl-chart` | P&L chart data |
| `GET` | `/api/analytics/trader-performance` | Per-trader performance |
| `GET` | `/api/analytics/distribution` | Trade distribution stats |

### Settings Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get all settings |
| `PUT` | `/api/settings` | Update settings |
| `GET` | `/api/settings/:key` | Get specific setting |

### WebSocket Events

Connect to `ws://localhost:3001` with Socket.IO client.

#### Server to Client Events

| Event | Description |
|-------|-------------|
| `trade:new` | New trade detected |
| `trade:updated` | Trade status updated |
| `trade:failed` | Trade execution failed |
| `position:opened` | New position opened |
| `position:updated` | Position updated |
| `position:closed` | Position closed |
| `market:priceUpdate` | Market price changed |
| `market:resolved` | Market resolved |
| `trader:statusChange` | Trader status changed |
| `trader:positionDetected` | New position detected from trader |
| `pnl:updated` | P&L figures updated |
| `stats:updated` | Statistics updated |
| `risk:alert` | Risk alert triggered |
| `risk:sltp` | Stop-loss/take-profit triggered |
| `risk:drawdown` | Drawdown update |
| `notification` | System notification |
| `error` | Error occurred |

#### Client to Server Events

| Event | Description |
|-------|-------------|
| `subscribe:trader` | Subscribe to trader updates |
| `unsubscribe:trader` | Unsubscribe from trader |
| `subscribe:market` | Subscribe to market updates |
| `unsubscribe:market` | Unsubscribe from market |
| `subscribe:all` | Subscribe to all updates |
| `unsubscribe:all` | Unsubscribe from all |
| `request:sync` | Request trader sync |

## Development

### Running Locally

```bash
# Start infrastructure
pnpm docker:up

# Generate Prisma client
pnpm db:generate

# Start development servers (with hot reload)
pnpm dev

# Or start individual services
pnpm --filter backend dev
pnpm --filter frontend dev
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm --filter backend test:coverage

# Run tests in watch mode
pnpm --filter backend test -- --watch
```

### Code Style

```bash
# Lint all packages
pnpm lint

# Format all files
pnpm format

# Check formatting
pnpm format:check

# Type check
pnpm --filter backend tsc --noEmit
pnpm --filter frontend tsc --noEmit
```

### Database Management

```bash
# Generate Prisma client after schema changes
pnpm db:generate

# Create and apply migrations
pnpm db:migrate

# Push schema to database (without migration)
pnpm db:push

# Open Prisma Studio (database GUI)
pnpm db:studio

# Seed database (if seed script exists)
pnpm --filter backend prisma:seed
```

## Deployment

### Production with Docker

1. **Build Images**

```bash
# Build all images
docker-compose -f docker/docker-compose.yml build
```

2. **Configure Environment**

```bash
# Edit docker/.env with production values
cp docker/.env.example docker/.env
nano docker/.env
```

3. **Start Full Stack**

```bash
# Start all services (database, redis, backend, frontend)
docker-compose -f docker/docker-compose.yml --profile full up -d

# Or start only infrastructure (run apps locally)
docker-compose -f docker/docker-compose.yml up -d
```

4. **Run Migrations**

```bash
# Run migrations inside the backend container
docker exec polymarket_backend npx prisma migrate deploy
```

5. **View Logs**

```bash
# All services
docker-compose -f docker/docker-compose.yml logs -f

# Specific service
docker-compose -f docker/docker-compose.yml logs -f backend
```

### Production Considerations

- **Secrets Management**: Use Docker secrets or a secrets manager (AWS Secrets Manager, HashiCorp Vault) instead of environment files
- **HTTPS**: Configure a reverse proxy (nginx, Traefik) with SSL certificates
- **Database Backups**: Set up automated PostgreSQL backups
- **Monitoring**: Add health checks to your orchestration platform
- **Logging**: Ship logs to a centralized logging service
- **Rate Limiting**: Configure rate limits for production traffic

### Environment-Specific Settings

| Setting | Development | Production |
|---------|-------------|------------|
| `NODE_ENV` | `development` | `production` |
| `POLYMARKET_NETWORK` | `testnet` | `mainnet` |
| Logging Level | `debug` | `info` |
| Rate Limiting | Relaxed | Strict |

## Security Notes

- **Private Keys**: Never store raw private keys. Always use the encryption script.
- **Environment Files**: Never commit `.env` files to version control.
- **API Keys**: Rotate Polymarket API keys regularly.
- **Database**: Use strong passwords and restrict network access.
- **CORS**: Configure allowed origins for production.
- **Rate Limiting**: The API includes rate limiting middleware.

## Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# View PostgreSQL logs
docker logs polymarket_db
```

**Redis connection failed**
```bash
# Check if Redis container is running
docker ps | grep redis

# Test Redis connection
docker exec polymarket_redis redis-cli -a your_password ping
```

**Prisma client not generated**
```bash
# Regenerate Prisma client
pnpm db:generate
```

**WebSocket not connecting**
- Verify `NEXT_PUBLIC_WS_URL` matches backend URL
- Check CORS configuration in backend
- Ensure backend server is running

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This software is for educational purposes only. Trading on prediction markets involves financial risk. Always do your own research and never trade with funds you cannot afford to lose. The authors are not responsible for any financial losses incurred from using this software.
