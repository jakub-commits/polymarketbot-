// Configuration loader

import dotenv from 'dotenv';
import pino from 'pino';
import { z } from 'zod';

// Create a bootstrap logger for configuration loading (before main logger is available)
const bootstrapLogger = pino({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),

  // Database
  databaseUrl: z.string().min(1),

  // Redis
  redisUrl: z.string().min(1),

  // Polymarket
  polymarketNetwork: z.enum(['mainnet', 'testnet']).default('mainnet'),
  polymarketClobUrl: z.string().url().default('https://clob.polymarket.com'),
  polymarketGammaUrl: z.string().url().default('https://gamma-api.polymarket.com'),
  polymarketApiKey: z.string().optional(),
  polymarketApiSecret: z.string().optional(),
  polymarketApiPassphrase: z.string().optional(),

  // Bot wallet
  botWalletAddress: z.string().optional(),
  botWalletEncryptedKey: z.string().optional(),
  encryptionKey: z.string().optional(),

  // Frontend
  frontendUrl: z.string().url().default('http://localhost:3000'),

  // Authentication
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  jwtExpiresIn: z.string().default('15m'),
  refreshTokenExpiresIn: z.string().default('7d'),

  // Optional
  webhookUrl: z.string().url().optional(),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT || process.env.BACKEND_PORT,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    polymarketNetwork: process.env.POLYMARKET_NETWORK,
    polymarketClobUrl: process.env.POLYMARKET_CLOB_URL,
    polymarketGammaUrl: process.env.POLYMARKET_GAMMA_URL,
    polymarketApiKey: process.env.POLYMARKET_API_KEY,
    polymarketApiSecret: process.env.POLYMARKET_API_SECRET,
    polymarketApiPassphrase: process.env.POLYMARKET_API_PASSPHRASE,
    botWalletAddress: process.env.BOT_WALLET_ADDRESS,
    botWalletEncryptedKey: process.env.BOT_WALLET_ENCRYPTED_KEY,
    encryptionKey: process.env.ENCRYPTION_KEY,
    frontendUrl: process.env.FRONTEND_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    webhookUrl: process.env.WEBHOOK_URL,
  });

  if (!result.success) {
    bootstrapLogger.error({ errors: result.error.format() }, 'Configuration validation failed');
    throw new Error('Invalid configuration');
  }

  return result.data;
}

export const config = loadConfig();

export const isDev = config.nodeEnv === 'development';
export const isProd = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';
