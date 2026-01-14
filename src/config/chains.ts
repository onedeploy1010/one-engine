/**
 * Chain Configuration for ONE Engine
 * Supports 200+ EVM chains via comprehensive registry
 *
 * This file serves as the main export point for chain configuration.
 * For detailed chain definitions, see the chains/ directory.
 *
 * Usage:
 *   import { getChainById, getAllChains, CHAIN_IDS } from '@/config/chains';
 *
 *   // Get a chain by ID
 *   const base = getChainById(8453);
 *
 *   // Get all available chains
 *   const allChains = getAllChains();
 *
 *   // Use chain ID constants
 *   const ethereumId = CHAIN_IDS.ETHEREUM; // 1
 */

// Re-export everything from the chains registry
export {
  // Types
  type ChainConfig,
  type ChainStatus,
  type ChainCategoryType,
  type NativeCurrency,
  type BlockExplorer,
  type RpcEndpoint,
  type ChainBridge,
  type ChainFeatures,
  type ChainCategory,

  // Chain lookup functions
  getChainConfig,
  getChainConfigBySlug,
  getChainById,
  getChainRPCs,
  isChainSupported,
  isTestnet,

  // Dynamic chain definition
  defineCustomChain,
  registerCustomChains,

  // Chain collection functions
  getAllChains,
  getMainnetChains,
  getL2Chains,
  getTestnetChains,
  getGamingChains,
  getChainsByCategory,
  getAllChainIds,
  getSmartWalletChains,
  getGasSponsorshipChains,
  searchChains,

  // Chain metadata functions
  getChainName,
  getNativeSymbol,
  getExplorerUrl,
  getTxExplorerUrl,
  getAddressExplorerUrl,
  getChainFaucets,

  // Health check functions
  checkChainHealth,
  checkMultipleChainHealth,

  // Constants
  DEFAULT_CHAIN_ID,
  DEFAULT_TESTNET_CHAIN_ID,
  CHAIN_IDS,
  RECOMMENDED_CHAINS,
  RECOMMENDED_TESTNETS,

  // Chain lists
  MAINNET_CHAINS,
  L2_ROLLUP_CHAINS,
  TESTNET_CHAINS,
  GAMING_APP_CHAINS,

  // Statistics
  getChainStats,
} from './chains/index';

// Import for backwards compatibility
import {
  getChainById,
  getChainConfig,
  isChainSupported,
  getChainName,
  DEFAULT_CHAIN_ID,
  getAllChainIds,
} from './chains/index';

// Backwards compatible exports (deprecated, use new functions)

/**
 * @deprecated Use getChainById instead
 */
export function getChain(chainId: number) {
  return getChainById(chainId);
}

/**
 * Default chain for Smart Account operations
 * @deprecated Use DEFAULT_CHAIN_ID and getChainById(DEFAULT_CHAIN_ID) instead
 */
export const DEFAULT_CHAIN = getChainById(DEFAULT_CHAIN_ID);

/**
 * Supported chain IDs for operations
 * @deprecated Use getAllChainIds() instead
 */
export const SUPPORTED_CHAIN_IDS = getAllChainIds();

/**
 * Chain ID to Chain object mapping
 * @deprecated Use getChainById instead
 */
export const CHAIN_MAP: Record<number, ReturnType<typeof getChainById>> = {};

// Populate CHAIN_MAP for backwards compatibility
for (const chainId of SUPPORTED_CHAIN_IDS.slice(0, 50)) {
  // Limit to first 50 for memory efficiency
  CHAIN_MAP[chainId] = getChainById(chainId);
}

/**
 * Chain categories
 * @deprecated Use getMainnetChains(), getTestnetChains() etc instead
 */
export const MAINNET_CHAIN_IDS = getAllChainIds().filter(
  (id) => !isChainSupported(id) || getChainConfig(id)?.testnet === false
);

export const TESTNET_CHAIN_IDS = getAllChainIds().filter(
  (id) => getChainConfig(id)?.testnet === true
);

/**
 * Chain metadata for UI display
 * @deprecated Use getChainConfig instead
 */
export interface ChainMeta {
  id: number;
  name: string;
  symbol: string;
  decimals: number;
  explorer: string;
  isTestnet: boolean;
}

/**
 * Get chain metadata for UI display
 * @deprecated Use getChainConfig instead
 */
export function getChainMeta(chainId: number): ChainMeta | undefined {
  const config = getChainConfig(chainId);
  if (!config) return undefined;

  return {
    id: config.id,
    name: config.name,
    symbol: config.nativeCurrency.symbol,
    decimals: config.nativeCurrency.decimals,
    explorer: config.blockExplorers[0]?.url || '',
    isTestnet: config.testnet,
  };
}
