// Analytics routes

import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = Router();

router.get('/metrics', analyticsController.getPerformanceMetrics);
router.get('/pnl-chart', analyticsController.getPnLChart);
router.get('/trader-performance', analyticsController.getTraderPerformance);
router.get('/distribution', analyticsController.getTradeDistribution);

export default router;
