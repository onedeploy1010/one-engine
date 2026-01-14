/**
 * AI Risk Manager Service
 * Controls position sizing, daily P&L limits, and risk management for AI trading
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import { getAgentConfig } from '@/config/agents.config';

const log = new LogService({ service: 'AIRiskManager' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

// ============ Risk Parameters ============

export interface RiskParams {
  // Daily P&L limits (as percentage of pool capital)
  maxDailyLossPct: number;       // e.g., 0.02 = 2% max daily loss
  maxDailyProfitPct: number;     // e.g., 0.05 = 5% max daily profit (to limit variance)
  targetDailyReturnPct: number;  // e.g., 0.005 = 0.5% target daily return

  // Position sizing
  maxPositionPct: number;        // e.g., 0.20 = max 20% of capital in single position
  maxTotalExposurePct: number;   // e.g., 0.60 = max 60% of capital in all positions
  minPositionSize: number;       // minimum USDT per position

  // Risk per trade
  maxRiskPerTradePct: number;    // e.g., 0.01 = max 1% capital at risk per trade
  defaultStopLossPct: number;    // e.g., 0.02 = 2% stop loss
  defaultTakeProfitPct: number;  // e.g., 0.04 = 4% take profit

  // Leverage limits
  maxLeverage: number;
  defaultLeverage: number;
}

const DEFAULT_RISK_PARAMS: RiskParams = {
  maxDailyLossPct: 0.02,         // 2% max daily loss
  maxDailyProfitPct: 0.05,       // 5% max daily profit
  targetDailyReturnPct: 0.005,   // 0.5% target daily return

  maxPositionPct: 0.20,          // 20% max single position
  maxTotalExposurePct: 0.60,     // 60% max total exposure
  minPositionSize: 50,           // $50 minimum

  maxRiskPerTradePct: 0.01,      // 1% risk per trade
  defaultStopLossPct: 0.02,      // 2% stop loss
  defaultTakeProfitPct: 0.04,    // 4% take profit

  maxLeverage: 10,
  defaultLeverage: 3,
};

// ============ Types ============

export interface PositionSizeCalculation {
  recommendedSize: number;
  maxAllowedSize: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  riskRewardRatio: number;
  reasoning: string;
}

export interface DailyRiskStatus {
  poolId: string;
  date: string;
  startingCapital: number;
  currentCapital: number;
  dailyPnl: number;
  dailyPnlPct: number;
  maxLossRemaining: number;
  maxProfitRemaining: number;
  canTrade: boolean;
  pauseReason?: string;
  tradesExecuted: number;
  openPositions: number;
  totalExposure: number;
  exposurePct: number;
}

export interface TradeRiskAssessment {
  approved: boolean;
  adjustedSize: number;
  adjustedLeverage: number;
  warnings: string[];
  rejectionReasons: string[];
  riskScore: number; // 0-100, lower is better
}

// ============ Service Implementation ============

class AIRiskManagerService {
  /**
   * Get risk parameters for a specific agent
   */
  getRiskParams(agentId: string): RiskParams {
    const agent = getAgentConfig(agentId);

    if (!agent) {
      return DEFAULT_RISK_PARAMS;
    }

    // Adjust risk params based on agent risk level
    const riskMultiplier = agent.risk_level / 5; // 1-5 scale

    return {
      maxDailyLossPct: Math.min(0.02 + (riskMultiplier * 0.02), 0.05),  // 2-5% based on risk
      maxDailyProfitPct: Math.min(0.05 + (riskMultiplier * 0.03), 0.10), // 5-10%
      targetDailyReturnPct: 0.003 + (riskMultiplier * 0.003),           // 0.3-0.9%

      maxPositionPct: Math.min(0.15 + (riskMultiplier * 0.10), 0.30),   // 15-30%
      maxTotalExposurePct: Math.min(0.50 + (riskMultiplier * 0.20), 0.80), // 50-80%
      minPositionSize: 50,

      maxRiskPerTradePct: Math.min(0.01 + (riskMultiplier * 0.01), 0.03), // 1-3%
      defaultStopLossPct: Math.max(0.03 - (riskMultiplier * 0.01), 0.01), // 1-3%
      defaultTakeProfitPct: 0.02 + (riskMultiplier * 0.04),              // 2-6%

      maxLeverage: Math.min(3 + (agent.risk_level * 2), 15),
      defaultLeverage: Math.min(2 + agent.risk_level, 10),
    };
  }

  /**
   * Get daily risk status for a pool
   */
  async getDailyRiskStatus(poolId: string): Promise<DailyRiskStatus> {
    const today = new Date().toISOString().split('T')[0];

    // Get pool data
    const { data: pool } = await db()
      .from('ai_strategy_pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (!pool) {
      throw new Error(`Pool ${poolId} not found`);
    }

    // Get today's snapshot or create one
    let { data: snapshot } = await db()
      .from('ai_performance_snapshots')
      .select('*')
      .eq('pool_id', poolId)
      .eq('snapshot_date', today)
      .single();

    if (!snapshot) {
      // Create today's snapshot
      await db()
        .from('ai_performance_snapshots')
        .insert({
          pool_id: poolId,
          strategy_id: pool.strategy_id,
          snapshot_date: today,
          nav: pool.current_nav,
          total_capital: pool.total_capital,
          daily_pnl: 0,
        });

      snapshot = {
        total_capital: pool.total_capital,
        daily_pnl: 0,
      };
    }

    const startingCapital = parseFloat(snapshot.total_capital) || parseFloat(pool.total_capital);
    const currentCapital = parseFloat(pool.total_capital) + parseFloat(pool.unrealized_pnl || 0);
    const dailyPnl = currentCapital - startingCapital;
    const dailyPnlPct = startingCapital > 0 ? (dailyPnl / startingCapital) : 0;

    // Get agent risk params
    const { data: strategy } = await db()
      .from('ai_strategies')
      .select('category')
      .eq('id', pool.strategy_id)
      .single();

    const riskParams = this.getRiskParams(strategy?.category || 'balanced');

    const maxLossRemaining = (riskParams.maxDailyLossPct * startingCapital) + dailyPnl;
    const maxProfitRemaining = (riskParams.maxDailyProfitPct * startingCapital) - dailyPnl;

    // Check if trading should be paused
    let canTrade = true;
    let pauseReason: string | undefined;

    if (dailyPnlPct <= -riskParams.maxDailyLossPct) {
      canTrade = false;
      pauseReason = `Daily loss limit reached: ${(dailyPnlPct * 100).toFixed(2)}%`;
    } else if (dailyPnlPct >= riskParams.maxDailyProfitPct) {
      canTrade = false;
      pauseReason = `Daily profit target reached: ${(dailyPnlPct * 100).toFixed(2)}%`;
    }

    // Get position exposure
    const { data: positions } = await db()
      .from('ai_open_positions')
      .select('notional_value')
      .eq('pool_id', poolId);

    const totalExposure = (positions || []).reduce(
      (sum: number, p: { notional_value: string }) => sum + parseFloat(p.notional_value || '0'),
      0
    );
    const exposurePct = currentCapital > 0 ? (totalExposure / currentCapital) : 0;

    if (exposurePct >= riskParams.maxTotalExposurePct) {
      canTrade = false;
      pauseReason = pauseReason || `Max exposure reached: ${(exposurePct * 100).toFixed(1)}%`;
    }

    return {
      poolId,
      date: today,
      startingCapital,
      currentCapital,
      dailyPnl,
      dailyPnlPct,
      maxLossRemaining,
      maxProfitRemaining,
      canTrade,
      pauseReason,
      tradesExecuted: pool.trades_today || 0,
      openPositions: (positions || []).length,
      totalExposure,
      exposurePct,
    };
  }

  /**
   * Calculate optimal position size
   */
  calculatePositionSize(params: {
    poolCapital: number;
    availableCapital: number;
    currentExposure: number;
    entryPrice: number;
    agentId: string;
    symbol: string;
    side: 'long' | 'short';
    confidence: number;
  }): PositionSizeCalculation {
    const riskParams = this.getRiskParams(params.agentId);

    // Base position size on available capital and confidence
    const confidenceMultiplier = params.confidence / 100;

    // Max position based on single position limit
    const maxFromPositionLimit = params.poolCapital * riskParams.maxPositionPct;

    // Max position based on remaining exposure capacity
    const remainingExposureCapacity = (params.poolCapital * riskParams.maxTotalExposurePct) - params.currentExposure;
    const maxFromExposure = Math.max(remainingExposureCapacity, 0);

    // Max based on available capital
    const maxFromCapital = params.availableCapital * 0.8; // Keep 20% reserve

    // Choose the minimum of all limits
    const maxAllowedSize = Math.min(maxFromPositionLimit, maxFromExposure, maxFromCapital);

    // Recommended size based on confidence (50-100% of max based on confidence)
    const sizeMultiplier = 0.5 + (confidenceMultiplier * 0.5);
    const recommendedSize = Math.max(maxAllowedSize * sizeMultiplier, riskParams.minPositionSize);

    // Calculate leverage based on risk
    const leverage = Math.min(
      riskParams.defaultLeverage * confidenceMultiplier,
      riskParams.maxLeverage
    );

    // Calculate stop loss and take profit
    const stopLossPct = riskParams.defaultStopLossPct;
    const takeProfitPct = riskParams.defaultTakeProfitPct;

    const stopLoss = params.side === 'long'
      ? params.entryPrice * (1 - stopLossPct)
      : params.entryPrice * (1 + stopLossPct);

    const takeProfit = params.side === 'long'
      ? params.entryPrice * (1 + takeProfitPct)
      : params.entryPrice * (1 - takeProfitPct);

    // Risk amount (potential loss)
    const riskAmount = recommendedSize * stopLossPct * leverage;

    return {
      recommendedSize: Math.round(recommendedSize * 100) / 100,
      maxAllowedSize: Math.round(maxAllowedSize * 100) / 100,
      leverage: Math.round(leverage * 10) / 10,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      riskAmount: Math.round(riskAmount * 100) / 100,
      riskRewardRatio: takeProfitPct / stopLossPct,
      reasoning: `Position sized at ${(sizeMultiplier * 100).toFixed(0)}% of max (confidence: ${params.confidence}%). ` +
        `Leverage ${leverage.toFixed(1)}x with ${(stopLossPct * 100).toFixed(1)}% SL and ${(takeProfitPct * 100).toFixed(1)}% TP.`,
    };
  }

  /**
   * Assess if a trade should be approved
   */
  async assessTradeRisk(params: {
    poolId: string;
    agentId: string;
    symbol: string;
    side: 'long' | 'short';
    amount: number;
    leverage: number;
    entryPrice: number;
    confidence: number;
  }): Promise<TradeRiskAssessment> {
    const warnings: string[] = [];
    const rejectionReasons: string[] = [];

    // Get daily risk status
    const riskStatus = await this.getDailyRiskStatus(params.poolId);

    // Check if trading is allowed
    if (!riskStatus.canTrade) {
      rejectionReasons.push(riskStatus.pauseReason || 'Trading paused');
    }

    // Get risk params
    const riskParams = this.getRiskParams(params.agentId);

    // Check position size
    const positionSize = this.calculatePositionSize({
      poolCapital: riskStatus.currentCapital,
      availableCapital: riskStatus.currentCapital - riskStatus.totalExposure,
      currentExposure: riskStatus.totalExposure,
      entryPrice: params.entryPrice,
      agentId: params.agentId,
      symbol: params.symbol,
      side: params.side,
      confidence: params.confidence,
    });

    let adjustedSize = params.amount;
    let adjustedLeverage = params.leverage;

    // Adjust size if too large
    if (params.amount > positionSize.maxAllowedSize) {
      adjustedSize = positionSize.recommendedSize;
      warnings.push(`Position size reduced from $${params.amount} to $${adjustedSize}`);
    }

    // Adjust leverage if too high
    if (params.leverage > riskParams.maxLeverage) {
      adjustedLeverage = riskParams.maxLeverage;
      warnings.push(`Leverage reduced from ${params.leverage}x to ${adjustedLeverage}x`);
    }

    // Check confidence threshold
    if (params.confidence < 60) {
      warnings.push(`Low confidence: ${params.confidence}%`);
    }

    if (params.confidence < 50) {
      rejectionReasons.push(`Confidence too low: ${params.confidence}% (min: 50%)`);
    }

    // Calculate risk score (0-100, lower is better)
    const exposureRisk = (riskStatus.exposurePct / riskParams.maxTotalExposurePct) * 30;
    const dailyPnlRisk = Math.abs(riskStatus.dailyPnlPct / riskParams.maxDailyLossPct) * 30;
    const confidenceRisk = ((100 - params.confidence) / 100) * 20;
    const leverageRisk = (params.leverage / riskParams.maxLeverage) * 20;

    const riskScore = Math.min(Math.round(exposureRisk + dailyPnlRisk + confidenceRisk + leverageRisk), 100);

    if (riskScore > 80) {
      warnings.push(`High risk score: ${riskScore}/100`);
    }

    return {
      approved: rejectionReasons.length === 0,
      adjustedSize,
      adjustedLeverage,
      warnings,
      rejectionReasons,
      riskScore,
    };
  }

  /**
   * Record trading metrics for the day
   */
  async recordDailyMetrics(poolId: string): Promise<void> {
    const riskStatus = await this.getDailyRiskStatus(poolId);

    // Get pool info
    const { data: pool } = await db()
      .from('ai_strategy_pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (!pool) return;

    // Update or insert daily snapshot
    await db()
      .from('ai_performance_snapshots')
      .upsert({
        pool_id: poolId,
        strategy_id: pool.strategy_id,
        snapshot_date: riskStatus.date,
        nav: pool.current_nav,
        total_capital: riskStatus.currentCapital,
        total_shares: pool.total_shares,
        daily_return: riskStatus.dailyPnlPct,
        daily_pnl: riskStatus.dailyPnl,
        trades_executed: riskStatus.tradesExecuted,
        drawdown: pool.current_drawdown,
      }, {
        onConflict: 'pool_id,snapshot_date',
      });

    log.info('Daily metrics recorded', {
      poolId,
      date: riskStatus.date,
      dailyPnl: riskStatus.dailyPnl,
      dailyPnlPct: riskStatus.dailyPnlPct,
      trades: riskStatus.tradesExecuted,
    });
  }

  /**
   * Reset daily trading counters (call at start of each day)
   */
  async resetDailyCounters(): Promise<void> {
    await db()
      .from('ai_strategy_pools')
      .update({
        trades_today: 0,
        daily_pnl: 0,
        updated_at: new Date().toISOString(),
      });

    log.info('Daily trading counters reset');
  }
}

export const aiRiskManager = new AIRiskManagerService();
