/**
 * ONE Chain Registry
 * Comprehensive chain configuration system supporting 200+ EVM chains
 *
 * Features:
 * - Pre-configured support for 200+ popular EVM chains
 * - Dynamic chain addition via Thirdweb's defineChain
 * - Chain categorization (mainnet, L2, testnet, gaming)
 * - RPC failover support
 * - Chain metadata for UI display
 *
 * Usage:
 *   import { getChainById, defineCustomChain, getAllChains } from '@/config/chains';
 *
 *   // Get a pre-configured chain
 *   const base = getChainById(8453);
 *
 *   // Define a custom chain dynamically
 *   const myChain = defineCustomChain({
 *     id: 12345,
 *     name: 'My Custom Chain',
 *     rpc: 'https://rpc.mychain.com',
 *   });
 */

import { defineChain } from 'thirdweb/chains';
import type { Chain } from 'thirdweb/chains';
import type { ChainConfig, ChainStatus, ChainCategoryType } from './types';
import { MAINNET_CHAINS } from './mainnets';
import { L2_ROLLUP_CHAINS } from './l2-rollups';
import { TESTNET_CHAINS } from './testnets';
import { GAMING_APP_CHAINS } from './gaming';

// Re-export types
export * from './types';

// ========================================
// Chain Registry
// ========================================

// Combine all chains into a single registry
const ALL_CHAINS: ChainConfig[] = [
  ...MAINNET_CHAINS,
  ...L2_ROLLUP_CHAINS,
  ...TESTNET_CHAINS,
  ...GAMING_APP_CHAINS,
];

// Create a map for fast lookup by chain ID
const CHAIN_BY_ID = new Map<number, ChainConfig>();
const CHAIN_BY_SLUG = new Map<string, ChainConfig>();

// Build lookup maps
for (const chain of ALL_CHAINS) {
  CHAIN_BY_ID.set(chain.id, chain);
  if (chain.slug) {
    CHAIN_BY_SLUG.set(chain.slug, chain);
  }
}

// Custom chains added at runtime
const CUSTOM_CHAINS = new Map<number, ChainConfig>();

// ========================================
// Chain Lookup Functions
// ========================================

/**
 * Get chain configuration by ID
 * Supports both pre-configured and custom chains
 */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_BY_ID.get(chainId) || CUSTOM_CHAINS.get(chainId);
}

/**
 * Get chain configuration by slug
 */
export function getChainConfigBySlug(slug: string): ChainConfig | undefined {
  return CHAIN_BY_SLUG.get(slug);
}

/**
 * Get Thirdweb Chain object by ID
 * Uses defineChain for dynamic chain support
 */
export function getChainById(chainId: number): Chain {
  const config = getChainConfig(chainId);

  if (config) {
    // Use our configuration with defineChain
    const chainConfig: any = {
      id: config.id,
      name: config.name,
      nativeCurrency: config.nativeCurrency,
      rpc: config.rpc[0], // Use primary RPC
      blockExplorers: config.blockExplorers.map(e => ({
        name: e.name,
        url: e.url,
        apiUrl: e.apiUrl,
      })),
    };
    // Only add testnet if true (thirdweb expects testnet: true | undefined)
    if (config.testnet) {
      chainConfig.testnet = true as const;
    }
    return defineChain(chainConfig);
  }

  // For unknown chains, use Thirdweb's defineChain with just the ID
  // This will use Thirdweb's default chain data if available
  return defineChain(chainId);
}

/**
 * Get all RPC endpoints for a chain (for failover)
 */
export function getChainRPCs(chainId: number): string[] {
  const config = getChainConfig(chainId);
  if (config) {
    return [...config.rpc];
  }
  // Return Thirdweb's default RPC format
  return [`https://${chainId}.rpc.thirdweb.com`];
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return CHAIN_BY_ID.has(chainId) || CUSTOM_CHAINS.has(chainId);
}

/**
 * Check if a chain is a testnet
 */
export function isTestnet(chainId: number): boolean {
  const config = getChainConfig(chainId);
  return config?.testnet ?? false;
}

// ========================================
// Dynamic Chain Definition
// ========================================

/**
 * Define a custom chain dynamically
 * This allows adding any EVM chain at runtime
 */
