/**
 * AI Quant Strategy Detail API
 * GET /api/v1/ai-quant/strategies/[id] - Get strategy details
 * GET /api/v1/ai-quant/strategies/[id]/performance - Get performance history
 * GET /api/v1/ai-quant/strategies/[id]/market - Get real-time market data
 * GET /api/v1/ai-quant/strategies/[id]/trades - Get trade history
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiQuantService } from '@/services/quant/ai-quant.service';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include')?.split(',') || [];

    const strategy = await aiQuantService.getStrategy(id);

    if (!strategy) {
      return NextResponse.json(
        apiError('E6002', 'Strategy not found'),
        { status: 404 }
      );
    }

    const response: any = { strategy };

    // Include performance history
    if (include.includes('performance')) {
      const days = parseInt(searchParams.get('days') || '30');
      response.performance = await aiQuantService.getStrategyPerformance(id, days);
    }

    // Include real-time market data
    if (include.includes('market')) {
      response.marketData = await aiQuantService.getStrategyMarketData(id);
    }

    // Include trade history
    if (include.includes('trades')) {
      const limit = parseInt(searchParams.get('limit') || '20');
      response.trades = await aiQuantService.getTradeHistory(id, limit);
    }

    return NextResponse.json(apiResponse(response));
  } catch (error) {
    console.error('Get strategy error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to fetch strategy', (error as Error).message),
      { status: 500 }
    );
  }
}
