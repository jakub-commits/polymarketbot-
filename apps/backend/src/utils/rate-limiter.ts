// Rate limiter for API calls

import { logger } from './logger.js';
import { sleep } from './retry.js';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  private cleanup(): void {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
  }

  async acquire(): Promise<void> {
    this.cleanup();

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (Date.now() - oldestRequest);

      if (waitTime > 0) {
        logger.debug({ waitTime }, 'Rate limit reached, waiting');
        await sleep(waitTime);
        this.cleanup();
      }
    }

    this.requests.push(Date.now());
  }

  canProceed(): boolean {
    this.cleanup();
    return this.requests.length < this.maxRequests;
  }

  remainingRequests(): number {
    this.cleanup();
    return Math.max(0, this.maxRequests - this.requests.length);
  }
}

// Pre-configured rate limiters for Polymarket APIs
export const clobRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 1000, // 10 requests per second
});

export const gammaRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 1000, // 5 requests per second
});