export function defineCustomChain(config: {
  id: number;
  name: string;
  rpc: string | string[];
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer?: {
    name: string;
    url: string;
  };
  testnet?: boolean;
}): Chain {
  const rpcList = Array.isArray(config.rpc) ? config.rpc : [config.rpc];

  const chainConfig: ChainConfig = {
    id: config.id,
    name: config.name,
    slug: config.name.toLowerCase().replace(/\s+/g, '-'),
    nativeCurrency: config.nativeCurrency || {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpc: rpcList,
    blockExplorers: config.blockExplorer
      ? [{ name: config.blockExplorer.name, url: config.blockExplorer.url }]
      : [],
    testnet: config.testnet ?? false,
  };

  // Add to custom chains registry
  CUSTOM_CHAINS.set(config.id, chainConfig);

  // Return Thirdweb Chain object
  const thirdwebConfig: any = {
    id: config.id,
    name: config.name,
    nativeCurrency: chainConfig.nativeCurrency,
    rpc: rpcList[0],
    blockExplorers: chainConfig.blockExplorers.map(e => ({
      name: e.name,
      url: e.url,
    })),
  };
  if (chainConfig.testnet) {
    thirdwebConfig.testnet = true as const;
  }
  return defineChain(thirdwebConfig);
}

/**
 * Register multiple custom chains at once
 */
export function registerCustomChains(
  chains: Array<{
    id: number;
    name: string;
    rpc: string | string[];
    nativeCurrency?: { name: string; symbol: string; decimals: number };
    blockExplorer?: { name: string; url: string };
    testnet?: boolean;
  }>
): Chain[] {
  return chains.map(defineCustomChain);
}

// ========================================
// Chain Collection Functions
// ========================================

/**
 * Get all available chains
 */
export function getAllChains(): ChainConfig[] {
  return [...ALL_CHAINS, ...Array.from(CUSTOM_CHAINS.values())];
}

/**
 * Get all mainnet chains
 */
export function getMainnetChains(): ChainConfig[] {
  return MAINNET_CHAINS;
}

/**
 * Get all L2/Rollup chains
 */
export function getL2Chains(): ChainConfig[] {
  return L2_ROLLUP_CHAINS;
}

/**
 * Get all testnet chains
 */
export function getTestnetChains(): ChainConfig[] {
  return TESTNET_CHAINS;
}

/**
 * Get all gaming/app-specific chains
 */
export function getGamingChains(): ChainConfig[] {
  return GAMING_APP_CHAINS;
}

/**
 * Get chains by category
 */
export function getChainsByCategory(category: ChainCategoryType): ChainConfig[] {
  switch (category) {
    case 'mainnet':
      return MAINNET_CHAINS;
    case 'l2':
      return L2_ROLLUP_CHAINS;
    case 'testnet':
      return TESTNET_CHAINS;
    case 'gaming':
      return GAMING_APP_CHAINS;
    case 'custom':
      return Array.from(CUSTOM_CHAINS.values());
    default:
      return [];
  }
}

/**
 * Get all chain IDs
 */
export function getAllChainIds(): number[] {
  return getAllChains().map(c => c.id);
}

/**
 * Get chains that support smart wallets
 */
export function getSmartWalletChains(): ChainConfig[] {
  return getAllChains().filter(c => c.features?.smartWallet === true);
}

/**
 * Get chains that support gas sponsorship
 */
export function getGasSponsorshipChains(): ChainConfig[] {
  return getAllChains().filter(c => c.features?.gasSponsorship === true);
}

/**
 * Search chains by name or symbol
 */
export function searchChains(query: string): ChainConfig[] {
  const lowerQuery = query.toLowerCase();
  return getAllChains().filter(
    c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.nativeCurrency.symbol.toLowerCase().includes(lowerQuery) ||
      c.shortName?.toLowerCase().includes(lowerQuery) ||
      c.slug?.toLowerCase().includes(lowerQuery)
  );
}

// ========================================
// Chain Metadata Functions
// ========================================

/**
 * Get chain display name
 */
export function getChainName(chainId: number): string {
  const config = getChainConfig(chainId);
  return config?.name || `Chain ${chainId}`;
}

/**
 * Get native currency symbol
 */
export function getNativeSymbol(chainId: number): string {
  const config = getChainConfig(chainId);
  return config?.nativeCurrency.symbol || 'ETH';
}

/**
 * Get block explorer URL
 */
export function getExplorerUrl(chainId: number): string | undefined {
  const config = getChainConfig(chainId);
  return config?.blockExplorers[0]?.url;
}

/**
 * Get transaction explorer URL
 */
export function getTxExplorerUrl(chainId: number, txHash: string): string | undefined {
  const explorerUrl = getExplorerUrl(chainId);
  if (explorerUrl) {
    return `${explorerUrl}/tx/${txHash}`;
  }
  return undefined;
}

/**
 * Get address explorer URL
 */
export function getAddressExplorerUrl(chainId: number, address: string): string | undefined {
  const explorerUrl = getExplorerUrl(chainId);
  if (explorerUrl) {
    return `${explorerUrl}/address/${address}`;
  }
  return undefined;
}

/**
 * Get chain faucets (for testnets)
 */
export function getChainFaucets(chainId: number): string[] {
  const config = getChainConfig(chainId);
  return config?.faucets || [];
}

// ========================================
// Chain Health Check
// ========================================

/**
 * Check chain health by testing RPC connectivity
 */
export async function checkChainHealth(chainId: number): Promise<ChainStatus> {
  const config = getChainConfig(chainId);
  const rpcUrl = config?.rpc[0] || `https://${chainId}.rpc.thirdweb.com`;

  const startTime = Date.now();

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
    });

    const result = await response.json();
    const latency = Date.now() - startTime;
    const blockNumber = result.result ? parseInt(result.result, 16) : undefined;

    return {
      chainId,
      isHealthy: response.ok && result.result !== undefined,
      latency,
      blockNumber,
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      chainId,
      isHealthy: false,
      latency: Date.now() - startTime,
      lastChecked: new Date(),
    };
  }
}

