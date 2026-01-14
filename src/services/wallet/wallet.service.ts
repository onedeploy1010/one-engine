/**
 * Wallet Service for ONE Engine
 * Manages Smart Wallets via Thirdweb SDK
 */

import crypto from 'crypto';
import { createThirdwebClient, ThirdwebClient } from 'thirdweb';
import { privateKeyToAccount, smartWallet } from 'thirdweb/wallets';
import type { Chain } from 'thirdweb/chains';

// Generate a random private key
function generatePrivateKey(): `0x${string}` {
  return `0x${crypto.randomBytes(32).toString('hex')}` as `0x${string}`;
}
import { env } from '@/config/env';
import { getChain, DEFAULT_CHAIN, SUPPORTED_CHAIN_IDS } from '@/config/chains';
import { walletRepository } from '@/repositories/wallet.repository';
import { userRepository } from '@/repositories/user.repository';
import { LogService } from '@/lib/logger';
import type { Wallet, WalletType } from '@/types';

const log = new LogService({ service: 'WalletService' });

export interface CreateWalletOptions {
  userId: string;
  projectId?: string;
  chainId?: number;
  type?: WalletType;
}

export interface WalletWithAccount {
  wallet: Wallet;
  smartAccountAddress: string;
  personalAddress: string;
}

export class WalletService {
  private client: ThirdwebClient;

  constructor() {
    this.client = createThirdwebClient({
      clientId: env.THIRDWEB_CLIENT_ID,
      secretKey: env.THIRDWEB_SECRET_KEY,
    });
  }

  /**
   * Create a new Smart Wallet for a user
   */
  async createWallet(options: CreateWalletOptions): Promise<WalletWithAccount> {
    const { userId, projectId, chainId = 8453, type = 'smart' } = options;
    const chain = getChain(chainId);

    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    log.info('Creating wallet', { userId, chainId });

    // Generate new private key for personal wallet
    const privateKey = generatePrivateKey();

    // Create personal account from private key
    const personalAccount = privateKeyToAccount({
      client: this.client,
      privateKey,
    });

    // Create smart wallet
    const wallet = smartWallet({
      chain,
      sponsorGas: true,
    });

    // Connect smart wallet with personal account as admin
    const smartAccount = await wallet.connect({
      client: this.client,
      personalAccount,
    });

    // Encrypt private key for storage (in production, use proper encryption)
    const encryptedKey = this.encryptPrivateKey(privateKey);

    // Save wallet to database
    const savedWallet = await walletRepository.create({
      userId,
      projectId,
      address: personalAccount.address,
      smartAccountAddress: smartAccount.address,
      walletType: type,
      chainId,
      isDefault: true,
      encryptedKey,
    });

    // Update user's wallet address
    await userRepository.linkWallet(userId, personalAccount.address, smartAccount.address);

    log.info('Wallet created', {
      walletId: savedWallet.id,
      smartAccountAddress: smartAccount.address
    });

    return {
      wallet: savedWallet,
      smartAccountAddress: smartAccount.address,
      personalAddress: personalAccount.address,
    };
  }

  /**
   * Get user's wallets
   */
  async getUserWallets(userId: string, chainId?: number): Promise<Wallet[]> {
    return walletRepository.findByUserId(userId, chainId);
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId: string): Promise<Wallet | null> {
    return walletRepository.findById(walletId);
  }

  /**
   * Get wallet by ID with ownership verification
   */
  async getWalletById(walletId: string, userId: string): Promise<Wallet | null> {
    const wallet = await walletRepository.findById(walletId);
    if (wallet && wallet.userId === userId) {
      return wallet;
    }
    return null;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(address: string, chainId: number): Promise<{
    native: string;
    nativeSymbol: string;
    tokens: Array<{ address: string; symbol: string; balance: string; decimals: number }>;
  }> {
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    try {
      // Fetch native balance via RPC
      const response = await fetch(chain.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      });

      const result = await response.json();
      const nativeBalance = result.result ? BigInt(result.result).toString() : '0';

      return {
        native: nativeBalance,
        nativeSymbol: chain.nativeCurrency?.symbol || 'ETH',
        tokens: [], // Would integrate token balance fetching in production
      };
    } catch (error) {
      log.error('Failed to fetch wallet balance', error as Error);
      return {
        native: '0',
        nativeSymbol: 'ETH',
        tokens: [],
      };
    }
  }

  /**
   * Get wallet by address
   */
  async getWalletByAddress(address: string, chainId?: number): Promise<Wallet | null> {
    return walletRepository.findByAddress(address, chainId);
  }

  /**
   * Get user's default wallet
   */
  async getDefaultWallet(userId: string, chainId = 8453): Promise<Wallet | null> {
    return walletRepository.getDefaultWallet(userId, chainId);
  }

  /**
   * Set default wallet
   */
  async setDefaultWallet(userId: string, walletId: string, chainId?: number): Promise<void> {
    const wallet = await walletRepository.findById(walletId);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.userId !== userId) {
      throw new Error('Wallet does not belong to user');
    }

    await walletRepository.setDefault(walletId, userId, chainId || wallet.chainId);
  }

  /**
   * Get connected smart account for a wallet
   * Used for signing transactions
   */
  async getSmartAccount(walletId: string, userId: string) {
    const wallet = await walletRepository.findById(walletId);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.userId !== userId) {
      throw new Error('Wallet does not belong to user');
    }

    const chain = getChain(wallet.chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${wallet.chainId}`);
    }

    // Get encrypted key from wallet record
    const encryptedKey = wallet.encryptedKey;
    if (!encryptedKey) {
      throw new Error('Wallet key not found');
    }

    // Decrypt private key
    const privateKey = this.decryptPrivateKey(encryptedKey) as `0x${string}`;

    // Recreate personal account from private key
    const personalAccount = privateKeyToAccount({
      client: this.client,
      privateKey,
    });

    // Recreate smart wallet
    const walletInstance = smartWallet({
      chain,
      sponsorGas: true,
    });

    // Connect and return smart account
    const smartAccount = await walletInstance.connect({
      client: this.client,
      personalAccount,
    });

    return smartAccount;
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): number[] {
    return SUPPORTED_CHAIN_IDS;
  }

  /**
   * Check if chain is supported
   */
  isChainSupported(chainId: number): boolean {
    return SUPPORTED_CHAIN_IDS.includes(chainId);
  }

  /**
   * Encrypt private key (placeholder - use proper encryption in production)
   */
  private encryptPrivateKey(privateKey: string): string {
    // In production, use proper encryption with a secure key management system
    // This is a placeholder - DO NOT use in production
    return Buffer.from(privateKey).toString('base64');
  }

  /**
   * Decrypt private key (placeholder - use proper decryption in production)
   */
  private decryptPrivateKey(encryptedKey: string): string {
    // In production, use proper decryption
    return Buffer.from(encryptedKey, 'base64').toString();
  }
}

export const walletService = new WalletService();
