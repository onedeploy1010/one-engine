/**
 * Quant Service for ONE Engine
 * AI-driven trading strategies and position management
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import type {
  QuantStrategy,
  QuantPosition,
  PositionStatus,
  StrategyType,
  RiskLevel,
} from '@/types';

const log = new LogService({ service: 'QuantService' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface CreatePositionParams {
  userId: string;
  strategyId: string;
  amount: number;
}

export interface PositionUpdate {
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export class QuantService {
  // ============ Strategy Methods ============

  /**
   * Get all active strategies
   */
  async getStrategies(filters?: {
    type?: StrategyType;
    riskLevel?: RiskLevel;
    isActive?: boolean;
  }): Promise<QuantStrategy[]> {
    let query = db()
      .from('quant_strategies')
      .select('*')
      .order('expected_apy', { ascending: false });

    if (filters?.type) {
      query = query.eq('strategy_type', filters.type);
    }
    if (filters?.riskLevel) {
      query = query.eq('risk_level', filters.riskLevel);
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch strategies: ${error.message}`);
    }

    return data.map(row => this.mapToStrategy(row));
  }

  /**
   * Get strategy by ID
   */
  async getStrategy(strategyId: string): Promise<QuantStrategy | null> {
    const { data, error } = await db()
      .from('quant_strategies')
      .select('*')
      .eq('id', strategyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch strategy: ${error.message}`);
    }

    return data ? this.mapToStrategy(data) : null;
  }

  /**
   * Get strategy performance history
   */
  async getStrategyPerformance(strategyId: string, days = 30): Promise<Array<{
    date: string;
    navPrice: number;
    dailyReturn: number;
    cumulativeReturn: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await db()
      .from('nav_snapshots')
      .select('*')
      .eq('strategy_id', strategyId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch performance: ${error.message}`);
    }

    return data.map(row => ({
      date: row.date,
      navPrice: row.nav_price,
      dailyReturn: row.daily_return || 0,
      cumulativeReturn: row.cumulative_return || 0,
    }));
  }

  // ============ Position Methods ============

  /**
   * Open a new position
   */
  async openPosition(params: CreatePositionParams): Promise<QuantPosition> {
    log.info('Opening position', {
      userId: params.userId,
      strategyId: params.strategyId,
      amount: params.amount,
    });

    // Get strategy
    const strategy = await this.getStrategy(params.strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    if (!strategy.isActive) {
      throw new Error('Strategy is not active');
    }

    if (params.amount < strategy.minInvestment) {
      throw new Error(`Minimum investment is ${strategy.minInvestment}`);
    }

    if (params.amount > strategy.maxInvestment) {
      throw new Error(`Maximum investment is ${strategy.maxInvestment}`);
    }

    // Get current NAV price (default to 1 if no snapshots)
    const { data: navData } = await db()
      .from('nav_snapshots')
      .select('nav_price')
      .eq('strategy_id', params.strategyId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const navPrice = navData?.nav_price || 1;
    const shares = params.amount / navPrice;

    // Create position
    const { data, error } = await db()
      .from('quant_positions')
      .insert({
        user_id: params.userId,
        strategy_id: params.strategyId,
        status: 'active',
        invested_amount: params.amount,
        current_value: params.amount,
        pnl: 0,
        pnl_percent: 0,
        shares,
        entry_nav: navPrice,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create position', error);
      throw new Error(`Failed to create position: ${error.message}`);
    }

    // Update strategy AUM
    await db()
      .from('quant_strategies')
      .update({
        total_aum: strategy.parameters.totalAum
          ? (strategy.parameters.totalAum as number) + params.amount
          : params.amount,
      })
      .eq('id', params.strategyId);

    log.info('Position opened', { positionId: data.id });

    return this.mapToPosition(data);
  }

  /**
   * Get user's positions
   */
  async getUserPositions(
    userId: string,
    filters?: {
      strategyId?: string;
      status?: PositionStatus;
    }
  ): Promise<QuantPosition[]> {
    let query = db()
      .from('quant_positions')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false });

    if (filters?.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch positions: ${error.message}`);
    }

    return data.map(row => this.mapToPosition(row));
  }

  /**
   * Get position by ID
   */
  async getPosition(positionId: string): Promise<QuantPosition | null> {
    const { data, error } = await db()
      .from('quant_positions')
      .select('*')
      .eq('id', positionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch position: ${error.message}`);
    }

    return data ? this.mapToPosition(data) : null;
  }

  /**
   * Pause a position
   */
  async pausePosition(positionId: string, userId: string): Promise<QuantPosition> {
    const position = await this.getPosition(positionId);

    if (!position) {
      throw new Error('Position not found');
    }

    if (position.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (position.status !== 'active') {
      throw new Error('Position is not active');
    }

    const { data, error } = await db()
      .from('quant_positions')
      .update({ status: 'paused' })
      .eq('id', positionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to pause position: ${error.message}`);
    }

    log.info('Position paused', { positionId });

    return this.mapToPosition(data);
  }

  /**
   * Resume a paused position
   */
  async resumePosition(positionId: string, userId: string): Promise<QuantPosition> {
    const position = await this.getPosition(positionId);

    if (!position) {
      throw new Error('Position not found');
    }

    if (position.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (position.status !== 'paused') {
      throw new Error('Position is not paused');
    }

    const { data, error } = await db()
      .from('quant_positions')
      .update({ status: 'active' })
      .eq('id', positionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resume position: ${error.message}`);
    }

    log.info('Position resumed', { positionId });

    return this.mapToPosition(data);
  }

  /**
   * Close a position (redeem)
   */
  async closePosition(positionId: string, userId: string): Promise<{
    position: QuantPosition;
    redeemAmount: number;
  }> {
    const position = await this.getPosition(positionId);

    if (!position) {
      throw new Error('Position not found');
    }

    if (position.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (position.status === 'closed') {
      throw new Error('Position is already closed');
    }

    const redeemAmount = position.currentValue;

    const { data, error } = await db()
      .from('quant_positions')
      .update({
        status: 'closed',
        exit_date: new Date().toISOString(),
      })
      .eq('id', positionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to close position: ${error.message}`);
    }

    log.info('Position closed', { positionId, redeemAmount });

    return {
      position: this.mapToPosition(data),
      redeemAmount,
    };
  }

  /**
   * Update position values (called by worker)
   */
  async updatePositionValue(positionId: string, update: PositionUpdate): Promise<void> {
    await db()
      .from('quant_positions')
      .update({
        current_value: update.currentValue,
        pnl: update.pnl,
        pnl_percent: update.pnlPercent,
        last_update: new Date().toISOString(),
      })
      .eq('id', positionId);
  }

  /**
   * Record daily PnL for a position
   */
  async recordDailyPnl(
    positionId: string,
    openingValue: number,
    closingValue: number,
    navPrice: number
  ): Promise<void> {
    const dailyPnlPercent = openingValue > 0
      ? ((closingValue - openingValue) / openingValue) * 100
      : 0;

    await db()
      .from('quant_daily_pnl')
      .insert({
        position_id: positionId,
        date: new Date().toISOString().split('T')[0],
        opening_value: openingValue,
        closing_value: closingValue,
        daily_pnl_percent: dailyPnlPercent,
        nav_price: navPrice,
      });
  }

  /**
   * Get user's total portfolio summary
   */
  async getPortfolioSummary(userId: string): Promise<{
    totalInvested: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activePositions: number;
  }> {
    const positions = await this.getUserPositions(userId, { status: 'active' });

    const totalInvested = positions.reduce((sum, p) => sum + p.investedAmount, 0);
    const currentValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnl = currentValue - totalInvested;
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return {
      totalInvested,
      currentValue,
      totalPnl,
      totalPnlPercent,
      activePositions: positions.length,
    };
  }

  // ============ Mappers ============

  private mapToStrategy(row: any): QuantStrategy {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.strategy_type,
      riskLevel: row.risk_level,
      minInvestment: row.min_investment,
      maxInvestment: row.max_investment,
      expectedApy: row.expected_apy,
      isActive: row.is_active,
      parameters: row.parameters || {},
      createdAt: row.created_at,
    };
  }

  private mapToPosition(row: any): QuantPosition {
    return {
      id: row.id,
      userId: row.user_id,
      strategyId: row.strategy_id,
      status: row.status,
      investedAmount: row.invested_amount,
      currentValue: row.current_value || row.invested_amount,
      pnl: row.pnl || 0,
      pnlPercent: row.pnl_percent || 0,
      entryDate: row.entry_date,
      lastUpdate: row.last_update,
    };
  }
}

export const quantService = new QuantService();
