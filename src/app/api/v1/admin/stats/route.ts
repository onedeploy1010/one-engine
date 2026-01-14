/**
 * Admin Statistics Endpoint
 * GET /api/v1/admin/stats - Get system-wide statistics (admin only)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { success, errors } from '@/lib/response';
import { requireAdmin } from '@/middleware/auth';
import { validateQuery } from '@/middleware/validation';
import { subDays } from 'date-fns';

const querySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

/**
 * Get system-wide statistics
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const query = validateQuery(req, querySchema);

    const supabase = getSupabaseAdmin();
    const startDate = subDays(new Date(), query.days).toISOString();

    // Fetch all stats in parallel
    const [
      totalUsers,
      newUsers,
      totalWallets,
      totalTransactions,
      totalProjects,
      totalStrategies,
      activePositions,
      totalPayments,
      totalFiatVolume,
    ] = await Promise.all([
      // Total users
      supabase.from('users').select('id', { count: 'exact', head: true }),

      // New users in period
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startDate),

      // Total wallets
      supabase.from('wallets').select('id', { count: 'exact', head: true }),

      // Total transactions
      supabase.from('transactions').select('id', { count: 'exact', head: true }),

      // Total projects
      supabase.from('projects').select('id', { count: 'exact', head: true }),

      // Total strategies
      supabase.from('quant_strategies').select('id', { count: 'exact', head: true }),

      // Active positions
      supabase
        .from('quant_positions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Total payments
      supabase.from('payments').select('id', { count: 'exact', head: true }),

      // Fiat volume
      supabase
        .from('fiat_transactions')
        .select('fiat_amount')
        .eq('status', 'completed')
        .gte('created_at', startDate),
    ]);

    // Calculate fiat volume
    const fiatData = totalFiatVolume.data as Array<{ fiat_amount: number }> | null;
    const fiatVolume = fiatData?.reduce(
      (sum, t) => sum + (t.fiat_amount || 0),
      0
    ) || 0;

    // Get user growth data
    const { data: userGrowth } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });

    // Aggregate by day
    const dailySignups: Record<string, number> = {};
    const userGrowthData = userGrowth as Array<{ created_at: string }> | null;
    userGrowthData?.forEach(user => {
      const day = user.created_at.split('T')[0];
      dailySignups[day] = (dailySignups[day] || 0) + 1;
    });

    // Get transaction volume by chain
    const { data: txByChain } = await supabase
      .from('transactions')
      .select('chain_id')
      .gte('created_at', startDate);

    const chainVolume: Record<number, number> = {};
    const txByChainData = txByChain as Array<{ chain_id: number }> | null;
    txByChainData?.forEach(tx => {
      chainVolume[tx.chain_id] = (chainVolume[tx.chain_id] || 0) + 1;
    });

    // Get KYC stats
    const { data: kycStats } = await supabase
      .from('users')
      .select('kyc_status');

    const kycBreakdown: Record<string, number> = {
      none: 0,
      pending: 0,
      verified: 0,
      rejected: 0,
    };
    const kycStatsData = kycStats as Array<{ kyc_status: string }> | null;
    kycStatsData?.forEach(user => {
      kycBreakdown[user.kyc_status] = (kycBreakdown[user.kyc_status] || 0) + 1;
    });

    return success({
      overview: {
        totalUsers: totalUsers.count || 0,
        newUsers: newUsers.count || 0,
        totalWallets: totalWallets.count || 0,
        totalTransactions: totalTransactions.count || 0,
        totalProjects: totalProjects.count || 0,
        totalStrategies: totalStrategies.count || 0,
        activePositions: activePositions.count || 0,
        totalPayments: totalPayments.count || 0,
        fiatVolume,
      },
      userGrowth: Object.entries(dailySignups).map(([date, count]) => ({
        date,
        count,
      })),
      chainVolume: Object.entries(chainVolume).map(([chainId, count]) => ({
        chainId: parseInt(chainId),
        count,
      })),
      kycBreakdown,
      period: {
        days: query.days,
        startDate,
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch statistics');
  }
}
