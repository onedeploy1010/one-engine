/**
 * ForexService for ONE Engine
 * StableFX on-chain forex custody trading with USDC stablecoin pairs
 * Manages investments, trades, pools, and portfolio operations
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import {
  FOREX_PAIRS,
  FOREX_CYCLE_OPTIONS,
  FOREX_AGENT_CONFIG,
  type ForexInvestment,
  type ForexTrade,
  type ForexPool,
  type ForexPoolType,
  type ForexInvestmentStatus,
  type ForexTradeStatus,
  type ForexModuleStats,
  type ForexPortfolioSummary,
  type CreateForexInvestmentParams,
  type ForexCurrencyPair,
} from '@/types/forex';

const log = new LogService({ service: 'ForexService' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export class ForexService {
  // ============ Currency Pairs ============

  getPairs(): ForexCurrencyPair[] {
    return FOREX_PAIRS.filter(p => p.isActive);
  }

  getPairById(pairId: string): ForexCurrencyPair | undefined {
    return FOREX_PAIRS.find(p => p.id === pairId);
  }

  // ============ Pools ============

  async getPools(): Promise<ForexPool[]> {
    const { data, error } = await db()
      .from('forex_pools')
      .select('*')
      .order('allocation', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch pools: ${error.message}`);
    }

    return data.map((row: any) => this.mapToPool(row));
  }

  async getPool(poolType: ForexPoolType): Promise<ForexPool | null> {
    const { data, error } = await db()
      .from('forex_pools')
      .select('*')
      .eq('pool_type', poolType)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch pool: ${error.message}`);
    }

    return data ? this.mapToPool(data) : null;
  }

  // ============ Investments ============

  async createInvestment(params: CreateForexInvestmentParams): Promise<ForexInvestment> {
    const { userId, amount, selectedPairs, cycleDays } = params;

    // Validate amount
    if (amount < FOREX_AGENT_CONFIG.minInvestment) {
      throw new Error(`Minimum investment is $${FOREX_AGENT_CONFIG.minInvestment}`);
    }
    if (amount > FOREX_AGENT_CONFIG.maxInvestment) {
      throw new Error(`Maximum investment is $${FOREX_AGENT_CONFIG.maxInvestment}`);
    }

    // Validate pairs
    const validPairIds = FOREX_PAIRS.map(p => p.id);
    for (const pairId of selectedPairs) {
      if (!validPairIds.includes(pairId)) {
        throw new Error(`Invalid pair: ${pairId}`);
      }
    }
    if (selectedPairs.length === 0) {
      throw new Error('At least one currency pair is required');
    }

    // Validate cycle
    const cycleOption = FOREX_CYCLE_OPTIONS.find(c => c.days === cycleDays);
    if (!cycleOption) {
      throw new Error(`Invalid cycle: ${cycleDays} days`);
    }

    // Get pool sizes for trade weight calculation
    const pools = await this.getPools();
    const totalPoolSize = pools.reduce((sum, p) => sum + p.totalSize, 0);
    const tradeWeight = amount / (totalPoolSize + amount);

    // Calculate pool allocations
    const poolClearing = amount * 0.50;
    const poolHedging = amount * 0.30;
    const poolInsurance = amount * 0.20;

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + cycleDays);

    log.info('Creating forex investment', {
      userId,
      amount,
      pairs: selectedPairs.length,
      cycleDays,
    });

    const { data, error } = await db()
      .from('forex_investments')
      .insert({
        user_id: userId,
        amount,
        current_value: amount,
        profit: 0,
        status: 'active',
        selected_pairs: selectedPairs,
        cycle_days: cycleDays,
        fee_rate: cycleOption.feeRate,
        commission_rate: cycleOption.commissionRate,
        pool_clearing: poolClearing,
        pool_hedging: poolHedging,
        pool_insurance: poolInsurance,
        trade_weight: tradeWeight,
        total_lots: 0,
        total_pips: 0,
        total_trades: 0,
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create forex investment', error);
      throw new Error(`Failed to create investment: ${error.message}`);
    }

    // Update pool utilization
    await this.updatePoolUtilization(amount);

    log.info('Forex investment created', { investmentId: data.id });

    return this.mapToInvestment(data);
  }

  async getInvestment(investmentId: string): Promise<ForexInvestment | null> {
    const { data, error } = await db()
      .from('forex_investments')
      .select('*')
      .eq('id', investmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch investment: ${error.message}`);
    }

    return data ? this.mapToInvestment(data) : null;
  }

  async getUserInvestments(
    userId: string,
    filters?: {
      status?: ForexInvestmentStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<ForexInvestment[]> {
    let query = db()
      .from('forex_investments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch investments: ${error.message}`);
    }

    return data.map((row: any) => this.mapToInvestment(row));
  }

  async redeemInvestment(investmentId: string, userId: string): Promise<{
    investment: ForexInvestment;
    redeemAmount: number;
  }> {
    const investment = await this.getInvestment(investmentId);

    if (!investment) {
      throw new Error('Investment not found');
    }
    if (investment.userId !== userId) {
      throw new Error('Not authorized');
    }
    if (investment.status !== 'active' && investment.status !== 'completed') {
      throw new Error(`Cannot redeem investment with status: ${investment.status}`);
    }

    const redeemAmount = investment.currentValue;

    const { data, error } = await db()
      .from('forex_investments')
      .update({
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', investmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to redeem investment: ${error.message}`);
    }

    log.info('Investment redeemed', { investmentId, redeemAmount });

    return {
      investment: this.mapToInvestment(data),
      redeemAmount,
    };
  }

  // ============ Trades ============

  async getInvestmentTrades(
    investmentId: string,
    filters?: {
      status?: ForexTradeStatus;
      pairId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<ForexTrade[]> {
    let query = db()
      .from('forex_trades')
      .select('*')
      .eq('investment_id', investmentId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.pairId) {
      query = query.eq('pair_id', filters.pairId);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch trades: ${error.message}`);
    }

    return data.map((row: any) => this.mapToTrade(row));
  }

  async getUserTrades(
    userId: string,
    filters?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<ForexTrade[]> {
    // First get user's investment IDs
    const { data: investments, error: invError } = await db()
      .from('forex_investments')
      .select('id')
      .eq('user_id', userId);

    if (invError) {
      throw new Error(`Failed to fetch user investments: ${invError.message}`);
    }

    const investmentIds = investments.map((i: any) => i.id);
    if (investmentIds.length === 0) return [];

    let query = db()
      .from('forex_trades')
      .select('*')
      .in('investment_id', investmentIds)
      .order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch trades: ${error.message}`);
    }

    return data.map((row: any) => this.mapToTrade(row));
  }

  // ============ Portfolio & Stats ============

  async getUserPortfolio(userId: string): Promise<ForexPortfolioSummary> {
    const investments = await this.getUserInvestments(userId);

    const active = investments.filter(i => i.status === 'active');
    const completed = investments.filter(i => i.status === 'completed' || i.status === 'redeemed');

    const totalInvested = active.reduce((sum, i) => sum + i.amount, 0);
    const totalValue = active.reduce((sum, i) => sum + i.currentValue, 0);
    const totalProfit = active.reduce((sum, i) => sum + i.profit, 0);
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalValue,
      totalProfit,
      totalProfitPercent,
      activeCount: active.length,
      completedCount: completed.length,
    };
  }

  async getModuleStats(): Promise<ForexModuleStats> {
    const pools = await this.getPools();
    const totalAum = pools.reduce((sum, p) => sum + p.totalSize, 0);

    // Count active investments
    const { count: activeCount, error: activeErr } = await db()
      .from('forex_investments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Count total investments
    const { count: totalCount, error: totalErr } = await db()
      .from('forex_investments')
      .select('*', { count: 'exact', head: true });

    // Count unique users
    const { data: userData, error: userErr } = await db()
      .from('forex_investments')
      .select('user_id')
      .eq('status', 'active');

    const uniqueUsers = new Set((userData || []).map((r: any) => r.user_id)).size;

    // Count total trades
    const { count: tradeCount, error: tradeErr } = await db()
      .from('forex_trades')
      .select('*', { count: 'exact', head: true });

    // Sum total volume
    const { data: volumeData } = await db()
      .from('forex_trades')
      .select('lots')
      .eq('status', 'settled');

    const totalVolume = (volumeData || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.lots) || 0) * FOREX_AGENT_CONFIG.lotSize,
      0,
    );

    return {
      totalAum,
      totalUsers: uniqueUsers,
      totalInvestments: totalCount || 0,
      activeInvestments: activeCount || 0,
      totalTrades: tradeCount || 0,
      totalVolume,
      avgWinRate: FOREX_AGENT_CONFIG.winRate,
      pools,
    };
  }

  // ============ Internal Helpers ============

  private async updatePoolUtilization(newAmount: number): Promise<void> {
    const allocations: Record<ForexPoolType, number> = {
      clearing: 0.50,
      hedging: 0.30,
      insurance: 0.20,
    };

    for (const [poolType, alloc] of Object.entries(allocations)) {
      const increment = newAmount * alloc;
      try {
        await db().rpc('increment_pool_size', {
          p_pool_type: poolType,
          p_amount: increment,
        });
      } catch {
        log.warn(`RPC increment_pool_size failed for ${poolType}, using direct update`);
        const { data: pool } = await db()
          .from('forex_pools')
          .select('total_size')
          .eq('pool_type', poolType)
          .single();
        if (pool) {
          await db()
            .from('forex_pools')
            .update({ total_size: pool.total_size + increment })
            .eq('pool_type', poolType);
        }
      }
    }
  }

  // ============ Row Mappers ============

  private mapToPool(row: any): ForexPool {
    return {
      id: row.id,
      type: row.pool_type,
      totalSize: parseFloat(row.total_size),
      utilization: parseFloat(row.utilization),
      allocation: parseFloat(row.allocation),
      updatedAt: row.updated_at,
    };
  }

  private mapToInvestment(row: any): ForexInvestment {
    return {
      id: row.id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      currentValue: parseFloat(row.current_value),
      profit: parseFloat(row.profit),
      status: row.status,
      selectedPairs: row.selected_pairs || [],
      cycleDays: row.cycle_days,
      feeRate: parseFloat(row.fee_rate),
      commissionRate: parseFloat(row.commission_rate),
      poolAllocations: {
        clearing: parseFloat(row.pool_clearing),
        hedging: parseFloat(row.pool_hedging),
        insurance: parseFloat(row.pool_insurance),
      },
      tradeWeight: parseFloat(row.trade_weight),
      totalLots: parseFloat(row.total_lots),
      totalPips: parseFloat(row.total_pips),
      totalTrades: row.total_trades,
      startDate: row.start_date,
      endDate: row.end_date,
      redeemedAt: row.redeemed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapToTrade(row: any): ForexTrade {
    return {
      id: row.id,
      investmentId: row.investment_id,
      pairId: row.pair_id,
      side: row.side,
      lots: parseFloat(row.lots),
      rfqPrice: parseFloat(row.rfq_price),
      quotePrice: parseFloat(row.quote_price),
      matchPrice: parseFloat(row.match_price),
      settlePrice: parseFloat(row.settle_price),
      pips: parseFloat(row.pips),
      pnl: parseFloat(row.pnl),
      status: row.status,
      pvpSettled: row.pvp_settled,
      counterparty: row.counterparty,
      gasCost: parseFloat(row.gas_cost),
      createdAt: row.created_at,
      settledAt: row.settled_at,
    };
  }
}

export const forexService = new ForexService();
