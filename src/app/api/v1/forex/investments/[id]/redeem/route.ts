/**
 * Forex Investment Redeem API
 * POST /api/v1/forex/investments/[id]/redeem - Redeem an investment
 */

import { NextRequest, NextResponse } from 'next/server';
import { forexService } from '@/services/forex/forex.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';

export async function POST(
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

    const result = await forexService.redeemInvestment(params.id, user.id);

    return NextResponse.json(
      apiResponse({
        investment: result.investment,
        redeemAmount: result.redeemAmount,
      }),
    );
  } catch (error) {
    console.error('Redeem forex investment error:', error);
    const message = (error as Error).message;

    if (message.includes('not found')) {
      return NextResponse.json(
        apiError('E8004', message),
        { status: 404 },
      );
    }
    if (message.includes('Not authorized')) {
      return NextResponse.json(
        apiError('E1002', message),
        { status: 403 },
      );
    }
    if (message.includes('Cannot redeem')) {
      return NextResponse.json(
        apiError('E8005', message),
        { status: 400 },
      );
    }

    return NextResponse.json(
      apiError('E8005', 'Failed to redeem investment', message),
      { status: 500 },
    );
  }
}
