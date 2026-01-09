#!/usr/bin/env tsx
/**
 * Script to encrypt a private key for secure storage
 *
 * Usage:
 *   pnpm tsx scripts/encrypt-key.ts
 *
 * This will prompt you for:
 *   1. Your private key (will be hidden)
 *   2. An encryption password
 *
 * It will output the encrypted key that you can store in your .env file
 * as BOT_WALLET_ENCRYPTED_KEY
 */

import * as readline from 'readline';
import { createCipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { ethers } from 'ethers';

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

async function encrypt(privateKey: string, password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const data: EncryptedData = {
    encrypted,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag: authTag.toString('hex'),
  };

  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function question(prompt: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      process.stdout.write(prompt);
      let input = '';

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (char: string) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007F' || char === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Polymarket Bot - Private Key Encryption Tool');
  console.log('='.repeat(60));
  console.log();
  console.log('This tool will encrypt your private key for secure storage.');
  console.log('The encrypted key can be stored in your .env file.');
  console.log();

  // Get private key
  const privateKey = await question('Enter your private key: ', true);

  // Validate private key
  const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const keyWithout0x = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

  if (!/^[a-fA-F0-9]{64}$/.test(keyWithout0x)) {
    console.error('\nError: Invalid private key format. Must be 64 hex characters.');
    process.exit(1);
  }

  // Derive address
  let wallet: ethers.Wallet;
  try {
    wallet = new ethers.Wallet(cleanKey);
  } catch (error) {
    console.error('\nError: Invalid private key.');
    process.exit(1);
  }

  console.log(`\nWallet address: ${wallet.address}`);

  // Get encryption password
  console.log();
  const password = await question('Enter encryption password: ', true);
  const confirmPassword = await question('Confirm encryption password: ', true);

  if (password !== confirmPassword) {
    console.error('\nError: Passwords do not match.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\nError: Password must be at least 8 characters.');
    process.exit(1);
  }

  // Encrypt
  console.log('\nEncrypting...');
  const encrypted = await encrypt(cleanKey, password);

  console.log('\n' + '='.repeat(60));
  console.log('  ENCRYPTION COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('Add these to your .env file:');
  console.log();
  console.log(`BOT_WALLET_ADDRESS=${wallet.address}`);
  console.log(`BOT_WALLET_ENCRYPTED_KEY=${encrypted}`);
  console.log(`ENCRYPTION_KEY=${password}`);
  console.log();
  console.log('IMPORTANT:');
  console.log('- Keep your ENCRYPTION_KEY secret and secure');
  console.log('- Never commit your .env file to version control');
  console.log('- Make a secure backup of your encryption password');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
