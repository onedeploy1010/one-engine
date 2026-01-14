/**
 * AI A/B Book Trading Service
 * Controls whether trades are executed on real exchange (A-Book) or simulated (B-Book)
 *
 * A-Book: Real execution on Bybit exchange
 * B-Book: Paper trading / simulation mode (no real trades)
 *
 * This configuration should NOT be visible to clients
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import { bybitService, type PlaceOrderParams, type OrderResult } from '@/services/trading/bybit.service';
import { v4 as uuidv4 } from 'uuid';

const log = new LogService({ service: 'AIAbBookService' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

// ============ Types ============

export type BookType = 'A' | 'B';

export interface AbBookConfig {
  // Global default mode
  defaultBookType: BookType;

  // Per-strategy overrides
  strategyOverrides: Record<string, BookType>;

  // Per-pool overrides (highest priority)
  poolOverrides: Record<string, BookType>;

  // Simulation parameters for B-Book
  simulation: {
    // Slippage range for simulated trades (percentage)
    slippageMin: number;
    slippageMax: number;

    // Fill rate for simulated orders (0-1)
    fillRate: number;

    // Delay simulation (ms)
    executionDelayMin: number;
    executionDelayMax: number;

    // Whether to record simulated trades in DB
    recordTrades: boolean;
  };
}

export interface SimulatedOrderResult {
  orderId: string;
  externalId: string;
  status: 'filled' | 'partial' | 'failed';
  filledQty: number;
  avgPrice: number;
  slippage: number;
  executionTime: number;
  bookType: 'B';
}

// ============ Configuration ============

// Default configuration - B-Book (simulation) is enabled by default
const DEFAULT_AB_CONFIG: AbBookConfig = {
  defaultBookType: 'B', // Default to simulation mode
  strategyOverrides: {},
  poolOverrides: {},
  simulation: {
    slippageMin: 0.0001, // 0.01% min slippage
    slippageMax: 0.001,  // 0.1% max slippage
    fillRate: 0.98,      // 98% fill rate
    executionDelayMin: 50,
    executionDelayMax: 200,
    recordTrades: true,
  },
};

// ============ Service Implementation ============

class AIAbBookService {
  private config: AbBookConfig = DEFAULT_AB_CONFIG;

  /**
   * Get current A/B Book configuration
   */
  getConfig(): AbBookConfig {
    return { ...this.config };
  }

  /**
   * Update A/B Book configuration
   * This is an admin-only function
   */
  updateConfig(updates: Partial<AbBookConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      simulation: {
        ...this.config.simulation,
        ...(updates.simulation || {}),
      },
    };

    log.info('A/B Book config updated', {
      defaultBookType: this.config.defaultBookType,
      overrides: Object.keys(this.config.strategyOverrides).length +
        Object.keys(this.config.poolOverrides).length,
    });
  }

  /**
   * Get book type for a specific pool/strategy
   */
  getBookType(params: { poolId?: string; strategyId?: string }): BookType {
    // Check pool override first (highest priority)
    if (params.poolId && this.config.poolOverrides[params.poolId]) {
      return this.config.poolOverrides[params.poolId];
    }

    // Check strategy override
    if (params.strategyId && this.config.strategyOverrides[params.strategyId]) {
      return this.config.strategyOverrides[params.strategyId];
    }

    // Return default
    return this.config.defaultBookType;
  }

  /**
   * Set book type for a pool
   */
  setPoolBookType(poolId: string, bookType: BookType): void {
    this.config.poolOverrides[poolId] = bookType;
    log.info('Pool book type set', { poolId, bookType });
  }

  /**
   * Set book type for a strategy
   */
  setStrategyBookType(strategyId: string, bookType: BookType): void {
    this.config.strategyOverrides[strategyId] = bookType;
    log.info('Strategy book type set', { strategyId, bookType });
  }

  /**
   * Execute a trade - routes to A-Book (real) or B-Book (simulated)
   */
  async executeTrade(params: {
    poolId: string;
    strategyId: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    positionId?: string;
  }): Promise<OrderResult | SimulatedOrderResult> {
    const bookType = this.getBookType({
      poolId: params.poolId,
      strategyId: params.strategyId,
    });

    if (bookType === 'A') {
      // A-Book: Real execution
      return this.executeRealTrade(params);
    } else {
      // B-Book: Simulated execution
      return this.executeSimulatedTrade(params);
    }
  }

  /**
   * A-Book: Execute real trade on Bybit
   */
  private async executeRealTrade(params: {
    poolId: string;
    strategyId: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    positionId?: string;
  }): Promise<OrderResult> {
    log.info('Executing A-Book (real) trade', {
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
    });

    const orderParams: PlaceOrderParams = {
      positionId: params.positionId || uuidv4(),
      strategyId: params.strategyId,
      symbol: params.symbol.replace('/', ''),
      side: params.side,
      type: 'market',
      quantity: params.quantity,
    };

    const result = await bybitService.placeOrder(orderParams);

    // Record A-Book trade
    await this.recordTrade({
      ...params,
      bookType: 'A',
      orderId: result.orderId,
      externalId: result.externalId,
      filledQty: result.filledQty || 0,
      avgPrice: result.avgPrice || params.price,
      status: result.status,
    });

    return result;
  }

  /**
   * B-Book: Execute simulated trade
   */
  private async executeSimulatedTrade(params: {
    poolId: string;
    strategyId: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    positionId?: string;
  }): Promise<SimulatedOrderResult> {
    const startTime = Date.now();

    // Simulate execution delay
    const delay = this.randomInRange(
      this.config.simulation.executionDelayMin,
      this.config.simulation.executionDelayMax
    );
    await this.sleep(delay);

    // Calculate simulated slippage
    const slippage = this.randomInRange(
      this.config.simulation.slippageMin,
      this.config.simulation.slippageMax
    );

    // Apply slippage (worse for trader)
    const avgPrice = params.side === 'buy'
      ? params.price * (1 + slippage)
      : params.price * (1 - slippage);

    // Determine fill status
    const filled = Math.random() < this.config.simulation.fillRate;
    const filledQty = filled
      ? params.quantity
      : params.quantity * this.randomInRange(0.5, 0.95);

    const orderId = uuidv4();
    const executionTime = Date.now() - startTime;

    const result: SimulatedOrderResult = {
      orderId,
      externalId: `sim-${orderId}`,
      status: filled ? 'filled' : 'partial',
      filledQty,
      avgPrice: Math.round(avgPrice * 100) / 100,
      slippage: Math.round(slippage * 10000) / 100, // Convert to percentage
      executionTime,
      bookType: 'B',
    };

    log.info('Executed B-Book (simulated) trade', {
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      filledQty: result.filledQty,
      avgPrice: result.avgPrice,
      slippage: result.slippage,
      executionTime,
    });

    // Record simulated trade if configured
    if (this.config.simulation.recordTrades) {
      await this.recordTrade({
        ...params,
        bookType: 'B',
        orderId: result.orderId,
        externalId: result.externalId,
        filledQty: result.filledQty,
        avgPrice: result.avgPrice,
        status: result.status,
      });
    }

    return result;
  }

  /**
   * Record trade to database
   */
  private async recordTrade(trade: {
    poolId: string;
    strategyId: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    bookType: BookType;
    orderId: string;
    externalId: string;
    filledQty: number;
    avgPrice: number;
    status: string;
  }): Promise<void> {
    try {
      await db()
        .from('ai_ab_book_trades')
        .insert({
          pool_id: trade.poolId,
          strategy_id: trade.strategyId,
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          book_type: trade.bookType,
          order_id: trade.orderId,
          external_id: trade.externalId,
          filled_qty: trade.filledQty,
          avg_price: trade.avgPrice,
          status: trade.status,
          is_simulated: trade.bookType === 'B',
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      log.error('Failed to record A/B trade', { error: (error as Error).message });
    }
  }

  /**
   * Get trade history (for admin reporting)
   */
  async getTradeHistory(params: {
    poolId?: string;
    strategyId?: string;
    bookType?: BookType;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    let query = db()
      .from('ai_ab_book_trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit || 100);

    if (params.poolId) {
      query = query.eq('pool_id', params.poolId);
    }

    if (params.strategyId) {
      query = query.eq('strategy_id', params.strategyId);
    }

    if (params.bookType) {
      query = query.eq('book_type', params.bookType);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to get trade history', { error: error.message });
      return [];
    }

    return data || [];
  }

  /**
   * Get A/B Book statistics (for admin reporting)
   */
  async getStatistics(): Promise<{
    totalTrades: { A: number; B: number };
    totalVolume: { A: number; B: number };
    avgSlippage: { A: number; B: number };
  }> {
    const { data: aBookStats } = await db()
      .from('ai_ab_book_trades')
      .select('filled_qty, avg_price')
      .eq('book_type', 'A');

    const { data: bBookStats } = await db()
      .from('ai_ab_book_trades')
      .select('filled_qty, avg_price')
      .eq('book_type', 'B');

    const aTotal = (aBookStats || []).length;
    const bTotal = (bBookStats || []).length;

    const aVolume = (aBookStats || []).reduce(
      (sum: number, t: { filled_qty: string; avg_price: string }) =>
        sum + parseFloat(t.filled_qty) * parseFloat(t.avg_price),
      0
    );

    const bVolume = (bBookStats || []).reduce(
      (sum: number, t: { filled_qty: string; avg_price: string }) =>
        sum + parseFloat(t.filled_qty) * parseFloat(t.avg_price),
      0
    );

    return {
      totalTrades: { A: aTotal, B: bTotal },
      totalVolume: { A: aVolume, B: bVolume },
      avgSlippage: { A: 0, B: 0 }, // TODO: Calculate from actual slippage data
    };
  }

  // ============ Helper Methods ============

  private randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const aiAbBookService = new AIAbBookService();
