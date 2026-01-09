// Market routes

import { Router } from 'express';
import * as marketController from '../controllers/market.controller.js';

const router = Router();

router.get('/', marketController.getAllMarkets);
router.get('/active', marketController.getActiveMarkets);
router.get('/:id', marketController.getMarketById);
router.get('/:id/orderbook', marketController.getOrderBook);
router.post('/refresh', marketController.refreshMarkets);

export default router;
