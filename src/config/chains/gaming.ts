/**
 * Gaming and Application-Specific Chains
 * Chains optimized for gaming, NFTs, and specific use cases
 */

import type { ChainConfig } from './types';

export const GAMING_APP_CHAINS: ChainConfig[] = [
  // ========================================
  // Gaming Focused Chains
  // ========================================

  // Immutable zkEVM
  {
    id: 13371,
    name: 'Immutable zkEVM',
    shortName: 'imx',
    slug: 'immutable-zkevm',
    nativeCurrency: { name: 'IMX', symbol: 'IMX', decimals: 18 },
    rpc: [
      'https://immutable-zkevm.rpc.thirdweb.com',
      'https://rpc.immutable.com',
    ],
    blockExplorers: [
      { name: 'Immutable Explorer', url: 'https://explorer.immutable.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://immutable.com',
  },

  // Beam
  {
    id: 4337,
    name: 'Beam',
    shortName: 'beam',
    slug: 'beam',
    nativeCurrency: { name: 'BEAM', symbol: 'BEAM', decimals: 18 },
    rpc: [
      'https://beam.rpc.thirdweb.com',
      'https://build.onbeam.com/rpc',
    ],
    blockExplorers: [
      { name: 'Beam Explorer', url: 'https://subnets.avax.network/beam' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://onbeam.com',
  },

  // Ronin
  {
    id: 2020,
    name: 'Ronin',
    shortName: 'ronin',
    slug: 'ronin',
    nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
    rpc: [
      'https://ronin.rpc.thirdweb.com',
      'https://api.roninchain.com/rpc',
    ],
    blockExplorers: [
      { name: 'Ronin Explorer', url: 'https://app.roninchain.com' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://roninchain.com',
  },

  // Oasys
  {
    id: 248,
    name: 'Oasys',
    shortName: 'oas',
    slug: 'oasys',
    nativeCurrency: { name: 'OAS', symbol: 'OAS', decimals: 18 },
    rpc: [
      'https://oasys.rpc.thirdweb.com',
      'https://rpc.mainnet.oasys.games',
    ],
    blockExplorers: [
      { name: 'Oasys Explorer', url: 'https://explorer.oasys.games' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://oasys.games',
  },

  // Treasure Chain (Ruby)
  {
    id: 978657,
    name: 'Treasure Chain',
    shortName: 'treasure',
    slug: 'treasure',
    nativeCurrency: { name: 'MAGIC', symbol: 'MAGIC', decimals: 18 },
    rpc: [
      'https://rpc.treasure.lol',
    ],
    blockExplorers: [
      { name: 'Treasure Explorer', url: 'https://explorer.treasure.lol' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://treasure.lol',
    parent: { type: 'L2', chain: 'arbitrum' },
  },

  // Xai (Gaming L3)
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

  // Proof of Play Apex
  {
    id: 70700,
    name: 'Proof of Play Apex',
    shortName: 'apex',
    slug: 'pop-apex',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://rpc.apex.proofofplay.com',
    ],
    blockExplorers: [
      { name: 'Apex Explorer', url: 'https://explorer.apex.proofofplay.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://proofofplay.com',
    parent: { type: 'L2', chain: 'arbitrum' },
  },

  // SKALE Nebula
  {
    id: 1482601649,
    name: 'SKALE Nebula',
    shortName: 'nebula',
    slug: 'skale-nebula',
    nativeCurrency: { name: 'sFUEL', symbol: 'sFUEL', decimals: 18 },
    rpc: [
      'https://mainnet.skalenodes.com/v1/green-giddy-denebola',
    ],
    blockExplorers: [
      { name: 'SKALE Explorer', url: 'https://green-giddy-denebola.explorer.mainnet.skalenodes.com' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://skale.space',
  },

  // SKALE Calypso
  {
    id: 1564830818,
    name: 'SKALE Calypso',
    shortName: 'calypso',
    slug: 'skale-calypso',
    nativeCurrency: { name: 'sFUEL', symbol: 'sFUEL', decimals: 18 },
    rpc: [
      'https://mainnet.skalenodes.com/v1/honorable-steel-rasalhague',
    ],
    blockExplorers: [
      { name: 'SKALE Explorer', url: 'https://honorable-steel-rasalhague.explorer.mainnet.skalenodes.com' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://skale.space',
  },

  // SKALE Europa
  {
    id: 2046399126,
    name: 'SKALE Europa',
    shortName: 'europa',
    slug: 'skale-europa',
    nativeCurrency: { name: 'sFUEL', symbol: 'sFUEL', decimals: 18 },
    rpc: [
      'https://mainnet.skalenodes.com/v1/elated-tan-skat',
    ],
    blockExplorers: [
      { name: 'SKALE Explorer', url: 'https://elated-tan-skat.explorer.mainnet.skalenodes.com' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://skale.space',
  },

  // Saigon (Ronin Testnet)
  {
    id: 2021,
    name: 'Saigon',
    shortName: 'saigon',
    slug: 'ronin-saigon',
    nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
    rpc: [
      'https://saigon-testnet.roninchain.com/rpc',
    ],
    blockExplorers: [
      { name: 'Saigon Explorer', url: 'https://saigon-app.roninchain.com' },
    ],
    testnet: true,
    features: { eip1559: false, eip155: true },
    faucets: [
      'https://faucet.roninchain.com',
    ],
    infoUrl: 'https://roninchain.com',
  },

  // Beam Testnet
  {
    id: 13337,
    name: 'Beam Testnet',
    shortName: 'beam-test',
    slug: 'beam-testnet',
    nativeCurrency: { name: 'BEAM', symbol: 'BEAM', decimals: 18 },
    rpc: [
      'https://build.onbeam.com/rpc/testnet',
    ],
    blockExplorers: [
      { name: 'Beam Testnet Explorer', url: 'https://subnets-test.avax.network/beam' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://faucet.onbeam.com',
    ],
    infoUrl: 'https://onbeam.com',
  },

  // Immutable zkEVM Testnet
  {
    id: 13473,
    name: 'Immutable zkEVM Testnet',
    shortName: 'imx-test',
    slug: 'immutable-zkevm-testnet',
    nativeCurrency: { name: 'IMX', symbol: 'IMX', decimals: 18 },
    rpc: [
      'https://rpc.testnet.immutable.com',
    ],
    blockExplorers: [
      { name: 'Immutable Testnet Explorer', url: 'https://explorer.testnet.immutable.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://immutable.com',
  },

  // ========================================
  // NFT & Creator Focused Chains
  // ========================================

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

  // Palm
  {
    id: 11297108109,
    name: 'Palm',
    shortName: 'palm',
    slug: 'palm',
    nativeCurrency: { name: 'PALM', symbol: 'PALM', decimals: 18 },
    rpc: [
      'https://palm.rpc.thirdweb.com',
      'https://palm-mainnet.infura.io/v3/3a961d6501e54add9a41aa53f15de99b',
    ],
    blockExplorers: [
      { name: 'Palm Explorer', url: 'https://explorer.palm.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://palm.io',
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

  // ========================================
  // Social/Community Chains
  // ========================================

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

  // ========================================
  // DeFi Focused Chains
  // ========================================

  // Sei
  {
    id: 1329,
    name: 'Sei',
    shortName: 'sei',
    slug: 'sei',
    nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
    rpc: [
      'https://sei.rpc.thirdweb.com',
      'https://evm-rpc.sei-apis.com',
    ],
    blockExplorers: [
      { name: 'Sei Explorer', url: 'https://seitrace.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://sei.io',
  },

  // Sei Testnet
  {
    id: 1328,
    name: 'Sei Testnet',
    shortName: 'sei-test',
    slug: 'sei-testnet',
    nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
    rpc: [
      'https://evm-rpc-testnet.sei-apis.com',
    ],
    blockExplorers: [
      { name: 'Sei Testnet Explorer', url: 'https://testnet.seitrace.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://atlantic-2.app.sei.io/faucet',
    ],
    infoUrl: 'https://sei.io',
  },

  // BOB (Build on Bitcoin)
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

  // ========================================
  // Privacy Focused Chains
  // ========================================

  // Oasis Sapphire
  {
    id: 23294,
    name: 'Oasis Sapphire',
    shortName: 'sapphire',
    slug: 'oasis-sapphire',
    nativeCurrency: { name: 'ROSE', symbol: 'ROSE', decimals: 18 },
    rpc: [
      'https://sapphire.rpc.thirdweb.com',
      'https://sapphire.oasis.io',
    ],
    blockExplorers: [
      { name: 'Oasis Sapphire Explorer', url: 'https://explorer.oasis.io/mainnet/sapphire' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://oasisprotocol.org',
  },

  // Oasis Sapphire Testnet
  {
    id: 23295,
    name: 'Oasis Sapphire Testnet',
    shortName: 'sapphire-test',
    slug: 'oasis-sapphire-testnet',
    nativeCurrency: { name: 'ROSE', symbol: 'ROSE', decimals: 18 },
    rpc: [
      'https://testnet.sapphire.oasis.io',
    ],
    blockExplorers: [
      { name: 'Oasis Sapphire Testnet Explorer', url: 'https://explorer.oasis.io/testnet/sapphire' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://faucet.testnet.oasis.io',
    ],
    infoUrl: 'https://oasisprotocol.org',
  },

  // ========================================
  // AI Focused Chains
  // ========================================

  // Bittensor (via subtensor EVM)
  {
    id: 964,
    name: 'Bittensor EVM',
    shortName: 'tao',
    slug: 'bittensor',
    nativeCurrency: { name: 'TAO', symbol: 'TAO', decimals: 18 },
    rpc: [
      'https://lite.chain.opentensor.ai',
    ],
    blockExplorers: [
      { name: 'Taostats', url: 'https://taostats.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://bittensor.com',
  },

  // ========================================
  // Enterprise Chains
  // ========================================

  // Hedera
  {
    id: 295,
    name: 'Hedera',
    shortName: 'hbar',
    slug: 'hedera',
    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
    rpc: [
      'https://mainnet.hashio.io/api',
    ],
    blockExplorers: [
      { name: 'HashScan', url: 'https://hashscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://hedera.com',
  },

  // Hedera Testnet
  {
    id: 296,
    name: 'Hedera Testnet',
    shortName: 'hbar-test',
    slug: 'hedera-testnet',
    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
    rpc: [
      'https://testnet.hashio.io/api',
    ],
    blockExplorers: [
      { name: 'HashScan Testnet', url: 'https://hashscan.io/testnet' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://portal.hedera.com',
    ],
    infoUrl: 'https://hedera.com',
  },

  // XDC Network
  {
    id: 50,
    name: 'XDC Network',
    shortName: 'xdc',
    slug: 'xdc',
    nativeCurrency: { name: 'XDC', symbol: 'XDC', decimals: 18 },
    rpc: [
      'https://xdc.rpc.thirdweb.com',
      'https://rpc.xdcrpc.com',
    ],
    blockExplorers: [
      { name: 'XDC Explorer', url: 'https://xdcscan.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://xdc.org',
  },

  // XDC Apothem Testnet
  {
    id: 51,
    name: 'XDC Apothem',
    shortName: 'xdc-apothem',
    slug: 'xdc-apothem',
    nativeCurrency: { name: 'XDC', symbol: 'XDC', decimals: 18 },
    rpc: [
      'https://rpc.apothem.network',
    ],
    blockExplorers: [
      { name: 'XDC Apothem Explorer', url: 'https://apothem.xdcscan.io' },
    ],
    testnet: true,
    features: { eip1559: false, eip155: true },
    faucets: [
      'https://faucet.apothem.network',
    ],
    infoUrl: 'https://xdc.org',
  },
];

export default GAMING_APP_CHAINS;
