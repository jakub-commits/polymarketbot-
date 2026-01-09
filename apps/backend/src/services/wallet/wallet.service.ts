// Wallet service
// Manages bot wallet and interactions

import { ethers } from 'ethers';
import { config } from '../../config/index.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { encryptionService } from './encryption.service.js';
import { clobClientService } from '../polymarket/clob-client.service.js';
import { AppError, ERROR_CODES } from '@polymarket-bot/shared';

export class WalletService {
  private wallet: ethers.Wallet | null = null;
  private isInitialized = false;

  /**
   * Initialize wallet from encrypted key
   */
  async initialize(): Promise<void> {
    try {
      if (!config.botWalletEncryptedKey) {
        logger.warn('No encrypted wallet key configured');
        return;
      }

      // Decrypt private key
      const privateKey = await encryptionService.decryptWithConfigKey(
        config.botWalletEncryptedKey
      );

      if (!encryptionService.isValidPrivateKey(privateKey)) {
        throw new AppError(
          ERROR_CODES.WALLET_DECRYPTION_ERROR,
          'Decrypted key is not a valid private key'
        );
      }

      // Create wallet instance
      this.wallet = new ethers.Wallet(privateKey);

      // Verify address matches config
      if (
        config.botWalletAddress &&
        this.wallet.address.toLowerCase() !== config.botWalletAddress.toLowerCase()
      ) {
        throw new AppError(
          ERROR_CODES.WALLET_NOT_CONFIGURED,
          'Wallet address does not match configured address'
        );
      }

      // Initialize CLOB client
      await clobClientService.initialize(privateKey);

      // Update or create wallet in database
      await this.updateWalletInDatabase();

      this.isInitialized = true;
      logger.info({ address: this.wallet.address }, 'Wallet initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize wallet');
      throw error;
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): string | null {
    return this.wallet?.address || config.botWalletAddress || null;
  }

  /**
   * Check if wallet is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get USDC balance
   */
  async getBalance(): Promise<number> {
    if (!this.isInitialized) {
      throw new AppError(ERROR_CODES.WALLET_NOT_CONFIGURED, 'Wallet not initialized');
    }

    const balance = await clobClientService.getBalance();

    // Update cached balance in database
    const address = this.getAddress();
    if (address) {
      await prisma.botWallet.update({
        where: { address: address.toLowerCase() },
        data: {
          usdcBalance: balance,
          lastBalanceCheck: new Date(),
        },
      });
    }

    return balance;
  }

  /**
   * Update wallet info in database
   */
  private async updateWalletInDatabase(): Promise<void> {
    const address = this.getAddress();
    if (!address) return;

    await prisma.botWallet.upsert({
      where: { address: address.toLowerCase() },
      update: {
        isActive: true,
        network: config.polymarketNetwork === 'mainnet' ? 'MAINNET' : 'TESTNET',
      },
      create: {
        address: address.toLowerCase(),
        network: config.polymarketNetwork === 'mainnet' ? 'MAINNET' : 'TESTNET',
        isActive: true,
        usdcBalance: 0,
      },
    });
  }

  /**
   * Get wallet info for API response
   */
  async getWalletInfo(): Promise<{
    address: string | null;
    network: string;
    isConnected: boolean;
    balance?: number;
    lastBalanceCheck?: Date;
  }> {
    const address = this.getAddress();

    if (!address) {
      return {
        address: null,
        network: config.polymarketNetwork,
        isConnected: false,
      };
    }

    const dbWallet = await prisma.botWallet.findUnique({
      where: { address: address.toLowerCase() },
    });

    return {
      address,
      network: config.polymarketNetwork,
      isConnected: this.isInitialized,
      balance: dbWallet?.usdcBalance,
      lastBalanceCheck: dbWallet?.lastBalanceCheck || undefined,
    };
  }
}

// Singleton instance
export const walletService = new WalletService();
