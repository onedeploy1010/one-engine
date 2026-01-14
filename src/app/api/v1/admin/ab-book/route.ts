/**
 * Admin A/B Book Management API
 * This endpoint is for internal admin use only - NOT exposed to clients
 *
 * GET /api/v1/admin/ab-book - Get current A/B Book configuration and stats
 * POST /api/v1/admin/ab-book - Update A/B Book configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiAbBookService } from '@/services/ai/ai-ab-book.service';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'AdminAbBookAPI' });

// Simple admin key check - in production use proper auth
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'admin-secret-key';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('x-admin-key');
  return authHeader === ADMIN_KEY;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const config = aiAbBookService.getConfig();
    const statistics = await aiAbBookService.getStatistics();
    const recentTrades = await aiAbBookService.getTradeHistory({ limit: 20 });

    return NextResponse.json({
      success: true,
      data: {
        config: {
          defaultBookType: config.defaultBookType,
          strategyOverrides: config.strategyOverrides,
          poolOverrides: config.poolOverrides,
          simulation: config.simulation,
        },
        statistics,
        recentTrades: recentTrades.map(t => ({
          id: t.id,
          poolId: t.pool_id,
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          bookType: t.book_type,
          avgPrice: t.avg_price,
          status: t.status,
          isSimulated: t.is_simulated,
          createdAt: t.created_at,
        })),
      },
    });
  } catch (error) {
    log.error('Failed to get A/B Book status', { error: (error as Error).message });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'set_default_book_type': {
        const { bookType } = params;
        if (bookType !== 'A' && bookType !== 'B') {
          return NextResponse.json(
            { success: false, error: 'Invalid book type. Must be A or B' },
            { status: 400 }
          );
        }

        aiAbBookService.updateConfig({ defaultBookType: bookType });

        log.info('Admin updated default book type', { bookType });

        return NextResponse.json({
          success: true,
          message: `Default book type set to ${bookType === 'A' ? 'Real (A-Book)' : 'Simulated (B-Book)'}`,
        });
      }

      case 'set_pool_book_type': {
        const { poolId, bookType } = params;
        if (!poolId || (bookType !== 'A' && bookType !== 'B')) {
          return NextResponse.json(
            { success: false, error: 'Invalid poolId or bookType' },
            { status: 400 }
          );
        }

        aiAbBookService.setPoolBookType(poolId, bookType);

        log.info('Admin updated pool book type', { poolId, bookType });

        return NextResponse.json({
          success: true,
          message: `Pool ${poolId} set to ${bookType === 'A' ? 'Real (A-Book)' : 'Simulated (B-Book)'}`,
        });
      }

      case 'set_strategy_book_type': {
        const { strategyId, bookType } = params;
        if (!strategyId || (bookType !== 'A' && bookType !== 'B')) {
          return NextResponse.json(
            { success: false, error: 'Invalid strategyId or bookType' },
            { status: 400 }
          );
        }

        aiAbBookService.setStrategyBookType(strategyId, bookType);

        log.info('Admin updated strategy book type', { strategyId, bookType });

        return NextResponse.json({
          success: true,
          message: `Strategy ${strategyId} set to ${bookType === 'A' ? 'Real (A-Book)' : 'Simulated (B-Book)'}`,
        });
      }

      case 'update_simulation_params': {
        const { simulation } = params;
        if (!simulation) {
          return NextResponse.json(
            { success: false, error: 'Simulation params required' },
            { status: 400 }
          );
        }

        aiAbBookService.updateConfig({ simulation });

        log.info('Admin updated simulation params', { simulation });

        return NextResponse.json({
          success: true,
          message: 'Simulation parameters updated',
        });
      }

      case 'get_trade_history': {
        const { poolId, strategyId, bookType, limit } = params;
        const trades = await aiAbBookService.getTradeHistory({
          poolId,
          strategyId,
          bookType,
          limit: limit || 100,
        });

        return NextResponse.json({
          success: true,
          data: trades,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    log.error('Failed to update A/B Book config', { error: (error as Error).message });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
