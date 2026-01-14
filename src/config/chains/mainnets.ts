/**
 * Mainnet EVM Chains
 * Major L1 blockchains and established networks
 */

import type { ChainConfig } from './types';

export const MAINNET_CHAINS: ChainConfig[] = [
  // ========================================
  // Ethereum
  // ========================================
  {
    id: 1,
    name: 'Ethereum',
    shortName: 'eth',
    slug: 'ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://ethereum.rpc.thirdweb.com',
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://1rpc.io/eth',
    ],
    blockExplorers: [
      { name: 'Etherscan', url: 'https://etherscan.io', apiUrl: 'https://api.etherscan.io/api' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true, gasSponsorship: true },
    infoUrl: 'https://ethereum.org',
    popularTokens: [
      { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
      { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
      { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
      { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    ],
  },

  // ========================================
  // Polygon
  // ========================================
  {
    id: 137,
    name: 'Polygon',
    shortName: 'matic',
    slug: 'polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpc: [
      'https://polygon.rpc.thirdweb.com',
      'https://polygon.llamarpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon-rpc.com',
    ],
    blockExplorers: [
      { name: 'PolygonScan', url: 'https://polygonscan.com', apiUrl: 'https://api.polygonscan.com/api' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true, gasSponsorship: true },
    infoUrl: 'https://polygon.technology',
    popularTokens: [
      { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
      { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
      { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    ],
  },

  // ========================================
  // BNB Chain (BSC)
  // ========================================
  {
    id: 56,
    name: 'BNB Smart Chain',
    shortName: 'bnb',
    slug: 'bsc',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpc: [
      'https://binance.rpc.thirdweb.com',
      'https://bsc-dataseed.binance.org',
      'https://rpc.ankr.com/bsc',
      'https://bsc.publicnode.com',
    ],
    blockExplorers: [
      { name: 'BscScan', url: 'https://bscscan.com', apiUrl: 'https://api.bscscan.com/api' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://www.bnbchain.org',
    popularTokens: [
      { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18, name: 'Tether USD' },
      { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18, name: 'USD Coin' },
      { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', decimals: 18, name: 'Binance-Peg ETH' },
    ],
  },

  // ========================================
  // Avalanche C-Chain
  // ========================================
  {
    id: 43114,
    name: 'Avalanche C-Chain',
    shortName: 'avax',
    slug: 'avalanche',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpc: [
      'https://avalanche.rpc.thirdweb.com',
      'https://api.avax.network/ext/bc/C/rpc',
      'https://rpc.ankr.com/avalanche',
      'https://avalanche.public-rpc.com',
    ],
    blockExplorers: [
      { name: 'SnowTrace', url: 'https://snowtrace.io', apiUrl: 'https://api.snowtrace.io/api' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://www.avax.network',
  },

  // ========================================
  // Fantom Opera
  // ========================================
  {
    id: 250,
    name: 'Fantom Opera',
    shortName: 'ftm',
    slug: 'fantom',
    nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
    rpc: [
      'https://fantom.rpc.thirdweb.com',
      'https://rpc.ftm.tools',
      'https://rpc.ankr.com/fantom',
      'https://fantom.publicnode.com',
    ],
    blockExplorers: [
      { name: 'FTMScan', url: 'https://ftmscan.com', apiUrl: 'https://api.ftmscan.com/api' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://fantom.foundation',
  },

  // ========================================
  // Cronos
  // ========================================
  {
    id: 25,
    name: 'Cronos',
    shortName: 'cro',
    slug: 'cronos',
    nativeCurrency: { name: 'Cronos', symbol: 'CRO', decimals: 18 },
    rpc: [
      'https://cronos.rpc.thirdweb.com',
      'https://evm.cronos.org',
      'https://cronos-evm.publicnode.com',
    ],
    blockExplorers: [
      { name: 'Cronoscan', url: 'https://cronoscan.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://cronos.org',
  },

  // ========================================
  // Gnosis Chain (xDai)
  // ========================================
  {
    id: 100,
    name: 'Gnosis Chain',
    shortName: 'gno',
    slug: 'gnosis',
    nativeCurrency: { name: 'xDAI', symbol: 'XDAI', decimals: 18 },
    rpc: [
      'https://gnosis.rpc.thirdweb.com',
      'https://rpc.gnosischain.com',
      'https://rpc.ankr.com/gnosis',
    ],
    blockExplorers: [
      { name: 'GnosisScan', url: 'https://gnosisscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://www.gnosis.io',
  },

  // ========================================
  // Celo
  // ========================================
  {
    id: 42220,
    name: 'Celo',
    shortName: 'celo',
    slug: 'celo',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpc: [
      'https://celo.rpc.thirdweb.com',
      'https://forno.celo.org',
      'https://rpc.ankr.com/celo',
    ],
    blockExplorers: [
      { name: 'Celoscan', url: 'https://celoscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true, eip4337: true, smartWallet: true },
    infoUrl: 'https://celo.org',
  },

  // ========================================
  // Moonbeam
  // ========================================
  {
    id: 1284,
    name: 'Moonbeam',
    shortName: 'mbeam',
    slug: 'moonbeam',
    nativeCurrency: { name: 'Glimmer', symbol: 'GLMR', decimals: 18 },
    rpc: [
      'https://moonbeam.rpc.thirdweb.com',
      'https://rpc.api.moonbeam.network',
      'https://moonbeam.public.blastapi.io',
    ],
    blockExplorers: [
      { name: 'Moonscan', url: 'https://moonbeam.moonscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://moonbeam.network',
  },

  // ========================================
  // Moonriver
  // ========================================
  {
    id: 1285,
    name: 'Moonriver',
    shortName: 'mriver',
    slug: 'moonriver',
    nativeCurrency: { name: 'Moonriver', symbol: 'MOVR', decimals: 18 },
    rpc: [
      'https://moonriver.rpc.thirdweb.com',
      'https://rpc.api.moonriver.moonbeam.network',
      'https://moonriver.public.blastapi.io',
    ],
    blockExplorers: [
      { name: 'Moonscan', url: 'https://moonriver.moonscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://moonbeam.network/moonriver',
  },

  // ========================================
  // Harmony
  // ========================================
  {
    id: 1666600000,
    name: 'Harmony',
    shortName: 'one',
    slug: 'harmony',
    nativeCurrency: { name: 'ONE', symbol: 'ONE', decimals: 18 },
    rpc: [
      'https://api.harmony.one',
      'https://harmony.public-rpc.com',
    ],
    blockExplorers: [
      { name: 'Harmony Explorer', url: 'https://explorer.harmony.one' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://www.harmony.one',
  },

  // ========================================
  // Aurora
  // ========================================
  {
    id: 1313161554,
    name: 'Aurora',
    shortName: 'aurora',
    slug: 'aurora',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://aurora.rpc.thirdweb.com',
      'https://mainnet.aurora.dev',
    ],
    blockExplorers: [
      { name: 'Aurora Explorer', url: 'https://explorer.aurora.dev' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://aurora.dev',
    parent: { type: 'L2', chain: 'near' },
  },

  // ========================================
  // Klaytn
  // ========================================
  {
    id: 8217,
    name: 'Klaytn',
    shortName: 'klay',
    slug: 'klaytn',
    nativeCurrency: { name: 'KLAY', symbol: 'KLAY', decimals: 18 },
    rpc: [
      'https://klaytn.rpc.thirdweb.com',
      'https://public-en-cypress.klaytn.net',
      'https://klaytn.drpc.org',
    ],
    blockExplorers: [
      { name: 'KlaytnScope', url: 'https://scope.klaytn.com' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://klaytn.foundation',
  },

  // ========================================
  // Evmos
  // ========================================
  {
    id: 9001,
    name: 'Evmos',
    shortName: 'evmos',
    slug: 'evmos',
    nativeCurrency: { name: 'Evmos', symbol: 'EVMOS', decimals: 18 },
    rpc: [
      'https://evmos.rpc.thirdweb.com',
      'https://evmos-evm.publicnode.com',
      'https://evmos.lava.build',
    ],
    blockExplorers: [
      { name: 'Evmos Explorer', url: 'https://www.mintscan.io/evmos' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://evmos.org',
  },

  // ========================================
  // KAVA
  // ========================================
  {
    id: 2222,
    name: 'Kava',
    shortName: 'kava',
    slug: 'kava',
    nativeCurrency: { name: 'KAVA', symbol: 'KAVA', decimals: 18 },
    rpc: [
      'https://kava.rpc.thirdweb.com',
      'https://evm.kava.io',
      'https://kava-evm.publicnode.com',
    ],
    blockExplorers: [
      { name: 'Kava Explorer', url: 'https://kavascan.com' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://www.kava.io',
  },

  // ========================================
  // Metis
  // ========================================
  {
    id: 1088,
    name: 'Metis Andromeda',
    shortName: 'metis',
    slug: 'metis',
    nativeCurrency: { name: 'Metis', symbol: 'METIS', decimals: 18 },
    rpc: [
      'https://metis.rpc.thirdweb.com',
      'https://andromeda.metis.io/?owner=1088',
    ],
    blockExplorers: [
      { name: 'Metis Explorer', url: 'https://andromeda-explorer.metis.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://www.metis.io',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // ========================================
  // Fuse
  // ========================================
  {
    id: 122,
    name: 'Fuse',
    shortName: 'fuse',
    slug: 'fuse',
    nativeCurrency: { name: 'Fuse', symbol: 'FUSE', decimals: 18 },
    rpc: [
      'https://fuse.rpc.thirdweb.com',
      'https://rpc.fuse.io',
    ],
    blockExplorers: [
      { name: 'Fuse Explorer', url: 'https://explorer.fuse.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://fuse.io',
  },

  // ========================================
  // Telos
  // ========================================
  {
    id: 40,
    name: 'Telos',
    shortName: 'tlos',
    slug: 'telos',
    nativeCurrency: { name: 'Telos', symbol: 'TLOS', decimals: 18 },
    rpc: [
      'https://telos.rpc.thirdweb.com',
      'https://mainnet.telos.net/evm',
    ],
    blockExplorers: [
      { name: 'Telos Explorer', url: 'https://www.teloscan.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://telos.net',
  },

  // ========================================
  // Oasis Emerald
  // ========================================
  {
    id: 42262,
    name: 'Oasis Emerald',
    shortName: 'emerald',
    slug: 'oasis-emerald',
    nativeCurrency: { name: 'ROSE', symbol: 'ROSE', decimals: 18 },
    rpc: [
      'https://oasis-emerald.rpc.thirdweb.com',
      'https://emerald.oasis.dev',
    ],
    blockExplorers: [
      { name: 'Oasis Explorer', url: 'https://explorer.emerald.oasis.dev' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://oasisprotocol.org',
  },

  // ========================================
  // Palm
  // ========================================
  {
    id: 11297108109,
    name: 'Palm',
    shortName: 'palm',
    slug: 'palm',
    nativeCurrency: { name: 'PALM', symbol: 'PALM', decimals: 18 },
    rpc: [
      'https://palm-mainnet.infura.io/v3/3a961d6501e54add9a41aa53f15de99b',
    ],
    blockExplorers: [
      { name: 'Palm Explorer', url: 'https://explorer.palm.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://palm.io',
  },

  // ========================================
  // Boba Network
  // ========================================
  {
    id: 288,
    name: 'Boba Network',
    shortName: 'boba',
    slug: 'boba',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [
      'https://boba.rpc.thirdweb.com',
      'https://mainnet.boba.network',
    ],
    blockExplorers: [
      { name: 'Boba Explorer', url: 'https://bobascan.com' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://boba.network',
    parent: { type: 'L2', chain: 'ethereum' },
  },

  // ========================================
  // Conflux eSpace
  // ========================================
  {
    id: 1030,
    name: 'Conflux eSpace',
    shortName: 'cfx',
    slug: 'conflux',
    nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
    rpc: [
      'https://conflux-espace.rpc.thirdweb.com',
      'https://evm.confluxrpc.com',
    ],
    blockExplorers: [
      { name: 'Conflux Scan', url: 'https://evm.confluxscan.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://confluxnetwork.org',
  },

  // ========================================
  // Flare
  // ========================================
  {
    id: 14,
    name: 'Flare',
    shortName: 'flr',
    slug: 'flare',
    nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
    rpc: [
      'https://flare.rpc.thirdweb.com',
      'https://flare-api.flare.network/ext/C/rpc',
    ],
    blockExplorers: [
      { name: 'Flare Explorer', url: 'https://flare-explorer.flare.network' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://flare.network',
  },

  // ========================================
  // Songbird
  // ========================================
  {
    id: 19,
    name: 'Songbird',
    shortName: 'sgb',
    slug: 'songbird',
    nativeCurrency: { name: 'Songbird', symbol: 'SGB', decimals: 18 },
    rpc: [
      'https://songbird.rpc.thirdweb.com',
      'https://songbird-api.flare.network/ext/C/rpc',
    ],
    blockExplorers: [
      { name: 'Songbird Explorer', url: 'https://songbird-explorer.flare.network' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://flare.network',
  },

  // ========================================
  // ThunderCore
  // ========================================
  {
    id: 108,
    name: 'ThunderCore',
    shortName: 'tt',
    slug: 'thundercore',
    nativeCurrency: { name: 'ThunderCore', symbol: 'TT', decimals: 18 },
    rpc: [
      'https://mainnet-rpc.thundercore.com',
    ],
    blockExplorers: [
      { name: 'ThunderCore Explorer', url: 'https://viewblock.io/thundercore' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://www.thundercore.com',
  },

  // ========================================
  // Wanchain
  // ========================================
  {
    id: 888,
    name: 'Wanchain',
    shortName: 'wan',
    slug: 'wanchain',
    nativeCurrency: { name: 'Wancoin', symbol: 'WAN', decimals: 18 },
    rpc: [
      'https://gwan-ssl.wandevs.org:56891',
    ],
    blockExplorers: [
      { name: 'Wanchain Explorer', url: 'https://www.wanscan.org' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://www.wanchain.org',
  },

  // ========================================
  // EOS EVM
  // ========================================
  {
    id: 17777,
    name: 'EOS EVM',
    shortName: 'eos',
    slug: 'eos-evm',
    nativeCurrency: { name: 'EOS', symbol: 'EOS', decimals: 18 },
    rpc: [
      'https://api.evm.eosnetwork.com',
    ],
    blockExplorers: [
      { name: 'EOS EVM Explorer', url: 'https://explorer.evm.eosnetwork.com' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://eosnetwork.com',
  },

  // ========================================
  // IoTeX
  // ========================================
  {
    id: 4689,
    name: 'IoTeX',
    shortName: 'iotx',
    slug: 'iotex',
    nativeCurrency: { name: 'IoTeX', symbol: 'IOTX', decimals: 18 },
    rpc: [
      'https://iotex.rpc.thirdweb.com',
      'https://babel-api.mainnet.iotex.io',
    ],
    blockExplorers: [
      { name: 'IoTeX Explorer', url: 'https://iotexscan.io' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://iotex.io',
  },

  // ========================================
  // Velas
  // ========================================
  {
    id: 106,
    name: 'Velas',
    shortName: 'vlx',
    slug: 'velas',
    nativeCurrency: { name: 'Velas', symbol: 'VLX', decimals: 18 },
    rpc: [
      'https://evmexplorer.velas.com/rpc',
    ],
    blockExplorers: [
      { name: 'Velas Explorer', url: 'https://evmexplorer.velas.com' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://velas.com',
  },

  // ========================================
  // Rootstock
  // ========================================
  {
    id: 30,
    name: 'Rootstock',
    shortName: 'rsk',
    slug: 'rootstock',
    nativeCurrency: { name: 'RSK Smart Bitcoin', symbol: 'RBTC', decimals: 18 },
    rpc: [
      'https://rootstock.rpc.thirdweb.com',
      'https://public-node.rsk.co',
    ],
    blockExplorers: [
      { name: 'RSK Explorer', url: 'https://explorer.rsk.co' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://rootstock.io',
  },

  // ========================================
  // Hedera
  // ========================================
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

  // ========================================
  // SX Network
  // ========================================
  {
    id: 416,
    name: 'SX Network',
    shortName: 'sx',
    slug: 'sx-network',
    nativeCurrency: { name: 'SX', symbol: 'SX', decimals: 18 },
    rpc: [
      'https://rpc.sx.technology',
    ],
    blockExplorers: [
      { name: 'SX Explorer', url: 'https://explorer.sx.technology' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://sx.technology',
  },

  // ========================================
  // Core
  // ========================================
  {
    id: 1116,
    name: 'Core',
    shortName: 'core',
    slug: 'core',
    nativeCurrency: { name: 'Core', symbol: 'CORE', decimals: 18 },
    rpc: [
      'https://core.rpc.thirdweb.com',
      'https://rpc.coredao.org',
    ],
    blockExplorers: [
      { name: 'Core Scan', url: 'https://scan.coredao.org' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://coredao.org',
  },

  // ========================================
  // Callisto
  // ========================================
  {
    id: 820,
    name: 'Callisto',
    shortName: 'clo',
    slug: 'callisto',
    nativeCurrency: { name: 'Callisto', symbol: 'CLO', decimals: 18 },
    rpc: [
      'https://rpc.callisto.network',
    ],
    blockExplorers: [
      { name: 'Callisto Explorer', url: 'https://explorer.callisto.network' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://callisto.network',
  },

  // ========================================
  // Astar
  // ========================================
  {
    id: 592,
    name: 'Astar',
    shortName: 'astr',
    slug: 'astar',
    nativeCurrency: { name: 'Astar', symbol: 'ASTR', decimals: 18 },
    rpc: [
      'https://astar.rpc.thirdweb.com',
      'https://evm.astar.network',
    ],
    blockExplorers: [
      { name: 'Astar Subscan', url: 'https://astar.subscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://astar.network',
  },

  // ========================================
  // Shiden
  // ========================================
  {
    id: 336,
    name: 'Shiden',
    shortName: 'sdn',
    slug: 'shiden',
    nativeCurrency: { name: 'Shiden', symbol: 'SDN', decimals: 18 },
    rpc: [
      'https://shiden.rpc.thirdweb.com',
      'https://evm.shiden.astar.network',
    ],
    blockExplorers: [
      { name: 'Shiden Subscan', url: 'https://shiden.subscan.io' },
    ],
    testnet: false,
    features: { eip1559: true, eip155: true },
    infoUrl: 'https://shiden.astar.network',
  },

  // ========================================
  // Neon EVM
  // ========================================
  {
    id: 245022934,
    name: 'Neon EVM',
    shortName: 'neon',
    slug: 'neon',
    nativeCurrency: { name: 'Neon', symbol: 'NEON', decimals: 18 },
    rpc: [
      'https://neon-proxy-mainnet.solana.p2p.org',
    ],
    blockExplorers: [
      { name: 'Neon Explorer', url: 'https://neonscan.org' },
    ],
    testnet: false,
    features: { eip1559: false, eip155: true },
    infoUrl: 'https://neonevm.org',
    parent: { type: 'L2', chain: 'solana' },
  },
];

export default MAINNET_CHAINS;
