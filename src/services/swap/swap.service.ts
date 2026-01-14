/**
 * Swap Service for ONE Engine
 * Token swaps and cross-chain bridges via Thirdweb Universal Bridge
 */

import { createThirdwebClient } from 'thirdweb';
import * as Bridge from 'thirdweb/bridge';
import { getContract, sendTransaction } from 'thirdweb';
import { env } from '@/config/env';
import { getChain, getNativeSymbol } from '@/config/chains';
import { LogService } from '@/lib/logger';
import type { SwapQuote, SwapRequest, TokenInfo } from '@/types';

const log = new LogService({ service: 'SwapService' });

export interface QuoteParams {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number;
  sender?: string;
  recipient?: string;
}

export interface SwapResult {
  transactionHash: string;
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  status: 'pending' | 'completed' | 'failed';
}

export class SwapService {
  private client;

  constructor() {
    this.client = createThirdwebClient({
      clientId: env.THIRDWEB_CLIENT_ID,
      secretKey: env.THIRDWEB_SECRET_KEY,
    });
  }

  /**
   * Get a swap quote
   */
  async getQuote(params: QuoteParams): Promise<SwapQuote> {
    const fromChain = getChain(params.fromChainId);
    const toChain = getChain(params.toChainId);

    if (!fromChain || !toChain) {
      throw new Error('Unsupported chain');
    }

    log.info('Getting swap quote', {
      fromChain: params.fromChainId,
      toChain: params.toChainId,
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
    });

    try {
      // Use Thirdweb Bridge to get quote
      const quote: any = await Bridge.Buy.quote({
        client: this.client,
        originChainId: params.fromChainId,
        originTokenAddress: params.fromToken,
        destinationChainId: params.toChainId,
        destinationTokenAddress: params.toToken,
        amount: BigInt(params.amount),
      } as any);

      // Get token info
      const fromTokenInfo = await this.getTokenInfo(params.fromToken, params.fromChainId);
      const toTokenInfo = await this.getTokenInfo(params.toToken, params.toChainId);

      // Calculate exchange rate and price impact
      const fromAmount = parseFloat(params.amount) / Math.pow(10, fromTokenInfo.decimals);
      const toAmount = parseFloat((quote.destinationAmount || quote.toAmount || params.amount).toString()) / Math.pow(10, toTokenInfo.decimals);
      const exchangeRate = toAmount / fromAmount;

      return {
        fromToken: fromTokenInfo,
        toToken: toTokenInfo,
        fromAmount: params.amount,
        toAmount: (quote.destinationAmount || quote.toAmount || params.amount).toString(),
        exchangeRate,
        priceImpact: 0, // Would need price oracle to calculate
        estimatedGas: (quote.estimatedGasLimit || quote.gas || '0').toString(),
        route: (quote.steps || []).map((step: any) => ({
          protocol: step.protocol || 'unknown',
          percent: 100,
          path: [params.fromToken, params.toToken],
        })),
        expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 minute expiry
      };
    } catch (error) {
      log.error('Failed to get swap quote', error as Error);
      throw new Error(`Failed to get quote: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(
    quote: SwapQuote,
    account: any, // Smart account
    sender: string,
    recipient?: string
  ): Promise<SwapResult> {
    log.info('Executing swap', {
      fromToken: quote.fromToken.address,
      toToken: quote.toToken.address,
      amount: quote.fromAmount,
    });

    try {
      // Prepare the bridge/swap transaction
      const preparedTx: any = await Bridge.Buy.prepare({
        client: this.client,
        originChainId: quote.fromToken.chainId,
        originTokenAddress: quote.fromToken.address,
        destinationChainId: quote.toToken.chainId,
        destinationTokenAddress: quote.toToken.address,
        amount: BigInt(quote.toAmount),
        sender,
        receiver: recipient || sender,
      } as any);

      // Execute the transaction
      const result: any = await sendTransaction({
        account,
        transaction: preparedTx,
      } as any);

      log.info('Swap executed', { hash: result.transactionHash });

      return {
        transactionHash: result.transactionHash,
        fromChainId: quote.fromToken.chainId,
        toChainId: quote.toToken.chainId,
        fromToken: quote.fromToken.address,
        toToken: quote.toToken.address,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        status: 'pending',
      };
    } catch (error) {
      log.error('Swap execution failed', error as Error);
      throw new Error(`Swap failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get supported tokens for a chain
   */
  async getSupportedTokens(chainId: number): Promise<TokenInfo[]> {
    // In production, fetch from Thirdweb's token list or your own list
    const tokens: Record<number, TokenInfo[]> = {
      8453: [ // Base
        { address: '0x0000000000000000000000000000000000000000', chainId: 8453, symbol: 'ETH', name: 'Ethereum', decimals: 18 },
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: 8453, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', chainId: 8453, symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
      ],
      42161: [ // Arbitrum
        { address: '0x0000000000000000000000000000000000000000', chainId: 42161, symbol: 'ETH', name: 'Ethereum', decimals: 18 },
        { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', chainId: 42161, symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      ],
      1: [ // Ethereum
        { address: '0x0000000000000000000000000000000000000000', chainId: 1, symbol: 'ETH', name: 'Ethereum', decimals: 18 },
        { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 1, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', chainId: 1, symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      ],
      137: [ // Polygon
        { address: '0x0000000000000000000000000000000000000000', chainId: 137, symbol: 'MATIC', name: 'Polygon', decimals: 18 },
        { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', chainId: 137, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      ],
    };

    return tokens[chainId] || [];
  }

  /**
   * Check swap status
   */
  async getSwapStatus(transactionHash: string, chainId: number): Promise<{
    status: 'pending' | 'completed' | 'failed';
    blockNumber?: number;
    timestamp?: string;
  }> {
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    try {
      const result: any = await Bridge.status({
        client: this.client,
        transactionHash: transactionHash as `0x${string}`,
        chainId,
      } as any);

      return {
        status: result.status === 'COMPLETED' ? 'completed' :
               result.status === 'FAILED' ? 'failed' : 'pending',
        blockNumber: result.blockNumber,
        timestamp: result.timestamp,
      };
    } catch (error) {
      // If we can't get status, assume still pending
      return { status: 'pending' };
    }
  }

  /**
   * Get token info
   */
  private async getTokenInfo(address: string, chainId: number): Promise<TokenInfo> {
    // Check if native token
    if (address === '0x0000000000000000000000000000000000000000' ||
        address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      const nativeSymbol = getNativeSymbol(chainId);
      return {
        address,
        chainId,
        symbol: nativeSymbol || 'ETH',
        name: 'Native Token',
        decimals: 18,
      };
    }

    // For ERC20 tokens, fetch metadata
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const contract = getContract({
      client: this.client,
      chain,
      address,
    });

    // Fetch token metadata (simplified - add proper ABI in production)
    return {
      address,
      chainId,
      symbol: 'TOKEN',
      name: 'Token',
      decimals: 18,
    };
  }
}

export const swapService = new SwapService();
