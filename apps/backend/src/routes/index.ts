// API routes index

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import traderRoutes from './trader.routes.js';
import tradeRoutes from './trade.routes.js';
import positionRoutes from './position.routes.js';
import marketRoutes from './market.routes.js';
import settingsRoutes from './settings.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import analyticsRoutes from './analytics.routes.js';

const router = Router();

// Health checks (no /api prefix)
router.use('/health', healthRoutes);

// Auth routes
router.use('/auth', authRoutes);

// API routes
router.use('/dashboard', dashboardRoutes);
router.use('/traders', traderRoutes);
router.use('/trades', tradeRoutes);
router.use('/positions', positionRoutes);
router.use('/markets', marketRoutes);
router.use('/settings', settingsRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
