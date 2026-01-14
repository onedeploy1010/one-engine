/**
 * Price Refresh Cron Endpoint
 * POST /api/v1/cron/refresh-prices
 *
 * Called every minute to update token prices in the database
 * This keeps wallet asset values in sync with real market prices
 */

import { NextRequest, NextResponse } from 'next/server';
import { priceService, PriceData } from '@/services/price/price.service';
import { createClient } from '@supabase/supabase-js';
import { apiResponse, apiError } from '@/lib/api-response';

// Supabase client for database updates
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Tokens to track prices for
const TRACKED_TOKENS = [
  'BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'XRP', 'DOGE',
  'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC',
  'ARB', 'OP', 'WBTC', 'WETH'
];

// Verify cron secret to prevent unauthorized calls
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return cronSecret === expectedSecret;
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        apiError('E4010', 'Unauthorized cron request'),
        { status: 401 }
      );
    }

    console.log('[Cron] Starting price refresh...');

    // Fetch latest prices
    const prices = await priceService.getPrices(TRACKED_TOKENS, false);

    if (prices.length === 0) {
      console.warn('[Cron] No prices fetched');
      return NextResponse.json(
        apiError('E5001', 'Failed to fetch prices'),
        { status: 500 }
      );
    }

    console.log(`[Cron] Fetched ${prices.length} token prices`);

    // Update database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert token prices
    const priceRecords = prices.map((p: PriceData) => ({
      token_symbol: p.symbol,
      price_usd: p.price,
      price_change_24h: p.changePercent24h || 0,
      market_cap: p.marketCap || 0,
      volume_24h: p.volume24h || 0,
      last_updated_at: new Date().toISOString(),
    }));

    const { error: priceError } = await supabase
      .from('token_prices')
      .upsert(priceRecords, { onConflict: 'token_symbol' });

    if (priceError) {
      console.error('[Cron] Failed to update token_prices:', priceError);
      // Continue anyway to update wallet_assets
    } else {
      console.log(`[Cron] Updated ${priceRecords.length} token prices in database`);
    }

    // Update wallet_assets with new prices
    // This updates value_usd = balance_formatted * price_usd
    const { error: assetError } = await supabase.rpc('update_wallet_asset_values');

    if (assetError) {
      console.error('[Cron] Failed to update wallet_assets:', assetError);
    } else {
      console.log('[Cron] Updated wallet asset values');
    }

    // Return summary
    const summary = {
      tokensUpdated: prices.length,
      prices: prices.map(p => ({
        symbol: p.symbol,
        price: p.price,
        change24h: p.changePercent24h
      })),
      timestamp: new Date().toISOString()
    };

    console.log('[Cron] Price refresh completed successfully');

    return NextResponse.json(apiResponse({
      success: true,
      message: 'Prices refreshed successfully',
      ...summary
    }));

  } catch (error) {
    console.error('[Cron] Price refresh error:', error);
    return NextResponse.json(
      apiError('E5000', 'Price refresh failed', (error as Error).message),
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
