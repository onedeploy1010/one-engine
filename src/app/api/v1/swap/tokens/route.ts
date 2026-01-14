/**
 * Swap Tokens Endpoint
 * GET /api/v1/swap/tokens - Get supported tokens for swapping
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { swapService } from '@/services/swap/swap.service';
import { success, errors } from '@/lib/response';
import { validateQuery, chainIdSchema } from '@/middleware/validation';

const querySchema = z.object({
  chainId: chainIdSchema.optional(),
});

/**
 * Get supported tokens for a chain
 */
export async function GET(req: NextRequest) {
  try {
    const query = validateQuery(req, querySchema);

    if (query.chainId) {
      const tokens = await swapService.getSupportedTokens(query.chainId);
      return success({ chainId: query.chainId, tokens });
    }

    // Return tokens for popular chains
    const chainIds = [1, 8453, 42161, 137, 56];
    const allTokens = await Promise.all(
      chainIds.map(async (chainId) => ({
        chainId,
        tokens: await swapService.getSupportedTokens(chainId),
      }))
    );

    return success({ chains: allTokens });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch tokens');
  }
}
