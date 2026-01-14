/**
 * Request Logging Middleware for ONE Engine
 * Comprehensive API request/response logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { LogService } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase';

const log = new LogService({ service: 'RequestLogger' });
const dbLog = new LogService({ service: 'DatabaseLogger' });

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  query: Record<string, string>;
  ip: string;
  userAgent: string;
  userId?: string;
  projectId?: string;
  startTime: number;
}

/**
 * Create request context for logging
 */
export function createRequestContext(req: NextRequest): RequestContext {
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return {
    requestId: uuidv4(),
    method: req.method,
    path: url.pathname,
    query,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0] ||
        req.headers.get('x-real-ip') ||
        'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
    startTime: Date.now(),
  };
}

/**
 * Log request start
 */
export function logRequestStart(ctx: RequestContext): void {
  log.info(`→ ${ctx.method} ${ctx.path}`, {
    requestId: ctx.requestId,
    ip: ctx.ip,
    query: Object.keys(ctx.query).length > 0 ? ctx.query : undefined,
  });
}

/**
 * Log request completion
 */
export function logRequestEnd(
  ctx: RequestContext,
  response: NextResponse,
  error?: Error
): void {
  const duration = Date.now() - ctx.startTime;
  const status = response.status;

  const logData = {
    requestId: ctx.requestId,
    duration: `${duration}ms`,
    status,
    userId: ctx.userId,
    projectId: ctx.projectId,
  };

  if (error) {
    log.error(`✗ ${ctx.method} ${ctx.path}`, error, logData);
  } else if (status >= 400) {
    log.warn(`⚠ ${ctx.method} ${ctx.path}`, logData);
  } else {
    log.info(`✓ ${ctx.method} ${ctx.path}`, logData);
  }

  // Log to database for analytics (async, don't wait)
  logToDatabase(ctx, status, duration).catch(() => {});
}

/**
 * Log request to database for analytics
 */
async function logToDatabase(
  ctx: RequestContext,
  status: number,
  duration: number
): Promise<void> {
  // Only log in production and for slower requests or errors
  if (process.env.NODE_ENV !== 'production' && status < 400 && duration < 1000) {
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const insertData = {
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      service: 'api',
      message: `${ctx.method} ${ctx.path}`,
      data: {
        requestId: ctx.requestId,
        status,
        duration,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        query: ctx.query,
      },
      user_id: ctx.userId,
      project_id: ctx.projectId,
      request_id: ctx.requestId,
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
    };
    await supabase.from('system_logs').insert(insertData as any);
  } catch (err) {
    // Don't throw, just log locally
    dbLog.error('Failed to log to database', err);
  }
}

/**
 * Middleware wrapper that adds logging
 */
export function withLogging<T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const ctx = createRequestContext(req);
    logRequestStart(ctx);

    let response: NextResponse;
    let error: Error | undefined;

    try {
      response = await handler(req, ...args);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      response = NextResponse.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    // Add request ID to response headers
    response.headers.set('x-request-id', ctx.requestId);

    logRequestEnd(ctx, response, error);

    return response;
  }) as T;
}

/**
 * Get analytics summary for a time period
 */
export async function getApiAnalytics(
  startDate: Date,
  endDate: Date
): Promise<{
  totalRequests: number;
  errorRate: number;
  avgDuration: number;
  topEndpoints: Array<{ path: string; count: number }>;
  statusCodes: Record<number, number>;
}> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('system_logs')
    .select('*')
    .eq('service', 'api')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error || !data) {
    return {
      totalRequests: 0,
      errorRate: 0,
      avgDuration: 0,
      topEndpoints: [],
      statusCodes: {},
    };
  }

  const logs = data as Array<{
    data: { status?: number; duration?: number } | null;
    message: string;
  }>;

  const totalRequests = logs.length;
  const errors = logs.filter((d) => d.data?.status && d.data.status >= 500).length;
  const durations = logs.map((d) => d.data?.duration || 0);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);

  // Count endpoints
  const endpointCounts = new Map<string, number>();
  const statusCounts: Record<number, number> = {};

  logs.forEach((d) => {
    const path = d.message?.split(' ')[1] || 'unknown';
    endpointCounts.set(path, (endpointCounts.get(path) || 0) + 1);

    const status = d.data?.status || 0;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const topEndpoints = Array.from(endpointCounts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRequests,
    errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
    avgDuration,
    topEndpoints,
    statusCodes: statusCounts,
  };
}
