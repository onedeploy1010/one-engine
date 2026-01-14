/**
 * AI Quant Service for ONE Engine
 * Comprehensive AI-driven trading strategies with real market data
 *
 * This service consolidates all AI quant functionality:
 * - Real-time price feeds from Bybit
 * - AI signal generation via OpenAI
 * - Strategy management with NAV tracking
 * - Order management with real profit/loss tracking
 * - Trade execution and allocation
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import { aiService, type StrategySignal } from '@/services/ai/ai.service';
import { bybitService } from '@/services/trading/bybit.service';

const log = new LogService({ service: 'AIQuantService' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

// ============ Types ============

export type StrategyCategory =
  | 'conservative'
  | 'balanced'
  | 'aggressive'
  | 'hedge'
  | 'arbitrage'
  | 'trend'
  | 'grid'
  | 'dca';

export type OrderStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'pending_redemption'
  | 'redeemed';

export type TradeAction =
  | 'buy'
  | 'sell'
  | 'long'
  | 'short'
  | 'close_long'
  | 'close_short';

export interface AIStrategy {
  id: string;
  name: string;
  description: string | null;
  category: StrategyCategory;
  riskLevel: number; // 1-10
  minInvestment: number;
  maxInvestment: number | null;
  lockPeriodDays: number;
  expectedApyMin: number | null;
  expectedApyMax: number | null;
  managementFeeRate: number; // e.g., 0.02 for 2%
  performanceFeeRate: number; // e.g., 0.20 for 20%
  supportedPairs: string[];
  supportedChains: string[];
  leverageMin: number;
  leverageMax: number;
  isActive: boolean;
  tvl: number; // Total Value Locked
  totalUsers: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  currentNav: number; // Net Asset Value per share
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface AIOrder {
  id: string;
  userId: string;
  strategyId: string;
  amount: number;
  currency: string;
  chain: string;
  status: OrderStatus;
  startDate: string;
  lockEndDate: string;
  lockPeriodDays: number;
  pauseCount: number;
  totalPauseDays: number;
  currentPauseStart: string | null;
  realizedProfit: number;
  unrealizedProfit: number;
  totalFeesPaid: number;
  currentNav: number | null;
  shareRatio: number; // User's share of the pool
  shares: number; // Number of shares owned
  redemptionRequestedAt: string | null;
  redemptionAmount: number | null;
  earlyWithdrawalPenaltyRate: number | null;
  penaltyAmount: number;
  txHashDeposit: string | null;
  txHashRedemption: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AITradeExecution {
  id: string;
  batchId: string;
  strategyId: string;
  tradeSeq: number;
  action: TradeAction;
  pair: string;
  entryPrice: number;
  exitPrice: number | null;
  amount: number;
  leverage: number;
  pnl: number;
  pnlPct: number;
  fee: number;
  status: 'open' | 'closed' | 'liquidated' | 'cancelled';
  openedAt: string;
  closedAt: string | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  externalOrderId: string | null;
  metadata: Record<string, unknown>;
}

export interface AITradeAllocation {
  id: string;
  executionId: string;
  orderId: string;
  userId: string;
  allocatedAmount: number;
  allocatedPnl: number;
  allocatedFee: number;
  shareRatio: number;
  createdAt: string;
}

export interface NavSnapshot {
  id: string;
  strategyId: string;
  snapshotDate: string;
  nav: number;
  dailyPnl: number;
  dailyPnlPct: number;
  cumulativePnl: number;
  cumulativePnlPct: number;
  totalAum: number;
  createdAt: string;
}

export interface PortfolioSummary {
  userId: string;
  totalInvested: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPct: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalFeesPaid: number;
  activeOrders: number;
  strategies: Array<{
    strategyId: string;
    strategyName: string;
    invested: number;
    currentValue: number;
    pnl: number;
    pnlPct: number;
  }>;
}

export interface CreateOrderParams {
  userId: string;
  strategyId: string;
  amount: number;
  currency: string;
  chain: string;
  lockPeriodDays?: number;
  txHashDeposit?: string;
}

export interface RedemptionResult {
  success: boolean;
  redemptionAmount: number;
  penaltyRate: number;
  penaltyAmount: number;
  completionRate: number;
  finalAmount: number;
}

// ============ Service Class ============

export class AIQuantService {
  // ============ Strategy Methods ============

  /**
   * Get all active AI strategies with real-time stats
   */
  async getStrategies(filters?: {
    category?: StrategyCategory;
    riskLevel?: number;
    minTvl?: number;
    isActive?: boolean;
  }): Promise<AIStrategy[]> {
    let query = db()
      .from('ai_strategies')
      .select('*')
      .order('tvl', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.riskLevel) {
      query = query.eq('risk_level', filters.riskLevel);
    }
    if (filters?.minTvl) {
      query = query.gte('tvl', filters.minTvl);
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch strategies: ${error.message}`);
    }

    return (data || []).map(this.mapStrategy);
  }

  /**
   * Get strategy by ID with real-time performance metrics
   */
  async getStrategy(strategyId: string): Promise<AIStrategy | null> {
    const { data, error } = await db()
      .from('ai_strategies')
      .select('*')
      .eq('id', strategyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch strategy: ${error.message}`);
    }

    return data ? this.mapStrategy(data) : null;
  }

  /**
   * Get strategy performance history with real NAV data
   */
  async getStrategyPerformance(strategyId: string, days = 30): Promise<NavSnapshot[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await db()
      .from('ai_nav_snapshots')
      .select('*')
      .eq('strategy_id', strategyId)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch performance: ${error.message}`);
    }

    return (data || []).map(this.mapNavSnapshot);
  }

  /**
   * Get real-time market data for strategy's trading pairs
   */
  async getStrategyMarketData(strategyId: string): Promise<Array<{
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
  }>> {
    const strategy = await this.getStrategy(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    const marketData = await bybitService.getMarketDataBatch(strategy.supportedPairs);

    return marketData.map(m => ({
      symbol: m.symbol,
      price: m.lastPrice,
      change24h: m.change24h,
      volume24h: m.volume24h,
      high24h: m.high24h,
      low24h: m.low24h,
    }));
  }

  // ============ Order Methods ============

  /**
   * Create a new AI trading order
   */
  async createOrder(params: CreateOrderParams): Promise<AIOrder> {
    log.info('Creating AI order', { userId: params.userId, strategyId: params.strategyId, amount: params.amount });

    // Get strategy
    const strategy = await this.getStrategy(params.strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    if (!strategy.isActive) {
      throw new Error('Strategy is not accepting new investments');
    }

    if (params.amount < strategy.minInvestment) {
      throw new Error(`Minimum investment is ${strategy.minInvestment}`);
    }

    if (strategy.maxInvestment && params.amount > strategy.maxInvestment) {
      throw new Error(`Maximum investment is ${strategy.maxInvestment}`);
    }

    // Calculate shares based on current NAV
    const currentNav = strategy.currentNav || 1;
    const shares = params.amount / currentNav;
    const lockPeriodDays = params.lockPeriodDays || strategy.lockPeriodDays;

    // Calculate lock end date
    const startDate = new Date();
    const lockEndDate = new Date(startDate);
    lockEndDate.setDate(lockEndDate.getDate() + lockPeriodDays);

    // Create order
    const { data, error } = await db()
      .from('ai_orders')
      .insert({
        user_id: params.userId,
        strategy_id: params.strategyId,
        amount: params.amount,
        currency: params.currency,
        chain: params.chain,
        status: 'active',
        start_date: startDate.toISOString(),
        lock_end_date: lockEndDate.toISOString(),
        lock_period_days: lockPeriodDays,
        pause_count: 0,
        total_pause_days: 0,
        realized_profit: 0,
        unrealized_profit: 0,
        total_fees_paid: 0,
        current_nav: currentNav,
        shares,
        share_ratio: shares / (strategy.tvl / currentNav + shares),
        penalty_amount: 0,
        tx_hash_deposit: params.txHashDeposit,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create order', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }

    // Update strategy TVL
    await db()
      .from('ai_strategies')
      .update({
        tvl: strategy.tvl + params.amount,
        total_users: strategy.totalUsers + 1,
      })
      .eq('id', params.strategyId);

    // Record order event
    await this.recordOrderEvent(data.id, 'created', null, 'active', params.amount);

    log.info('AI order created', { orderId: data.id });

    return this.mapOrder(data);
  }

  /**
   * Get user's AI orders
   */
  async getUserOrders(userId: string, filters?: {
    strategyId?: string;
    status?: OrderStatus;
  }): Promise<AIOrder[]> {
    let query = db()
      .from('ai_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    // Update unrealized PnL with current NAV
    const orders = (data || []).map(this.mapOrder);
    for (const order of orders) {
      if (order.status === 'active' || order.status === 'paused') {
        const strategy = await this.getStrategy(order.strategyId);
        if (strategy) {
          const currentValue = order.shares * strategy.currentNav;
          order.unrealizedProfit = currentValue - order.amount;
          order.currentNav = strategy.currentNav;
        }
      }
    }

    return orders;
  }

  /**
   * Get order by ID with real-time valuation
   */
  async getOrder(orderId: string): Promise<AIOrder | null> {
    const { data, error } = await db()
      .from('ai_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch order: ${error.message}`);
    }

    if (!data) return null;

    const order = this.mapOrder(data);

    // Update with current NAV
    if (order.status === 'active' || order.status === 'paused') {
      const strategy = await this.getStrategy(order.strategyId);
      if (strategy) {
        const currentValue = order.shares * strategy.currentNav;
        order.unrealizedProfit = currentValue - order.amount;
        order.currentNav = strategy.currentNav;
      }
    }

    return order;
  }

  /**
   * Pause an order
   */
  async pauseOrder(orderId: string, userId: string): Promise<AIOrder> {
    const order = await this.getOrder(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (order.status !== 'active') {
      throw new Error('Order is not active');
    }

    const { data, error } = await db()
      .from('ai_orders')
      .update({
        status: 'paused',
        current_pause_start: new Date().toISOString(),
        pause_count: order.pauseCount + 1,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to pause order: ${error.message}`);
    }

    await this.recordOrderEvent(orderId, 'paused', 'active', 'paused');

    log.info('Order paused', { orderId });

    return this.mapOrder(data);
  }

  /**
   * Resume a paused order
   */
  async resumeOrder(orderId: string, userId: string): Promise<AIOrder> {
    const order = await this.getOrder(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (order.status !== 'paused') {
      throw new Error('Order is not paused');
    }

    // Calculate pause days
    let pauseDays = order.totalPauseDays;
    if (order.currentPauseStart) {
      const pauseStart = new Date(order.currentPauseStart);
      const now = new Date();
      pauseDays += Math.ceil((now.getTime() - pauseStart.getTime()) / (1000 * 60 * 60 * 24));
    }

    const { data, error } = await db()
      .from('ai_orders')
      .update({
        status: 'active',
        current_pause_start: null,
        total_pause_days: pauseDays,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resume order: ${error.message}`);
    }

    await this.recordOrderEvent(orderId, 'resumed', 'paused', 'active');

    log.info('Order resumed', { orderId, pauseDays });

    return this.mapOrder(data);
  }

  /**
   * Request redemption (early or at maturity)
   */
  async requestRedemption(orderId: string, userId: string): Promise<RedemptionResult> {
    const order = await this.getOrder(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (order.status === 'redeemed' || order.status === 'cancelled') {
      throw new Error('Order already redeemed or cancelled');
    }

    const strategy = await this.getStrategy(order.strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Calculate current value
    const currentValue = order.shares * strategy.currentNav;
    const profit = currentValue - order.amount;

    // Calculate early withdrawal penalty if applicable
    const lockEndDate = new Date(order.lockEndDate);
    const now = new Date();
    const isEarlyWithdrawal = now < lockEndDate;

    let penaltyRate = 0;
    let penaltyAmount = 0;
    let completionRate = 1;

    if (isEarlyWithdrawal) {
      // Calculate completion rate (how much of lock period completed)
      const startDate = new Date(order.startDate);
      const totalLockDays = order.lockPeriodDays;
      const daysCompleted = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) - order.totalPauseDays);
      completionRate = Math.min(1, daysCompleted / totalLockDays);

      // Early withdrawal penalty: scales from 10% at 0% completion to 0% at 100%
      penaltyRate = 0.1 * (1 - completionRate);
      penaltyAmount = currentValue * penaltyRate;
    }

    // Calculate performance fee on profits
    const performanceFee = profit > 0 ? profit * strategy.performanceFeeRate : 0;
    const finalAmount = currentValue - penaltyAmount - performanceFee;

    // Update order
    const { error } = await db()
      .from('ai_orders')
      .update({
        status: 'pending_redemption',
        redemption_requested_at: now.toISOString(),
        redemption_amount: currentValue,
        early_withdrawal_penalty_rate: penaltyRate,
        penalty_amount: penaltyAmount,
        realized_profit: profit - performanceFee,
        total_fees_paid: order.totalFeesPaid + performanceFee,
      })
      .eq('id', orderId);

    if (error) {
      throw new Error(`Failed to request redemption: ${error.message}`);
    }

    await this.recordOrderEvent(orderId, 'redemption_requested', order.status, 'pending_redemption', finalAmount, {
      penaltyRate,
      penaltyAmount,
      performanceFee,
      completionRate,
    });

    // Update strategy TVL
    await db()
      .from('ai_strategies')
      .update({
        tvl: strategy.tvl - order.amount,
      })
      .eq('id', order.strategyId);

    log.info('Redemption requested', {
      orderId,
      currentValue,
      penaltyAmount,
      finalAmount,
      isEarlyWithdrawal,
    });

    return {
      success: true,
      redemptionAmount: currentValue,
      penaltyRate,
      penaltyAmount,
      completionRate,
      finalAmount,
    };
  }

  /**
   * Complete redemption (admin or automated)
   */
  async completeRedemption(orderId: string, txHash?: string): Promise<AIOrder> {
    const { data, error } = await db()
      .from('ai_orders')
      .update({
        status: 'redeemed',
        tx_hash_redemption: txHash,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete redemption: ${error.message}`);
    }

    await this.recordOrderEvent(orderId, 'redeemed', 'pending_redemption', 'redeemed');

    log.info('Redemption completed', { orderId, txHash });

    return this.mapOrder(data);
  }

  // ============ Portfolio Methods ============

  /**
   * Get user's portfolio summary with real-time values
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const orders = await this.getUserOrders(userId, { status: 'active' });
    const allOrders = await this.getUserOrders(userId);

    let totalInvested = 0;
    let currentValue = 0;
    let realizedPnl = 0;
    let unrealizedPnl = 0;
    let totalFeesPaid = 0;
    const strategyMap = new Map<string, { name: string; invested: number; value: number }>();

    for (const order of allOrders) {
      totalFeesPaid += order.totalFeesPaid;
      realizedPnl += order.realizedProfit;

      if (order.status === 'redeemed' || order.status === 'cancelled') {
        continue;
      }

      const strategy = await this.getStrategy(order.strategyId);
      if (!strategy) continue;

      const orderValue = order.shares * strategy.currentNav;

      totalInvested += order.amount;
      currentValue += orderValue;
      unrealizedPnl += orderValue - order.amount;

      const existing = strategyMap.get(order.strategyId) || {
        name: strategy.name,
        invested: 0,
        value: 0
      };
      existing.invested += order.amount;
      existing.value += orderValue;
      strategyMap.set(order.strategyId, existing);
    }

    const totalPnl = realizedPnl + unrealizedPnl;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return {
      userId,
      totalInvested,
      currentValue,
      totalPnl,
      totalPnlPct,
      realizedPnl,
      unrealizedPnl,
      totalFeesPaid,
      activeOrders: orders.length,
      strategies: Array.from(strategyMap.entries()).map(([strategyId, data]) => ({
        strategyId,
        strategyName: data.name,
        invested: data.invested,
        currentValue: data.value,
        pnl: data.value - data.invested,
        pnlPct: data.invested > 0 ? ((data.value - data.invested) / data.invested) * 100 : 0,
      })),
    };
  }

  // ============ Trade Execution Methods ============

  /**
   * Execute AI-generated trading signals
   */
  async executeAISignals(strategyId: string): Promise<AITradeExecution[]> {
    log.info('Executing AI signals for strategy', { strategyId });

    const strategy = await this.getStrategy(strategyId);
    if (!strategy || !strategy.isActive) {
      throw new Error('Strategy not found or not active');
    }

    // Get current market data
    const marketData = await bybitService.getMarketDataBatch(strategy.supportedPairs);

    // Get current open positions
    const openTrades = await this.getOpenTrades(strategyId);

    // Generate AI signals
    const signals = await aiService.generateSignals({
      strategyType: strategy.category,
      riskLevel: this.getRiskLevelString(strategy.riskLevel),
      positions: openTrades.map(t => ({
        symbol: t.pair,
        quantity: t.amount,
        entryPrice: t.entryPrice,
      })),
      marketData: marketData.map(m => ({
        symbol: m.symbol,
        price: m.lastPrice,
      })),
      availableCapital: strategy.tvl * 0.2, // Use 20% for new positions
      maxPositionSize: strategy.tvl * 0.1, // Max 10% per position
    });

    log.info('AI signals generated', { strategyId, signalCount: signals.length });

    const executions: AITradeExecution[] = [];
    const batchId = `batch_${Date.now()}`;
    let tradeSeq = 0;

    // Execute high-confidence signals
    for (const signal of signals) {
      if (signal.confidence >= 75 && signal.action !== 'hold') {
        try {
          const execution = await this.executeTrade(strategyId, batchId, ++tradeSeq, signal);
          executions.push(execution);
        } catch (error) {
          log.error('Failed to execute signal', error as Error, { signal });
        }
      }
    }

    // Update strategy statistics
    await this.updateStrategyStats(strategyId);

    return executions;
  }

  /**
   * Execute a single trade
   */
  private async executeTrade(
    strategyId: string,
    batchId: string,
    tradeSeq: number,
    signal: StrategySignal
  ): Promise<AITradeExecution> {
    log.info('Executing trade', { strategyId, signal });

    // Place order via Bybit
    const orderResult = await bybitService.placeOrder({
      positionId: strategyId, // Use strategy ID as position reference
      strategyId,
      symbol: signal.symbol,
      side: signal.action as 'buy' | 'sell',
      type: signal.price ? 'limit' : 'market',
      quantity: signal.quantity,
      price: signal.price,
    });

    // Get fill price
    const fillPrice = orderResult.avgPrice || signal.price || 0;

    // Record trade execution
    const { data, error } = await db()
      .from('ai_trade_executions')
      .insert({
        batch_id: batchId,
        strategy_id: strategyId,
        trade_seq: tradeSeq,
        action: signal.action,
        pair: signal.symbol,
        entry_price: fillPrice,
        amount: signal.quantity,
        leverage: 1,
        pnl: 0,
        pnl_pct: 0,
        fee: 0,
        status: 'open',
        ai_confidence: signal.confidence,
        ai_reasoning: signal.reason,
        external_order_id: orderResult.externalId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record trade: ${error.message}`);
    }

    // Allocate trade to active orders
    await this.allocateTradeToOrders(data.id, strategyId);

    // Place stop-loss if provided
    if (signal.stopLoss && signal.action === 'buy') {
      await bybitService.placeOrder({
        positionId: strategyId,
        strategyId,
        symbol: signal.symbol,
        side: 'sell',
        type: 'stop',
        quantity: signal.quantity,
        stopPrice: signal.stopLoss,
        reduceOnly: true,
      });
    }

    return this.mapTradeExecution(data);
  }

  /**
   * Allocate trade P&L to user orders
   */
  private async allocateTradeToOrders(executionId: string, strategyId: string): Promise<void> {
    // Get all active orders for this strategy
    const { data: orders } = await db()
      .from('ai_orders')
      .select('*')
      .eq('strategy_id', strategyId)
      .in('status', ['active']);

    if (!orders || orders.length === 0) return;

    // Calculate total shares
    const totalShares = orders.reduce((sum, o) => sum + (o.shares || 0), 0);
    if (totalShares === 0) return;

    // Create allocations
    const allocations = orders.map(order => ({
      execution_id: executionId,
      order_id: order.id,
      user_id: order.user_id,
      allocated_amount: 0, // Will be updated when trade closes
      allocated_pnl: 0,
      allocated_fee: 0,
      share_ratio: order.shares / totalShares,
    }));

    await db().from('ai_trade_allocations').insert(allocations);
  }

  /**
   * Close a trade and allocate P&L
   */
  async closeTrade(executionId: string, exitPrice: number): Promise<AITradeExecution> {
    const { data: trade, error: fetchError } = await db()
      .from('ai_trade_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (fetchError || !trade) {
      throw new Error('Trade not found');
    }

    // Calculate P&L
    const isLong = ['buy', 'long'].includes(trade.action);
    const priceChange = isLong
      ? (exitPrice - trade.entry_price) / trade.entry_price
      : (trade.entry_price - exitPrice) / trade.entry_price;

    const pnl = trade.amount * priceChange * trade.leverage;
    const pnlPct = priceChange * 100 * trade.leverage;
    const fee = Math.abs(pnl) * 0.001; // 0.1% fee

    // Update trade execution
    const { data: updatedTrade, error: updateError } = await db()
      .from('ai_trade_executions')
      .update({
        exit_price: exitPrice,
        pnl,
        pnl_pct: pnlPct,
        fee,
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', executionId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to close trade: ${updateError.message}`);
    }

    // Update allocations
    const { data: allocations } = await db()
      .from('ai_trade_allocations')
      .select('*')
      .eq('execution_id', executionId);

    for (const allocation of allocations || []) {
      const allocatedPnl = pnl * allocation.share_ratio;
      const allocatedFee = fee * allocation.share_ratio;

      await db()
        .from('ai_trade_allocations')
        .update({
          allocated_pnl: allocatedPnl,
          allocated_fee: allocatedFee,
        })
        .eq('id', allocation.id);

      // Update order's realized profit
      await db()
        .from('ai_orders')
        .update({
          realized_profit: db().raw(`realized_profit + ${allocatedPnl - allocatedFee}`),
          total_fees_paid: db().raw(`total_fees_paid + ${allocatedFee}`),
        })
        .eq('id', allocation.order_id);
    }

    return this.mapTradeExecution(updatedTrade);
  }

  /**
   * Get open trades for a strategy
   */
  async getOpenTrades(strategyId: string): Promise<AITradeExecution[]> {
    const { data, error } = await db()
      .from('ai_trade_executions')
      .select('*')
      .eq('strategy_id', strategyId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch open trades: ${error.message}`);
    }

    return (data || []).map(this.mapTradeExecution);
  }

  /**
   * Get trade history for a strategy
   */
  async getTradeHistory(strategyId: string, limit = 50): Promise<AITradeExecution[]> {
    const { data, error } = await db()
      .from('ai_trade_executions')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch trade history: ${error.message}`);
    }

    return (data || []).map(this.mapTradeExecution);
  }

  /**
   * Get user's trade allocations
   */
  async getUserTradeAllocations(userId: string, limit = 50): Promise<AITradeAllocation[]> {
    const { data, error } = await db()
      .from('ai_trade_allocations')
      .select(`
        *,
        ai_trade_executions (
          *
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch allocations: ${error.message}`);
    }

    return (data || []).map(row => ({
      id: row.id,
      executionId: row.execution_id,
      orderId: row.order_id,
      userId: row.user_id,
      allocatedAmount: row.allocated_amount,
      allocatedPnl: row.allocated_pnl,
      allocatedFee: row.allocated_fee,
      shareRatio: row.share_ratio,
      createdAt: row.created_at,
    }));
  }

  // ============ NAV & Statistics ============

  /**
   * Update daily NAV snapshot
   */
  async updateDailyNav(strategyId: string): Promise<NavSnapshot> {
    const strategy = await this.getStrategy(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Get yesterday's NAV
    const { data: lastNav } = await db()
      .from('ai_nav_snapshots')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    const prevNav = lastNav?.nav || 1;
    const prevCumulativePnl = lastNav?.cumulative_pnl || 0;

    // Get today's trades
    const today = new Date().toISOString().split('T')[0];
    const { data: todayTrades } = await db()
      .from('ai_trade_executions')
      .select('*')
      .eq('strategy_id', strategyId)
      .gte('closed_at', today)
      .eq('status', 'closed');

    // Calculate daily P&L
    const dailyPnl = (todayTrades || []).reduce((sum, t) => sum + t.pnl, 0);
    const dailyPnlPct = strategy.tvl > 0 ? (dailyPnl / strategy.tvl) * 100 : 0;

    // Calculate new NAV
    const newNav = prevNav * (1 + dailyPnlPct / 100);
    const cumulativePnl = prevCumulativePnl + dailyPnl;
    const cumulativePnlPct = strategy.tvl > 0 ? (cumulativePnl / strategy.tvl) * 100 : 0;

    // Insert NAV snapshot
    const { data, error } = await db()
      .from('ai_nav_snapshots')
      .insert({
        strategy_id: strategyId,
        snapshot_date: today,
        nav: newNav,
        daily_pnl: dailyPnl,
        daily_pnl_pct: dailyPnlPct,
        cumulative_pnl: cumulativePnl,
        cumulative_pnl_pct: cumulativePnlPct,
        total_aum: strategy.tvl,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update NAV: ${error.message}`);
    }

    // Update strategy's current NAV
    await db()
      .from('ai_strategies')
      .update({ current_nav: newNav })
      .eq('id', strategyId);

    return this.mapNavSnapshot(data);
  }

  /**
   * Update strategy statistics
   */
  private async updateStrategyStats(strategyId: string): Promise<void> {
    // Get all trades for this strategy
    const { data: trades } = await db()
      .from('ai_trade_executions')
      .select('*')
      .eq('strategy_id', strategyId)
      .eq('status', 'closed');

    if (!trades || trades.length === 0) return;

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const winRate = (winningTrades / totalTrades) * 100;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let cumPnl = 0;
    for (const trade of trades) {
      cumPnl += trade.pnl;
      if (cumPnl > peak) peak = cumPnl;
      const drawdown = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    await db()
      .from('ai_strategies')
      .update({
        total_trades: totalTrades,
        win_rate: winRate,
        max_drawdown: maxDrawdown,
      })
      .eq('id', strategyId);
  }

  // ============ Event Recording ============

  private async recordOrderEvent(
    orderId: string,
    eventType: string,
    oldStatus: string | null,
    newStatus: string,
    amount?: number,
    details?: Record<string, unknown>
  ): Promise<void> {
    await db().from('ai_order_events').insert({
      order_id: orderId,
      event_type: eventType,
      old_status: oldStatus,
      new_status: newStatus,
      amount,
      details: details || {},
    });
  }

  // ============ Mappers ============

  private mapStrategy(row: any): AIStrategy {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      riskLevel: row.risk_level,
      minInvestment: row.min_investment,
      maxInvestment: row.max_investment,
      lockPeriodDays: row.lock_period_days,
      expectedApyMin: row.expected_apy_min,
      expectedApyMax: row.expected_apy_max,
      managementFeeRate: row.management_fee_rate,
      performanceFeeRate: row.performance_fee_rate,
      supportedPairs: row.supported_pairs || ['BTCUSDT', 'ETHUSDT'],
      supportedChains: row.supported_chains || ['ethereum', 'bsc'],
      leverageMin: row.leverage_min || 1,
      leverageMax: row.leverage_max || 1,
      isActive: row.is_active,
      tvl: row.tvl || 0,
      totalUsers: row.total_users || 0,
      totalTrades: row.total_trades || 0,
      winRate: row.win_rate || 0,
      maxDrawdown: row.max_drawdown || 0,
      sharpeRatio: row.sharpe_ratio || 0,
      currentNav: row.current_nav || 1,
      createdAt: row.created_at,
      metadata: row.metadata || {},
    };
  }

  private mapOrder(row: any): AIOrder {
    return {
      id: row.id,
      userId: row.user_id,
      strategyId: row.strategy_id,
      amount: row.amount,
      currency: row.currency,
      chain: row.chain,
      status: row.status,
      startDate: row.start_date,
      lockEndDate: row.lock_end_date,
      lockPeriodDays: row.lock_period_days,
      pauseCount: row.pause_count || 0,
      totalPauseDays: row.total_pause_days || 0,
      currentPauseStart: row.current_pause_start,
      realizedProfit: row.realized_profit || 0,
      unrealizedProfit: row.unrealized_profit || 0,
      totalFeesPaid: row.total_fees_paid || 0,
      currentNav: row.current_nav,
      shareRatio: row.share_ratio || 0,
      shares: row.shares || 0,
      redemptionRequestedAt: row.redemption_requested_at,
      redemptionAmount: row.redemption_amount,
      earlyWithdrawalPenaltyRate: row.early_withdrawal_penalty_rate,
      penaltyAmount: row.penalty_amount || 0,
      txHashDeposit: row.tx_hash_deposit,
      txHashRedemption: row.tx_hash_redemption,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTradeExecution(row: any): AITradeExecution {
    return {
      id: row.id,
      batchId: row.batch_id,
      strategyId: row.strategy_id,
      tradeSeq: row.trade_seq,
      action: row.action,
      pair: row.pair,
      entryPrice: row.entry_price,
      exitPrice: row.exit_price,
      amount: row.amount,
      leverage: row.leverage || 1,
      pnl: row.pnl || 0,
      pnlPct: row.pnl_pct || 0,
      fee: row.fee || 0,
      status: row.status,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      aiConfidence: row.ai_confidence,
      aiReasoning: row.ai_reasoning,
      externalOrderId: row.external_order_id,
      metadata: row.metadata || {},
    };
  }

  private mapNavSnapshot(row: any): NavSnapshot {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      snapshotDate: row.snapshot_date,
      nav: row.nav,
      dailyPnl: row.daily_pnl || 0,
      dailyPnlPct: row.daily_pnl_pct || 0,
      cumulativePnl: row.cumulative_pnl || 0,
      cumulativePnlPct: row.cumulative_pnl_pct || 0,
      totalAum: row.total_aum || 0,
      createdAt: row.created_at,
    };
  }

  private getRiskLevelString(level: number): string {
    if (level <= 3) return 'low';
    if (level <= 6) return 'medium';
    if (level <= 8) return 'high';
    return 'aggressive';
  }
}

export const aiQuantService = new AIQuantService();
