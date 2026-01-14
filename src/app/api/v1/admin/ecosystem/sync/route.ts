/**
 * Ecosystem Sync API
 * Trigger and monitor sync operations between One-Engine and sub-ecosystems
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/middleware/auth';
import { success, error } from '@/lib/response';
import { ecosystemService } from '@/services/ecosystem';
import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import { z } from 'zod';

const log = new LogService({ service: 'EcosystemSyncAPI' });

export const runtime = 'nodejs';

const syncRequestSchema = z.object({
  appSlug: z.string().min(1),
  syncType: z.enum(['full', 'incremental', 'users', 'wallets']).default('full'),
  users: z.array(z.object({
    id: z.string(),
    email: z.string().email(),
    wallet_address: z.string().optional(),
    thirdweb_user_id: z.string().optional(),
    kyc_status: z.string().optional(),
    kyc_level: z.number().optional(),
    membership_tier: z.string().optional(),
    agent_level: z.number().optional(),
    referral_code: z.string().optional(),
    referred_by: z.string().optional(),
    total_referrals: z.number().optional(),
    total_team_volume: z.number().optional(),
    wallet_status: z.string().optional(),
    wallet_type: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    created_at: z.string().optional(),
    last_login_at: z.string().optional(),
  })).optional(),
});

/**
 * GET /api/v1/admin/ecosystem/sync
 * Get sync logs and status
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if ('error' in authResult) {
      return error((authResult.error as { code: string; message: string }).code, (authResult.error as { code: string; message: string }).message, 401);
    }

    const { searchParams } = new URL(request.url);
    const appSlug = searchParams.get('appSlug');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (appSlug) {
      const logs = await ecosystemService.getSyncLogs(appSlug, limit);
      return success({ logs, total: logs.length });
    }

    // Get all recent sync logs
    const { data: logs } = await getSupabaseAdmin()
      .from('sync_logs')
      .select(`
        *,
        ecosystem_apps (name, slug)
      `)
      .order('started_at', { ascending: false })
      .limit(limit);

    return success({ logs: logs || [], total: logs?.length || 0 });

  } catch (err) {
    log.error('Failed to fetch sync logs', err as Error);
    return error('E5001', 'Failed to fetch sync logs', 500);
  }
}

/**
 * POST /api/v1/admin/ecosystem/sync
 * Trigger a sync operation
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if ('error' in authResult) {
      return error((authResult.error as { code: string; message: string }).code, (authResult.error as { code: string; message: string }).message, 401);
    }

    const body = await request.json();
    const validatedData = syncRequestSchema.parse(body);

    // Verify app exists
    const app = await ecosystemService.getAppBySlug(validatedData.appSlug);
    if (!app) {
      return error('E4004', `App not found: ${validatedData.appSlug}`, 404);
    }

    // If users data is provided, sync them
    if (validatedData.users && validatedData.users.length > 0) {
      const result = await ecosystemService.syncUsersFromApp(
        validatedData.appSlug,
        validatedData.users as any
      );

      log.info('User sync completed', {
        appSlug: validatedData.appSlug,
        imported: result.imported,
        updated: result.updated,
        failed: result.failed,
        adminId: authResult.userId,
      });

      return success({
        message: 'Sync completed',
        result,
      });
    }

    // For incremental sync, we would fetch from the app's API
    // This is a placeholder for the actual implementation
    return success({
      message: 'Sync initiated',
      syncType: validatedData.syncType,
      appSlug: validatedData.appSlug,
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return error('E4001', 'Validation failed: ' + err.errors[0].message, 400);
    }
    log.error('Sync operation failed', err as Error);
    return error('E5001', 'Sync operation failed', 500);
  }
}
