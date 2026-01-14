/**
 * Ecosystem Statistics API
 * Aggregate statistics across the entire ecosystem
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/middleware/auth';
import { success, error } from '@/lib/response';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cache, CACHE_TTL } from '@/lib/cache';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'EcosystemStatsAPI' });

export const runtime = 'nodejs';

interface EcosystemStats {
  users: {
    total: number;
    active30d: number;
    newToday: number;
    byTier: Record<string, number>;
    byKycStatus: Record<string, number>;
  };
  apps: {
    total: number;
    active: number;
  };
  transactions: {
    total: number;
    today: number;
    volumeUsd: number;
  };
  trading: {
    totalPositions: number;
    activePositions: number;
    totalAum: number;
  };
  growth: {
    usersLast7Days: number[];
    transactionsLast7Days: number[];
  };
}

/**
 * GET /api/v1/admin/ecosystem/stats
 * Get ecosystem-wide statistics
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if ('error' in authResult) {
      return error((authResult.error as { code: string; message: string }).code, (authResult.error as { code: string; message: string }).message, 401);
    }

    const cacheKey = 'admin:ecosystem:stats';
    const cached = await cache.get<EcosystemStats>(cacheKey);
    if (cached) {
      return success(cached);
    }

    // Fetch all stats in parallel
    const [
      userStats,
      appStats,
      txStats,
      tradingStats,
      growthStats,
    ] = await Promise.all([
      fetchUserStats(),
      fetchAppStats(),
      fetchTransactionStats(),
      fetchTradingStats(),
      fetchGrowthStats(),
    ]);

    const stats: EcosystemStats = {
      users: userStats,
      apps: appStats,
      transactions: txStats,
      trading: tradingStats,
      growth: growthStats,
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, stats, CACHE_TTL.CONFIG);

    return success(stats);

  } catch (err) {
    log.error('Failed to fetch ecosystem stats', err as Error);
    return error('E5001', 'Failed to fetch ecosystem stats', 500);
  }
}

async function fetchUserStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    { count: total },
    { count: newToday },
    { data: tierData },
    { data: kycData },
  ] = await Promise.all([
    getSupabaseAdmin().from('users').select('*', { count: 'exact', head: true }),
    getSupabaseAdmin().from('users').select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),
    getSupabaseAdmin().from('users').select('membership_tier'),
    getSupabaseAdmin().from('users').select('kyc_status'),
  ]);

  const byTier: Record<string, number> = {};
  (tierData || []).forEach((u: any) => {
    const tier = u.membership_tier || 'free';
    byTier[tier] = (byTier[tier] || 0) + 1;
  });

  const byKycStatus: Record<string, number> = {};
  (kycData || []).forEach((u: any) => {
    const status = u.kyc_status || 'none';
    byKycStatus[status] = (byKycStatus[status] || 0) + 1;
  });

  return {
    total: total || 0,
    active30d: total || 0, // Would need last_login tracking
    newToday: newToday || 0,
    byTier,
    byKycStatus,
  };
}

async function fetchAppStats() {
  const { count: total } = await getSupabaseAdmin()
    .from('ecosystem_apps')
    .select('*', { count: 'exact', head: true });

  const { count: active } = await getSupabaseAdmin()
    .from('ecosystem_apps')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  return {
    total: total || 0,
    active: active || 0,
  };
}

async function fetchTransactionStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: total },
    { count: todayCount },
  ] = await Promise.all([
    getSupabaseAdmin().from('transactions').select('*', { count: 'exact', head: true }),
    getSupabaseAdmin().from('transactions').select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),
  ]);

  return {
    total: total || 0,
    today: todayCount || 0,
    volumeUsd: 0, // Would aggregate from transactions
  };
}

async function fetchTradingStats() {
  const [
    { count: totalPositions },
    { count: activePositions },
    { data: aumData },
  ] = await Promise.all([
    getSupabaseAdmin().from('quant_positions').select('*', { count: 'exact', head: true }),
    getSupabaseAdmin().from('quant_positions').select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    getSupabaseAdmin().from('quant_positions')
      .select('current_value')
      .eq('status', 'active'),
  ]);

  const totalAum = (aumData || []).reduce((sum: number, p: any) =>
    sum + (parseFloat(p.current_value) || 0), 0
  );

  return {
    totalPositions: totalPositions || 0,
    activePositions: activePositions || 0,
    totalAum,
  };
}

async function fetchGrowthStats() {
  const days = 7;
  const usersLast7Days: number[] = [];
  const transactionsLast7Days: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const [
      { count: users },
      { count: txs },
    ] = await Promise.all([
      getSupabaseAdmin().from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString()),
      getSupabaseAdmin().from('transactions').select('*', { count: 'exact', head: true })
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString()),
    ]);

    usersLast7Days.push(users || 0);
    transactionsLast7Days.push(txs || 0);
  }

  return {
    usersLast7Days,
    transactionsLast7Days,
  };
}
