/**
 * Health Check Endpoint
 * GET /api/health - System health status
 */

import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { success, errors } from '@/lib/response';
import { getWorkerStatus } from '@/workers';

/**
 * Health check
 */
export async function GET(req: NextRequest) {
  try {
    const checks: Record<string, boolean> = {};
    const details: Record<string, unknown> = {};

    // Check Supabase connection
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from('users').select('count').limit(1);
      checks.database = !error;
    } catch {
      checks.database = false;
    }

    // Get worker status
    try {
      const workers = getWorkerStatus();
      checks.workers = workers.every(w => w.running);
      details.workers = workers;
    } catch {
      checks.workers = false;
    }

    // Overall health
    const healthy = Object.values(checks).every(Boolean);

    return success({
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks,
      details,
    });
  } catch (error) {
    return errors.internal('Health check failed');
  }
}
