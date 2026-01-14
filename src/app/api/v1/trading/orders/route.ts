/**
 * Trading Orders Endpoints
 * GET /api/v1/trading/orders - Get open orders
 * POST /api/v1/trading/orders - Place an order
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { bybitService } from '@/services/trading/bybit.service';
import { quantService } from '@/services/quant/quant.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody, validateQuery } from '@/middleware/validation';

const querySchema = z.object({
  symbol: z.string().optional(),
  positionId: z.string().uuid().optional(),
});

const placeOrderSchema = z.object({
  positionId: z.string().uuid(),
  symbol: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop']).default('market'),
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
});

/**
 * Get open orders
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const query = validateQuery(req, querySchema);

    // If positionId provided, verify user owns it
    if (query.positionId) {
      const position = await quantService.getPosition(query.positionId);
      if (!position || position.userId !== auth.userId) {
        return errors.forbidden('Not authorized to view these orders');
      }
    }

    const orders = await bybitService.getOpenOrders(query.symbol);

    return success({
      orders,
      total: orders.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to fetch orders');
  }
}

/**
 * Place an order
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, placeOrderSchema);

    // Verify user owns the position
    const position = await quantService.getPosition(body.positionId);
    if (!position || position.userId !== auth.userId) {
      return errors.forbidden('Not authorized to place orders for this position');
    }

    if (position.status !== 'active') {
      return errors.badRequest('Position is not active');
    }

    // Place order
    const result = await bybitService.placeOrder({
      positionId: body.positionId,
      strategyId: position.strategyId,
      symbol: body.symbol,
      side: body.side,
      type: body.type,
      quantity: body.quantity,
      price: body.price,
      stopPrice: body.stopPrice,
    });

    return success({
      order: result,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to place order');
  }
}
