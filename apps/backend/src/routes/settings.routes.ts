// Settings routes

import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';

const router = Router();

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.get('/wallet', settingsController.getWalletInfo);
router.get('/status', settingsController.getBotStatus);

export default router;
