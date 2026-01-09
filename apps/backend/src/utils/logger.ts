// Logger utility using Pino

import pino from 'pino';
import { config, isDev } from '../config/index.js';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: config.nodeEnv,
  },
});

// Create child logger with context
export function createLogger(context: string) {
  return logger.child({ context });
}
