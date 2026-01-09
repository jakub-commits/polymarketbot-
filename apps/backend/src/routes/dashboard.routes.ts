// Dashboard routes

import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/stats', dashboardController.getDashboardStats);
router.get('/overview', dashboardController.getDashboardOverview);
router.get('/wallet', dashboardController.getWalletStatus);

export default router;
