// Configuration loader

import dotenv from 'dotenv';
import { z } from 'zod';

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
    webhookUrl: process.env.WEBHOOK_URL,
  });

  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid configuration');
  }

  return result.data;
}

export const config = loadConfig();

export const isDev = config.nodeEnv === 'development';
export const isProd = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';
