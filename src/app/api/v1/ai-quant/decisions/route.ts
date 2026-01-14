/**
 * AI Decisions API
 * GET /api/v1/ai-quant/decisions - Get AI decision history
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiMemoryService } from '@/services/ai/ai-memory.service';
import { LogService } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase';

const log = new LogService({ service: 'AIDecisionsAPI' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategyId');
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const executedOnly = searchParams.get('executedOnly') === 'true';

    let query = db()
      .from('ai_decision_log')
      .select(`
        *,
        ai_strategies (
          name,
          category
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    if (executedOnly) {
      query = query.eq('was_executed', true);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const decisions = (data || []).map((d: Record<string, unknown>) => ({
      id: d.id,
      agentId: d.agent_id,
      strategyId: d.strategy_id,
      strategyName: (d.ai_strategies as Record<string, unknown>)?.name || 'Unknown',
      category: (d.ai_strategies as Record<string, unknown>)?.category || 'unknown',
      batchId: d.batch_id,
      type: d.decision_type,
      action: d.action,
      symbol: d.symbol,
      amount: d.suggested_amount,
      price: d.suggested_price,
      stopLoss: d.stop_loss_price,
      takeProfit: d.take_profit_price,
      leverage: d.leverage,
      analysis: d.market_analysis,
      reasoning: d.reasoning,
      confidence: d.confidence_score,
      riskScore: d.risk_score,
      wasExecuted: d.was_executed,
      executionPrice: d.execution_price,
      executionTime: d.execution_time,
      outcomePnl: d.outcome_pnl,
      outcomePnlPct: d.outcome_pnl_pct,
      wasSuccessful: d.was_successful,
      timestamp: d.created_at,
    }));

    // Calculate stats
    const stats = {
      total: decisions.length,
      executed: decisions.filter((d: { wasExecuted: boolean }) => d.wasExecuted).length,
      successful: decisions.filter((d: { wasSuccessful: boolean }) => d.wasSuccessful).length,
      avgConfidence: decisions.length > 0
        ? decisions.reduce((sum: number, d: { confidence: number }) => sum + (d.confidence || 0), 0) / decisions.length
        : 0,
      totalPnl: decisions.reduce((sum: number, d: { outcomePnl: number | null }) => sum + (d.outcomePnl || 0), 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        decisions,
        stats,
      },
    });
  } catch (error) {
    log.error('Failed to get decisions', error as Error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
