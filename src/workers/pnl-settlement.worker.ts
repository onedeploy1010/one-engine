/**
 * PnL Settlement Worker
 * Daily settlement of position PnL and NAV updates
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { quantService } from '@/services/quant/quant.service';
import { bybitService } from '@/services/trading/bybit.service';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'PnlSettlementWorker' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

/**
 * Run daily PnL settlement
 */
export async function runPnlSettlement(): Promise<void> {
  // Using db() helper

  log.info('Starting daily PnL settlement');

  // Get all active strategies
  const { data: strategies } = await db()
    .from('quant_strategies')
    .select('*')
    .eq('is_active', true);

  if (!strategies) {
    log.info('No active strategies found');
    return;
  }

  for (const strategy of strategies) {
    try {
      await settleStrategy(strategy);
    } catch (error) {
      log.error(`Failed to settle strategy ${strategy.id}`, error as Error);
    }
  }

  log.info('PnL settlement completed');
}

/**
 * Settle PnL for a single strategy
 */
async function settleStrategy(strategy: any): Promise<void> {
  // Using db() helper
  const today = new Date().toISOString().split('T')[0];

  // Get all active positions for this strategy
  const { data: positions } = await db()
    .from('quant_positions')
    .select('*')
    .eq('strategy_id', strategy.id)
    .eq('status', 'active');

  if (!positions || positions.length === 0) {
    log.info(`No active positions for strategy ${strategy.name}`);
    return;
  }

  log.info(`Settling ${positions.length} positions for strategy ${strategy.name}`);

  // Calculate strategy total value from exchange
  let totalValue = 0;
  const balances = await bybitService.getBalances();

  // Map balances to USD value (simplified - use proper conversion in production)
  for (const balance of balances) {
    if (balance.asset === 'USDT' || balance.asset === 'USDC') {
      totalValue += balance.total;
    }
    // Add other asset valuations as needed
  }

  // Calculate total shares across all positions
  const totalShares = positions.reduce((sum, p) => sum + (p.shares || 0), 0);

  // Calculate new NAV price
  const previousNAV = await getPreviousNAV(strategy.id);
  const newNAVPrice = totalShares > 0 ? totalValue / totalShares : 1;

  // Calculate daily return
  const dailyReturn = previousNAV > 0
    ? ((newNAVPrice - previousNAV) / previousNAV)
    : 0;

  // Save NAV snapshot
  await db().from('nav_snapshots').insert({
    strategy_id: strategy.id,
    date: today,
    nav_price: newNAVPrice,
    total_shares: totalShares,
    total_value: totalValue,
    daily_return: dailyReturn,
    cumulative_return: await getCumulativeReturn(strategy.id, dailyReturn),
  });

  // Update each position
  for (const position of positions) {
    const currentValue = (position.shares || 0) * newNAVPrice;
    const pnl = currentValue - position.invested_amount;
    const pnlPercent = position.invested_amount > 0
      ? (pnl / position.invested_amount) * 100
      : 0;

    // Record daily PnL
    await quantService.recordDailyPnl(
      position.id,
      position.current_value || position.invested_amount,
      currentValue,
      newNAVPrice
    );

    // Update position
    await quantService.updatePositionValue(position.id, {
      currentValue,
      pnl,
      pnlPercent,
    });
  }

  // Update strategy metrics
  const currentApy = calculateAPY(dailyReturn);
  await db()
    .from('quant_strategies')
    .update({
      current_apy: currentApy,
      total_aum: totalValue,
    })
    .eq('id', strategy.id);

  log.info(`Settled strategy ${strategy.name}`, {
    navPrice: newNAVPrice,
    dailyReturn: (dailyReturn * 100).toFixed(2) + '%',
    totalValue,
  });
}

/**
 * Get previous NAV price
 */
async function getPreviousNAV(strategyId: string): Promise<number> {
  // Using db() helper

  const { data } = await db()
    .from('nav_snapshots')
    .select('nav_price')
    .eq('strategy_id', strategyId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  return data?.nav_price || 1;
}

/**
 * Get cumulative return
 */
async function getCumulativeReturn(strategyId: string, dailyReturn: number): Promise<number> {
  // Using db() helper

  const { data } = await db()
    .from('nav_snapshots')
    .select('cumulative_return')
    .eq('strategy_id', strategyId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  const previousCumulative = data?.cumulative_return || 0;
  return (1 + previousCumulative) * (1 + dailyReturn) - 1;
}

/**
 * Calculate annualized return from daily return
 */
function calculateAPY(dailyReturn: number): number {
  return (Math.pow(1 + dailyReturn, 365) - 1) * 100;
}
