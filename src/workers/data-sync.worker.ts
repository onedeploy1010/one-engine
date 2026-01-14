/**
 * Data Sync Worker
 * Syncs order status and market data from Bybit
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { bybitService } from '@/services/trading/bybit.service';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'DataSyncWorker' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

/**
 * Run data sync
 */
export async function runDataSync(): Promise<void> {
  log.info('Starting data sync');

  try {
    await syncOrderStatus();
    await syncMarketData();
  } catch (error) {
    log.error('Data sync failed', error as Error);
    throw error;
  }

  log.info('Data sync completed');
}

/**
 * Sync open order status from Bybit
 */
async function syncOrderStatus(): Promise<void> {
  // Using db() helper

  // Get pending/open orders from database
  const { data: pendingOrders } = await db()
    .from('trade_orders')
    .select('*')
    .in('status', ['pending', 'open', 'partially_filled'])
    .eq('exchange', 'bybit');

  if (!pendingOrders || pendingOrders.length === 0) {
    log.info('No pending orders to sync');
    return;
  }

  log.info(`Syncing ${pendingOrders.length} pending orders`);

  for (const order of pendingOrders) {
    try {
      const status = await bybitService.getOrderStatus(
        order.external_id,
        order.symbol
      );

      // Update if status changed
      if (status.status !== order.status) {
        await db()
          .from('trade_orders')
          .update({
            status: status.status,
            filled_qty: status.filledQty,
            avg_price: status.avgPrice,
            filled_at: status.status === 'filled' ? new Date().toISOString() : null,
          })
          .eq('id', order.id);

        log.info(`Updated order ${order.id}`, {
          oldStatus: order.status,
          newStatus: status.status,
        });
      }
    } catch (error) {
      log.error(`Failed to sync order ${order.id}`, error as Error);
    }
  }
}

/**
 * Sync market data and cache popular pairs
 */
async function syncMarketData(): Promise<void> {
  // Using db() helper

  // Popular trading pairs
  const pairs = [
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
    'ADAUSDT',
    'DOGEUSDT',
    'AVAXUSDT',
    'DOTUSDT',
    'LINKUSDT',
  ];

  try {
    const marketData = await bybitService.getMarketDataBatch(pairs);

    log.info(`Fetched market data for ${marketData.length} pairs`);

    // Store in system logs or cache (in production, use Redis)
    await db().from('system_logs').insert({
      level: 'info',
      service: 'data-sync',
      message: 'Market data synced',
      data: {
        pairs: marketData.map(m => ({
          symbol: m.symbol,
          price: m.lastPrice,
          change24h: m.change24h,
        })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('Failed to sync market data', error as Error);
  }
}

/**
 * Sync account balances
 */
export async function syncBalances(): Promise<void> {
  // Using db() helper

  try {
    const balances = await bybitService.getBalances();

    log.info(`Synced ${balances.length} account balances`);

    // Store snapshot (for auditing)
    await db().from('system_logs').insert({
      level: 'info',
      service: 'data-sync',
      message: 'Balance snapshot',
      data: {
        balances,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('Failed to sync balances', error as Error);
  }
}
