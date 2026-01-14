/**
 * Fiat Offramp Endpoint
 * GET /api/v1/fiat/offramp - Get offramp configuration
 * POST /api/v1/fiat/offramp - Create offramp session
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { env } from '@/config/env';

const createOfframpSchema = z.object({
  cryptoCurrency: z.string().min(1),
  fiatCurrency: z.string().min(3).max(3),
  cryptoAmount: z.string(),
  walletAddress: z.string(),
  chainId: z.number(),
  payoutMethod: z.enum(['bank_transfer', 'card', 'paypal']).optional(),
  bankDetails: z.object({
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    iban: z.string().optional(),
    swift: z.string().optional(),
  }).optional(),
});

// Supported cryptocurrencies for offramp
const SUPPORTED_CRYPTO = ['ETH', 'USDC', 'USDT', 'DAI', 'BTC'];

// Supported fiat currencies
const SUPPORTED_FIAT = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'HKD'];

// Supported payout methods by region
const PAYOUT_METHODS = {
  US: ['bank_transfer', 'card'],
  EU: ['bank_transfer', 'card', 'paypal'],
  UK: ['bank_transfer', 'card', 'paypal'],
  DEFAULT: ['bank_transfer'],
};

/**
 * Get offramp configuration and supported options
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || 'US';

    return success({
      supportedCryptoCurrencies: SUPPORTED_CRYPTO,
      supportedFiatCurrencies: SUPPORTED_FIAT,
      payoutMethods: PAYOUT_METHODS[country as keyof typeof PAYOUT_METHODS] || PAYOUT_METHODS.DEFAULT,
      limits: {
        min: 50,    // Minimum $50
        max: 50000, // Maximum $50,000
        daily: 10000,
        monthly: 50000,
      },
      fees: {
        percentage: 1.5,      // 1.5% fee
        minimum: 2.99,        // Minimum $2.99
        networkFee: 'varies', // Network fee varies
      },
      processingTime: {
        bankTransfer: '1-3 business days',
        card: 'Instant to 24 hours',
        paypal: 'Instant to 24 hours',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to get offramp configuration');
  }
}

/**
 * Create an offramp session to sell crypto for fiat
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, createOfframpSchema);

    // Validate crypto currency
    if (!SUPPORTED_CRYPTO.includes(body.cryptoCurrency.toUpperCase())) {
      return errors.badRequest(`Unsupported cryptocurrency: ${body.cryptoCurrency}`);
    }

    // Validate fiat currency
    if (!SUPPORTED_FIAT.includes(body.fiatCurrency.toUpperCase())) {
      return errors.badRequest(`Unsupported fiat currency: ${body.fiatCurrency}`);
    }

    const supabase = getSupabaseAdmin() as any;

    // Create offramp transaction record
    const { data: transaction, error: insertError } = await supabase
      .from('fiat_transactions')
      .insert({
        user_id: auth.userId,
        type: 'offramp',
        crypto_currency: body.cryptoCurrency.toUpperCase(),
        fiat_currency: body.fiatCurrency.toUpperCase(),
        crypto_amount: body.cryptoAmount,
        wallet_address: body.walletAddress,
        chain_id: body.chainId,
        payout_method: body.payoutMethod || 'bank_transfer',
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return errors.internal('Failed to create offramp transaction');
    }

    // In production, integrate with Onramper or similar service
    // For now, return a mock session
    const sessionId = transaction.id;

    // Calculate estimated fiat amount (simplified)
    // In production, fetch real exchange rates
    const mockExchangeRates: Record<string, number> = {
      ETH: 3500,
      USDC: 1,
      USDT: 1,
      DAI: 1,
      BTC: 95000,
    };

    const rate = mockExchangeRates[body.cryptoCurrency.toUpperCase()] || 1;
    const cryptoAmount = parseFloat(body.cryptoAmount);
    const fiatAmount = cryptoAmount * rate;
    const fee = Math.max(fiatAmount * 0.015, 2.99);
    const netAmount = fiatAmount - fee;

    // Update transaction with calculated amounts
    await supabase
      .from('fiat_transactions')
      .update({
        fiat_amount: netAmount.toFixed(2),
        fee_amount: fee.toFixed(2),
        exchange_rate: rate,
      })
      .eq('id', sessionId);

    return success({
      session: {
        id: sessionId,
        status: 'pending',
        cryptoCurrency: body.cryptoCurrency.toUpperCase(),
        cryptoAmount: body.cryptoAmount,
        fiatCurrency: body.fiatCurrency.toUpperCase(),
        estimatedFiatAmount: netAmount.toFixed(2),
        fee: fee.toFixed(2),
        exchangeRate: rate,
        payoutMethod: body.payoutMethod || 'bank_transfer',
        depositAddress: generateDepositAddress(body.chainId),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
      },
      instructions: {
        step1: `Send ${body.cryptoAmount} ${body.cryptoCurrency} to the deposit address`,
        step2: 'Wait for blockchain confirmation',
        step3: `Receive ${body.fiatCurrency} ${netAmount.toFixed(2)} via ${body.payoutMethod || 'bank transfer'}`,
      },
      message: 'Offramp session created successfully',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create offramp session');
  }
}

/**
 * Generate a deposit address for offramp
 * In production, this would create a unique address per transaction
 */
function generateDepositAddress(chainId: number): string {
  // Mock addresses per chain - in production use actual deposit addresses
  const depositAddresses: Record<number, string> = {
    1: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3',    // Ethereum
    8453: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3', // Base
    42161: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3', // Arbitrum
    137: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3',  // Polygon
  };

  return depositAddresses[chainId] || depositAddresses[1];
}
