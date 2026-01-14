/**
 * Admin Users Endpoints
 * GET /api/v1/admin/users - List all users (admin only)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { success, errors } from '@/lib/response';
import { requireAdmin } from '@/middleware/auth';
import { validateQuery } from '@/middleware/validation';
import { parsePaginationParams, createPaginationResult } from '@/utils/pagination';

const querySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  role: z.enum(['user', 'agent', 'admin', 'superadmin']).optional(),
  kycStatus: z.enum(['none', 'pending', 'verified', 'rejected']).optional(),
  membershipTier: z.enum(['free', 'basic', 'premium', 'vip']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * List all users (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const query = validateQuery(req, querySchema);
    const pagination = parsePaginationParams(query);

    const supabase = getSupabaseAdmin();
    let dbQuery = supabase
      .from('users')
      .select('*', { count: 'exact' });

    // Apply filters
    if (query.search) {
      dbQuery = dbQuery.or(`email.ilike.%${query.search}%,wallet_address.ilike.%${query.search}%`);
    }
    if (query.role) {
      dbQuery = dbQuery.eq('role', query.role);
    }
    if (query.kycStatus) {
      dbQuery = dbQuery.eq('kyc_status', query.kycStatus);
    }
    if (query.membershipTier) {
      dbQuery = dbQuery.eq('membership_tier', query.membershipTier);
    }

    // Apply pagination
    const offset = (pagination.page - 1) * pagination.limit;
    dbQuery = dbQuery
      .order(pagination.sortBy || 'created_at', { ascending: pagination.sortOrder === 'asc' })
      .range(offset, offset + pagination.limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      return errors.internal(`Failed to fetch users: ${error.message}`);
    }

    interface UserRow {
      id: string;
      email: string | null;
      wallet_address: string | null;
      smart_account_address: string | null;
      role: string;
      kyc_status: string;
      membership_tier: string;
      created_at: string;
      updated_at: string;
    }

    const users = (data as UserRow[]).map(row => ({
      id: row.id,
      email: row.email,
      walletAddress: row.wallet_address,
      smartAccountAddress: row.smart_account_address,
      role: row.role,
      kycStatus: row.kyc_status,
      membershipTier: row.membership_tier,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const result = createPaginationResult(users, count || 0, pagination);

    return success(result);
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch users');
  }
}
