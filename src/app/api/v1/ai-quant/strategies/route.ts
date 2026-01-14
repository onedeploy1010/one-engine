/**
 * AI Quant Strategies API
 * GET /api/v1/ai-quant/strategies - Get all strategies
 * GET /api/v1/ai-quant/strategies/[id] - Get strategy by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiQuantService } from '@/services/quant/ai-quant.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as any;
    const riskLevel = searchParams.get('risk_level');
    const minTvl = searchParams.get('min_tvl');
    const isActive = searchParams.get('is_active');

    const strategies = await aiQuantService.getStrategies({
      category: category || undefined,
      riskLevel: riskLevel ? parseInt(riskLevel) : undefined,
      minTvl: minTvl ? parseFloat(minTvl) : undefined,
      isActive: isActive !== null ? isActive === 'true' : undefined,
    });

    return NextResponse.json(apiResponse({ strategies }));
  } catch (error) {
    console.error('Get strategies error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to fetch strategies', (error as Error).message),
      { status: 500 }
    );
  }
}
