// Express application setup

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { requestLogger } from './middleware/logging.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware.js';
import { apiRateLimiter } from './middleware/rate-limiter.middleware.js';
import routes from './routes/index.js';

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Rate limiting for API routes
app.use('/api', apiRateLimiter);

// Health check routes (no /api prefix)
app.use('/health', routes);

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
