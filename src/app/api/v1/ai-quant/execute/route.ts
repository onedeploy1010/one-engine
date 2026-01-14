/**
 * AI Quant Execute API
 * POST /api/v1/ai-quant/execute - Execute AI signals for a strategy (admin/worker)
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiQuantService } from '@/services/quant/ai-quant.service';
import { getUser } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/api-response';
import { z } from 'zod';

const executeSchema = z.object({
  strategyId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        apiError('E1001', 'Unauthorized'),
        { status: 401 }
      );
    }

    // Check if user is admin (only admins can execute signals)
    if (user.role !== 'admin') {
      return NextResponse.json(
        apiError('E1002', 'Admin access required'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = executeSchema.parse(body);

    const executions = await aiQuantService.executeAISignals(validated.strategyId);

    return NextResponse.json(apiResponse({
      executions,
      count: executions.length,
      message: `Executed ${executions.length} trades`,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        apiError('E4001', 'Validation error', error.errors),
        { status: 400 }
      );
    }
    console.error('Execute signals error:', error);
    return NextResponse.json(
      apiError('E6001', 'Failed to execute signals', (error as Error).message),
      { status: 500 }
    );
  }
}
