/**
 * Fiat Service for ONE Engine
 * On/Off ramp via Onramper integration
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { env } from '@/config/env';
import { LogService } from '@/lib/logger';
import type { FiatTransaction, FiatStatus } from '@/types';

const log = new LogService({ service: 'FiatService' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface OnrampParams {
  userId: string;
  projectId?: string;
  fiatCurrency: string;
  fiatAmount: number;
  cryptoCurrency: string;
  walletAddress: string;
  chainId: number;
}

export interface OfframpParams {
  userId: string;
  projectId?: string;
  cryptoCurrency: string;
  cryptoAmount: string;
  fiatCurrency: string;
  walletAddress: string;
  chainId: number;
  bankDetails?: Record<string, unknown>;
}

export interface OnramperWidget {
  widgetUrl: string;
  sessionId: string;
  expiresAt: string;
}

export class FiatService {
  private onramperApiKey = env.ONRAMPER_API_KEY;
  private baseUrl = 'https://api.onramper.com';

  /**
   * Generate Onramper widget URL for onramp
   */
  async createOnrampSession(params: OnrampParams): Promise<OnramperWidget> {
    log.info('Creating onramp session', {
      userId: params.userId,
      fiatCurrency: params.fiatCurrency,
      cryptoCurrency: params.cryptoCurrency,
    });

    // Create transaction record
    const insertData = {
      user_id: params.userId,
      project_id: params.projectId,
      type: 'onramp',
      fiat_currency: params.fiatCurrency.toUpperCase(),
      fiat_amount: params.fiatAmount,
      crypto_currency: params.cryptoCurrency.toUpperCase(),
      crypto_amount: '0', // Will be updated after completion
      status: 'pending',
      provider: 'onramper',
      wallet_address: params.walletAddress,
      chain_id: params.chainId,
    };

    const { data: transaction, error } = await db()
      .from('fiat_transactions')
      .insert(insertData as any)
      .select()
      .single();

    if (error || !transaction) {
      log.error('Failed to create fiat transaction', error);
      throw new Error('Failed to create transaction');
    }

    // Build Onramper widget URL
    const widgetParams = new URLSearchParams({
      apiKey: this.onramperApiKey,
      defaultCrypto: params.cryptoCurrency.toUpperCase(),
      defaultFiat: params.fiatCurrency.toUpperCase(),
      defaultAmount: params.fiatAmount.toString(),
      wallets: `${params.cryptoCurrency.toUpperCase()}:${params.walletAddress}`,
      onlyOneCrypto: 'true',
      onlyOneFiat: 'true',
      partnerContext: transaction.id,
      themeName: 'dark',
    });

    const widgetUrl = `https://buy.onramper.com?${widgetParams.toString()}`;

    return {
      widgetUrl,
      sessionId: transaction.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
    };
  }

  /**
   * Handle Onramper webhook
   */
  async handleWebhook(payload: {
    eventType: string;
    transactionId: string;
    status: string;
    cryptoAmount?: string;
    txHash?: string;
    partnerContext?: string;
  }): Promise<void> {
    log.info('Processing Onramper webhook', { eventType: payload.eventType });

    const transactionId = payload.partnerContext;
    if (!transactionId) {
      log.warn('No transaction ID in webhook');
      return;
    }

    let status: FiatStatus = 'pending';
    switch (payload.status) {
      case 'pending':
        status = 'processing';
        break;
      case 'completed':
        status = 'completed';
        break;
      case 'failed':
        status = 'failed';
        break;
      case 'refunded':
        status = 'refunded';
        break;
    }

    const updates: Record<string, unknown> = { status };
    if (payload.cryptoAmount) {
      updates.crypto_amount = payload.cryptoAmount;
    }
    if (payload.txHash) {
      updates.tx_hash = payload.txHash;
    }
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    await db()
      .from('fiat_transactions')
      .update(updates)
      .eq('id', transactionId);

    log.info('Updated fiat transaction', { transactionId, status });
  }

  /**
   * Get supported fiat currencies
   */
  async getSupportedFiatCurrencies(): Promise<string[]> {
    // From Onramper API or cached list
    return [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'HKD', 'JPY', 'CHF', 'NZD',
      'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'TRY', 'ZAR',
      'MXN', 'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'INR', 'PHP', 'IDR', 'THB',
      'MYR', 'VND', 'KRW', 'TWD', 'AED', 'SAR', 'ILS', 'NGN', 'KES', 'GHS',
    ];
  }

  /**
   * Get supported crypto currencies for fiat
   */
  async getSupportedCryptoCurrencies(): Promise<Array<{
    symbol: string;
    name: string;
    chains: number[];
  }>> {
    return [
      { symbol: 'ETH', name: 'Ethereum', chains: [1, 8453, 42161, 10] },
      { symbol: 'USDC', name: 'USD Coin', chains: [1, 8453, 42161, 137] },
      { symbol: 'USDT', name: 'Tether USD', chains: [1, 42161, 137, 56] },
      { symbol: 'BTC', name: 'Bitcoin', chains: [] },
      { symbol: 'MATIC', name: 'Polygon', chains: [137] },
      { symbol: 'BNB', name: 'BNB', chains: [56] },
    ];
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<FiatTransaction | null> {
    const { data, error } = await db()
      .from('fiat_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error || !data) return null;

    return this.mapToTransaction(data);
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(
    userId: string,
    filters?: {
      type?: 'onramp' | 'offramp';
      status?: FiatStatus;
      limit?: number;
    }
  ): Promise<FiatTransaction[]> {
    let query = db()
      .from('fiat_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return data.map(row => this.mapToTransaction(row));
  }

  /**
   * Map database row to FiatTransaction
   */
  private mapToTransaction(row: any): FiatTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      fiatCurrency: row.fiat_currency,
      fiatAmount: row.fiat_amount,
      cryptoCurrency: row.crypto_currency,
      cryptoAmount: row.crypto_amount,
      status: row.status,
      provider: row.provider,
      externalId: row.external_id,
      walletAddress: row.wallet_address,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }
}

export const fiatService = new FiatService();
