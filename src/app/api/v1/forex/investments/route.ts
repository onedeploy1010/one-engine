/**
 * Forex Investments API
 * GET  /api/v1/forex/investments - Get user's forex investments
 * POST /api/v1/forex/investments - Create new forex investment
 */

import { NextRequest, NextResponse } from 'next/server';
import { forexService } from '@/services/forex/forex.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';
import { z } from 'zod';

const createInvestmentSchema = z.object({
  amount: z.number().min(100).max(1000000),
  selectedPairs: z.array(z.string()).min(1).max(6),
  cycleDays: z.number().refine(d => [30, 60, 90, 180, 360].includes(d), {
    message: 'cycleDays must be 30, 60, 90, 180, or 360',
  }),
});

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
    const status = searchParams.get('status') as any || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const investments = await forexService.getUserInvestments(user.id, {
      status,
      limit,
      offset,
    });

    const portfolio = await forexService.getUserPortfolio(user.id);

    return NextResponse.json(
      apiResponse({
        investments,
        portfolio,
      }),
    );
  } catch (error) {
    console.error('Get forex investments error:', error);
    return NextResponse.json(
      apiError('E8003', 'Failed to fetch investments', (error as Error).message),
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        apiError('E1001', 'Unauthorized'),
        { status: 401 },
      );
    }

    const body = await request.json();
    const validated = createInvestmentSchema.parse(body);

    const investment = await forexService.createInvestment({
      userId: user.id,
      amount: validated.amount,
      selectedPairs: validated.selectedPairs,
      cycleDays: validated.cycleDays,
    });

    return NextResponse.json(apiResponse({ investment }), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        apiError('E4001', 'Validation error', error.errors),
        { status: 400 },
      );
    }
    console.error('Create forex investment error:', error);
    return NextResponse.json(
      apiError('E8003', 'Failed to create investment', (error as Error).message),
      { status: 500 },
    );
  }
}
