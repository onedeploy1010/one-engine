/**
 * Quant Strategies Endpoints
 * GET /api/v1/quant/strategies - Get available strategies
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { quantService } from '@/services/quant/quant.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateQuery } from '@/middleware/validation';

const querySchema = z.object({
  type: z.enum(['grid', 'dca', 'arbitrage', 'momentum', 'ai_driven']).optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'aggressive']).optional(),
  active: z.enum(['true', 'false']).optional(),
});

/**
 * Get available strategies
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const strategies = await quantService.getStrategies({
      type: query.type,
      riskLevel: query.riskLevel,
      isActive: query.active === undefined ? true : query.active === 'true',
    });

    return success({
      strategies,
      total: strategies.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch strategies');
  }
}
