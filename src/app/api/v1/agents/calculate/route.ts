/**
 * Agent Calculate API
 * POST /api/v1/agents/calculate - Calculate subscription parameters
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiResponse, apiError } from '@/lib/api-response';
import {
  getAgentConfig,
  calculateSubscriptionParams,
  validateSubscription,
} from '@/config/agents.config';
import { z } from 'zod';

const calculateSchema = z.object({
  agentId: z.string(),
  amount: z.number().positive(),
  cycleDays: z.number().int().positive(),
  pairs: z.array(z.string()).optional(),
  chain: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = calculateSchema.parse(body);

    const agent = getAgentConfig(validated.agentId);
    if (!agent) {
      return NextResponse.json(
        apiError('E4004', 'Agent not found'),
        { status: 404 }
      );
    }

    // Validate if pairs and chain provided
    if (validated.pairs || validated.chain) {
      const validation = validateSubscription(
        validated.agentId,
        validated.amount,
        validated.cycleDays,
        validated.pairs || agent.supported_pairs,
        validated.chain || agent.supported_chains[0]
      );

      if (!validation.valid) {
        return NextResponse.json(
          apiError('E4001', 'Validation error', validation.errors),
          { status: 400 }
        );
      }
    }

    const params = calculateSubscriptionParams(
      agent,
      validated.amount,
      validated.cycleDays
    );

    // Find matching tier
    const tier = agent.tiers.find(t => t.amount === validated.amount);

    return NextResponse.json(apiResponse({
      agentId: validated.agentId,
      agentName: agent.name,
      amount: validated.amount,
      cycleDays: validated.cycleDays,
      tier: tier ? {
        level: tier.tier,
        label: tier.label,
        label_zh: tier.label_zh,
      } : null,
      ...params,
      riskControl: {
        maxDrawdownPct: agent.max_drawdown_pct * 100,
        dailyLossLimitPct: agent.daily_loss_limit_pct * 100,
        positionReduceThreshold: agent.position_reduce_threshold * 100,
      },
      disclaimer: {
        en: 'ROI estimates are based on historical backtesting only. Actual returns may vary and could be negative. Past performance does not guarantee future results.',
        zh: '收益预估仅基于历史回测数据，实际收益可能有所不同，也可能为负。过往业绩不代表未来表现。',
      },
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        apiError('E4001', 'Validation error', error.errors),
        { status: 400 }
      );
    }
    console.error('Calculate error:', error);
    return NextResponse.json(
      apiError('E5001', 'Internal error'),
      { status: 500 }
    );
  }
}
