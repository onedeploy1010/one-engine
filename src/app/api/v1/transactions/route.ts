/**
 * Transactions Endpoint
 * GET /api/v1/transactions - Get user's transaction history
 * POST /api/v1/transactions - Create/track a new transaction
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/response';
import { requireAuth, getProjectId } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'TransactionsAPI' });

const createTransactionSchema = z.object({
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  chainId: z.number(),
  type: z.enum(['transfer', 'swap', 'contract', 'approve', 'other']).optional(),
  from: z.string(),
  to: z.string(),
  value: z.string().optional(),
  data: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Get transaction history
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);

    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get('chainId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const walletAddress = searchParams.get('address');

    const supabase = getSupabaseAdmin() as any;

    // Build query
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (chainId) {
      query = query.eq('chain_id', parseInt(chainId));
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (walletAddress) {
      query = query.or(`from_address.eq.${walletAddress},to_address.eq.${walletAddress}`);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      log.error('Failed to fetch transactions', error);
      return errors.internal('Failed to fetch transactions');
    }

    // Format transactions
    const formattedTransactions = (transactions || []).map(tx => ({
      id: tx.id,
      hash: tx.hash,
      chainId: tx.chain_id,
      type: tx.type,
      status: tx.status,
      from: tx.from_address,
      to: tx.to_address,
      value: tx.value,
      gasUsed: tx.gas_used,
      gasPrice: tx.gas_price,
      blockNumber: tx.block_number,
      timestamp: tx.timestamp,
      metadata: tx.metadata,
      createdAt: tx.created_at,
    }));

    return success({
      transactions: formattedTransactions,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch transactions');
  }
}

/**
 * Create/track a new transaction
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const body = await validateBody(req, createTransactionSchema);

    const supabase = getSupabaseAdmin() as any;

    // Check if transaction already exists
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('hash', body.hash.toLowerCase())
      .eq('chain_id', body.chainId)
      .single();

    if (existing) {
      return errors.conflict('Transaction already tracked');
    }

    // Insert new transaction
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        user_id: auth.userId,
        project_id: projectId,
        hash: body.hash.toLowerCase(),
        chain_id: body.chainId,
        type: body.type || 'other',
        from_address: body.from.toLowerCase(),
        to_address: body.to.toLowerCase(),
        value: body.value || '0',
        data: body.data,
        status: 'pending',
        metadata: body.metadata,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create transaction', error);
      return errors.internal('Failed to track transaction');
    }

    return success({
      transaction: {
        id: transaction.id,
        hash: transaction.hash,
        chainId: transaction.chain_id,
        type: transaction.type,
        status: transaction.status,
        from: transaction.from_address,
        to: transaction.to_address,
        value: transaction.value,
        createdAt: transaction.created_at,
      },
      message: 'Transaction tracking started',
    }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to track transaction');
  }
}
