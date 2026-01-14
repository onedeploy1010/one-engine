/**
 * Swap Execute Endpoint
 * POST /api/v1/swap/execute - Execute a swap transaction
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { swapService } from '@/services/swap/swap.service';
import { walletService } from '@/services/wallet/wallet.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

const executeSwapSchema = z.object({
  quote: z.object({
    fromToken: z.object({
      address: z.string(),
      chainId: z.number(),
      symbol: z.string(),
      name: z.string(),
      decimals: z.number(),
    }),
    toToken: z.object({
      address: z.string(),
      chainId: z.number(),
      symbol: z.string(),
      name: z.string(),
      decimals: z.number(),
    }),
    fromAmount: z.string(),
    toAmount: z.string(),
    exchangeRate: z.number(),
    priceImpact: z.number().optional(),
    estimatedGas: z.string().optional(),
    route: z.array(z.any()).optional(),
    expiresAt: z.string().optional(),
  }),
  walletId: z.string().uuid().optional(),
  recipient: z.string().optional(),
  slippage: z.number().min(0).max(50).optional().default(0.5),
});

/**
 * Execute a swap transaction
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, executeSwapSchema);

    // Check if quote has expired
    if (body.quote.expiresAt && new Date(body.quote.expiresAt) < new Date()) {
      return errors.badRequest('Quote has expired. Please get a new quote.');
    }

    // Get the user's wallet/account
    let wallet;
    if (body.walletId) {
      wallet = await walletService.getWalletById(body.walletId, auth.userId);
    } else {
      wallet = await walletService.getDefaultWallet(auth.userId);
    }

    if (!wallet) {
      return errors.notFound('Wallet not found. Please create a wallet first.');
    }

    // Get the smart account for transaction execution
    const account = await walletService.getSmartAccount(wallet.id, auth.userId);
    if (!account) {
      return errors.badRequest('Could not initialize wallet account');
    }

    // Execute the swap
    const result = await swapService.executeSwap(
      body.quote as any,
      account,
      (wallet as any).smart_account_address || (wallet as any).address,
      body.recipient
    );

    return success({
      transaction: {
        hash: result.transactionHash,
        status: result.status,
        fromChainId: result.fromChainId,
        toChainId: result.toChainId,
        fromToken: result.fromToken,
        toToken: result.toToken,
        fromAmount: result.fromAmount,
        toAmount: result.toAmount,
      },
      message: 'Swap transaction submitted successfully',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to execute swap');
  }
}

/**
 * Get swap status
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const hash = searchParams.get('hash');
    const chainId = searchParams.get('chainId');

    if (!hash || !chainId) {
      return errors.badRequest('Missing hash or chainId parameter');
    }

    const status = await swapService.getSwapStatus(hash, parseInt(chainId));

    return success({ status });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to get swap status');
  }
}
