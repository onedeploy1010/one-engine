/**
 * Forex Module Stats API
 * GET /api/v1/forex/stats - Get forex module statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { forexService } from '@/services/forex/forex.service';
import { apiResponse, apiError } from '@/lib/api-response';
import { FOREX_PAIRS, FOREX_CYCLE_OPTIONS, FOREX_AGENT_CONFIG } from '@/types/forex';

export async function GET(_request: NextRequest) {
  try {
    const stats = await forexService.getModuleStats();

    return NextResponse.json(
      apiResponse({
        stats,
        agent: FOREX_AGENT_CONFIG,
        supportedPairs: FOREX_PAIRS.filter(p => p.isActive).length,
        cycleOptions: FOREX_CYCLE_OPTIONS,
      }),
    );
  } catch (error) {
    console.error('Get forex stats error:', error);
    return NextResponse.json(
      apiError('E8007', 'Failed to fetch forex stats', (error as Error).message),
      { status: 500 },
    );
  }
}
