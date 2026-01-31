/**
 * Forex Trades API
 * GET /api/v1/forex/trades - Get user's forex trade history
 */

import { NextRequest, NextResponse } from 'next/server';
import { forexService } from '@/services/forex/forex.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        apiError('E1001', 'Unauthorized'),
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const investmentId = searchParams.get('investment_id') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    let trades;
    if (investmentId) {
      // Verify the investment belongs to the user
      const investment = await forexService.getInvestment(investmentId);
      if (!investment || investment.userId !== user.id) {
        return NextResponse.json(
          apiError('E1002', 'Not authorized'),
          { status: 403 },
        );
      }
      trades = await forexService.getInvestmentTrades(investmentId, { limit, offset });
    } else {
      trades = await forexService.getUserTrades(user.id, { limit, offset });
    }

    return NextResponse.json(
      apiResponse({
        trades,
        total: trades.length,
      }),
    );
  } catch (error) {
    console.error('Get forex trades error:', error);
    return NextResponse.json(
      apiError('E8006', 'Failed to fetch trades', (error as Error).message),
      { status: 500 },
    );
  }
}
