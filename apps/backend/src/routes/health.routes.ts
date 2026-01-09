// Health check routes

import { Router } from 'express';
import { healthCheck, readinessCheck, livenessCheck } from '../controllers/health.controller.js';

const router = Router();

// Full health check with all services
router.get('/', healthCheck);

// Kubernetes-style probes
router.get('/ready', readinessCheck);
router.get('/live', livenessCheck);

export default router;
