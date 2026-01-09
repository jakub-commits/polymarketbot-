// Trader routes

import { Router } from 'express';
import * as traderController from '../controllers/trader.controller.js';

const router = Router();

// CRUD operations
router.get('/', traderController.getAllTraders);
router.get('/:id', traderController.getTraderById);
router.post('/', traderController.createTrader);
router.put('/:id', traderController.updateTrader);
router.delete('/:id', traderController.deleteTrader);

// Actions
router.post('/:id/start', traderController.startCopying);
router.post('/:id/stop', traderController.stopCopying);
router.post('/:id/sync', traderController.syncPositions);

// Analytics
router.get('/:id/stats', traderController.getTraderStats);
router.get('/:id/trades', traderController.getTraderTrades);
router.get('/:id/positions', traderController.getTraderPositions);

export default router;
