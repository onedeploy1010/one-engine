/**
 * Pause Order API
 * POST /api/v1/ai-quant/orders/[id]/pause
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

    const order = await aiQuantService.pauseOrder(params.id, user.id);

    return NextResponse.json(apiResponse({ order, message: 'Order paused successfully' }));
  } catch (error) {
    console.error('Pause order error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to pause order', (error as Error).message),
      { status: 500 }
    );
  }
}
