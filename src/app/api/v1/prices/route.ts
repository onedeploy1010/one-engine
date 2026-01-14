/**
 * Price API - FREE cryptocurrency prices
 * GET /api/v1/prices - Get prices for symbols
 * GET /api/v1/prices/top - Get top coins by market cap
 * GET /api/v1/prices/overview - Get market overview
 */

import { NextRequest, NextResponse } from 'next/server';
import { priceService } from '@/services/price/price.service';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')?.split(',').filter(Boolean);
    const type = searchParams.get('type'); // 'top' or 'overview'

    // Market overview
    if (type === 'overview') {
      const overview = await priceService.getMarketOverview();
      return NextResponse.json(apiResponse({ overview }));
    }

    // Top coins
    if (type === 'top') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const topCoins = await priceService.getTopCoins(limit);
      return NextResponse.json(apiResponse({ prices: topCoins }));
    }

    // Specific symbols
    if (symbols && symbols.length > 0) {
      const prices = await priceService.getPrices(symbols);
      return NextResponse.json(apiResponse({ prices }));
    }

    // Default: return top 10 coins
    const defaultPrices = await priceService.getTopCoins(10);
    return NextResponse.json(apiResponse({ prices: defaultPrices }));
  } catch (error) {
    console.error('Price API error:', error);
    return NextResponse.json(
      apiError('E7001', 'Failed to fetch prices', (error as Error).message),
      { status: 500 }
    );
  }
}
