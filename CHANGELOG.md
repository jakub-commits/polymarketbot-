# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-01-10

### Added
- Complete Polymarket Copy Trading Bot implementation
  - Backend API with Express.js, Prisma ORM, Socket.IO
  - Frontend dashboard with Next.js 14, React 18, Tailwind CSS
  - Real-time WebSocket updates for trades and positions
  - Risk management system (stop-loss, take-profit, max drawdown)
  - Position sizing with slippage estimation
  - Trader monitoring and copy trading logic
  - Analytics and performance metrics
- Settings page for bot configuration
- Markets page with live market data
- Internationalization (i18n) support
  - English (en)
  - Czech (cs)
  - Slovak (sk)

### Fixed
- Frontend layout structure and styling issues
- API data fetching in dashboard components
- ESLint configuration migrated to v9 flat config
- Jest mock hoisting issues in service tests
- Floating point precision in slippage calculations
- Unused imports removed across codebase

### Infrastructure
- Docker Compose setup for PostgreSQL and Redis
- Turborepo monorepo configuration
- GitHub Actions CI pipeline
- Prisma database schema and migrations

---

### Commit History

| Hash | Description |
|------|-------------|
| `b8ace3a` | fix: resolve CI failures in linting and tests |
| `5c6f322` | feat(frontend): add i18n support with English, Czech, and Slovak translations |
| `50ab7ba` | feat(frontend): add Settings and Markets pages, fix API data fetching |
| `6b08e64` | fix(frontend): fix layout structure and styling |
| `9339c6d` | feat: complete Polymarket Copy Trading Bot implementation |

[Unreleased]: https://github.com/jakub-commits/polymarketbot-/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jakub-commits/polymarketbot-/releases/tag/v0.1.0
