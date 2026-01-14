/**
 * AI Quant Order Detail API
 * GET /api/v1/ai-quant/orders/[id] - Get order details
 * POST /api/v1/ai-quant/orders/[id]/pause - Pause order
 * POST /api/v1/ai-quant/orders/[id]/resume - Resume order
 * POST /api/v1/ai-quant/orders/[id]/redeem - Request redemption
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiQuantService } from '@/services/quant/ai-quant.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';

export async function GET(
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

    const order = await aiQuantService.getOrder(params.id);

    if (!order) {
      return NextResponse.json(
        apiError('E6002', 'Order not found'),
        { status: 404 }
      );
    }

    if (order.userId !== user.id) {
      return NextResponse.json(
        apiError('E1002', 'Forbidden'),
        { status: 403 }
      );
    }

    // Get strategy info
    const strategy = await aiQuantService.getStrategy(order.strategyId);

    return NextResponse.json(apiResponse({ order, strategy }));
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to fetch order', (error as Error).message),
      { status: 500 }
    );
  }
}
