/**
 * AI Memory Service
 * Handles long-term memory, learning, and decision tracking for AI agents
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'AIMemoryService' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

// ============ Types ============

export interface AgentMemory {
  id: string;
  agentId: string;
  memoryType: 'market_pattern' | 'successful_trade' | 'failed_trade' | 'learned_rule' | 'risk_event';
  symbol?: string;
  marketCondition?: Record<string, unknown>;
  patternDescription?: string;
  confidenceScore?: number;
  tradeAction?: string;
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  pnlPct?: number;
  lessonLearned?: string;
  shouldRepeat: boolean;
  importanceWeight: number;
  createdAt: string;
  accessCount: number;
}

export interface DecisionLog {
  id: string;
  agentId: string;
  strategyId: string;
  batchId: string;
  decisionType: 'trade' | 'hold' | 'rebalance' | 'risk_adjust' | 'stop_loss' | 'take_profit';
  action?: string;
  symbol?: string;
  suggestedAmount?: number;
  suggestedPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  leverage?: number;
  marketAnalysis?: string;
  reasoning: string;
  confidenceScore: number;
  riskScore?: number;
  marketData?: Record<string, unknown>;
  currentPositions?: Array<Record<string, unknown>>;
  poolCapital?: number;
  wasExecuted: boolean;
  executionId?: string;
  outcomePnl?: number;
  wasSuccessful?: boolean;
  createdAt: string;
}

export interface PoolInfo {
  id: string;
  strategyId: string;
  totalCapital: number;
  availableCapital: number;
  lockedCapital: number;
  currentNav: number;
  totalShares: number;
  totalPnl: number;
  unrealizedPnl: number;
  winRate: number;
  totalTrades: number;
  tradesToday: number;
  dailyTradeLimit: number;
}

export interface OpenPosition {
  id: string;
  poolId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice?: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  entryReasoning?: string;
  aiConfidence?: number;
}

// ============ Service Implementation ============

class AIMemoryService {
  /**
   * Store a new memory for an agent
   */
  async storeMemory(memory: Omit<AgentMemory, 'id' | 'createdAt' | 'accessCount'>): Promise<AgentMemory> {
    log.info('Storing memory', { agentId: memory.agentId, type: memory.memoryType });

    const { data, error } = await db()
      .from('ai_agent_memory')
      .insert({
        agent_id: memory.agentId,
        memory_type: memory.memoryType,
        symbol: memory.symbol,
        market_condition: memory.marketCondition,
        pattern_description: memory.patternDescription,
        confidence_score: memory.confidenceScore,
        trade_action: memory.tradeAction,
        entry_price: memory.entryPrice,
        exit_price: memory.exitPrice,
        pnl: memory.pnl,
        pnl_pct: memory.pnlPct,
        lesson_learned: memory.lessonLearned,
        should_repeat: memory.shouldRepeat,
        importance_weight: memory.importanceWeight,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to store memory', error);
      throw error;
    }

    return this.mapMemoryFromDb(data);
  }

  /**
   * Retrieve relevant memories for decision making
   */
  async getRelevantMemories(params: {
    agentId: string;
    symbol?: string;
    memoryTypes?: string[];
    limit?: number;
  }): Promise<AgentMemory[]> {
    let query = db()
      .from('ai_agent_memory')
      .select('*')
      .eq('agent_id', params.agentId)
      .order('importance_weight', { ascending: false })
      .order('access_count', { ascending: false })
      .limit(params.limit || 20);

    if (params.symbol) {
      query = query.eq('symbol', params.symbol);
    }

    if (params.memoryTypes?.length) {
      query = query.in('memory_type', params.memoryTypes);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to get memories', error);
      return [];
    }

    // Update access count for retrieved memories
    if (data?.length) {
      await db()
        .from('ai_agent_memory')
        .update({ access_count: db().raw('access_count + 1'), last_accessed_at: new Date().toISOString() })
        .in('id', data.map((m: { id: string }) => m.id));
    }

    return (data || []).map(this.mapMemoryFromDb);
  }

  /**
   * Get memories of successful trades for a specific pattern
   */
  async getSuccessfulPatterns(agentId: string, symbol: string): Promise<AgentMemory[]> {
    const { data, error } = await db()
      .from('ai_agent_memory')
      .select('*')
      .eq('agent_id', agentId)
      .eq('memory_type', 'successful_trade')
      .eq('symbol', symbol)
      .eq('should_repeat', true)
      .order('pnl_pct', { ascending: false })
      .limit(10);

    if (error) {
      log.error('Failed to get successful patterns', error);
      return [];
    }

    return (data || []).map(this.mapMemoryFromDb);
  }

  /**
   * Learn from a completed trade - create memory based on outcome
   */
  async learnFromTrade(params: {
    agentId: string;
    symbol: string;
    action: string;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPct: number;
    marketCondition: Record<string, unknown>;
    reasoning: string;
  }): Promise<void> {
    const isSuccessful = params.pnl > 0;
    const memoryType = isSuccessful ? 'successful_trade' : 'failed_trade';

    // Calculate importance based on P&L magnitude
    const importanceWeight = Math.min(Math.abs(params.pnlPct) / 10, 2);

    await this.storeMemory({
      agentId: params.agentId,
      memoryType,
      symbol: params.symbol,
      marketCondition: params.marketCondition,
      patternDescription: `${params.action} at ${params.entryPrice}, exit at ${params.exitPrice}`,
      tradeAction: params.action,
      entryPrice: params.entryPrice,
      exitPrice: params.exitPrice,
      pnl: params.pnl,
      pnlPct: params.pnlPct,
      lessonLearned: isSuccessful
        ? `Profitable ${params.action} in ${JSON.stringify(params.marketCondition).slice(0, 100)}`
        : `Loss on ${params.action} - avoid similar conditions: ${params.reasoning}`,
      shouldRepeat: isSuccessful,
      importanceWeight,
    });

    log.info('Learned from trade', {
      agentId: params.agentId,
      symbol: params.symbol,
      isSuccessful,
      pnlPct: params.pnlPct,
    });
  }

  /**
   * Log a decision for tracking
   */
  async logDecision(decision: Omit<DecisionLog, 'id' | 'createdAt'>): Promise<DecisionLog> {
    const { data, error } = await db()
      .from('ai_decision_log')
      .insert({
        agent_id: decision.agentId,
        strategy_id: decision.strategyId,
        batch_id: decision.batchId,
        decision_type: decision.decisionType,
        action: decision.action,
        symbol: decision.symbol,
        suggested_amount: decision.suggestedAmount,
        suggested_price: decision.suggestedPrice,
        stop_loss_price: decision.stopLossPrice,
        take_profit_price: decision.takeProfitPrice,
        leverage: decision.leverage,
        market_analysis: decision.marketAnalysis,
        reasoning: decision.reasoning,
        confidence_score: decision.confidenceScore,
        risk_score: decision.riskScore,
        market_data: decision.marketData,
        current_positions: decision.currentPositions,
        pool_capital: decision.poolCapital,
        was_executed: decision.wasExecuted,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to log decision', error);
      throw error;
    }

    return this.mapDecisionFromDb(data);
  }

  /**
   * Update decision outcome after execution
   */
  async updateDecisionOutcome(params: {
    decisionId: string;
    executionId: string;
    executionPrice: number;
    pnl: number;
    pnlPct: number;
  }): Promise<void> {
    const { error } = await db()
      .from('ai_decision_log')
      .update({
        was_executed: true,
        execution_id: params.executionId,
        execution_price: params.executionPrice,
        execution_time: new Date().toISOString(),
        outcome_pnl: params.pnl,
        outcome_pnl_pct: params.pnlPct,
        was_successful: params.pnl > 0,
        evaluated_at: new Date().toISOString(),
      })
      .eq('id', params.decisionId);

    if (error) {
      log.error('Failed to update decision outcome', error);
    }
  }

  /**
   * Get recent decisions for an agent
   */
  async getRecentDecisions(agentId: string, limit: number = 20): Promise<DecisionLog[]> {
    const { data, error } = await db()
      .from('ai_decision_log')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get recent decisions', error);
      return [];
    }

    return (data || []).map(this.mapDecisionFromDb);
  }

  /**
   * Get decision success rate for an agent
   */
  async getDecisionSuccessRate(agentId: string): Promise<{
    totalDecisions: number;
    executedDecisions: number;
    successfulDecisions: number;
    successRate: number;
    avgConfidence: number;
  }> {
    const { data, error } = await db()
      .from('ai_decision_log')
      .select('was_executed, was_successful, confidence_score')
      .eq('agent_id', agentId);

    if (error || !data) {
      return {
        totalDecisions: 0,
        executedDecisions: 0,
        successfulDecisions: 0,
        successRate: 0,
        avgConfidence: 0,
      };
    }

    const executed = data.filter((d: { was_executed: boolean }) => d.was_executed);
    const successful = executed.filter((d: { was_successful: boolean }) => d.was_successful);
    const avgConfidence = data.length > 0
      ? data.reduce((sum: number, d: { confidence_score: number }) => sum + (d.confidence_score || 0), 0) / data.length
      : 0;

    return {
      totalDecisions: data.length,
      executedDecisions: executed.length,
      successfulDecisions: successful.length,
      successRate: executed.length > 0 ? (successful.length / executed.length) * 100 : 0,
      avgConfidence,
    };
  }

  // ============ Pool Management ============

  /**
   * Get or create strategy pool
   */
  async getOrCreatePool(strategyId: string): Promise<PoolInfo> {
    // Try to get existing pool
    let { data, error } = await db()
      .from('ai_strategy_pools')
      .select('*')
      .eq('strategy_id', strategyId)
      .single();

    if (error || !data) {
      // Create new pool
      const { data: newPool, error: createError } = await db()
        .from('ai_strategy_pools')
        .insert({
          strategy_id: strategyId,
          current_nav: 1.0,
          daily_trade_limit: 30,
        })
        .select()
        .single();

      if (createError) {
        log.error('Failed to create pool', createError);
        throw createError;
      }

      data = newPool;
    }

    return this.mapPoolFromDb(data);
  }

  /**
   * Update pool capital when user invests
   */
  async addCapitalToPool(params: {
    strategyId: string;
    amount: number;
    orderId: string;
    userId: string;
  }): Promise<{ shares: number; nav: number }> {
    const pool = await this.getOrCreatePool(params.strategyId);

    // Calculate shares based on current NAV
    const sharesToIssue = params.amount / pool.currentNav;

    // Update pool
    await db()
      .from('ai_strategy_pools')
      .update({
        total_capital: pool.totalCapital + params.amount,
        available_capital: pool.availableCapital + params.amount,
        total_shares: pool.totalShares + sharesToIssue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pool.id);

    // Create order share record
    await db()
      .from('ai_order_shares')
      .insert({
        order_id: params.orderId,
        user_id: params.userId,
        pool_id: pool.id,
        shares_owned: sharesToIssue,
        share_percentage: (sharesToIssue / (pool.totalShares + sharesToIssue)) * 100,
        avg_entry_nav: pool.currentNav,
        total_invested: params.amount,
        current_value: params.amount,
        unrealized_pnl: 0,
        unrealized_pnl_pct: 0,
      });

    log.info('Added capital to pool', {
      strategyId: params.strategyId,
      amount: params.amount,
      shares: sharesToIssue,
      nav: pool.currentNav,
    });

    return { shares: sharesToIssue, nav: pool.currentNav };
  }

  /**
   * Get open positions for a pool
   */
  async getOpenPositions(poolId: string): Promise<OpenPosition[]> {
    const { data, error } = await db()
      .from('ai_open_positions')
      .select('*')
      .eq('pool_id', poolId);

    if (error) {
      log.error('Failed to get open positions', error);
      return [];
    }

    return (data || []).map(this.mapPositionFromDb);
  }

  /**
   * Open a new position
   */
  async openPosition(params: {
    poolId: string;
    strategyId: string;
    decisionId?: string;
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    quantity: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
    reasoning?: string;
    confidence?: number;
  }): Promise<OpenPosition> {
    const marginRequired = (params.quantity * params.entryPrice) / params.leverage;

    // Update pool locked capital
    await db()
      .from('ai_strategy_pools')
      .update({
        available_capital: db().raw(`available_capital - ${marginRequired}`),
        locked_capital: db().raw(`locked_capital + ${marginRequired}`),
        trades_today: db().raw('trades_today + 1'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.poolId);

    // Create position
    const { data, error } = await db()
      .from('ai_open_positions')
      .insert({
        pool_id: params.poolId,
        strategy_id: params.strategyId,
        decision_id: params.decisionId,
        symbol: params.symbol,
        side: params.side,
        entry_price: params.entryPrice,
        current_price: params.entryPrice,
        quantity: params.quantity,
        leverage: params.leverage,
        notional_value: params.quantity * params.entryPrice,
        margin_used: marginRequired,
        stop_loss_price: params.stopLoss,
        take_profit_price: params.takeProfit,
        entry_reasoning: params.reasoning,
        ai_confidence: params.confidence,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to open position', error);
      throw error;
    }

    log.info('Opened position', {
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      entryPrice: params.entryPrice,
    });

    return this.mapPositionFromDb(data);
  }

  /**
   * Update position prices and P&L
   */
  async updatePositionPrices(updates: Array<{ symbol: string; price: number }>): Promise<void> {
    for (const update of updates) {
      // Get all positions for this symbol
      const { data: positions } = await db()
        .from('ai_open_positions')
        .select('*')
        .eq('symbol', update.symbol);

      if (!positions?.length) continue;

      for (const pos of positions) {
        const pnl = pos.side === 'long'
          ? (update.price - pos.entry_price) * pos.quantity * pos.leverage
          : (pos.entry_price - update.price) * pos.quantity * pos.leverage;

        const pnlPct = ((pnl / (pos.margin_used || 1)) * 100);

        await db()
          .from('ai_open_positions')
          .update({
            current_price: update.price,
            notional_value: pos.quantity * update.price,
            unrealized_pnl: pnl,
            unrealized_pnl_pct: pnlPct,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pos.id);
      }
    }

    // Update pool unrealized P&L
    const { data: pools } = await db()
      .from('ai_strategy_pools')
      .select('id');

    for (const pool of pools || []) {
      const { data: positions } = await db()
        .from('ai_open_positions')
        .select('unrealized_pnl')
        .eq('pool_id', pool.id);

      const totalUnrealizedPnl = (positions || []).reduce(
        (sum: number, p: { unrealized_pnl: number }) => sum + (p.unrealized_pnl || 0),
        0
      );

      await db()
        .from('ai_strategy_pools')
        .update({
          unrealized_pnl: totalUnrealizedPnl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pool.id);
    }
  }

  // ============ Mappers ============

  private mapMemoryFromDb(data: Record<string, unknown>): AgentMemory {
    return {
      id: data.id as string,
      agentId: data.agent_id as string,
      memoryType: data.memory_type as AgentMemory['memoryType'],
      symbol: data.symbol as string | undefined,
      marketCondition: data.market_condition as Record<string, unknown> | undefined,
      patternDescription: data.pattern_description as string | undefined,
      confidenceScore: data.confidence_score as number | undefined,
      tradeAction: data.trade_action as string | undefined,
      entryPrice: data.entry_price as number | undefined,
      exitPrice: data.exit_price as number | undefined,
      pnl: data.pnl as number | undefined,
      pnlPct: data.pnl_pct as number | undefined,
      lessonLearned: data.lesson_learned as string | undefined,
      shouldRepeat: data.should_repeat as boolean,
      importanceWeight: data.importance_weight as number,
      createdAt: data.created_at as string,
      accessCount: data.access_count as number,
    };
  }

  private mapDecisionFromDb(data: Record<string, unknown>): DecisionLog {
    return {
      id: data.id as string,
      agentId: data.agent_id as string,
      strategyId: data.strategy_id as string,
      batchId: data.batch_id as string,
      decisionType: data.decision_type as DecisionLog['decisionType'],
      action: data.action as string | undefined,
      symbol: data.symbol as string | undefined,
      suggestedAmount: data.suggested_amount as number | undefined,
      suggestedPrice: data.suggested_price as number | undefined,
      stopLossPrice: data.stop_loss_price as number | undefined,
      takeProfitPrice: data.take_profit_price as number | undefined,
      leverage: data.leverage as number | undefined,
      marketAnalysis: data.market_analysis as string | undefined,
      reasoning: data.reasoning as string,
      confidenceScore: data.confidence_score as number,
      riskScore: data.risk_score as number | undefined,
      marketData: data.market_data as Record<string, unknown> | undefined,
      currentPositions: data.current_positions as Array<Record<string, unknown>> | undefined,
      poolCapital: data.pool_capital as number | undefined,
      wasExecuted: data.was_executed as boolean,
      executionId: data.execution_id as string | undefined,
      outcomePnl: data.outcome_pnl as number | undefined,
      wasSuccessful: data.was_successful as boolean | undefined,
      createdAt: data.created_at as string,
    };
  }

  private mapPoolFromDb(data: Record<string, unknown>): PoolInfo {
    return {
      id: data.id as string,
      strategyId: data.strategy_id as string,
      totalCapital: parseFloat(data.total_capital as string) || 0,
      availableCapital: parseFloat(data.available_capital as string) || 0,
      lockedCapital: parseFloat(data.locked_capital as string) || 0,
      currentNav: parseFloat(data.current_nav as string) || 1,
      totalShares: parseFloat(data.total_shares as string) || 0,
      totalPnl: parseFloat(data.total_pnl as string) || 0,
      unrealizedPnl: parseFloat(data.unrealized_pnl as string) || 0,
      winRate: parseFloat(data.win_rate as string) || 0,
      totalTrades: data.total_trades as number || 0,
      tradesToday: data.trades_today as number || 0,
      dailyTradeLimit: data.daily_trade_limit as number || 30,
    };
  }

  private mapPositionFromDb(data: Record<string, unknown>): OpenPosition {
    return {
      id: data.id as string,
      poolId: data.pool_id as string,
      symbol: data.symbol as string,
      side: data.side as 'long' | 'short',
      entryPrice: parseFloat(data.entry_price as string) || 0,
      currentPrice: data.current_price ? parseFloat(data.current_price as string) : undefined,
      quantity: parseFloat(data.quantity as string) || 0,
      leverage: parseFloat(data.leverage as string) || 1,
      unrealizedPnl: parseFloat(data.unrealized_pnl as string) || 0,
      unrealizedPnlPct: parseFloat(data.unrealized_pnl_pct as string) || 0,
      entryReasoning: data.entry_reasoning as string | undefined,
      aiConfidence: data.ai_confidence as number | undefined,
    };
  }
}

export const aiMemoryService = new AIMemoryService();
