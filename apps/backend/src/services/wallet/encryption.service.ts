// Wallet encryption service
// Secure storage and retrieval of private keys

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { AppError, ERROR_CODES } from '@polymarket-bot/shared';

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
}

export class EncryptionService {
  /**
   * Encrypt a private key with a password
   */
  async encrypt(privateKey: string, password: string): Promise<string> {
    try {
      // Generate random salt and IV
      const salt = randomBytes(SALT_LENGTH);
      const iv = randomBytes(IV_LENGTH);

      // Derive key from password
      const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

      // Create cipher
      const cipher = createCipheriv(ALGORITHM, key, iv);

      // Encrypt
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine all parts
      const data: EncryptedData = {
        encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: authTag.toString('hex'),
      };

      // Encode as base64 JSON
      return Buffer.from(JSON.stringify(data)).toString('base64');
    } catch (error) {
      logger.error({ error }, 'Encryption failed');
      throw new AppError(
        ERROR_CODES.WALLET_ENCRYPTION_ERROR,
        'Failed to encrypt private key'
      );
    }
  }

  /**
   * Decrypt a private key with a password
   */
  async decrypt(encryptedString: string, password: string): Promise<string> {
    try {
      // Decode from base64
      const dataString = Buffer.from(encryptedString, 'base64').toString('utf8');
      const data: EncryptedData = JSON.parse(dataString);

      // Extract parts
      const salt = Buffer.from(data.salt, 'hex');
      const iv = Buffer.from(data.iv, 'hex');
      const authTag = Buffer.from(data.authTag, 'hex');
      const encrypted = data.encrypted;

      // Derive key from password
      const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error({ error }, 'Decryption failed');
      throw new AppError(
        ERROR_CODES.WALLET_DECRYPTION_ERROR,
        'Failed to decrypt private key. Check your encryption key.'
      );
    }
  }

  /**
   * Encrypt using the configured encryption key
   */
  async encryptWithConfigKey(privateKey: string): Promise<string> {
    if (!config.encryptionKey) {
      throw new AppError(
        ERROR_CODES.WALLET_NOT_CONFIGURED,
        'Encryption key not configured'
      );
    }
    return this.encrypt(privateKey, config.encryptionKey);
  }

  /**
   * Decrypt using the configured encryption key
   */
  async decryptWithConfigKey(encryptedString: string): Promise<string> {
    if (!config.encryptionKey) {
      throw new AppError(
        ERROR_CODES.WALLET_NOT_CONFIGURED,
        'Encryption key not configured'
      );
    }
    return this.decrypt(encryptedString, config.encryptionKey);
  }

  /**
   * Validate that a string is a valid private key
   */
  isValidPrivateKey(privateKey: string): boolean {
    // Remove 0x prefix if present
    const key = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

    // Should be 64 hex characters (32 bytes)
    return /^[a-fA-F0-9]{64}$/.test(key);
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
