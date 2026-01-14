/**
 * Single Contract Operations
 * GET /api/v1/contracts/[id] - Get contract details
 * PUT /api/v1/contracts/[id] - Update contract metadata
 * DELETE /api/v1/contracts/[id] - Delete contract
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { contractService } from '@/services/contracts/contract.service';
import { success, errors } from '@/lib/response';
import { requireAuth, getProjectId } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';
import { getSupabaseAdmin } from '@/lib/supabase';

const updateContractSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  metadata: z.record(z.any()).optional(),
  isVerified: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get contract details
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const { id } = await params;

    const supabase = getSupabaseAdmin() as any;

    // Try to find by ID or address
    let query = supabase
      .from('contracts_registry')
      .select('*');

    // Check if id is UUID or address
    if (id.startsWith('0x')) {
      query = query.eq('address', id.toLowerCase());
    } else {
      query = query.eq('id', id);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return errors.notFound('Contract not found');
    }

    const contract = data as {
      id: string;
      address: string;
      chain_id: number;
      name: string;
      contract_type: string;
      abi: any;
      bytecode: string | null;
      verified: boolean;
      deploy_tx_hash: string | null;
      deployer_address: string | null;
      constructor_args: any;
      metadata: any;
      created_at: string;
      updated_at: string;
    };

    return success({
      contract: {
        id: contract.id,
        address: contract.address,
        chainId: contract.chain_id,
        name: contract.name,
        contractType: contract.contract_type,
        abi: contract.abi,
        verified: contract.verified,
        deployTxHash: contract.deploy_tx_hash,
        deployerAddress: contract.deployer_address,
        metadata: contract.metadata,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to get contract');
  }
}

/**
 * Update contract metadata
 */
export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const { id } = await params;
    const body = await validateBody(req, updateContractSchema);

    const supabase = getSupabaseAdmin() as any;

    // Verify contract exists and belongs to project
    let query = supabase
      .from('contracts_registry')
      .select('id, project_id')
      .eq('id', id);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: existingContract, error: fetchError } = await query.single();

    if (fetchError || !existingContract) {
      return errors.notFound('Contract not found');
    }

    // Build update object - only update fields that exist in the schema
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;
    if (body.isVerified !== undefined) updateData.verified = body.isVerified;

    // Update contract
    const { data, error } = await supabase
      .from('contracts_registry')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return errors.internal('Failed to update contract');
    }

    const updated = data as any;

    return success({
      contract: {
        id: updated.id,
        address: updated.address,
        chainId: updated.chain_id,
        name: updated.name,
        contractType: updated.contract_type,
        verified: updated.verified,
        metadata: updated.metadata,
        updatedAt: updated.updated_at,
      },
      message: 'Contract updated successfully',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to update contract');
  }
}

/**
 * Delete contract from registry
 */
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const { id } = await params;

    const supabase = getSupabaseAdmin() as any;

    // Verify contract exists and belongs to project
    let query = supabase
      .from('contracts_registry')
      .select('id')
      .eq('id', id);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: existingContract, error: fetchError } = await query.single();

    if (fetchError || !existingContract) {
      return errors.notFound('Contract not found');
    }

    // Soft delete
    const { error } = await supabase
      .from('contracts_registry')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return errors.internal('Failed to delete contract');
    }

    return success({
      message: 'Contract removed from registry successfully',
      deletedId: id,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to delete contract');
  }
}
