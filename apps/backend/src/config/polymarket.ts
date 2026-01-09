// Polymarket configuration

import { config } from './index.js';
import { POLYMARKET_URLS, CHAIN_IDS, CONTRACTS } from '@polymarket-bot/shared';

export type NetworkType = 'mainnet' | 'testnet';

export interface PolymarketConfig {
  network: NetworkType;
  chainId: number;
  urls: {
    clob: string;
    gamma: string;
    strapi: string;
  };
  contracts: {
    usdc: string;
    ctfExchange: string;
    negRiskCtfExchange: string;
    negRiskAdapter: string;
  };
  rpcUrl: string;
}

const RPC_URLS = {
  mainnet: 'https://polygon-rpc.com',
  testnet: 'https://rpc-amoy.polygon.technology',
};

function getPolymarketConfig(): PolymarketConfig {
  const network = (config.polymarketNetwork || 'mainnet') as NetworkType;
  const networkKey = network.toUpperCase() as 'MAINNET' | 'TESTNET';

  const contracts = CONTRACTS[networkKey];
  return {
    network,
    chainId: CHAIN_IDS[networkKey],
    urls: {
      clob: config.polymarketClobUrl || POLYMARKET_URLS[networkKey].CLOB,
      gamma: config.polymarketGammaUrl || POLYMARKET_URLS[networkKey].GAMMA,
      strapi: POLYMARKET_URLS[networkKey].STRAPI,
    },
    contracts: {
      usdc: contracts.USDC,
      ctfExchange: contracts.CTF_EXCHANGE,
      negRiskCtfExchange: contracts.NEG_RISK_CTF_EXCHANGE,
      negRiskAdapter: contracts.NEG_RISK_ADAPTER,
    },
    rpcUrl: RPC_URLS[network],
  };
}

export const polymarketConfig = getPolymarketConfig();

// Network utilities
export function isMainnet(): boolean {
  return polymarketConfig.network === 'mainnet';
}

export function isTestnet(): boolean {
  return polymarketConfig.network === 'testnet';
}

export function getNetworkName(): string {
  return polymarketConfig.network === 'mainnet' ? 'Polygon Mainnet' : 'Polygon Amoy Testnet';
}

export function getExplorerUrl(txHash?: string): string {
  const baseUrl = polymarketConfig.network === 'mainnet'
    ? 'https://polygonscan.com'
    : 'https://amoy.polygonscan.com';

  return txHash ? `${baseUrl}/tx/${txHash}` : baseUrl;
}
