/**
 * Circle Programmable Wallets SDK Client
 * Supports both Testnet and Mainnet with dynamic switching
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { env } from '@/config/env';

type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;
export type NetworkMode = 'testnet' | 'mainnet';

// Separate clients for testnet and mainnet
let testnetClient: CircleClient | null = null;
let mainnetClient: CircleClient | null = null;

// Current network mode (can be overridden per-request)
let currentNetworkMode: NetworkMode = env.CIRCLE_NETWORK_MODE || 'testnet';

/**
 * Get Circle API credentials for a specific network
 */
function getCircleCredentials(network: NetworkMode): { apiKey: string; entitySecret: string; walletSetId: string } {
  if (network === 'mainnet') {
    return {
      apiKey: env.CIRCLE_MAINNET_API_KEY || env.CIRCLE_API_KEY || '',
      entitySecret: env.CIRCLE_MAINNET_ENTITY_SECRET || env.CIRCLE_ENTITY_SECRET || '',
      walletSetId: env.CIRCLE_MAINNET_WALLET_SET_ID || env.CIRCLE_WALLET_SET_ID || '',
    };
  }
  return {
    apiKey: env.CIRCLE_TESTNET_API_KEY || env.CIRCLE_API_KEY || '',
    entitySecret: env.CIRCLE_TESTNET_ENTITY_SECRET || env.CIRCLE_ENTITY_SECRET || '',
    walletSetId: env.CIRCLE_TESTNET_WALLET_SET_ID || env.CIRCLE_WALLET_SET_ID || '',
  };
}

/**
 * Initialize Circle client for a specific network
 */
function initializeClient(network: NetworkMode): CircleClient {
  const creds = getCircleCredentials(network);

  if (!creds.apiKey || !creds.entitySecret) {
    throw new Error(`Circle ${network} credentials not configured`);
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey: creds.apiKey,
    entitySecret: creds.entitySecret,
  });
}

/**
 * Get Circle client for specified network (or current default)
 */
export function getCircleClient(network?: NetworkMode): CircleClient {
  const targetNetwork = network || currentNetworkMode;

  if (targetNetwork === 'mainnet') {
    if (!mainnetClient) {
      mainnetClient = initializeClient('mainnet');
    }
    return mainnetClient;
  } else {
    if (!testnetClient) {
      testnetClient = initializeClient('testnet');
    }
    return testnetClient;
  }
}

/**
 * Get wallet set ID for specified network
 */
export function getCircleWalletSetId(network?: NetworkMode): string {
  const targetNetwork = network || currentNetworkMode;
  const creds = getCircleCredentials(targetNetwork);

  if (!creds.walletSetId) {
    throw new Error(`CIRCLE_${targetNetwork.toUpperCase()}_WALLET_SET_ID not configured`);
  }

  return creds.walletSetId;
}

/**
 * Set current network mode
 */
export function setCircleNetworkMode(network: NetworkMode): void {
  currentNetworkMode = network;
}

/**
 * Get current network mode
 */
export function getCircleNetworkMode(): NetworkMode {
  return currentNetworkMode;
}

/**
 * Check if Circle is configured for a specific network
 */
export function isCircleConfigured(network?: NetworkMode): boolean {
  const targetNetwork = network || currentNetworkMode;
  const creds = getCircleCredentials(targetNetwork);
  return !!(creds.apiKey && creds.entitySecret);
}

// Map ONE chain IDs to Circle blockchain identifiers
// Testnet chains
export const CIRCLE_TESTNET_CHAINS: Record<number, string> = {
  11155111: 'ETH-SEPOLIA',    // Ethereum Sepolia
  80002: 'MATIC-AMOY',        // Polygon Amoy
  84532: 'BASE-SEPOLIA',      // Base Sepolia
  421614: 'ARB-SEPOLIA',      // Arbitrum Sepolia
  43113: 'AVAX-FUJI',         // Avalanche Fuji
  11155420: 'OP-SEPOLIA',     // Optimism Sepolia
};

// Mainnet chains
export const CIRCLE_MAINNET_CHAINS: Record<number, string> = {
  1: 'ETH',                   // Ethereum
  137: 'MATIC',               // Polygon
  8453: 'BASE',               // Base
  42161: 'ARB',               // Arbitrum
  43114: 'AVAX',              // Avalanche
  10: 'OP',                   // Optimism
};

// Combined map for all chains
export const CIRCLE_CHAIN_MAP: Record<number, string> = {
  ...CIRCLE_TESTNET_CHAINS,
  ...CIRCLE_MAINNET_CHAINS,
  5042002: 'ARC',             // Special chain
};

/**
 * Get Circle blockchain identifier for a chain ID
 */
export function getCircleBlockchain(chainId: number, network?: NetworkMode): string | null {
  const targetNetwork = network || currentNetworkMode;

  // Check network-specific chains first
  if (targetNetwork === 'mainnet') {
    return CIRCLE_MAINNET_CHAINS[chainId] || null;
  } else {
    return CIRCLE_TESTNET_CHAINS[chainId] || null;
  }
}

/**
 * Get all supported chain IDs for a network
 */
export function getSupportedChainIds(network?: NetworkMode): number[] {
  const targetNetwork = network || currentNetworkMode;

  if (targetNetwork === 'mainnet') {
    return Object.keys(CIRCLE_MAINNET_CHAINS).map(Number);
  }
  return Object.keys(CIRCLE_TESTNET_CHAINS).map(Number);
}
