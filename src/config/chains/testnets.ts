/**
 * Testnet Chains
 * All major testnet networks for development and testing
 */

import type { ChainConfig } from './types';

export const TESTNET_CHAINS: ChainConfig[] = [
  // ========================================
  // Ethereum Testnets
  // ========================================

  // Sepolia
  {
    id: 11155111,
    name: 'Sepolia',
    shortName: 'sep',
    slug: 'sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://sepolia.rpc.thirdweb.com',
      'https://rpc.sepolia.org',
      'https://rpc.ankr.com/eth_sepolia',
      'https://ethereum-sepolia-rpc.publicnode.com',
    ],
    blockExplorers: [
      { name: 'Etherscan Sepolia', url: 'https://sepolia.etherscan.io', apiUrl: 'https://api-sepolia.etherscan.io/api' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true, gasSponsorship: true },
    faucets: [
      'https://sepoliafaucet.com',
      'https://faucet.quicknode.com/ethereum/sepolia',
      'https://www.alchemy.com/faucets/ethereum-sepolia',
    ],
    infoUrl: 'https://sepolia.dev',
  },

  // Holesky
  {
    id: 17000,
    name: 'Holesky',
    shortName: 'holesky',
    slug: 'holesky',
    nativeCurrency: { name: 'Holesky Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://holesky.rpc.thirdweb.com',
      'https://ethereum-holesky.publicnode.com',
      'https://rpc.ankr.com/eth_holesky',
    ],
    blockExplorers: [
      { name: 'Etherscan Holesky', url: 'https://holesky.etherscan.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    faucets: [
      'https://holesky-faucet.pk910.de',
      'https://faucet.quicknode.com/ethereum/holesky',
    ],
    infoUrl: 'https://holesky.ethpandaops.io',
  },

  // ========================================
  // Base Testnets
  // ========================================

  // Base Sepolia
  {
    id: 84532,
    name: 'Base Sepolia',
    shortName: 'base-sep',
    slug: 'base-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://base-sepolia.rpc.thirdweb.com',
      'https://sepolia.base.org',
      'https://base-sepolia.blockpi.network/v1/rpc/public',
    ],
    blockExplorers: [
      { name: 'Basescan Sepolia', url: 'https://sepolia.basescan.org' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true, gasSponsorship: true },
    faucets: [
      'https://www.coinbase.com/faucets/base-ethereum-goerli-faucet',
      'https://faucet.quicknode.com/base/sepolia',
    ],
    infoUrl: 'https://base.org',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Arbitrum Testnets
  // ========================================

  // Arbitrum Sepolia
  {
    id: 421614,
    name: 'Arbitrum Sepolia',
    shortName: 'arb-sep',
    slug: 'arbitrum-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://arbitrum-sepolia.rpc.thirdweb.com',
      'https://sepolia-rollup.arbitrum.io/rpc',
      'https://arbitrum-sepolia.blockpi.network/v1/rpc/public',
    ],
    blockExplorers: [
      { name: 'Arbiscan Sepolia', url: 'https://sepolia.arbiscan.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true, gasSponsorship: true },
    faucets: [
      'https://faucet.quicknode.com/arbitrum/sepolia',
    ],
    infoUrl: 'https://arbitrum.io',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Optimism Testnets
  // ========================================

  // Optimism Sepolia
  {
    id: 11155420,
    name: 'Optimism Sepolia',
    shortName: 'op-sep',
    slug: 'optimism-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://optimism-sepolia.rpc.thirdweb.com',
      'https://sepolia.optimism.io',
      'https://optimism-sepolia.blockpi.network/v1/rpc/public',
    ],
    blockExplorers: [
      { name: 'Optimism Sepolia Explorer', url: 'https://sepolia-optimistic.etherscan.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    faucets: [
      'https://faucet.quicknode.com/optimism/sepolia',
    ],
    infoUrl: 'https://optimism.io',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Polygon Testnets
  // ========================================

  // Polygon Amoy
  {
    id: 80002,
    name: 'Polygon Amoy',
    shortName: 'amoy',
    slug: 'polygon-amoy',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpc: [
      'https://polygon-amoy.rpc.thirdweb.com',
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy.blockpi.network/v1/rpc/public',
    ],
    blockExplorers: [
      { name: 'PolygonScan Amoy', url: 'https://amoy.polygonscan.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    faucets: [
      'https://faucet.polygon.technology',
    ],
    infoUrl: 'https://polygon.technology',
  },

  // Polygon zkEVM Cardona
  {
    id: 2442,
    name: 'Polygon zkEVM Cardona',
    shortName: 'zkevm-cardona',
    slug: 'polygon-zkevm-cardona',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://rpc.cardona.zkevm-rpc.com',
    ],
    blockExplorers: [
      { name: 'PolygonScan zkEVM Cardona', url: 'https://cardona-zkevm.polygonscan.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://polygon.technology',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // BNB Chain Testnets
  // ========================================

  // BNB Chain Testnet
  {
    id: 97,
    name: 'BNB Smart Chain Testnet',
    shortName: 'bnbt',
    slug: 'bsc-testnet',
    nativeCurrency: { name: 'Test BNB', symbol: 'tBNB', decimals: 18 },
    rpc: [
      'https://bsc-testnet.rpc.thirdweb.com',
      'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
      'https://bsc-testnet.publicnode.com',
    ],
    blockExplorers: [
      { name: 'BscScan Testnet', url: 'https://testnet.bscscan.com' },
    ],
    testnet: true,
    features: { eip1559: false, eip155: true },
    faucets: [
      'https://testnet.bnbchain.org/faucet-smart',
    ],
    infoUrl: 'https://www.bnbchain.org',
  },

  // opBNB Testnet
  {
    id: 5611,
    name: 'opBNB Testnet',
    shortName: 'opbnb-test',
    slug: 'opbnb-testnet',
    nativeCurrency: { name: 'Test BNB', symbol: 'tBNB', decimals: 18 },
    rpc: [
      'https://opbnb-testnet.rpc.thirdweb.com',
      'https://opbnb-testnet-rpc.bnbchain.org',
    ],
    blockExplorers: [
      { name: 'opBNB Testnet Scan', url: 'https://testnet.opbnbscan.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://testnet.bnbchain.org/faucet-smart',
    ],
    infoUrl: 'https://opbnb.bnbchain.org',
    parent: { type: 'L2', chain: 'bsc-testnet' },
  },

  // ========================================
  // Avalanche Testnets
  // ========================================

  // Avalanche Fuji
  {
    id: 43113,
    name: 'Avalanche Fuji',
    shortName: 'fuji',
    slug: 'avalanche-fuji',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpc: [
      'https://avalanche-fuji.rpc.thirdweb.com',
      'https://api.avax-test.network/ext/bc/C/rpc',
      'https://rpc.ankr.com/avalanche_fuji',
    ],
    blockExplorers: [
      { name: 'SnowTrace Testnet', url: 'https://testnet.snowtrace.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://faucet.avax.network',
    ],
    infoUrl: 'https://www.avax.network',
  },

  // ========================================
  // Fantom Testnets
  // ========================================

  // Fantom Testnet
  {
    id: 4002,
    name: 'Fantom Testnet',
    shortName: 'ftm-test',
    slug: 'fantom-testnet',
    nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
    rpc: [
      'https://fantom-testnet.rpc.thirdweb.com',
      'https://rpc.testnet.fantom.network',
    ],
    blockExplorers: [
      { name: 'FTMScan Testnet', url: 'https://testnet.ftmscan.com' },
    ],
    testnet: true,
    features: { eip1559: false, eip155: true },
    faucets: [
      'https://faucet.fantom.network',
    ],
    infoUrl: 'https://fantom.foundation',
  },

  // ========================================
  // zkSync Testnets
  // ========================================

  // zkSync Sepolia
  {
    id: 300,
    name: 'zkSync Sepolia',
    shortName: 'zksync-sep',
    slug: 'zksync-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://zksync-sepolia.rpc.thirdweb.com',
      'https://sepolia.era.zksync.dev',
    ],
    blockExplorers: [
      { name: 'zkSync Sepolia Explorer', url: 'https://sepolia.explorer.zksync.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://docs.zksync.io/build/tooling/network-faucets.html',
    ],
    infoUrl: 'https://zksync.io',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Linea Testnets
  // ========================================

  // Linea Sepolia
  {
    id: 59141,
    name: 'Linea Sepolia',
    shortName: 'linea-sep',
    slug: 'linea-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://linea-sepolia.rpc.thirdweb.com',
      'https://rpc.sepolia.linea.build',
    ],
    blockExplorers: [
      { name: 'Linea Sepolia Explorer', url: 'https://sepolia.lineascan.build' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://faucet.goerli.linea.build',
    ],
    infoUrl: 'https://linea.build',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Scroll Testnets
  // ========================================

  // Scroll Sepolia
  {
    id: 534351,
    name: 'Scroll Sepolia',
    shortName: 'scroll-sep',
    slug: 'scroll-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://scroll-sepolia.rpc.thirdweb.com',
      'https://sepolia-rpc.scroll.io',
    ],
    blockExplorers: [
      { name: 'Scroll Sepolia Explorer', url: 'https://sepolia.scrollscan.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://scroll.io/bridge',
    ],
    infoUrl: 'https://scroll.io',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Blast Testnets
  // ========================================

  // Blast Sepolia
  {
    id: 168587773,
    name: 'Blast Sepolia',
    shortName: 'blast-sep',
    slug: 'blast-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://blast-sepolia.rpc.thirdweb.com',
      'https://sepolia.blast.io',
    ],
    blockExplorers: [
      { name: 'Blast Sepolia Explorer', url: 'https://sepolia.blastscan.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://blast.io',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Mode Testnets
  // ========================================

  // Mode Sepolia
  {
    id: 919,
    name: 'Mode Sepolia',
    shortName: 'mode-sep',
    slug: 'mode-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://mode-sepolia.rpc.thirdweb.com',
      'https://sepolia.mode.network',
    ],
    blockExplorers: [
      { name: 'Mode Sepolia Explorer', url: 'https://sepolia.explorer.mode.network' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://mode.network',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Zora Testnets
  // ========================================

  // Zora Sepolia
  {
    id: 999999999,
    name: 'Zora Sepolia',
    shortName: 'zora-sep',
    slug: 'zora-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://zora-sepolia.rpc.thirdweb.com',
      'https://sepolia.rpc.zora.energy',
    ],
    blockExplorers: [
      { name: 'Zora Sepolia Explorer', url: 'https://sepolia.explorer.zora.energy' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://zora.energy',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Mantle Testnets
  // ========================================

  // Mantle Sepolia
  {
    id: 5003,
    name: 'Mantle Sepolia',
    shortName: 'mantle-sep',
    slug: 'mantle-sepolia',
    nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
    rpc: [
      'https://mantle-sepolia.rpc.thirdweb.com',
      'https://rpc.sepolia.mantle.xyz',
    ],
    blockExplorers: [
      { name: 'Mantle Sepolia Explorer', url: 'https://explorer.sepolia.mantle.xyz' },
    ],
    testnet: true,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://mantle.xyz',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Celo Testnets
  // ========================================

  // Celo Alfajores
  {
    id: 44787,
    name: 'Celo Alfajores',
    shortName: 'celo-alf',
    slug: 'celo-alfajores',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpc: [
      'https://celo-alfajores.rpc.thirdweb.com',
      'https://alfajores-forno.celo-testnet.org',
    ],
    blockExplorers: [
      { name: 'Celoscan Alfajores', url: 'https://alfajores.celoscan.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://faucet.celo.org',
    ],
    infoUrl: 'https://celo.org',
  },

  // ========================================
  // Gnosis Testnets
  // ========================================

  // Gnosis Chiado
  {
    id: 10200,
    name: 'Gnosis Chiado',
    shortName: 'chiado',
    slug: 'gnosis-chiado',
    nativeCurrency: { name: 'Chiado xDAI', symbol: 'XDAI', decimals: 18 },
    rpc: [
      'https://gnosis-chiado.rpc.thirdweb.com',
      'https://rpc.chiadochain.net',
    ],
    blockExplorers: [
      { name: 'Gnosis Chiado Explorer', url: 'https://gnosis-chiado.blockscout.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://gnosisfaucet.com',
    ],
    infoUrl: 'https://www.gnosis.io',
  },

  // ========================================
  // Moonbeam Testnets
  // ========================================

  // Moonbase Alpha
  {
    id: 1287,
    name: 'Moonbase Alpha',
    shortName: 'mbase',
    slug: 'moonbase-alpha',
    nativeCurrency: { name: 'DEV', symbol: 'DEV', decimals: 18 },
    rpc: [
      'https://moonbase-alpha.rpc.thirdweb.com',
      'https://rpc.api.moonbase.moonbeam.network',
    ],
    blockExplorers: [
      { name: 'Moonscan Moonbase', url: 'https://moonbase.moonscan.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://faucet.moonbeam.network',
    ],
    infoUrl: 'https://moonbeam.network',
  },

  // ========================================
  // Cronos Testnets
  // ========================================

  // Cronos Testnet
  {
    id: 338,
    name: 'Cronos Testnet',
    shortName: 'tcro',
    slug: 'cronos-testnet',
    nativeCurrency: { name: 'Test CRO', symbol: 'TCRO', decimals: 18 },
    rpc: [
      'https://cronos-testnet.rpc.thirdweb.com',
      'https://evm-t3.cronos.org',
    ],
    blockExplorers: [
      { name: 'Cronos Testnet Explorer', url: 'https://cronos.org/explorer/testnet3' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    faucets: [
      'https://cronos.org/faucet',
    ],
    infoUrl: 'https://cronos.org',
  },

  // ========================================
  // Klaytn Testnets
  // ========================================

  // Klaytn Baobab
  {
    id: 1001,
    name: 'Klaytn Baobab',
    shortName: 'klay-baobab',
    slug: 'klaytn-baobab',
    nativeCurrency: { name: 'KLAY', symbol: 'KLAY', decimals: 18 },
    rpc: [
      'https://klaytn-baobab.rpc.thirdweb.com',
      'https://public-en-baobab.klaytn.net',
    ],
    blockExplorers: [
      { name: 'KlaytnScope Baobab', url: 'https://baobab.klaytnscope.com' },
    ],
    testnet: true,
    features: { eip1559: false, eip155: true },
    faucets: [
      'https://baobab.wallet.klaytn.foundation/faucet',
    ],
    infoUrl: 'https://klaytn.foundation',
  },

  // ========================================
  // Taiko Testnets
  // ========================================

  // Taiko Hekla
  {
    id: 167009,
    name: 'Taiko Hekla',
    shortName: 'taiko-hekla',
    slug: 'taiko-hekla',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://taiko-hekla.rpc.thirdweb.com',
      'https://rpc.hekla.taiko.xyz',
    ],
    blockExplorers: [
      { name: 'Taiko Hekla Explorer', url: 'https://hekla.taikoscan.io' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://taiko.xyz',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Abstract Testnets
  // ========================================

  // Abstract Testnet
  {
    id: 11124,
    name: 'Abstract Testnet',
    shortName: 'abstract-test',
    slug: 'abstract-testnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://api.testnet.abs.xyz',
    ],
    blockExplorers: [
      { name: 'Abstract Testnet Explorer', url: 'https://sepolia.abscan.org' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://abs.xyz',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Lisk Testnets
  // ========================================

  // Lisk Sepolia
  {
    id: 4202,
    name: 'Lisk Sepolia',
    shortName: 'lisk-sep',
    slug: 'lisk-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://lisk-sepolia.rpc.thirdweb.com',
      'https://rpc.sepolia-api.lisk.com',
    ],
    blockExplorers: [
      { name: 'Lisk Sepolia Explorer', url: 'https://sepolia-blockscout.lisk.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://lisk.com',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // World Chain Testnets
  // ========================================

  // World Chain Sepolia
  {
    id: 4801,
    name: 'World Chain Sepolia',
    shortName: 'wld-sep',
    slug: 'worldchain-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://worldchain-sepolia.g.alchemy.com/public',
    ],
    blockExplorers: [
      { name: 'World Chain Sepolia Explorer', url: 'https://worldchain-sepolia.explorer.alchemy.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://world.org',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Fraxtal Testnets
  // ========================================

  // Fraxtal Holesky
  {
    id: 2522,
    name: 'Fraxtal Holesky',
    shortName: 'frax-holesky',
    slug: 'fraxtal-holesky',
    nativeCurrency: { name: 'Frax Ether', symbol: 'frxETH', decimals: 18 },
    rpc: [
      'https://fraxtal-holesky.rpc.thirdweb.com',
      'https://rpc.holesky.frax.com',
    ],
    blockExplorers: [
      { name: 'Fraxscan Holesky', url: 'https://holesky.fraxscan.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://frax.finance',
    parent: { type: 'L2', chain: 'holesky' },
  },

  // ========================================
  // Ink Testnets
  // ========================================

  // Ink Sepolia
  {
    id: 763373,
    name: 'Ink Sepolia',
    shortName: 'ink-sep',
    slug: 'ink-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://rpc-gel-sepolia.inkonchain.com',
    ],
    blockExplorers: [
      { name: 'Ink Sepolia Explorer', url: 'https://explorer-sepolia.inkonchain.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://inkonchain.com',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // Soneium Testnets
  // ========================================

  // Soneium Minato
  {
    id: 1946,
    name: 'Soneium Minato',
    shortName: 'soneium-minato',
    slug: 'soneium-minato',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://rpc.minato.soneium.org',
    ],
    blockExplorers: [
      { name: 'Soneium Minato Explorer', url: 'https://soneium-minato.blockscout.com' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://soneium.org',
    parent: { type: 'L2', chain: 'sepolia' },
  },

  // ========================================
  // ApeChain Testnets
  // ========================================

  // ApeChain Curtis
  {
    id: 33111,
    name: 'ApeChain Curtis',
    shortName: 'ape-curtis',
    slug: 'apechain-curtis',
    nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
    rpc: [
      'https://curtis.rpc.caldera.xyz/http',
    ],
    blockExplorers: [
      { name: 'ApeChain Curtis Explorer', url: 'https://curtis.explorer.caldera.xyz' },
    ],
    testnet: true,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://apechain.com',
    parent: { type: 'L2', chain: 'sepolia' },
  },
];

export default TESTNET_CHAINS;
