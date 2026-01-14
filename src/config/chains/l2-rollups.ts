/**
 * L2 and Rollup Chains
 * Optimistic Rollups, ZK Rollups, and other Layer 2 solutions
 */

import type { ChainConfig } from './types';

export const L2_ROLLUP_CHAINS: ChainConfig[] = [
  // ========================================
  // Optimistic Rollups
  // ========================================

  // Optimism
  {
    id: 10,
    name: 'OP Mainnet',
    shortName: 'oeth',
    slug: 'optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://optimism.rpc.thirdweb.com',
      'https://mainnet.optimism.io',
      'https://rpc.ankr.com/optimism',
      'https://optimism.llamarpc.com',
    ],
    blockExplorers: [
      { name: 'Optimism Etherscan', url: 'https://optimistic.etherscan.io', apiUrl: 'https://api-optimistic.etherscan.io/api' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true, gasSponsorship: true },
    infoUrl: 'https://optimism.io',
    parent: { type: 'L2', chain: 'ethereum' },
    popularTokens: [
      { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
      { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    ],
  },

  // Base
  {
    id: 8453,
    name: 'Base',
    shortName: 'base',
    slug: 'base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://base.rpc.thirdweb.com',
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://rpc.ankr.com/base',
    ],
    blockExplorers: [
      { name: 'Basescan', url: 'https://basescan.org', apiUrl: 'https://api.basescan.org/api' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true, gasSponsorship: true },
    infoUrl: 'https://base.org',
    parent: { type: 'L2', chain: 'ethereum' },
    popularTokens: [
      { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
      { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', decimals: 6, name: 'Bridged USDC' },
    ],
  },

  // Arbitrum One
  {
    id: 42161,
    name: 'Arbitrum One',
    shortName: 'arb1',
    slug: 'arbitrum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://arbitrum.rpc.thirdweb.com',
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
      'https://arbitrum.llamarpc.com',
    ],
    blockExplorers: [
      { name: 'Arbiscan', url: 'https://arbiscan.io', apiUrl: 'https://api.arbiscan.io/api' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true, gasSponsorship: true },
    infoUrl: 'https://arbitrum.io',
    parent: { type: 'L2', chain: 'ethereum' },
    popularTokens: [
      { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
      { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
      { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', symbol: 'ARB', decimals: 18, name: 'Arbitrum' },
    ],
  },

  // Arbitrum Nova
  {
    id: 42170,
    name: 'Arbitrum Nova',
    shortName: 'arb-nova',
    slug: 'arbitrum-nova',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://arbitrum-nova.rpc.thirdweb.com',
      'https://nova.arbitrum.io/rpc',
    ],
    blockExplorers: [
      { name: 'Arbiscan Nova', url: 'https://nova.arbiscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://arbitrum.io',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Blast
  {
    id: 81457,
    name: 'Blast',
    shortName: 'blast',
    slug: 'blast',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://blast.rpc.thirdweb.com',
      'https://rpc.blast.io',
      'https://blast.blockpi.network/v1/rpc/public',
    ],
    blockExplorers: [
      { name: 'Blastscan', url: 'https://blastscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://blast.io',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Mode
  {
    id: 34443,
    name: 'Mode',
    shortName: 'mode',
    slug: 'mode',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://mode.rpc.thirdweb.com',
      'https://mainnet.mode.network',
    ],
    blockExplorers: [
      { name: 'Mode Explorer', url: 'https://explorer.mode.network' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://mode.network',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Zora
  {
    id: 7777777,
    name: 'Zora',
    shortName: 'zora',
    slug: 'zora',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://zora.rpc.thirdweb.com',
      'https://rpc.zora.energy',
    ],
    blockExplorers: [
      { name: 'Zora Explorer', url: 'https://explorer.zora.energy' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://zora.energy',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Manta Pacific
  {
    id: 169,
    name: 'Manta Pacific',
    shortName: 'manta',
    slug: 'manta-pacific',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://manta-pacific.rpc.thirdweb.com',
      'https://pacific-rpc.manta.network/http',
    ],
    blockExplorers: [
      { name: 'Manta Pacific Explorer', url: 'https://pacific-explorer.manta.network' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://manta.network',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Mantle
  {
    id: 5000,
    name: 'Mantle',
    shortName: 'mantle',
    slug: 'mantle',
    nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
    rpc: [
      'https://mantle.rpc.thirdweb.com',
      'https://rpc.mantle.xyz',
    ],
    blockExplorers: [
      { name: 'Mantle Explorer', url: 'https://explorer.mantle.xyz' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://mantle.xyz',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Fraxtal
  {
    id: 252,
    name: 'Fraxtal',
    shortName: 'frax',
    slug: 'fraxtal',
    nativeCurrency: { name: 'Frax Ether', symbol: 'frxETH', decimals: 18 },
    rpc: [
      'https://fraxtal.rpc.thirdweb.com',
      'https://rpc.frax.com',
    ],
    blockExplorers: [
      { name: 'Fraxscan', url: 'https://fraxscan.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://frax.finance',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // ========================================
  // ZK Rollups
  // ========================================

  // zkSync Era
  {
    id: 324,
    name: 'zkSync Era',
    shortName: 'zksync',
    slug: 'zksync-era',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://zksync.rpc.thirdweb.com',
      'https://mainnet.era.zksync.io',
      'https://zksync-era.blockpi.network/v1/rpc/public',
    ],
    blockExplorers: [
      { name: 'zkSync Explorer', url: 'https://explorer.zksync.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://zksync.io',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Linea
  {
    id: 59144,
    name: 'Linea',
    shortName: 'linea',
    slug: 'linea',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://linea.rpc.thirdweb.com',
      'https://rpc.linea.build',
      'https://linea.blockpi.network/v1/rpc/public',
    ],
    blockExplorers: [
      { name: 'Lineascan', url: 'https://lineascan.build' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://linea.build',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Scroll
  {
    id: 534352,
    name: 'Scroll',
    shortName: 'scroll',
    slug: 'scroll',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://scroll.rpc.thirdweb.com',
      'https://rpc.scroll.io',
      'https://scroll.blockpi.network/v1/rpc/public',
    ],
    blockExplorers: [
      { name: 'Scrollscan', url: 'https://scrollscan.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://scroll.io',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Polygon zkEVM
  {
    id: 1101,
    name: 'Polygon zkEVM',
    shortName: 'zkevm',
    slug: 'polygon-zkevm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://polygon-zkevm.rpc.thirdweb.com',
      'https://zkevm-rpc.com',
      'https://rpc.ankr.com/polygon_zkevm',
    ],
    blockExplorers: [
      { name: 'PolygonScan zkEVM', url: 'https://zkevm.polygonscan.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://polygon.technology/polygon-zkevm',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Starknet (via Kakarot - EVM compatible)
  {
    id: 1802203764,
    name: 'Kakarot Sepolia',
    shortName: 'kakarot',
    slug: 'kakarot',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://sepolia-rpc.kakarot.org',
    ],
    blockExplorers: [
      { name: 'Kakarot Explorer', url: 'https://sepolia.kakarotscan.org' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://kakarot.org',
    parent: { type: 'L2', chain: 'starknet' },
  },

  // Taiko
  {
    id: 167000,
    name: 'Taiko',
    shortName: 'taiko',
    slug: 'taiko',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://taiko.rpc.thirdweb.com',
      'https://rpc.mainnet.taiko.xyz',
    ],
    blockExplorers: [
      { name: 'Taiko Explorer', url: 'https://taikoscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://taiko.xyz',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Zircuit
  {
    id: 48900,
    name: 'Zircuit',
    shortName: 'zircuit',
    slug: 'zircuit',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://zircuit1-mainnet.p2pify.com',
    ],
    blockExplorers: [
      { name: 'Zircuit Explorer', url: 'https://explorer.zircuit.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://zircuit.com',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // ========================================
  // Application Specific Rollups
  // ========================================

  // Worldchain
  {
    id: 480,
    name: 'World Chain',
    shortName: 'wld',
    slug: 'worldchain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://worldchain-mainnet.g.alchemy.com/public',
    ],
    blockExplorers: [
      { name: 'World Chain Explorer', url: 'https://worldchain-mainnet.explorer.alchemy.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://world.org',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Lisk
  {
    id: 1135,
    name: 'Lisk',
    shortName: 'lisk',
    slug: 'lisk',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://lisk.rpc.thirdweb.com',
      'https://rpc.api.lisk.com',
    ],
    blockExplorers: [
      { name: 'Lisk Explorer', url: 'https://blockscout.lisk.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true },
    infoUrl: 'https://lisk.com',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // opBNB
  {
    id: 204,
    name: 'opBNB',
    shortName: 'opbnb',
    slug: 'opbnb',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpc: [
      'https://opbnb.rpc.thirdweb.com',
      'https://opbnb-mainnet-rpc.bnbchain.org',
    ],
    blockExplorers: [
      { name: 'opBNB Scan', url: 'https://opbnbscan.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://opbnb.bnbchain.org',
    parent: { type: 'L2', chain: 'bsc' },
  },

  // Mint
  {
    id: 185,
    name: 'Mint',
    shortName: 'mint',
    slug: 'mint',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://rpc.mintchain.io',
    ],
    blockExplorers: [
      { name: 'Mint Explorer', url: 'https://explorer.mintchain.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://mintchain.io',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Cyber
  {
    id: 7560,
    name: 'Cyber',
    shortName: 'cyber',
    slug: 'cyber',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://cyber.rpc.thirdweb.com',
      'https://cyber.alt.technology',
    ],
    blockExplorers: [
      { name: 'Cyber Explorer', url: 'https://cyberscan.co' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true },
    infoUrl: 'https://cyber.co',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Kroma
  {
    id: 255,
    name: 'Kroma',
    shortName: 'kroma',
    slug: 'kroma',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://kroma.rpc.thirdweb.com',
      'https://api.kroma.network',
    ],
    blockExplorers: [
      { name: 'Kroma Explorer', url: 'https://blockscout.kroma.network' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://kroma.network',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Redstone
  {
    id: 690,
    name: 'Redstone',
    shortName: 'redstone',
    slug: 'redstone',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://redstone.rpc.thirdweb.com',
      'https://rpc.redstonechain.com',
    ],
    blockExplorers: [
      { name: 'Redstone Explorer', url: 'https://explorer.redstone.xyz' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://redstone.xyz',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // BOB
  {
    id: 60808,
    name: 'BOB',
    shortName: 'bob',
    slug: 'bob',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://bob.rpc.thirdweb.com',
      'https://rpc.gobob.xyz',
    ],
    blockExplorers: [
      { name: 'BOB Explorer', url: 'https://explorer.gobob.xyz' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://gobob.xyz',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Shape
  {
    id: 360,
    name: 'Shape',
    shortName: 'shape',
    slug: 'shape',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://mainnet.shape.network',
    ],
    blockExplorers: [
      { name: 'Shape Explorer', url: 'https://shapescan.xyz' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://shape.network',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Xai
  {
    id: 660279,
    name: 'Xai',
    shortName: 'xai',
    slug: 'xai',
    nativeCurrency: { name: 'XAI', symbol: 'XAI', decimals: 18 },
    rpc: [
      'https://xai.rpc.thirdweb.com',
      'https://xai-chain.net/rpc',
    ],
    blockExplorers: [
      { name: 'Xai Explorer', url: 'https://explorer.xai-chain.net' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://xai.games',
    parent: { type: 'L2', chain: 'arbitrum' },
  },

  // Sanko
  {
    id: 1996,
    name: 'Sanko',
    shortName: 'sanko',
    slug: 'sanko',
    nativeCurrency: { name: 'Dream Machine Token', symbol: 'DMT', decimals: 18 },
    rpc: [
      'https://mainnet.sanko.xyz',
    ],
    blockExplorers: [
      { name: 'Sanko Explorer', url: 'https://explorer.sanko.xyz' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://sanko.xyz',
    parent: { type: 'L2', chain: 'arbitrum' },
  },

  // Degen
  {
    id: 666666666,
    name: 'Degen',
    shortName: 'degen',
    slug: 'degen',
    nativeCurrency: { name: 'DEGEN', symbol: 'DEGEN', decimals: 18 },
    rpc: [
      'https://degen.rpc.thirdweb.com',
      'https://rpc.degen.tips',
    ],
    blockExplorers: [
      { name: 'Degen Explorer', url: 'https://explorer.degen.tips' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://degen.tips',
    parent: { type: 'L2', chain: 'base' },
  },

  // Ham
  {
    id: 5112,
    name: 'Ham',
    shortName: 'ham',
    slug: 'ham',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://rpc.ham.fun',
    ],
    blockExplorers: [
      { name: 'Ham Explorer', url: 'https://explorer.ham.fun' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://ham.fun',
    parent: { type: 'L2', chain: 'base' },
  },

  // Soneium
  {
    id: 1868,
    name: 'Soneium',
    shortName: 'soneium',
    slug: 'soneium',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://rpc.soneium.org',
    ],
    blockExplorers: [
      { name: 'Soneium Explorer', url: 'https://soneium.blockscout.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://soneium.org',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Ink
  {
    id: 57073,
    name: 'Ink',
    shortName: 'ink',
    slug: 'ink',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://rpc-gel.inkonchain.com',
    ],
    blockExplorers: [
      { name: 'Ink Explorer', url: 'https://explorer.inkonchain.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://inkonchain.com',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // RARI Chain
  {
    id: 1380012617,
    name: 'RARI Chain',
    shortName: 'rari',
    slug: 'rari',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://mainnet.rpc.rarichain.org/http',
    ],
    blockExplorers: [
      { name: 'RARI Explorer', url: 'https://mainnet.explorer.rarichain.org' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://rarichain.org',
    parent: { type: 'L2', chain: 'arbitrum' },
  },

  // B3
  {
    id: 8333,
    name: 'B3',
    shortName: 'b3',
    slug: 'b3',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://mainnet-rpc.b3.fun',
    ],
    blockExplorers: [
      { name: 'B3 Explorer', url: 'https://explorer.b3.fun' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://b3.fun',
    parent: { type: 'L2', chain: 'base' },
  },

  // Abstract
  {
    id: 2741,
    name: 'Abstract',
    shortName: 'abstract',
    slug: 'abstract',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://api.mainnet.abs.xyz',
    ],
    blockExplorers: [
      { name: 'Abstract Explorer', url: 'https://abscan.org' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://abs.xyz',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Apechain
  {
    id: 33139,
    name: 'ApeChain',
    shortName: 'ape',
    slug: 'apechain',
    nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
    rpc: [
      'https://apechain.rpc.thirdweb.com',
      'https://rpc.apechain.com/http',
    ],
    blockExplorers: [
      { name: 'ApeChain Explorer', url: 'https://apescan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://apechain.com',
    parent: { type: 'L2', chain: 'arbitrum' },
  },

  // Superseed
  {
    id: 5330,
    name: 'Superseed',
    shortName: 'superseed',
    slug: 'superseed',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://mainnet.superseed.xyz',
    ],
    blockExplorers: [
      { name: 'Superseed Explorer', url: 'https://explorer.superseed.xyz' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://superseed.xyz',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Swan
  {
    id: 254,
    name: 'Swan Chain',
    shortName: 'swan',
    slug: 'swan',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://mainnet-rpc01.swanchain.io',
    ],
    blockExplorers: [
      { name: 'Swan Explorer', url: 'https://swanscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://swanchain.io',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // Unichain
  {
    id: 1301,
    name: 'Unichain',
    shortName: 'uni',
    slug: 'unichain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://sepolia.unichain.org',
    ],
    blockExplorers: [
      { name: 'Unichain Explorer', url: 'https://sepolia.uniscan.xyz' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://unichain.org',
    parent: { type: 'L2', chain: 'ethereum' },
  },
];

export default L2_ROLLUP_CHAINS;
