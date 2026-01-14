/**
 * Asset Endpoints
 * GET /api/v1/assets - Get wallet balances
 * GET /api/v1/assets/portfolio - Get portfolio summary
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assetService } from '@/services/assets/asset.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateQuery, chainIdSchema, addressSchema } from '@/middleware/validation';

const querySchema = z.object({
  chainId: chainIdSchema.optional(),
  address: addressSchema.optional(),
});

/**
 * Get wallet balances
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const address = query.address || auth.walletAddress;

    if (!address) {
      return errors.badRequest('No wallet address provided');
    }

    if (query.chainId) {
      const balance = await assetService.getBalances(address, query.chainId);
      return success({ balance });
    }

    const balances = await assetService.getMultiChainBalances(address);
    return success({
      address,
      balances,
      totalValueUsd: balances.reduce((sum, b) => sum + b.totalValueUsd, 0),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to fetch balances');
  }
}
