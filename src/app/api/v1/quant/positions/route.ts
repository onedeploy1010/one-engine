/**
 * Quant Positions Endpoints
 * GET /api/v1/quant/positions - Get user positions
 * POST /api/v1/quant/positions - Open new position
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { quantService } from '@/services/quant/quant.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody, validateQuery, uuidSchema } from '@/middleware/validation';

const querySchema = z.object({
  strategyId: uuidSchema.optional(),
  status: z.enum(['active', 'paused', 'closed', 'liquidated']).optional(),
});

const createSchema = z.object({
  strategyId: uuidSchema,
  amount: z.number().positive().min(10),
});

/**
 * Get user positions
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const positions = await quantService.getUserPositions(auth.userId, {
      strategyId: query.strategyId,
      status: query.status,
    });

    return success({
      positions,
      total: positions.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch positions');
  }
}

/**
 * Open new position
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, createSchema);

    const position = await quantService.openPosition({
      userId: auth.userId,
      strategyId: body.strategyId,
      amount: body.amount,
    });

    return success({ position });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to open position');
  }
}
