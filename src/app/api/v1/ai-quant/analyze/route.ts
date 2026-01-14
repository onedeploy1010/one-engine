/**
 * AI Analysis API
 * GET /api/v1/ai-quant/analyze - Get AI analysis for a strategy
 * POST /api/v1/ai-quant/analyze - Request new AI analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiTradingExecutor } from '@/services/ai/ai-trading-executor.service';
import { aiMemoryService } from '@/services/ai/ai-memory.service';
import { aiService } from '@/services/ai/ai.service';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'AIAnalyzeAPI' });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategyId');

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: 'strategyId is required' },
        { status: 400 }
      );
    }

    // Get trading status
    const status = await aiTradingExecutor.getTradingStatus(strategyId);

    // Format for frontend
    const response = {
      success: true,
      data: {
        pool: {
          totalCapital: status.pool.totalCapital,
          availableCapital: status.pool.availableCapital,
          lockedCapital: status.pool.lockedCapital,
          currentNav: status.pool.currentNav,
          totalShares: status.pool.totalShares,
          unrealizedPnl: status.pool.unrealizedPnl,
        },
        positions: status.positions.map(p => ({
          symbol: p.symbol,
          side: p.side,
          entryPrice: p.entryPrice,
          currentPrice: p.currentPrice,
          quantity: p.quantity,
          leverage: p.leverage,
          unrealizedPnl: p.unrealizedPnl,
          unrealizedPnlPct: p.unrealizedPnlPct,
          reasoning: p.entryReasoning,
          confidence: p.aiConfidence,
        })),
        recentDecisions: status.recentDecisions.map(d => ({
          id: d.id,
          type: d.decisionType,
          action: d.action,
          symbol: d.symbol,
          reasoning: d.reasoning,
          confidence: d.confidenceScore,
          wasExecuted: d.wasExecuted,
          outcome: d.wasSuccessful,
          pnl: d.outcomePnl,
          timestamp: d.createdAt,
        })),
        performance: status.performance,
        riskStatus: {
          dailyPnl: status.riskStatus.dailyPnl,
          dailyPnlPct: status.riskStatus.dailyPnlPct * 100,
          exposurePct: status.riskStatus.exposurePct * 100,
          canTrade: status.riskStatus.canTrade,
          pauseReason: status.riskStatus.pauseReason,
          maxLossRemaining: status.riskStatus.maxLossRemaining,
          maxProfitRemaining: status.riskStatus.maxProfitRemaining,
          openPositions: status.riskStatus.openPositions,
          tradesExecuted: status.riskStatus.tradesExecuted,
        },
        lastUpdate: status.lastUpdate,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    log.error('Failed to get analysis', error as Error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategyId, forceAnalysis } = body;

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: 'strategyId is required' },
        { status: 400 }
      );
    }

    // Execute a trading cycle which includes AI analysis
    const result = await aiTradingExecutor.executeTradingCycle(strategyId);

    return NextResponse.json({
      success: true,
      data: {
        batchId: result.batchId,
        agentId: result.agentId,
        analysis: result.marketAnalysis,
        decisions: result.decisions.map(d => ({
          id: d.id,
          type: d.decisionType,
          action: d.action,
          symbol: d.symbol,
          amount: d.suggestedAmount,
          price: d.suggestedPrice,
          stopLoss: d.stopLossPrice,
          takeProfit: d.takeProfitPrice,
          reasoning: d.reasoning,
          confidence: d.confidenceScore,
          wasExecuted: d.wasExecuted,
        })),
        executedTrades: result.executedTrades,
        pnl: result.totalPnl,
        navBefore: result.poolNavBefore,
        navAfter: result.poolNavAfter,
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    log.error('Failed to execute analysis', error as Error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
