/**
 * Asset Service for ONE Engine
 * Handles balance fetching, NFTs, and portfolio management via Thirdweb
 * Leverages smart contract capabilities for real-time on-chain data
 */

import { createThirdwebClient } from 'thirdweb';
import { getWalletBalance } from 'thirdweb/wallets';
import { getContract, readContract } from 'thirdweb';
import { getOwnedNFTs } from 'thirdweb/extensions/erc721';
import { balanceOf as erc1155BalanceOf } from 'thirdweb/extensions/erc1155';
import { env } from '@/config/env';
import { getChain, getAllChainIds, getChainName, getNativeSymbol } from '@/config/chains';
import { LogService } from '@/lib/logger';
import { priceService, PriceData } from '@/services/price/price.service';
import type { WalletBalance, TokenBalance } from '@/types';

const log = new LogService({ service: 'AssetService' });

// Common ERC20 ABI for balance and metadata
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
] as const;

// Token logo base URLs
const TOKEN_LOGO_BASE = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const COINGECKO_LOGO_BASE = 'https://assets.coingecko.com/coins/images';

// Comprehensive token list with logos
const POPULAR_TOKENS: Record<number, Array<{
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri: string;
  coingeckoId?: string;
}>> = {
  1: [ // Ethereum Mainnet
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png`, coingeckoId: 'tether' },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`, coingeckoId: 'usd-coin' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png`, coingeckoId: 'dai' },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png`, coingeckoId: 'wrapped-bitcoin' },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png`, coingeckoId: 'chainlink' },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png`, coingeckoId: 'uniswap' },
    { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE', name: 'Aave', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png`, coingeckoId: 'aave' },
  ],
  8453: [ // Base
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png`, coingeckoId: 'usd-coin' },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/base/assets/0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb/logo.png`, coingeckoId: 'dai' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png`, coingeckoId: 'weth' },
  ],
  42161: [ // Arbitrum
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/arbitrum/assets/0xaf88d065e77c8cC2239327C5EDb3A432268e5831/logo.png`, coingeckoId: 'usd-coin' },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/arbitrum/assets/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9/logo.png`, coingeckoId: 'tether' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/arbitrum/assets/0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1/logo.png`, coingeckoId: 'dai' },
    { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', symbol: 'ARB', name: 'Arbitrum', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png`, coingeckoId: 'arbitrum' },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png`, coingeckoId: 'weth' },
  ],
  137: [ // Polygon
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/polygon/assets/0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359/logo.png`, coingeckoId: 'usd-coin' },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/polygon/assets/0xc2132D05D31c914a87C6611C10748AEb04B58e8F/logo.png`, coingeckoId: 'tether' },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/polygon/assets/0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063/logo.png`, coingeckoId: 'dai' },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png`, coingeckoId: 'weth' },
    { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, logoUri: `${TOKEN_LOGO_BASE}/polygon/assets/0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6/logo.png`, coingeckoId: 'wrapped-bitcoin' },
  ],
  56: [ // BSC
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png`, coingeckoId: 'tether' },
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', name: 'USD Coin', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/smartchain/assets/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/logo.png`, coingeckoId: 'usd-coin' },
    { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', name: 'Ethereum', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/smartchain/assets/0x2170Ed0880ac9A755fd29B2688956BD959F933F8/logo.png`, coingeckoId: 'ethereum' },
    { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', symbol: 'BTCB', name: 'Bitcoin BEP2', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/smartchain/assets/0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c/logo.png`, coingeckoId: 'bitcoin' },
  ],
  10: [ // Optimism
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/optimism/assets/0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85/logo.png`, coingeckoId: 'usd-coin' },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/optimism/assets/0x94b008aA00579c1307B0EF2c499aD98a8ce58e58/logo.png`, coingeckoId: 'tether' },
    { address: '0x4200000000000000000000000000000000000042', symbol: 'OP', name: 'Optimism', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/optimism/assets/0x4200000000000000000000000000000000000042/logo.png`, coingeckoId: 'optimism' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png`, coingeckoId: 'weth' },
  ],
  43114: [ // Avalanche
    { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/avalanchec/assets/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/logo.png`, coingeckoId: 'usd-coin' },
    { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoUri: `${TOKEN_LOGO_BASE}/avalanchec/assets/0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7/logo.png`, coingeckoId: 'tether' },
    { address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', symbol: 'WETH.e', name: 'Wrapped Ether', decimals: 18, logoUri: `${TOKEN_LOGO_BASE}/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png`, coingeckoId: 'weth' },
  ],
};

// Native token logos
const NATIVE_LOGOS: Record<number, string> = {
  1: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  8453: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  42161: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  10: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  137: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  56: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  43114: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
};

// NFT Contract addresses for popular collections
const NFT_CONTRACTS: Record<number, string[]> = {
  1: [], // Ethereum NFTs
  8453: [], // Base NFTs
  137: [], // Polygon NFTs
};

export interface NFTAsset {
  contractAddress: string;
  tokenId: string;
  name: string;
  description?: string;
  image?: string;
  chainId: number;
  tokenType: 'ERC721' | 'ERC1155';
  attributes?: Array<{ trait_type: string; value: string }>;
  collection?: { name: string; symbol: string };
}

export interface EnhancedTokenBalance extends TokenBalance {
  logoUri: string;
  priceChange24h: number;
  chainId: number;
}

export interface EnhancedWalletBalance extends WalletBalance {
  native: {
    symbol: string;
    balance: string;
    balanceFormatted: string;
    valueUsd: number;
    logoUri: string;
    priceChange24h: number;
  };
  tokens: EnhancedTokenBalance[];
  nfts?: NFTAsset[];
}

export class AssetService {
  private client;
  private priceCache: Map<string, { data: PriceData; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 30000; // 30 seconds

  constructor() {
    this.client = createThirdwebClient({
      clientId: env.THIRDWEB_CLIENT_ID,
      secretKey: env.THIRDWEB_SECRET_KEY,
    });
  }

  /**
   * Get native balance for an address on a specific chain with enhanced data
   */
  async getNativeBalance(address: string, chainId: number): Promise<{
    symbol: string;
    balance: string;
    balanceFormatted: string;
    valueUsd: number;
    logoUri: string;
    priceChange24h: number;
  }> {
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const nativeSymbol = getNativeSymbol(chainId) || 'ETH';
    const balance = await getWalletBalance({
      address,
      client: this.client,
      chain,
    });

    // Get price with 24h change
    const priceData = await this.getTokenPriceData(nativeSymbol);
    const priceUsd = priceData?.price || 0;
    const priceChange24h = priceData?.changePercent24h || 0;

    return {
      symbol: nativeSymbol,
      balance: balance.value.toString(),
      balanceFormatted: balance.displayValue,
      valueUsd: parseFloat(balance.displayValue) * priceUsd,
      logoUri: NATIVE_LOGOS[chainId] || NATIVE_LOGOS[1],
      priceChange24h,
    };
  }

  /**
   * Get ERC20 token balance with enhanced metadata
   */
  async getTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    chainId: number,
    tokenInfo?: { symbol: string; name: string; decimals: number; logoUri: string }
  ): Promise<EnhancedTokenBalance> {
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const contract = getContract({
      client: this.client,
      chain,
      address: tokenAddress,
      abi: ERC20_ABI,
    });

    let balance: bigint;
    let decimals: number;
    let symbol: string;
    let name: string;

    if (tokenInfo) {
      // Use provided token info for optimization
      balance = await readContract({ contract, method: 'balanceOf', params: [walletAddress] });
      decimals = tokenInfo.decimals;
      symbol = tokenInfo.symbol;
      name = tokenInfo.name;
    } else {
      // Fetch all metadata from contract
      const results = await Promise.all([
        readContract({ contract, method: 'balanceOf', params: [walletAddress] }),
        readContract({ contract, method: 'decimals', params: [] }),
        readContract({ contract, method: 'symbol', params: [] }),
        readContract({ contract, method: 'name', params: [] }),
      ]);
      balance = results[0];
      decimals = Number(results[1]);
      symbol = results[2] as string;
      name = results[3] as string;
    }

    const balanceFormatted = this.formatBalance(balance.toString(), decimals);
    const priceData = await this.getTokenPriceData(symbol);
    const priceUsd = priceData?.price || 0;
    const priceChange24h = priceData?.changePercent24h || 0;

    return {
      address: tokenAddress,
      symbol,
      name,
      decimals,
      balance: balance.toString(),
      balanceFormatted,
      priceUsd,
      valueUsd: parseFloat(balanceFormatted) * priceUsd,
      logoUri: tokenInfo?.logoUri || this.getTokenLogoUri(symbol, chainId),
      priceChange24h,
      chainId,
    };
  }

  /**
   * Get all balances for an address on a chain with NFTs
   */
  async getBalances(address: string, chainId: number, includeNFTs = false): Promise<EnhancedWalletBalance> {
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    // Get native balance
    const native = await this.getNativeBalance(address, chainId);

    // Get popular token balances with optimization
    const popularTokens = POPULAR_TOKENS[chainId] || [];
    const tokenPromises = popularTokens.map(async (token) => {
      try {
        return await this.getTokenBalance(address, token.address, chainId, {
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoUri: token.logoUri,
        });
      } catch (error) {
        return null;
      }
    });

    const tokenResults = await Promise.all(tokenPromises);
    const tokens = tokenResults.filter((t): t is EnhancedTokenBalance =>
      t !== null && parseFloat(t.balanceFormatted) > 0
    );

    // Optionally fetch NFTs
    let nfts: NFTAsset[] | undefined;
    if (includeNFTs) {
      nfts = await this.getNFTsForChain(address, chainId);
    }

    const totalValueUsd = native.valueUsd + tokens.reduce((sum, t) => sum + t.valueUsd, 0);

    return {
      chainId,
      address,
      native,
      tokens,
      nfts,
      totalValueUsd,
    };
  }

  /**
   * Get NFTs owned by address on a specific chain
   */
  async getNFTsForChain(address: string, chainId: number): Promise<NFTAsset[]> {
    const chain = getChain(chainId);
    if (!chain) return [];

    const nfts: NFTAsset[] = [];
    const nftContracts = NFT_CONTRACTS[chainId] || [];

    for (const contractAddress of nftContracts) {
      try {
        const contract = getContract({
          client: this.client,
          chain,
          address: contractAddress,
        });

        const ownedNFTs = await getOwnedNFTs({
          contract,
          owner: address,
        });

        for (const nft of ownedNFTs) {
          nfts.push({
            contractAddress,
            tokenId: nft.id.toString(),
            name: nft.metadata?.name || `NFT #${nft.id}`,
            description: nft.metadata?.description,
            image: nft.metadata?.image,
            chainId,
            tokenType: 'ERC721',
            attributes: nft.metadata?.attributes as any,
          });
        }
      } catch (error) {
        log.warn(`Failed to fetch NFTs from ${contractAddress}`, { error, chainId });
      }
    }

    return nfts;
  }

  /**
   * Get balances across multiple chains (optimized parallel fetching)
   */
  async getMultiChainBalances(
    address: string,
    chainIds?: number[],
    includeNFTs = false
  ): Promise<EnhancedWalletBalance[]> {
    // Default to popular chains for faster response
    const defaultChains = [8453, 42161, 137, 10, 1]; // Base, Arbitrum, Polygon, Optimism, Ethereum
    const chains = chainIds || defaultChains;

    // Pre-fetch all prices in batch for optimization
    const allSymbols = new Set<string>();
    for (const chainId of chains) {
      const nativeSymbol = getNativeSymbol(chainId);
      if (nativeSymbol) allSymbols.add(nativeSymbol);

      const tokens = POPULAR_TOKENS[chainId] || [];
      tokens.forEach(t => allSymbols.add(t.symbol));
    }

    await this.prefetchPrices(Array.from(allSymbols));

    // Fetch balances in parallel
    const balancePromises = chains.map(async (chainId) => {
      try {
        return await this.getBalances(address, chainId, includeNFTs);
      } catch (error) {
        log.error('Failed to get balance for chain', error as Error, { chainId, address });
        return null;
      }
    });

    const results = await Promise.all(balancePromises);
    return results.filter((b): b is EnhancedWalletBalance => b !== null);
  }

  /**
   * Get complete portfolio with breakdown and NFTs
   */
  async getPortfolio(address: string, includeNFTs = false): Promise<{
    totalValueUsd: number;
    totalChange24h: number;
    balances: EnhancedWalletBalance[];
    breakdown: {
      chainId: number;
      chainName: string;
      valueUsd: number;
      percentage: number;
    }[];
    topAssets: {
      symbol: string;
      valueUsd: number;
      percentage: number;
      logoUri: string;
    }[];
    nftCount: number;
  }> {
    const balances = await this.getMultiChainBalances(address, undefined, includeNFTs);
    const totalValueUsd = balances.reduce((sum, b) => sum + b.totalValueUsd, 0);

    // Calculate weighted 24h change
    let totalChange24h = 0;
    const allAssets: { symbol: string; valueUsd: number; priceChange24h: number; logoUri: string }[] = [];

    for (const balance of balances) {
      // Native token
      if (balance.native.valueUsd > 0) {
        totalChange24h += (balance.native.priceChange24h * balance.native.valueUsd);
        allAssets.push({
          symbol: balance.native.symbol,
          valueUsd: balance.native.valueUsd,
          priceChange24h: balance.native.priceChange24h,
          logoUri: balance.native.logoUri,
        });
      }

      // ERC20 tokens
      for (const token of balance.tokens) {
        if (token.valueUsd > 0) {
          totalChange24h += (token.priceChange24h * token.valueUsd);
          allAssets.push({
            symbol: token.symbol,
            valueUsd: token.valueUsd,
            priceChange24h: token.priceChange24h,
            logoUri: token.logoUri,
          });
        }
      }
    }

    totalChange24h = totalValueUsd > 0 ? totalChange24h / totalValueUsd : 0;

    // Sort assets by value
    allAssets.sort((a, b) => b.valueUsd - a.valueUsd);

    // Chain breakdown
    const breakdown = balances
      .filter(b => b.totalValueUsd > 0)
      .map(b => ({
        chainId: b.chainId,
        chainName: getChainName(b.chainId) || `Chain ${b.chainId}`,
        valueUsd: b.totalValueUsd,
        percentage: totalValueUsd > 0 ? (b.totalValueUsd / totalValueUsd) * 100 : 0,
      }))
      .sort((a, b) => b.valueUsd - a.valueUsd);

    // Top 5 assets
    const topAssets = allAssets.slice(0, 5).map(a => ({
      symbol: a.symbol,
      valueUsd: a.valueUsd,
      percentage: totalValueUsd > 0 ? (a.valueUsd / totalValueUsd) * 100 : 0,
      logoUri: a.logoUri,
    }));

    // Count NFTs
    const nftCount = balances.reduce((sum, b) => sum + (b.nfts?.length || 0), 0);

    return {
      totalValueUsd,
      totalChange24h,
      balances,
      breakdown,
      topAssets,
      nftCount,
    };
  }

  /**
   * Pre-fetch prices for optimization
   */
  private async prefetchPrices(symbols: string[]): Promise<void> {
    try {
      const prices = await priceService.getPrices(symbols);
      const now = Date.now();
      for (const price of prices) {
        this.priceCache.set(price.symbol.toUpperCase(), { data: price, timestamp: now });
      }
    } catch (error) {
      log.warn('Failed to prefetch prices', { error });
    }
  }

  /**
   * Get token price with 24h change data
   */
  private async getTokenPriceData(symbol: string): Promise<PriceData | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    const cached = this.priceCache.get(upperSymbol);
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached.data;
    }

    // Stablecoins
    const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX', 'LUSD'];
    if (stablecoins.includes(upperSymbol)) {
      return {
        symbol: upperSymbol,
        price: 1,
        change24h: 0,
        changePercent24h: 0,
        high24h: 1,
        low24h: 1,
        volume24h: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    try {
      const priceData = await priceService.getPrice(symbol);
      if (priceData) {
        this.priceCache.set(upperSymbol, { data: priceData, timestamp: Date.now() });
        return priceData;
      }
    } catch (error) {
      log.warn(`Failed to fetch price for ${symbol}`, { error });
    }

    return null;
  }

  /**
   * Get token logo URI
   */
  private getTokenLogoUri(symbol: string, chainId: number): string {
    const chainName = this.getChainNameForLogo(chainId);
    return `${TOKEN_LOGO_BASE}/${chainName}/info/logo.png`;
  }

  private getChainNameForLogo(chainId: number): string {
    const names: Record<number, string> = {
      1: 'ethereum',
      8453: 'base',
      42161: 'arbitrum',
      137: 'polygon',
      56: 'smartchain',
      10: 'optimism',
      43114: 'avalanchec',
    };
    return names[chainId] || 'ethereum';
  }

  /**
   * Format balance with decimals
   */
  private formatBalance(balance: string, decimals: number): string {
    const value = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;

    if (fractionalPart === BigInt(0)) {
      return integerPart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');

    return `${integerPart}.${trimmedFractional}`;
  }
}

export const assetService = new AssetService();
