/**
 * Bybit Trading Service for ONE Engine
 * Real trading execution via Bybit API
 */

import ccxt, { bybit } from 'ccxt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { env } from '@/config/env';
import { LogService } from '@/lib/logger';
import type { TradeOrder, OrderStatus, OrderSide, OrderType } from '@/types';

const log = new LogService({ service: 'BybitService' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface PlaceOrderParams {
  positionId: string;
  strategyId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price?: number;
  stopPrice?: number;
  reduceOnly?: boolean;
}

export interface OrderResult {
  orderId: string;
  externalId: string;
  status: OrderStatus;
  filledQty?: number;
  avgPrice?: number;
}

export interface MarketData {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume24h: number;
  change24h: number;
  high24h: number;
  low24h: number;
}

export interface AccountBalance {
  asset: string;
  available: number;
  locked: number;
  total: number;
}

export class BybitService {
  private exchange: bybit;

  constructor() {
    this.exchange = new ccxt.bybit({
      apiKey: env.BYBIT_API_KEY,
      secret: env.BYBIT_API_SECRET,
      sandbox: env.BYBIT_TESTNET,
      options: {
        defaultType: 'spot', // or 'future', 'linear', 'inverse'
      },
    });
  }

  /**
   * Place a trading order
   */
  async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
    log.info('Placing order', {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
    });

    try {
      // Place order on Bybit
      const order = await this.exchange.createOrder(
        params.symbol,
        params.type,
        params.side,
        params.quantity,
        params.price,
        params.stopPrice ? { stopPrice: params.stopPrice } : undefined
      );

      // Save order to database
      const { data: savedOrder, error } = await db()
        .from('trade_orders')
        .insert({
          position_id: params.positionId,
          strategy_id: params.strategyId,
          exchange: 'bybit',
          symbol: params.symbol,
          side: params.side,
          order_type: params.type,
          quantity: params.quantity,
          price: params.price,
          stop_price: params.stopPrice,
          status: this.mapOrderStatus(order.status),
          external_id: order.id,
          filled_qty: order.filled,
          avg_price: order.average,
          commission: order.fee?.cost,
          commission_asset: order.fee?.currency,
        })
        .select()
        .single();

      if (error) {
        log.error('Failed to save order', error);
      }

      log.info('Order placed', {
        orderId: savedOrder?.id,
        externalId: order.id,
        status: order.status,
      });

      return {
        orderId: savedOrder?.id || '',
        externalId: order.id,
        status: this.mapOrderStatus(order.status),
        filledQty: order.filled,
        avgPrice: order.average,
      };
    } catch (error) {
      log.error('Order placement failed', error as Error);

      // Save failed order
      await db().from('trade_orders').insert({
        position_id: params.positionId,
        strategy_id: params.strategyId,
        exchange: 'bybit',
        symbol: params.symbol,
        side: params.side,
        order_type: params.type,
        quantity: params.quantity,
        price: params.price,
        status: 'rejected',
        error_message: (error as Error).message,
      });

      throw new Error(`Order failed: ${(error as Error).message}`);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(externalId: string, symbol: string): Promise<boolean> {
    log.info('Cancelling order', { externalId, symbol });

    try {
      await this.exchange.cancelOrder(externalId, symbol);

      await db()
        .from('trade_orders')
        .update({ status: 'cancelled' })
        .eq('external_id', externalId);

      return true;
    } catch (error) {
      log.error('Cancel order failed', error as Error);
      return false;
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(externalId: string, symbol: string): Promise<{
    status: OrderStatus;
    filledQty: number;
    avgPrice: number;
  }> {
    try {
      const order = await this.exchange.fetchOrder(externalId, symbol);

      // Update database
      await db()
        .from('trade_orders')
        .update({
          status: this.mapOrderStatus(order.status),
          filled_qty: order.filled,
          avg_price: order.average,
          filled_at: order.status === 'closed' ? new Date().toISOString() : null,
        })
        .eq('external_id', externalId);

      return {
        status: this.mapOrderStatus(order.status),
        filledQty: order.filled || 0,
        avgPrice: order.average || 0,
      };
    } catch (error) {
      log.error('Get order status failed', error as Error);
      throw error;
    }
  }

  /**
   * Get market data for a symbol
   */
  async getMarketData(symbol: string): Promise<MarketData> {
    try {
      const ticker = await this.exchange.fetchTicker(symbol);

      return {
        symbol,
        lastPrice: ticker.last || 0,
        bid: ticker.bid || 0,
        ask: ticker.ask || 0,
        volume24h: ticker.quoteVolume || 0,
        change24h: ticker.percentage || 0,
        high24h: ticker.high || 0,
        low24h: ticker.low || 0,
      };
    } catch (error) {
      log.error('Get market data failed', error as Error, { symbol });
      throw error;
    }
  }

  /**
   * Get ticker data for a symbol (used by AI trading executor)
   */
  async getTicker(symbol: string): Promise<{
    lastPrice: string;
    price24hPcnt: string;
    volume24h: string;
    highPrice24h: string;
    lowPrice24h: string;
  } | null> {
    try {
      const ticker = await this.exchange.fetchTicker(symbol);

      return {
        lastPrice: String(ticker.last || 0),
        price24hPcnt: String((ticker.percentage || 0) / 100),
        volume24h: String(ticker.quoteVolume || 0),
        highPrice24h: String(ticker.high || 0),
        lowPrice24h: String(ticker.low || 0),
      };
    } catch (error) {
      log.warn(`Get ticker failed for ${symbol}`, { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Get market data for multiple symbols
   */
  async getMarketDataBatch(symbols: string[]): Promise<MarketData[]> {
    try {
      const tickers = await this.exchange.fetchTickers(symbols);

      return symbols.map(symbol => ({
        symbol,
        lastPrice: tickers[symbol]?.last || 0,
        bid: tickers[symbol]?.bid || 0,
        ask: tickers[symbol]?.ask || 0,
        volume24h: tickers[symbol]?.quoteVolume || 0,
        change24h: tickers[symbol]?.percentage || 0,
        high24h: tickers[symbol]?.high || 0,
        low24h: tickers[symbol]?.low || 0,
      }));
    } catch (error) {
      log.error('Get batch market data failed', error as Error);
      throw error;
    }
  }

  /**
   * Get account balances
   */
  async getBalances(): Promise<AccountBalance[]> {
    try {
      const balance = await this.exchange.fetchBalance();

      return Object.entries(balance.total)
        .filter(([_, value]) => (value as number) > 0)
        .map(([asset, total]) => ({
          asset,
          available: (balance.free[asset] as number) || 0,
          locked: (balance.used[asset] as number) || 0,
          total: total as number,
        }));
    } catch (error) {
      log.error('Get balances failed', error as Error);
      throw error;
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<TradeOrder[]> {
    try {
      const orders = await this.exchange.fetchOpenOrders(symbol);

      return orders.map(order => ({
        id: '',
        positionId: '',
        exchange: 'bybit' as const,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        type: order.type as 'market' | 'limit' | 'stop',
        quantity: order.amount,
        price: order.price,
        status: this.mapOrderStatus(order.status),
        externalId: order.id,
        filledQty: order.filled,
        avgPrice: order.average,
        createdAt: order.datetime || new Date().toISOString(),
      }));
    } catch (error) {
      log.error('Get open orders failed', error as Error);
      throw error;
    }
  }

  /**
   * Get OHLCV candles
   */
  async getCandles(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>> {
    try {
      const candles = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

      return candles.map(candle => ({
        timestamp: candle[0] as number,
        open: candle[1] as number,
        high: candle[2] as number,
        low: candle[3] as number,
        close: candle[4] as number,
        volume: candle[5] as number,
      }));
    } catch (error) {
      log.error('Get candles failed', error as Error, { symbol });
      throw error;
    }
  }

  /**
   * Map CCXT order status to our status
   */
  private mapOrderStatus(status: string | undefined): OrderStatus {
    switch (status) {
      case 'open':
        return 'open';
      case 'closed':
        return 'filled';
      case 'canceled':
        return 'cancelled';
      case 'expired':
        return 'cancelled';
      case 'rejected':
        return 'rejected';
      default:
        return 'pending';
    }
  }
}

export const bybitService = new BybitService();
