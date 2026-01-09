// Trade routes

import { Router } from 'express';
import * as tradeController from '../controllers/trade.controller.js';
import { tradeRateLimiter } from '../middleware/rate-limiter.middleware.js';

const router = Router();

// Read operations
router.get('/', tradeController.getAllTrades);
router.get('/recent', tradeController.getRecentTrades);
router.get('/copier/status', tradeController.getCopierStatus);
router.get('/:id', tradeController.getTradeById);

// Write operations (rate limited)
router.post('/execute', tradeRateLimiter, tradeController.executeTrade);
router.post('/copier/start', tradeController.startCopier);
router.post('/copier/stop', tradeController.stopCopier);
router.post('/:id/retry', tradeRateLimiter, tradeController.retryTrade);
router.post('/:id/cancel', tradeController.cancelTrade);

export default router;
