// Position routes

import { Router } from 'express';
import * as positionController from '../controllers/position.controller.js';

const router = Router();

router.get('/', positionController.getAllPositions);
router.get('/open', positionController.getOpenPositions);
router.get('/summary', positionController.getPositionSummary);
router.get('/:id', positionController.getPositionById);
router.post('/:id/close', positionController.closePosition);

export default router;
