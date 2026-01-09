// Global error handler middleware

import type { Request, Response, NextFunction } from 'express';
import { AppError, ERROR_CODES } from '@polymarket-bot/shared';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  logger.error(
    {
      error: err,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
    },
    'Request error'
  );

  // Handle AppError
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };

    // Add stack trace in development
    if (config.nodeEnv === 'development') {
      response.error.stack = err.stack;
    }

    const statusCode = getStatusCodeForError(err.code);
    res.status(statusCode).json(response);
    return;
  }

  // Handle validation errors (Zod)
  if (err.name === 'ZodError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation error',
        details: (err as unknown as { errors: unknown[] }).errors,
      },
    };
    res.status(400).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: config.nodeEnv === 'development' ? err.message : 'Internal server error',
    },
  };

  if (config.nodeEnv === 'development') {
    response.error.stack = err.stack;
  }

  res.status(500).json(response);
}

function getStatusCodeForError(code: string): number {
  switch (code) {
    case ERROR_CODES.VALIDATION_ERROR:
    case ERROR_CODES.INVALID_WALLET_ADDRESS:
      return 400;
    case ERROR_CODES.UNAUTHORIZED:
      return 401;
    case ERROR_CODES.FORBIDDEN:
      return 403;
    case ERROR_CODES.NOT_FOUND:
    case ERROR_CODES.TRADER_NOT_FOUND:
    case ERROR_CODES.POSITION_NOT_FOUND:
    case ERROR_CODES.MARKET_NOT_FOUND:
      return 404;
    case ERROR_CODES.RATE_LIMITED:
    case ERROR_CODES.POLYMARKET_RATE_LIMITED:
      return 429;
    default:
      return 500;
  }
}

// Not found handler
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
    },
  };
  res.status(404).json(response);
}
