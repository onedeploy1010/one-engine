/**
 * Forex Liquidity Pools API
 * GET /api/v1/forex/pools - Get pool status (clearing/hedging/insurance)
 */

import { NextRequest, NextResponse } from 'next/server';
import { forexService } from '@/services/forex/forex.service';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(_request: NextRequest) {
  try {
    const pools = await forexService.getPools();
    const totalSize = pools.reduce((sum, p) => sum + p.totalSize, 0);

    return NextResponse.json(
      apiResponse({
        pools,
        totalSize,
      }),
    );
  } catch (error) {
    console.error('Get forex pools error:', error);
    return NextResponse.json(
      apiError('E8002', 'Failed to fetch forex pools', (error as Error).message),
      { status: 500 },
    );
  }
}
