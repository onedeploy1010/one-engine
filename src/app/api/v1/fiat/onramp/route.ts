/**
 * Fiat Onramp Endpoints
 * POST /api/v1/fiat/onramp - Create onramp session
 * GET /api/v1/fiat/onramp - Get currencies
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fiatService } from '@/services/fiat/fiat.service';
import { success, errors } from '@/lib/response';
import { requireAuth, getProjectId } from '@/middleware/auth';
import { validateBody, addressSchema, chainIdSchema } from '@/middleware/validation';

const onrampSchema = z.object({
  fiatCurrency: z.string().length(3).toUpperCase(),
  fiatAmount: z.number().positive().min(10),
  cryptoCurrency: z.string().min(2).max(10).toUpperCase(),
  walletAddress: addressSchema,
  chainId: chainIdSchema.default(8453),
});

/**
 * Get supported currencies
 */
export async function GET() {
  try {
    const [fiatCurrencies, cryptoCurrencies] = await Promise.all([
      fiatService.getSupportedFiatCurrencies(),
      fiatService.getSupportedCryptoCurrencies(),
    ]);

    return success({
      fiatCurrencies,
      cryptoCurrencies,
    });
  } catch (error) {
    return errors.internal('Failed to fetch currencies');
  }
}

/**
 * Create onramp session
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const body = await validateBody(req, onrampSchema);

    const session = await fiatService.createOnrampSession({
      userId: auth.userId,
      projectId,
      fiatCurrency: body.fiatCurrency,
      fiatAmount: body.fiatAmount,
      cryptoCurrency: body.cryptoCurrency,
      walletAddress: body.walletAddress,
      chainId: body.chainId,
    });

    return success(session);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create onramp session');
  }
}
