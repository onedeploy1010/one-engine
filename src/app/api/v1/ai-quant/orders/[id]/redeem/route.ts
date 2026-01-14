/**
 * Redeem Order API
 * POST /api/v1/ai-quant/orders/[id]/redeem
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiQuantService } from '@/services/quant/ai-quant.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        apiError('E1001', 'Unauthorized'),
        { status: 401 }
      );
    }

    const result = await aiQuantService.requestRedemption(params.id, user.id);

    return NextResponse.json(apiResponse({
      success: result.success,
      redemption: {
        amount: result.redemptionAmount,
        penaltyRate: result.penaltyRate,
        penaltyAmount: result.penaltyAmount,
        completionRate: result.completionRate,
        finalAmount: result.finalAmount,
      },
      message: result.success
        ? 'Redemption requested successfully'
        : 'Redemption failed',
    }));
  } catch (error) {
    console.error('Redeem order error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to request redemption', (error as Error).message),
      { status: 500 }
    );
  }
}
