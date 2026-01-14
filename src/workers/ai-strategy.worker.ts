/**
 * AI Strategy Worker
 * Runs AI-driven trading strategies and generates signals
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { aiService } from '@/services/ai/ai.service';
import { bybitService } from '@/services/trading/bybit.service';
import { quantService } from '@/services/quant/quant.service';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'AIStrategyWorker' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

/**
 * Run AI strategy for all active positions
 */
export async function runAIStrategy(): Promise<void> {
  // Using db() helper for type-safe queries

  // Get all AI-driven strategies
  const strategies = await quantService.getStrategies({
    type: 'ai_driven',
    isActive: true,
  });

  log.info(`Processing ${strategies.length} AI strategies`);

  for (const strategy of strategies) {
    try {
      await processStrategy(strategy.id, strategy.parameters);
    } catch (error) {
      log.error(`Failed to process strategy ${strategy.id}`, error as Error);
    }
  }
}

/**
 * Process a single strategy
 */
async function processStrategy(
  strategyId: string,
  parameters: Record<string, unknown>
): Promise<void> {
  // Using db() helper for type-safe queries

  // Get active positions for this strategy
  const { data: positions } = await db()
    .from('quant_positions')
    .select('*')
    .eq('strategy_id', strategyId)
    .eq('status', 'active');

  if (!positions || positions.length === 0) {
    log.info(`No active positions for strategy ${strategyId}`);
    return;
  }

  // Get trading pairs from strategy parameters
  const tradingPairs = (parameters.trading_pairs as string[]) || ['BTCUSDT', 'ETHUSDT'];

  // Fetch market data
  const marketData = await bybitService.getMarketDataBatch(tradingPairs);

  // Calculate total capital
  const totalCapital = positions.reduce((sum, p) => sum + p.current_value, 0);

  // Generate AI signals
  const currentPositions = await getCurrentOpenPositions(strategyId);

  const signals = await aiService.generateSignals({
    strategyType: 'ai_driven',
    riskLevel: parameters.risk_level as string || 'medium',
    positions: currentPositions,
    marketData: marketData.map(m => ({
      symbol: m.symbol,
      price: m.lastPrice,
    })),
    availableCapital: totalCapital * 0.2, // Use 20% for new positions
    maxPositionSize: totalCapital * 0.1, // Max 10% per position
  });

  log.info(`Generated ${signals.length} signals for strategy ${strategyId}`);

  // Execute high-confidence signals
  for (const signal of signals) {
    if (signal.confidence >= 75 && signal.action !== 'hold') {
      try {
        await executeSignal(strategyId, positions[0].id, signal as any);
      } catch (error) {
        log.error(`Failed to execute signal`, error as Error, { signal });
      }
    }
  }
}

/**
 * Get current open trading positions
 */
async function getCurrentOpenPositions(strategyId: string): Promise<Array<{
  symbol: string;
  quantity: number;
  entryPrice: number;
}>> {
  // Using db() helper for type-safe queries

  const { data: orders } = await db()
    .from('trade_orders')
    .select('*')
    .eq('strategy_id', strategyId)
    .eq('status', 'filled')
    .order('filled_at', { ascending: false });

  // Aggregate positions by symbol
  const positionMap = new Map<string, { quantity: number; totalCost: number }>();

  for (const order of orders || []) {
    const current = positionMap.get(order.symbol) || { quantity: 0, totalCost: 0 };

    if (order.side === 'buy') {
      current.quantity += order.filled_qty;
      current.totalCost += order.filled_qty * order.avg_price;
    } else {
      current.quantity -= order.filled_qty;
      current.totalCost -= order.filled_qty * order.avg_price;
    }

    positionMap.set(order.symbol, current);
  }

  return Array.from(positionMap.entries())
    .filter(([_, pos]) => pos.quantity > 0)
    .map(([symbol, pos]) => ({
      symbol,
      quantity: pos.quantity,
      entryPrice: pos.totalCost / pos.quantity,
    }));
}

/**
 * Execute a trading signal
 */
async function executeSignal(
  strategyId: string,
  positionId: string,
  signal: {
    action: 'buy' | 'sell';
    symbol: string;
    quantity: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
  }
): Promise<void> {
  log.info('Executing signal', { strategyId, signal });

  // Place order via Bybit
  const result = await bybitService.placeOrder({
    positionId,
    strategyId,
    symbol: signal.symbol,
    side: signal.action,
    type: signal.price ? 'limit' : 'market',
    quantity: signal.quantity,
    price: signal.price,
  });

  log.info('Order executed', { orderId: result.orderId, externalId: result.externalId });

  // If there's a stop loss, place stop order
  if (signal.stopLoss && signal.action === 'buy') {
    await bybitService.placeOrder({
      positionId,
      strategyId,
      symbol: signal.symbol,
      side: 'sell',
      type: 'stop',
      quantity: signal.quantity,
      stopPrice: signal.stopLoss,
      reduceOnly: true,
    });
  }
}