/**
 * Check health of multiple chains
 */
export async function checkMultipleChainHealth(chainIds: number[]): Promise<Map<number, ChainStatus>> {
  const results = await Promise.all(chainIds.map(checkChainHealth));
  const statusMap = new Map<number, ChainStatus>();
  for (const status of results) {
    statusMap.set(status.chainId, status);
  }
  return statusMap;
}

// ========================================
// Popular Chain Constants
// ========================================

// Default chains for the ONE Ecosystem
export const DEFAULT_CHAIN_ID = 8453; // Base
export const DEFAULT_TESTNET_CHAIN_ID = 84532; // Base Sepolia

// Popular chain IDs for quick reference
export const CHAIN_IDS = {
  // Mainnets
  ETHEREUM: 1,
  POLYGON: 137,
  BSC: 56,
  AVALANCHE: 43114,
  FANTOM: 250,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  ZKSYNC: 324,
  LINEA: 59144,
  SCROLL: 534352,
  BLAST: 81457,
  MODE: 34443,
  ZORA: 7777777,
  MANTLE: 5000,
  GNOSIS: 100,
  CELO: 42220,

  // L2s
  POLYGON_ZKEVM: 1101,
  MANTA: 169,
  FRAXTAL: 252,
  TAIKO: 167000,

  // Gaming
  IMMUTABLE_ZKEVM: 13371,
  BEAM: 4337,
  RONIN: 2020,

  // Testnets
  SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
  ARBITRUM_SEPOLIA: 421614,
  OPTIMISM_SEPOLIA: 11155420,
  POLYGON_AMOY: 80002,
} as const;

// Recommended chains for the ONE Ecosystem (with smart wallet support)
export const RECOMMENDED_CHAINS = [
  CHAIN_IDS.BASE,
  CHAIN_IDS.ETHEREUM,
  CHAIN_IDS.POLYGON,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.OPTIMISM,
  CHAIN_IDS.ZKSYNC,
  CHAIN_IDS.LINEA,
  CHAIN_IDS.SCROLL,
  CHAIN_IDS.BLAST,
];

// Recommended testnet chains
export const RECOMMENDED_TESTNETS = [
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.SEPOLIA,
  CHAIN_IDS.ARBITRUM_SEPOLIA,
  CHAIN_IDS.OPTIMISM_SEPOLIA,
];

// Export chain lists
export {
  MAINNET_CHAINS,
  L2_ROLLUP_CHAINS,
  TESTNET_CHAINS,
  GAMING_APP_CHAINS,
};

// ========================================
// Statistics
// ========================================

/**
 * Get chain registry statistics
 */
export function getChainStats() {
  return {
    total: getAllChains().length,
    mainnets: MAINNET_CHAINS.length,
    l2Rollups: L2_ROLLUP_CHAINS.length,
    testnets: TESTNET_CHAINS.length,
    gaming: GAMING_APP_CHAINS.length,
    custom: CUSTOM_CHAINS.size,
    smartWalletSupported: getSmartWalletChains().length,
    gasSponsorshipSupported: getGasSponsorshipChains().length,
  };
}

