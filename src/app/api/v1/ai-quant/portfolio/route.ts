/**
 * AI Quant Portfolio API
 * GET /api/v1/ai-quant/portfolio - Get user's portfolio summary
 * GET /api/v1/ai-quant/portfolio/allocations - Get trade allocations
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiQuantService } from '@/services/quant/ai-quant.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        apiError('E1001', 'Unauthorized'),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include')?.split(',') || [];

    const portfolio = await aiQuantService.getPortfolioSummary(user.id);

    const response: any = { portfolio };

    // Include trade allocations
    if (include.includes('allocations')) {
      const limit = parseInt(searchParams.get('limit') || '50');
      response.allocations = await aiQuantService.getUserTradeAllocations(user.id, limit);
    }

    // Include orders
    if (include.includes('orders')) {
      response.orders = await aiQuantService.getUserOrders(user.id);
    }

    return NextResponse.json(apiResponse(response));
  } catch (error) {
    console.error('Get portfolio error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to fetch portfolio', (error as Error).message),
      { status: 500 }
    );
  }
}
