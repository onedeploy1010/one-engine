/**
 * Wallet Endpoints
 * GET /api/v1/wallet - Get user's wallets
 * POST /api/v1/wallet - Create new wallet
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { walletService } from '@/services/wallet/wallet.service';
import { success, errors } from '@/lib/response';
import { requireAuth, getProjectId } from '@/middleware/auth';
import { validateBody, validateQuery, chainIdSchema } from '@/middleware/validation';

const createWalletSchema = z.object({
  chainId: chainIdSchema.default(8453),
  type: z.enum(['smart', 'eoa', 'multisig']).default('smart'),
});

const querySchema = z.object({
  chainId: chainIdSchema.optional(),
});

/**
 * Get user's wallets
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const wallets = await walletService.getUserWallets(auth.userId, query.chainId);

    return success({
      wallets,
      total: wallets.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch wallets');
  }
}

/**
 * Create a new wallet
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, createWalletSchema);
    const projectId = getProjectId(req, auth);

    if (!walletService.isChainSupported(body.chainId)) {
      return errors.chainNotSupported(body.chainId);
    }

    const result = await walletService.createWallet({
      userId: auth.userId,
      projectId,
      chainId: body.chainId,
      type: body.type,
    });

    return success({
      wallet: result.wallet,
      smartAccountAddress: result.smartAccountAddress,
      personalAddress: result.personalAddress,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create wallet');
  }
}
