/**
 * Circle Wallet Service
 * Creates and manages wallets via Circle Developer-Controlled Wallets (MPC-based)
 */

import {
  getCircleClient,
  getCircleBlockchain,
  getCircleWalletSetId,
  getCircleNetworkMode,
  NetworkMode
} from '@/lib/circle';
import { env } from '@/config/env';
import { walletRepository } from '@/repositories/wallet.repository';
import { userRepository } from '@/repositories/user.repository';
import { LogService } from '@/lib/logger';
import type { Wallet } from '@/types';

const log = new LogService({ service: 'CircleWalletService' });

export interface CircleCreateWalletOptions {
  userId: string;
  projectId?: string;
  chainId?: number;
  network?: NetworkMode;  // testnet or mainnet
}

export class CircleWalletService {
  async createWallet(options: CircleCreateWalletOptions): Promise<{
    wallet: Wallet;
    smartAccountAddress: string;
    personalAddress: string;
  }> {
    const { userId, projectId, chainId = 8453, network } = options;  // Default to Base mainnet
    const targetNetwork = network || getCircleNetworkMode();
    const circleBlockchain = getCircleBlockchain(chainId, targetNetwork);

    if (!circleBlockchain) {
      throw new Error(`Chain ${chainId} not supported by Circle on ${targetNetwork}`);
    }

    const client = getCircleClient(targetNetwork);
    const walletSetId = getCircleWalletSetId(targetNetwork);

    log.info('Creating Circle wallet', { userId, chainId, blockchain: circleBlockchain, network: targetNetwork });

    // Create SCA wallet via Circle
    const response = await client.createWallets({
      accountType: 'SCA',
      blockchains: [circleBlockchain as any], // Circle SDK expects specific Blockchain type
      count: 1,
      walletSetId,
    });

    const circleWallet = response.data?.wallets?.[0];
    if (!circleWallet) {
      throw new Error('Failed to create Circle wallet');
    }

    // Save to DB
    const savedWallet = await walletRepository.create({
      userId,
      projectId,
      address: circleWallet.address,
      smartAccountAddress: circleWallet.address,
      walletType: 'circle',
      chainId,
      isDefault: true,
      provider: 'circle',
      circleWalletId: circleWallet.id,
      circleWalletSetId: walletSetId,
    });

    // Update user's wallet address
    await userRepository.linkWallet(userId, circleWallet.address, circleWallet.address);

    log.info('Circle wallet created', {
      walletId: savedWallet.id,
      circleWalletId: circleWallet.id,
      address: circleWallet.address,
    });

    return {
      wallet: savedWallet,
      smartAccountAddress: circleWallet.address,
      personalAddress: circleWallet.address,
    };
  }

  async getWalletBalance(circleWalletId: string) {
    const client = getCircleClient();
    const response = await client.getWalletTokenBalance({ id: circleWalletId });
    return response.data?.tokenBalances || [];
  }
}

export const circleWalletService = new CircleWalletService();
