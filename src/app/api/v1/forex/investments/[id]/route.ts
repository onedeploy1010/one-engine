/**
 * Forex Investment Detail API
 * GET /api/v1/forex/investments/[id] - Get specific investment details
 */

import { NextRequest, NextResponse } from 'next/server';
import { forexService } from '@/services/forex/forex.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        apiError('E1001', 'Unauthorized'),
        { status: 401 },
      );
    }

    const investment = await forexService.getInvestment(params.id);

    if (!investment) {
      return NextResponse.json(
        apiError('E8004', 'Investment not found'),
        { status: 404 },
      );
    }

    if (investment.userId !== user.id) {
      return NextResponse.json(
        apiError('E1002', 'Not authorized'),
        { status: 403 },
      );
    }

    // Also fetch trades for this investment
    const trades = await forexService.getInvestmentTrades(params.id, {
      limit: 50,
    });

    return NextResponse.json(
      apiResponse({
        investment,
        trades,
      }),
    );
  } catch (error) {
    console.error('Get forex investment error:', error);
    return NextResponse.json(
      apiError('E8004', 'Failed to fetch investment', (error as Error).message),
      { status: 500 },
    );
  }
}
