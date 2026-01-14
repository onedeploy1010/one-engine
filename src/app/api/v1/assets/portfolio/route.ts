/**
 * Portfolio Endpoint
 * GET /api/v1/assets/portfolio - Get portfolio summary
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assetService } from '@/services/assets/asset.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateQuery, addressSchema } from '@/middleware/validation';

const querySchema = z.object({
  address: addressSchema.optional(),
});

/**
 * Get portfolio summary across all chains
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const address = query.address || auth.walletAddress;

    if (!address) {
      return errors.badRequest('No wallet address provided');
    }

    const portfolio = await assetService.getPortfolio(address);

    return success({
      address,
      ...portfolio,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to fetch portfolio');
  }
}
