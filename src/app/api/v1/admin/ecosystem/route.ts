/**
 * Admin Ecosystem Management API
 * Manage ecosystem apps, users, and sync operations
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/middleware/auth';
import { success, error, paginated } from '@/lib/response';
import { ecosystemService } from '@/services/ecosystem';
import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import { z } from 'zod';

const log = new LogService({ service: 'AdminEcosystemAPI' });

export const runtime = 'nodejs';

// Validation schemas
const createAppSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(100),
  description: z.string().optional(),
  supabaseUrl: z.string().url().optional(),
  supabaseProjectId: z.string().optional(),
  apiEndpoint: z.string().url().optional(),
  syncConfig: z.object({
    syncUsers: z.boolean().default(true),
    syncWallets: z.boolean().default(true),
    syncTransactions: z.boolean().default(false),
    syncIntervalSeconds: z.number().min(60).default(300),
  }).optional(),
});

/**
 * GET /api/v1/admin/ecosystem
 * List all ecosystem apps with stats
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if ('error' in authResult) {
      return error((authResult.error as { code: string; message: string }).code, (authResult.error as { code: string; message: string }).message, 401);
    }

    const apps = await ecosystemService.getApps();

    // Fetch stats for each app
    const appsWithStats = await Promise.all(
      apps.map(async (app) => {
        const { count: userCount } = await getSupabaseAdmin()
          .from('user_app_mappings')
          .select('*', { count: 'exact', head: true })
          .eq('app_id', app.id);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lastSync } = await (getSupabaseAdmin() as any)
          .from('sync_logs')
          .select('*')
          .eq('app_id', app.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...app,
          stats: {
            totalUsers: userCount || 0,
            lastSync: (lastSync as any)?.completed_at || null,
            lastSyncStatus: (lastSync as any)?.status || null,
          },
        };
      })
    );

    return success({
      apps: appsWithStats,
      total: appsWithStats.length,
    });

  } catch (err) {
    log.error('Failed to fetch ecosystem apps', err as Error);
    return error('E5001', 'Failed to fetch ecosystem apps', 500);
  }
}

/**
 * POST /api/v1/admin/ecosystem
 * Register a new ecosystem app
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if ('error' in authResult) {
      return error((authResult.error as { code: string; message: string }).code, (authResult.error as { code: string; message: string }).message, 401);
    }

    const body = await request.json();
    const validatedData = createAppSchema.parse(body);

    const app = await ecosystemService.registerApp(validatedData as any);

    log.info('Ecosystem app registered', { slug: app.slug, adminId: authResult.userId });
    return success({ app }, 201);

  } catch (err) {
    if (err instanceof z.ZodError) {
      return error('E4001', 'Validation failed: ' + err.errors[0].message, 400);
    }
    log.error('Failed to register ecosystem app', err as Error);
    return error('E5001', 'Failed to register app', 500);
  }
}
