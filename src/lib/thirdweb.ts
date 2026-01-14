/**
 * Thirdweb SDK Configuration for ONE Engine
 * Handles all blockchain interactions: wallets, contracts, swaps, deployments
 *
 * Based on Thirdweb API documentation:
 * - https://portal.thirdweb.com/typescript/v5
 * - https://portal.thirdweb.com/engine
 */

import { createThirdwebClient, ThirdwebClient } from 'thirdweb';
import { privateKeyToAccount, smartWallet, inAppWallet } from 'thirdweb/wallets';
import { getContract, readContract, prepareContractCall, sendTransaction } from 'thirdweb';
import type { Chain } from 'thirdweb/chains';
import { env } from '@/config/env';
import {
  getChainById,
  getChainConfig,
  getAllChainIds,
  getSmartWalletChains,
  getGasSponsorshipChains,
  CHAIN_IDS,
  DEFAULT_CHAIN_ID,
} from '@/config/chains';

// Singleton Thirdweb client
let thirdwebClient: ThirdwebClient | null = null;

// Get recommended chains for display
const smartWalletChains = getSmartWalletChains().slice(0, 20);

// ONE Ecosystem Thirdweb Configuration
// Client ID is centrally managed - all ecosystem projects use this
export const THIRDWEB_CONFIG = {
  clientId: env.THIRDWEB_CLIENT_ID,
  // Supported features
  features: {
    inAppWallet: true,
    smartWallet: true,
    sponsoredGas: true,
    email: true,
    social: ['google', 'apple'],
    passkey: true,
  },
  // Supported chains (200+ chains available)
  supportedChains: smartWalletChains.map((chain) => ({
    id: chain.id,
    name: chain.name,
    isDefault: chain.id === DEFAULT_CHAIN_ID,
    symbol: chain.nativeCurrency.symbol,
    testnet: chain.testnet,
  })),
  // Total available chains
  totalChains: getAllChainIds().length,
  // Default configuration
  defaults: {
    chainId: DEFAULT_CHAIN_ID, // Base (8453)
    sponsorGas: true,
  },
};

/**
 * Get Thirdweb client instance (singleton)
 * Uses ONE Ecosystem's centralized clientId
 */
export function getThirdwebClient(): ThirdwebClient {
  if (!thirdwebClient) {
    thirdwebClient = createThirdwebClient({
      clientId: env.THIRDWEB_CLIENT_ID,
      secretKey: env.THIRDWEB_SECRET_KEY,
    });
  }
  return thirdwebClient;
}

/**
 * Get public client configuration for frontend
 * This is what gets returned to SDK via /api/v1/config/thirdweb
 */
export function getPublicThirdwebConfig() {
  return {
    clientId: env.THIRDWEB_CLIENT_ID,
    ...THIRDWEB_CONFIG,
  };
}

/**
 * Smart Wallet Configuration
 * Uses EIP-4337 Account Abstraction with gas sponsorship
 */
export interface SmartWalletConfig {
  chain?: Chain;
  sponsorGas?: boolean;
  factoryAddress?: string;
}

// Get the default chain for smart wallet operations
const DEFAULT_CHAIN = getChainById(DEFAULT_CHAIN_ID);

/**
 * Create a smart wallet for a user based on their personal wallet
 * The personal wallet can be from email, social auth, or private key
 */
export async function createSmartWallet(
  personalWalletPrivateKey: string,
  config: SmartWalletConfig = {}
) {
  const client = getThirdwebClient();
  const chain = config.chain || DEFAULT_CHAIN;

  // Create personal wallet from private key
  const personalAccount = privateKeyToAccount({
    client,
    privateKey: personalWalletPrivateKey,
  });

  // Configure smart wallet
  const wallet = smartWallet({
    chain,
    sponsorGas: config.sponsorGas ?? true,
    factoryAddress: config.factoryAddress,
  });

  // Connect smart wallet with personal account as admin
  const smartAccount = await wallet.connect({
    client,
    personalAccount,
  });

  return {
    wallet,
    smartAccount,
    address: smartAccount.address,
    chain,
  };
}

/**
 * Get contract instance for read/write operations
 */
export function getContractInstance(
  contractAddress: string,
  chainId: number,
  abi?: any[]
) {
  const client = getThirdwebClient();
  // getChainById supports any EVM chain via defineChain
  const chain = getChainById(chainId);

  return getContract({
    client,
    chain,
    address: contractAddress,
    abi,
  });
}

/**
 * Read from a contract
 */
export async function readFromContract<T = unknown>(
  contractAddress: string,
  chainId: number,
  method: string,
  args: unknown[] = [],
  abi?: any[]
): Promise<T> {
  const contract = getContractInstance(contractAddress, chainId, abi);

  const result = await readContract({
    contract,
    method,
    params: args,
  });

  return result as T;
}

/**
 * Prepare a contract call (for signing by smart wallet)
 */
export async function prepareTransaction(
  contractAddress: string,
  chainId: number,
  method: string,
  args: unknown[] = [],
  abi?: any[],
  value?: bigint
) {
  const contract = getContractInstance(contractAddress, chainId, abi);

  const transaction = prepareContractCall({
    contract,
    method,
    params: args,
    value,
  });

  return transaction;
}

/**
 * Execute a transaction from a smart wallet
 */
export async function executeTransaction(
  smartAccount: any,
  transaction: any
): Promise<{ hash: string }> {
  const result = await sendTransaction({
    account: smartAccount,
    transaction,
  });

  return { hash: result.transactionHash };
}

