// Rate limiting middleware

import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@polymarket-bot/shared';

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests, please try again later',
    },
  },
});

// Stricter rate limiter for trade endpoints
export const tradeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 trade requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many trade requests, please try again later',
    },
  },
});

// Rate limiter for login endpoint - prevents brute-force attacks
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 login attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many login attempts, please try again later',
    },
  },
});

// Rate limiter for registration endpoint - prevents spam registrations
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 registration attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many registration attempts, please try again later',
    },
  },
});
