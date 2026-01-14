/**
 * Contract Read Endpoint
 * POST /api/v1/contracts/read - Read from a contract
 */

import { NextRequest } from 'next/server';
import { contractService } from '@/services/contracts/contract.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody, contractCallSchema } from '@/middleware/validation';

/**
 * Read from a contract (view/pure functions)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await validateBody(req, contractCallSchema);

    const result = await contractService.read({
      contractAddress: body.contractAddress,
      chainId: body.chainId,
      method: body.method,
      args: body.args,
      abi: body.abi,
    });

    return success({
      result,
      contractAddress: body.contractAddress,
      chainId: body.chainId,
      method: body.method,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to read from contract');
  }
}
