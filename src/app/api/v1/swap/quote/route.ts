/**
 * Swap Quote Endpoint
 * POST /api/v1/swap/quote - Get swap quote
 */

import { NextRequest } from 'next/server';
import { swapService } from '@/services/swap/swap.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody, swapRequestSchema } from '@/middleware/validation';

/**
 * Get a swap quote
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, swapRequestSchema);

    const quote = await swapService.getQuote({
      fromChainId: body.fromChainId,
      toChainId: body.toChainId,
      fromToken: body.fromToken,
      toToken: body.toToken,
      amount: body.amount,
      slippage: body.slippage,
      sender: auth.walletAddress,
      recipient: body.recipient,
    });

    return success({ quote });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to get swap quote');
  }
}
