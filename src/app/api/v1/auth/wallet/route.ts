/**
 * Wallet Authentication Endpoint
 * POST /api/v1/auth/wallet - Authenticate with wallet
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authService } from '@/services/auth/auth.service';
import { success, errors } from '@/lib/response';
import { validateBody, addressSchema } from '@/middleware/validation';

const walletAuthSchema = z.object({
  walletAddress: addressSchema,
  smartAccountAddress: addressSchema,
  email: z.string().email().optional(),
});

/**
 * Authenticate with wallet address
 */
export async function POST(req: NextRequest) {
  try {
    const body = await validateBody(req, walletAuthSchema);

    const result = await authService.authenticateWithWallet(
      body.walletAddress,
      body.smartAccountAddress,
      body.email
    );

    return success({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to authenticate wallet');
  }
}
