/**
 * AI Quant Orders API
 * GET /api/v1/ai-quant/orders - Get user's orders
 * POST /api/v1/ai-quant/orders - Create new order
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiQuantService } from '@/services/quant/ai-quant.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';
import { z } from 'zod';

const createOrderSchema = z.object({
  strategyId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('USDT'),
  chain: z.string().default('ethereum'),
  lockPeriodDays: z.number().int().positive().optional(),
  txHashDeposit: z.string().optional(),
});

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
    const strategyId = searchParams.get('strategy_id') || undefined;
    const status = searchParams.get('status') as any || undefined;

    const orders = await aiQuantService.getUserOrders(user.id, {
      strategyId,
      status,
    });

    return NextResponse.json(apiResponse({ orders }));
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to fetch orders', (error as Error).message),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        apiError('E1001', 'Unauthorized'),
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = createOrderSchema.parse(body);

    const order = await aiQuantService.createOrder({
      userId: user.id,
      strategyId: validated.strategyId,
      amount: validated.amount,
      currency: validated.currency,
      chain: validated.chain,
      lockPeriodDays: validated.lockPeriodDays,
      txHashDeposit: validated.txHashDeposit,
    });

    return NextResponse.json(apiResponse({ order }), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        apiError('E4001', 'Validation error', error.errors),
        { status: 400 }
      );
    }
    console.error('Create order error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to create order', (error as Error).message),
      { status: 500 }
    );
  }
}
