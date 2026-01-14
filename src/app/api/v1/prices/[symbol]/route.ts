/**
 * Single Symbol Price API
 * GET /api/v1/prices/[symbol] - Get price for a single symbol
 * GET /api/v1/prices/[symbol]?candles=true - Get OHLCV candles
 */

import { NextRequest, NextResponse } from 'next/server';
import { priceService } from '@/services/price/price.service';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params;
    const { searchParams } = new URL(request.url);
    const candles = searchParams.get('candles') === 'true';
    const interval = (searchParams.get('interval') || '1h') as '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get OHLCV candles
    if (candles) {
      const candleData = await priceService.getCandlesFromBinance(symbol, interval, limit);
      return NextResponse.json(apiResponse({
        symbol: symbol.toUpperCase(),
        interval,
        candles: candleData,
      }));
    }

    // Get current price
    const price = await priceService.getPrice(symbol);

    if (!price) {
      return NextResponse.json(
        apiError('E7002', 'Price not found for symbol', { symbol }),
        { status: 404 }
      );
    }

    return NextResponse.json(apiResponse({ price }));
  } catch (error) {
    console.error('Price API error:', error);
    return NextResponse.json(
      apiError('E7001', 'Failed to fetch price', (error as Error).message),
      { status: 500 }
    );
  }
}
