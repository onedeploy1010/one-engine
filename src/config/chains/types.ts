/**
 * Chain Type Definitions
 * Comprehensive types for EVM chain configuration
 */

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface BlockExplorer {
  name: string;
  url: string;
  apiUrl?: string;
}

export interface RpcEndpoint {
  url: string;
  tracking?: 'none' | 'limited' | 'yes';
  isPublic?: boolean;
}

export interface ChainBridge {
  name: string;
  url: string;
}

export interface ChainFeatures {
  eip1559?: boolean;
  eip155?: boolean;
  eip4337?: boolean; // Account Abstraction
  smartWallet?: boolean;
  gasSponsorship?: boolean;
}

export interface ChainConfig {
  id: number;
  name: string;
  shortName?: string;
  slug?: string;
  nativeCurrency: NativeCurrency;
  rpc: string[];
  blockExplorers: BlockExplorer[];
  testnet: boolean;
  features?: ChainFeatures;
  bridges?: ChainBridge[];
  faucets?: string[];
  infoUrl?: string;
  icon?: string;
  parent?: {
    type: 'L2' | 'shard';
    chain: string;
    bridges?: ChainBridge[];
  };
  // Gas settings
  gasSettings?: {
    minGasPrice?: string;
    maxGasPrice?: string;
    gasLimitMultiplier?: number;
  };
  // Popular tokens on this chain
  popularTokens?: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    logoURI?: string;
  }[];
}

export interface ChainCategory {
  name: string;
  description: string;
  chains: ChainConfig[];
}

// Chain status for health checks
export interface ChainStatus {
  chainId: number;
  isHealthy: boolean;
  latency?: number;
  blockNumber?: number;
  lastChecked: Date;
}

// Supported chain categories
export type ChainCategoryType =
  | 'mainnet'
  | 'l2'
  | 'testnet'
  | 'gaming'
  | 'enterprise'
  | 'custom';
