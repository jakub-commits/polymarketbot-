# Polymarket Copy Trading Bot - Backend

The backend service for the Polymarket Copy Trading Bot. A Node.js/Express API server that handles trader monitoring, trade execution, risk management, and real-time WebSocket communication.

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3
- **Framework**: Express.js 4.18
- **ORM**: Prisma 5.7
- **Database**: PostgreSQL 16
- **Cache**: Redis 7 (ioredis)
- **WebSocket**: Socket.IO 4.7
- **Validation**: Zod
- **Logging**: Pino
- **Testing**: Vitest

## Project Structure

```
apps/backend/
├── prisma/
│   └── schema.prisma         # Database schema
├── src/
│   ├── config/               # Configuration modules
│   │   ├── index.ts          # Environment config
│   │   ├── database.ts       # Prisma client setup
│   │   └── redis.ts          # Redis client setup
│   │
│   ├── controllers/          # Route handlers
│   │   ├── analytics.controller.ts
│   │   ├── dashboard.controller.ts
│   │   ├── market.controller.ts
│   │   ├── position.controller.ts
│   │   ├── settings.controller.ts
│   │   ├── trade.controller.ts
│   │   └── trader.controller.ts
│   │
│   ├── middleware/           # Express middleware
│   │   ├── error-handler.middleware.ts
│   │   ├── logging.middleware.ts
│   │   └── rate-limiter.middleware.ts
│   │
│   ├── routes/               # API route definitions
│   │   ├── index.ts          # Route aggregator
│   │   ├── analytics.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── health.routes.ts
│   │   ├── market.routes.ts
│   │   ├── position.routes.ts
│   │   ├── settings.routes.ts
│   │   ├── trade.routes.ts
│   │   └── trader.routes.ts
│   │
│   ├── services/             # Business logic
│   │   ├── analytics/        # Performance analytics
│   │   │   └── analytics.service.ts
│   │   ├── polymarket/       # Polymarket API integration
│   │   │   ├── clob-client.service.ts
│   │   │   ├── gamma-api.service.ts
│   │   │   └── market-data.service.ts
│   │   ├── risk/             # Risk management
│   │   │   └── stop-loss-take-profit.service.ts
│   │   ├── trade/            # Trade execution
│   │   │   ├── position-sizing.service.ts
│   │   │   ├── retry-queue.service.ts
│   │   │   └── trade-executor.service.ts
│   │   ├── trader/           # Trader monitoring
│   │   │   ├── trader.service.ts
│   │   │   └── trader-monitor.service.ts
│   │   └── wallet/           # Wallet management
│   │       ├── encryption.service.ts
│   │       └── wallet.service.ts
│   │
│   ├── utils/                # Utility modules
│   │   ├── logger.ts         # Pino logger setup
│   │   ├── rate-limiter.ts   # API rate limiting
│   │   └── retry.ts          # Retry logic
│   │
│   ├── websocket/            # WebSocket setup
│   │   ├── index.ts
│   │   └── websocket.service.ts
│   │
│   ├── app.ts                # Express app configuration
│   └── server.ts             # Server entry point
│
├── .env.example              # Environment template
├── package.json
└── tsconfig.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16 (via Docker or local)
- Redis 7 (via Docker or local)

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

3. **Start infrastructure**:
   ```bash
   # From monorepo root
   pnpm docker:up
   ```

4. **Generate Prisma client**:
   ```bash
   pnpm prisma:generate
   ```

5. **Run migrations**:
   ```bash
   pnpm prisma:migrate
   ```

6. **Start development server**:
   ```bash
   pnpm dev
   ```

The server will start at `http://localhost:3001`.

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | `development` |
| `PORT` | Server port | No | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `POLYMARKET_NETWORK` | Network (`mainnet`/`testnet`) | No | `mainnet` |
| `POLYMARKET_CLOB_URL` | CLOB API URL | No | `https://clob.polymarket.com` |
| `POLYMARKET_GAMMA_URL` | Gamma API URL | No | `https://gamma-api.polymarket.com` |
| `POLYMARKET_API_KEY` | Polymarket API key | Yes | - |
| `POLYMARKET_API_SECRET` | Polymarket API secret | Yes | - |
| `POLYMARKET_API_PASSPHRASE` | Polymarket API passphrase | Yes | - |
| `BOT_WALLET_ADDRESS` | Bot wallet address | Yes | - |
| `BOT_WALLET_ENCRYPTED_KEY` | Encrypted private key | Yes | - |
| `ENCRYPTION_KEY` | Private key decryption key | Yes | - |
| `FRONTEND_URL` | Frontend URL for CORS | No | `http://localhost:3000` |
| `WEBHOOK_URL` | Notification webhook URL | No | - |

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Full health check |
| `GET` | `/health/ready` | Readiness probe |
| `GET` | `/health/live` | Liveness probe |

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stats` | Summary statistics |
| `GET` | `/overview` | Dashboard overview |
| `GET` | `/wallet` | Bot wallet status |

### Traders (`/api/traders`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all traders |
| `POST` | `/` | Add new trader |
| `GET` | `/:id` | Get trader details |
| `PUT` | `/:id` | Update trader |
| `DELETE` | `/:id` | Remove trader |
| `POST` | `/:id/start` | Start copying |
| `POST` | `/:id/stop` | Stop copying |
| `POST` | `/:id/sync` | Force sync |

### Trades (`/api/trades`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all trades |
| `GET` | `/recent` | Recent trades |
| `GET` | `/:id` | Trade details |
| `POST` | `/:id/retry` | Retry failed trade |

### Positions (`/api/positions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | All positions |
| `GET` | `/open` | Open positions |
| `GET` | `/summary` | Position summary |
| `POST` | `/:id/close` | Close position |

