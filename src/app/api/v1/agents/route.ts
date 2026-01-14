/**
 * AI Agents API
 * GET /api/v1/agents - Get all agents with complete configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiResponse } from '@/lib/api-response';
import {
  AGENT_CONFIGS,
  SHARE_RATES_BY_CYCLE,
  getActiveAgents,
  calculateSubscriptionParams,
} from '@/config/agents.config';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const agentId = searchParams.get('agentId');

  // Get single agent if specified
  if (agentId) {
    const agent = AGENT_CONFIGS.find(a => a.id === agentId);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Calculate params for all tiers and cycles
    const tierParams = agent.tiers.map(tier => {
      const cycleParams = agent.supported_cycles.map(cycle => ({
        cycle,
        ...calculateSubscriptionParams(agent, tier.amount, cycle),
      }));
      return {
        tier: tier.tier,
        amount: tier.amount,
        label: tier.label,
        label_zh: tier.label_zh,
        cycles: cycleParams,
      };
    });

    return NextResponse.json(apiResponse({
      agent: {
        ...agent,
        tierParams,
      },
    }));
  }

  // Get all agents
  const agents = includeInactive ? AGENT_CONFIGS : getActiveAgents();

  // Transform for API response
  const agentsWithParams = agents.map(agent => {
    // Calculate params for default tier and cycle
    const defaultTier = agent.tiers[1] || agent.tiers[0]; // Use middle tier as default
    const defaultParams = calculateSubscriptionParams(
      agent,
      defaultTier.amount,
      agent.default_cycle
    );

    return {
      id: agent.id,
      name: agent.name,
      name_zh: agent.name_zh,
      description: agent.description,
      description_zh: agent.description_zh,
      category: agent.category,
      risk_level: agent.risk_level,
      icon: agent.icon,
      color: agent.color,
      tiers: agent.tiers,
      supported_cycles: agent.supported_cycles,
      default_cycle: agent.default_cycle,
      supported_pairs: agent.supported_pairs,
      supported_chains: agent.supported_chains,
      is_active: agent.is_active,
      // Default preview params
      preview: {
        tier: defaultTier,
        cycle: agent.default_cycle,
        ...defaultParams,
      },
    };
  });

  return NextResponse.json(apiResponse({
    agents: agentsWithParams,
    shareRates: SHARE_RATES_BY_CYCLE,
    timestamp: new Date().toISOString(),
  }));
}
