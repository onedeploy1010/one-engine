/**
 * Contract Endpoints
 * GET /api/v1/contracts - Get project contracts
 * POST /api/v1/contracts - Register a contract
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { contractService } from '@/services/contracts/contract.service';
import { success, errors } from '@/lib/response';
import { requireAuth, getProjectId } from '@/middleware/auth';
import { validateBody, validateQuery, chainIdSchema, addressSchema } from '@/middleware/validation';

const querySchema = z.object({
  chainId: chainIdSchema.optional(),
  type: z.enum(['token', 'nft', 'marketplace', 'staking', 'dao', 'custom']).optional(),
});

const registerSchema = z.object({
  address: addressSchema,
  chainId: chainIdSchema,
  name: z.string().min(1).max(255),
  type: z.enum(['token', 'nft', 'marketplace', 'staking', 'dao', 'custom']).default('custom'),
  abi: z.array(z.any()),
});

/**
 * Get project contracts
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const query = validateQuery(req, querySchema);

    if (!projectId) {
      return errors.badRequest('Project ID is required');
    }

    const contracts = await contractService.getProjectContracts(projectId, {
      chainId: query.chainId,
      contractType: query.type,
    });

    return success({
      contracts,
      total: contracts.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch contracts');
  }
}

/**
 * Register a contract
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const body = await validateBody(req, registerSchema);

    if (!projectId) {
      return errors.badRequest('Project ID is required');
    }

    const contract = await contractService.register(
      projectId,
      body.address,
      body.chainId,
      body.name,
      body.type,
      body.abi
    );

    return success({ contract });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      if (error.message.includes('already registered')) {
        return errors.conflict(error.message);
      }
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to register contract');
  }
}
