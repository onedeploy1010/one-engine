/**
 * AI Risk Status API
 * GET /api/v1/ai-quant/risk-status - Get daily risk status for a pool/strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiTradingExecutor } from '@/services/ai/ai-trading-executor.service';
import { aiRiskManager } from '@/services/ai/ai-risk-manager.service';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'AIRiskStatusAPI' });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategyId');
    const poolId = searchParams.get('poolId');

    if (!strategyId && !poolId) {
      return NextResponse.json(
        { success: false, error: 'strategyId or poolId is required' },
        { status: 400 }
      );
    }

    let riskStatus;

    if (poolId) {
      riskStatus = await aiRiskManager.getDailyRiskStatus(poolId);
    } else if (strategyId) {
      riskStatus = await aiTradingExecutor.getRiskStatusByStrategy(strategyId);
    }

    if (!riskStatus) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Get risk parameters for display
    const riskParams = aiRiskManager.getRiskParams('balanced');

    return NextResponse.json({
      success: true,
      data: {
        status: riskStatus,
        limits: {
          maxDailyLossPct: riskParams.maxDailyLossPct * 100,
          maxDailyProfitPct: riskParams.maxDailyProfitPct * 100,
          targetDailyReturnPct: riskParams.targetDailyReturnPct * 100,
          maxPositionPct: riskParams.maxPositionPct * 100,
          maxTotalExposurePct: riskParams.maxTotalExposurePct * 100,
          maxLeverage: riskParams.maxLeverage,
        },
        summary: {
          dailyPnl: riskStatus.dailyPnl,
          dailyPnlPct: riskStatus.dailyPnlPct * 100,
          exposurePct: riskStatus.exposurePct * 100,
          canTrade: riskStatus.canTrade,
          pauseReason: riskStatus.pauseReason,
          maxLossRemaining: riskStatus.maxLossRemaining,
          maxProfitRemaining: riskStatus.maxProfitRemaining,
          openPositions: riskStatus.openPositions,
          tradesExecuted: riskStatus.tradesExecuted,
        },
      },
    });
  } catch (error) {
    log.error('Failed to get risk status', error as Error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
