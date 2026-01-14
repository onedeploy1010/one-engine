/**
 * User Investment Status API
 * GET /api/v1/ai-quant/user-status - Get user's real-time investment status
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiTradingExecutor } from '@/services/ai/ai-trading-executor.service';
import { LogService } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase';

const log = new LogService({ service: 'UserStatusAPI' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const orderId = searchParams.get('orderId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get all user's investments
    let query = db()
      .from('ai_order_shares')
      .select(`
        *,
        ai_orders (
          id,
          strategy_id,
          amount,
          currency,
          status,
          start_date,
          lock_end_date,
          realized_profit,
          total_fees_paid
        ),
        ai_strategy_pools (
          current_nav,
          total_capital,
          unrealized_pnl,
          win_rate,
          total_trades
        ),
        ai_strategies:ai_orders!inner(
          ai_strategies (
            id,
            name,
            category,
            description
          )
        )
      `)
      .eq('user_id', userId);

    if (orderId) {
      query = query.eq('order_id', orderId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const investments = (data || []).map((os: Record<string, unknown>) => {
      const order = os.ai_orders as Record<string, unknown> || {};
      const pool = os.ai_strategy_pools as Record<string, unknown> || {};
      const currentNav = parseFloat(pool.current_nav as string) || 1;
      const shares = parseFloat(os.shares_owned as string) || 0;
      const invested = parseFloat(os.total_invested as string) || 0;
      const currentValue = shares * currentNav;
      const pnl = currentValue - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

      return {
        orderId: os.order_id,
        strategyId: order.strategy_id,
        strategyName: 'Strategy', // Would come from joined data
        status: order.status,

        // Investment details
        investedAmount: invested,
        currency: order.currency || 'USDT',

        // Share ownership
        shares,
        sharePercentage: parseFloat(os.share_percentage as string) || 0,
        entryNav: parseFloat(os.avg_entry_nav as string) || 1,
        currentNav,

        // Value and P&L
        currentValue,
        unrealizedPnl: pnl,
        unrealizedPnlPct: pnlPct,
        realizedPnl: parseFloat(order.realized_profit as string) || 0,
        feesPaid: parseFloat(order.total_fees_paid as string) || 0,

        // Pool stats
        poolCapital: parseFloat(pool.total_capital as string) || 0,
        poolWinRate: parseFloat(pool.win_rate as string) || 0,
        poolTotalTrades: pool.total_trades || 0,

        // Dates
        startDate: order.start_date,
        lockEndDate: order.lock_end_date,

        updatedAt: os.updated_at,
      };
    });

    // Calculate totals
    const summary = {
      totalInvested: investments.reduce((sum: number, i: { investedAmount: number }) => sum + i.investedAmount, 0),
      totalCurrentValue: investments.reduce((sum: number, i: { currentValue: number }) => sum + i.currentValue, 0),
      totalUnrealizedPnl: investments.reduce((sum: number, i: { unrealizedPnl: number }) => sum + i.unrealizedPnl, 0),
      totalRealizedPnl: investments.reduce((sum: number, i: { realizedPnl: number }) => sum + i.realizedPnl, 0),
      totalFeesPaid: investments.reduce((sum: number, i: { feesPaid: number }) => sum + i.feesPaid, 0),
      activeInvestments: investments.filter((i: { status: string }) => i.status === 'active').length,
      totalInvestments: investments.length,
    };

    summary.totalUnrealizedPnl = summary.totalCurrentValue - summary.totalInvested;

    const totalPnlPct = summary.totalInvested > 0
      ? ((summary.totalCurrentValue - summary.totalInvested) / summary.totalInvested) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        investments,
        summary: {
          ...summary,
          totalPnlPct,
        },
      },
    });
  } catch (error) {
    log.error('Failed to get user status', error as Error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
