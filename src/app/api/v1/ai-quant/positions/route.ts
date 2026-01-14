/**
 * AI Positions API
 * GET /api/v1/ai-quant/positions - Get current open positions
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiMemoryService } from '@/services/ai/ai-memory.service';
import { aiTradingExecutor } from '@/services/ai/ai-trading-executor.service';
import { LogService } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase';

const log = new LogService({ service: 'AIPositionsAPI' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategyId');
    const poolId = searchParams.get('poolId');

    let query = db()
      .from('ai_open_positions')
      .select(`
        *,
        ai_strategy_pools (
          strategy_id,
          current_nav,
          total_capital
        ),
        ai_strategies (
          name,
          category
        )
      `);

    if (poolId) {
      query = query.eq('pool_id', poolId);
    }

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Update prices from market
    const symbolSet = new Set((data || []).map((p: { symbol: string }) => p.symbol));
    const symbols = Array.from(symbolSet);
    if (symbols.length > 0) {
      const marketData = await aiTradingExecutor.fetchMarketData(symbols as string[]);

      // Update positions with current prices
      for (const md of marketData) {
        await aiMemoryService.updatePositionPrices([{ symbol: md.symbol, price: md.price }]);
      }
    }

    // Re-fetch with updated prices
    const { data: updatedData } = await query;

    const positions = (updatedData || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      poolId: p.pool_id,
      strategyId: p.strategy_id,
      strategyName: (p.ai_strategies as Record<string, unknown>)?.name || 'Unknown',
      symbol: p.symbol,
      side: p.side,
      entryPrice: parseFloat(p.entry_price as string),
      currentPrice: parseFloat(p.current_price as string) || parseFloat(p.entry_price as string),
      quantity: parseFloat(p.quantity as string),
      leverage: parseFloat(p.leverage as string),
      notionalValue: parseFloat(p.notional_value as string),
      marginUsed: parseFloat(p.margin_used as string),
      unrealizedPnl: parseFloat(p.unrealized_pnl as string),
      unrealizedPnlPct: parseFloat(p.unrealized_pnl_pct as string),
      stopLoss: p.stop_loss_price ? parseFloat(p.stop_loss_price as string) : null,
      takeProfit: p.take_profit_price ? parseFloat(p.take_profit_price as string) : null,
      liquidationPrice: p.liquidation_price ? parseFloat(p.liquidation_price as string) : null,
      reasoning: p.entry_reasoning,
      confidence: p.ai_confidence,
      openedAt: p.opened_at,
    }));

    // Calculate summary
    const summary = {
      totalPositions: positions.length,
      totalNotional: positions.reduce((sum: number, p: { notionalValue: number }) => sum + p.notionalValue, 0),
      totalMargin: positions.reduce((sum: number, p: { marginUsed: number }) => sum + p.marginUsed, 0),
      totalUnrealizedPnl: positions.reduce((sum: number, p: { unrealizedPnl: number }) => sum + p.unrealizedPnl, 0),
      longCount: positions.filter((p: { side: string }) => p.side === 'long').length,
      shortCount: positions.filter((p: { side: string }) => p.side === 'short').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        positions,
        summary,
      },
    });
  } catch (error) {
    log.error('Failed to get positions', error as Error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
