/**
 * Forex Currency Pairs API
 * GET /api/v1/forex/pairs - Get supported USDC stablecoin pairs
 */

import { NextRequest, NextResponse } from 'next/server';
import { forexService } from '@/services/forex/forex.service';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(_request: NextRequest) {
  try {
    const pairs = forexService.getPairs();

    return NextResponse.json(
      apiResponse({
        pairs,
        total: pairs.length,
      }),
    );
  } catch (error) {
    console.error('Get forex pairs error:', error);
    return NextResponse.json(
      apiError('E8001', 'Failed to fetch forex pairs', (error as Error).message),
      { status: 500 },
    );
  }
}
