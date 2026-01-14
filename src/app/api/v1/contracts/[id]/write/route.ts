/**
 * Contract Write Operations
 * POST /api/v1/contracts/[id]/write - Execute contract state-changing methods
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { contractService } from '@/services/contracts/contract.service';
import { walletService } from '@/services/wallet/wallet.service';
import { success, errors } from '@/lib/response';
import { requireAuth, getProjectId } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';
import { getSupabaseAdmin } from '@/lib/supabase';

const writeContractSchema = z.object({
  method: z.string().min(1),
  args: z.array(z.any()).optional().default([]),
  value: z.string().optional(), // ETH value to send
  walletId: z.string().uuid().optional(),
  gasLimit: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Execute a write operation on the contract
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const { id } = await params;
    const body = await validateBody(req, writeContractSchema);

    const supabase = getSupabaseAdmin() as any;

    // Get contract from registry
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

    const { data: contract, error: fetchError } = await query.single();

    if (fetchError || !contract) {
      return errors.notFound('Contract not found');
    }

    // Get user's wallet for transaction
    let wallet;
    if (body.walletId) {
      wallet = await walletService.getWalletById(body.walletId, auth.userId);
    } else {
      wallet = await walletService.getDefaultWallet(auth.userId);
    }

    if (!wallet) {
      return errors.notFound('Wallet not found. Please create a wallet first.');
    }

    // Ensure wallet is on the same chain as contract
    if (wallet.chain_id !== contract.chain_id) {
      return errors.badRequest(
        `Wallet is on chain ${wallet.chain_id} but contract is on chain ${contract.chain_id}`
      );
    }

    // Get smart account
    const account = await walletService.getSmartAccount(wallet.id, auth.userId);
    if (!account) {
      return errors.badRequest('Could not initialize wallet account');
    }

    // Execute the contract write
    const result = await contractService.write({
      contractAddress: contract.address,
      chainId: contract.chain_id,
      abi: contract.abi,
      method: body.method,
      args: body.args,
      account,
      value: body.value ? BigInt(body.value) : undefined,
    });

    // Log the transaction
    await supabase.from('contract_transactions').insert({
      contract_id: contract.id,
      project_id: projectId,
      user_id: auth.userId,
      wallet_id: wallet.id,
      method: body.method,
      args: body.args,
      tx_hash: result.transactionHash,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    return success({
      transaction: {
        hash: result.transactionHash,
        status: 'pending',
        contractAddress: contract.address,
        chainId: contract.chain_id,
        method: body.method,
        args: body.args,
      },
      message: 'Transaction submitted successfully',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to execute contract method');
  }
}