### Markets (`/api/markets`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List markets |
| `GET` | `/active` | Active markets |
| `GET` | `/:id` | Market details |
| `POST` | `/refresh` | Refresh data |

### Analytics (`/api/analytics`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/metrics` | Performance metrics |
| `GET` | `/pnl-chart` | P&L chart data |
| `GET` | `/trader-performance` | Per-trader stats |
| `GET` | `/distribution` | Trade distribution |

### Settings (`/api/settings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get all settings |
| `PUT` | `/` | Update settings |
| `GET` | `/:key` | Get setting by key |

## WebSocket Events

Connect via Socket.IO at `ws://localhost:3001`.

### Server to Client

| Event | Payload | Description |
|-------|---------|-------------|
| `trade:new` | `Trade` | New trade detected |
| `trade:updated` | `Trade` | Trade status changed |
| `trade:failed` | `{ tradeId, error }` | Trade execution failed |
| `position:opened` | `Position` | New position opened |
| `position:updated` | `Position` | Position updated |
| `position:closed` | `Position` | Position closed |
| `market:priceUpdate` | `MarketPriceUpdate` | Price changed |
| `market:resolved` | `MarketResolved` | Market resolved |
| `trader:statusChange` | `TraderStatusChange` | Trader status changed |
| `trader:positionDetected` | `PositionDetected` | Position detected |
| `pnl:updated` | `PnLUpdate` | P&L updated |
| `stats:updated` | `StatsUpdate` | Stats updated |
| `risk:alert` | `RiskAlert` | Risk alert |
| `risk:sltp` | `SLTPTriggerEvent` | SL/TP triggered |
| `risk:drawdown` | `DrawdownUpdate` | Drawdown update |
| `notification` | `Notification` | System notification |
| `error` | `WSError` | Error occurred |

### Client to Server

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe:trader` | `traderId` | Subscribe to trader |
| `unsubscribe:trader` | `traderId` | Unsubscribe |
| `subscribe:market` | `marketId` | Subscribe to market |
| `unsubscribe:market` | `marketId` | Unsubscribe |
| `subscribe:all` | - | Subscribe to all |
| `unsubscribe:all` | - | Unsubscribe from all |
| `request:sync` | `traderId` | Request sync |

## Services

### Core Services

| Service | Description |
|---------|-------------|
| `TraderService` | CRUD operations for traders |
| `TraderMonitorService` | Monitors wallets for position changes |
| `TradeExecutorService` | Executes trades on Polymarket |
| `PositionSizingService` | Calculates position sizes |
| `RetryQueueService` | Manages failed trade retries |

### Polymarket Integration

| Service | Description |
|---------|-------------|
| `ClobClientService` | Polymarket CLOB API client |
| `GammaApiService` | Polymarket Gamma API client |
| `MarketDataService` | Market data caching and updates |

### Risk Management

| Service | Description |
|---------|-------------|
| `StopLossTakeProfitService` | Monitors and executes SL/TP orders |

### Wallet Management

| Service | Description |
|---------|-------------|
| `WalletService` | Bot wallet operations |
| `EncryptionService` | Private key encryption/decryption |

### Analytics

| Service | Description |
|---------|-------------|
| `AnalyticsService` | Performance metrics calculation |

## Database Schema

Key models defined in `prisma/schema.prisma`:

- **Trader**: Monitored traders with copy settings
- **Trade**: Executed trades (source and copied)
- **Position**: Open and closed positions
- **Market**: Cached market data
- **TraderSnapshot**: Historical performance snapshots
- **DailyStats**: Aggregated daily statistics
- **BotWallet**: Bot wallet configuration
- **Settings**: Key-value settings storage
- **ActivityLog**: Audit log

## Scripts

```bash
# Development
pnpm dev                    # Start with hot reload
pnpm build                  # Build for production
pnpm start                  # Start production server

# Testing
pnpm test                   # Run tests
pnpm test:coverage          # Run with coverage

# Linting
pnpm lint                   # Run ESLint

# Database
pnpm prisma:generate        # Generate Prisma client
pnpm prisma:migrate         # Run migrations
pnpm prisma:push            # Push schema (no migration)
pnpm prisma:studio          # Open Prisma Studio
pnpm prisma:seed            # Seed database
```

## Logging

Uses Pino for structured JSON logging:

```typescript
import { logger } from './utils/logger';

logger.info({ userId: '123' }, 'User logged in');
logger.error({ error }, 'Failed to execute trade');
```

Log levels: `debug`, `info`, `warn`, `error`, `fatal`

Development uses `pino-pretty` for human-readable output.

## Error Handling

The error handler middleware provides consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid wallet address"
  }
}
```

## Rate Limiting

API endpoints are protected with rate limiting:

- Default: 100 requests per minute per IP
- Trade endpoints: 10 requests per minute
- Health endpoints: No limit

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/services/trader.service.test.ts

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test -- --watch
```

## Production Deployment

1. Build the application:
   ```bash
   pnpm build
   ```

2. Set production environment variables

3. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

4. Start the server:
   ```bash
   pnpm start
   ```

Or use Docker:
```bash
docker-compose -f docker/docker-compose.yml --profile full up -d
```

## Security Considerations

- Private keys are stored encrypted (AES-256-GCM)
- API endpoints are rate-limited
- CORS is configured to allow only specified origins
- Helmet.js adds security headers
- Input validation with Zod schemas
- SQL injection prevented by Prisma ORM
