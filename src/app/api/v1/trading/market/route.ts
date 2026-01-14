/**
 * Trading Market Data Endpoints
 * GET /api/v1/trading/market - Get market data from Bybit
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { bybitService } from '@/services/trading/bybit.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateQuery } from '@/middleware/validation';

const querySchema = z.object({
  symbol: z.string().optional(),
  symbols: z.string().optional(), // Comma-separated
});

/**
 * Get market data
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const query = validateQuery(req, querySchema);

    if (query.symbol) {
      // Single symbol
      const data = await bybitService.getMarketData(query.symbol);
      return success({ market: data });
    }

    if (query.symbols) {
      // Multiple symbols
      const symbolList = query.symbols.split(',').map(s => s.trim());
      const data = await bybitService.getMarketDataBatch(symbolList);
      return success({ markets: data });
    }

    // Default popular symbols
    const defaultSymbols = [
      'BTCUSDT',
      'ETHUSDT',
      'SOLUSDT',
      'BNBUSDT',
      'XRPUSDT',
    ];
    const data = await bybitService.getMarketDataBatch(defaultSymbols);
    return success({ markets: data });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to fetch market data');
  }
}