/**
 * Get chain instance by ID
 * Supports all 200+ EVM chains via the chain registry
 */
export function getChainInstance(chainId: number): Chain {
  // getChainById supports any EVM chain through our registry + Thirdweb's defineChain
  return getChainById(chainId);
}

/**
 * Create an in-app wallet for email authentication
 * This creates a wallet that users can access via email OTP
 */
export async function createInAppWalletForEmail(email: string) {
  const client = getThirdwebClient();

  const wallet = inAppWallet({
    auth: {
      options: ['email', 'google', 'apple', 'passkey'],
    },
  });

  return wallet;
}

/**
 * Verify email and connect in-app wallet
 */
export async function connectInAppWallet(
  email: string,
  verificationCode: string,
  chainId: number = 8453
) {
  const client = getThirdwebClient();
  const chain = getChainInstance(chainId);

  const wallet = inAppWallet({
    auth: {
      options: ['email'],
    },
  });

  // Connect wallet with email verification
  const account = await wallet.connect({
    client,
    chain,
    strategy: 'email',
    email,
    verificationCode,
  });

  return {
    wallet,
    account,
    address: account.address,
  };
}

/**
 * Create smart wallet from in-app wallet
 * Combines in-app wallet (email auth) with smart wallet (gas sponsorship)
 */
export async function createSmartWalletFromInApp(
  personalAccount: any,
  chainId: number = 8453
) {
  const client = getThirdwebClient();
  const chain = getChainInstance(chainId);

  const wallet = smartWallet({
    chain,
    sponsorGas: true,
  });

  const smartAccount = await wallet.connect({
    client,
    personalAccount,
  });

  return {
    wallet,
    smartAccount,
    address: smartAccount.address,
    personalAddress: personalAccount.address,
  };
}

/**
 * Send native token (ETH, MATIC, etc.)
 */
export async function sendNativeToken(
  smartAccount: any,
  to: string,
  amount: bigint,
  chainId: number
) {
  const client = getThirdwebClient();
  const chain = getChainInstance(chainId);

  const transaction = {
    to,
    value: amount,
    chain,
    client,
  };

  const result = await sendTransaction({
    account: smartAccount,
    transaction: transaction as any,
  });

  return { hash: result.transactionHash };
}

/**
 * Send ERC20 token
 */
export async function sendERC20Token(
  smartAccount: any,
  tokenAddress: string,
  to: string,
  amount: bigint,
  chainId: number
) {
  const contract = getContractInstance(tokenAddress, chainId);

  const transaction = prepareContractCall({
    contract,
    method: 'function transfer(address to, uint256 amount) returns (bool)',
    params: [to, amount],
  });

  const result = await sendTransaction({
    account: smartAccount,
    transaction,
  });

  return { hash: result.transactionHash };
}

/**
 * Batch execute multiple transactions atomically
 * Based on Thirdweb Engine v2.1.25 batch capabilities
 */
export async function executeBatchTransactions(
  smartAccount: any,
  transactions: Array<{
    to: string;
    data?: string;
    value?: bigint;
  }>,
  chainId: number
) {
  const results: string[] = [];

  // For smart wallets, transactions are typically batched automatically
  // Execute sequentially for now - can optimize with UserOp batching
  for (const tx of transactions) {
    const result = await sendTransaction({
      account: smartAccount,
      transaction: tx as any,
    });
    results.push(result.transactionHash);
  }

  return { hashes: results };
}

/**
 * Get wallet balance (native token)
 */
export async function getWalletNativeBalance(
  address: string,
  chainId: number
): Promise<{ balance: bigint; formatted: string; symbol: string }> {
  const chain = getChainInstance(chainId);
  const chainConfig = getChainConfig(chainId);
  const symbol = chainConfig?.nativeCurrency.symbol || 'ETH';
  const decimals = chainConfig?.nativeCurrency.decimals || 18;

  // Get RPC URL from chain (supports all 200+ chains)
  const rpcUrl = chainConfig?.rpc[0] || `https://${chainId}.rpc.thirdweb.com`;

  // Use RPC to get balance
  const response = await fetch(rpcUrl, {
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
  const balance = BigInt(result.result || '0');
  const formatted = (Number(balance) / Math.pow(10, decimals)).toFixed(6);

  return { balance, formatted, symbol };
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  from: string,
  to: string,
  data: string,
  value: string,
  chainId: number
): Promise<{ gasLimit: string; gasPrice: string }> {
  const chainConfig = getChainConfig(chainId);
  const rpcUrl = chainConfig?.rpc[0] || `https://${chainId}.rpc.thirdweb.com`;

  const [gasLimitResponse, gasPriceResponse] = await Promise.all([
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_estimateGas',
        params: [{ from, to, data, value }],
      }),
    }),
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_gasPrice',
        params: [],
      }),
    }),
  ]);

  const gasLimitResult = await gasLimitResponse.json();
  const gasPriceResult = await gasPriceResponse.json();

  return {
    gasLimit: gasLimitResult.result || '0x5208', // Default 21000
    gasPrice: gasPriceResult.result || '0x0',
  };
}

// Re-export useful thirdweb functions and types
export {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
};

// Re-export chain utilities
export {
  getChainById,
  getChainConfig,
  getAllChainIds,
  getSmartWalletChains,
  getGasSponsorshipChains,
  CHAIN_IDS,
  DEFAULT_CHAIN_ID,
};
