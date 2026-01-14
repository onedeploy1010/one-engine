/**
 * Project Authentication Middleware
 * 验证请求的project凭证，实现数据隔离
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

// Helper to get typed supabase client (bypasses strict type checking for new tables)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface ProjectContext {
  projectId: string;
  teamId: string;
  clientId: string;
  apiKeyId?: string;
  keyType: 'publishable' | 'secret';
  permissions: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

// Header names
const CLIENT_ID_HEADER = 'x-client-id';
const SECRET_KEY_HEADER = 'x-secret-key';
const AUTHORIZATION_HEADER = 'authorization';

/**
 * Development mode bypass configuration
 */
const DEV_CLIENT_ID = process.env.DEFAULT_CLIENT_ID || 'one_pk_e8f647bfa643fdcfaa3a23f760488e49be09f929296eed4a6c399d437d907f60';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * 从请求中提取并验证project凭证
 */
export async function authenticateProject(req: NextRequest): Promise<{
  success: boolean;
  context?: ProjectContext;
  error?: { code: string; message: string };
}> {
  // 1. 提取凭证
  const clientId = req.headers.get(CLIENT_ID_HEADER);
  const secretKey = req.headers.get(SECRET_KEY_HEADER);
  const authHeader = req.headers.get(AUTHORIZATION_HEADER);

  // Bearer token格式: Bearer one_sk_xxxxx
  let apiKey = secretKey;
  if (!apiKey && authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7);
  }

  // 2. 必须提供client_id
  if (!clientId) {
    return {
      success: false,
      error: {
        code: 'AUTH_MISSING_CLIENT_ID',
        message: 'Missing x-client-id header',
      },
    };
  }

  // Development mode bypass - skip database validation
  if (IS_DEVELOPMENT && clientId === DEV_CLIENT_ID) {
    return {
      success: true,
      context: {
        projectId: 'dev-project',
        teamId: 'dev-team',
        clientId: DEV_CLIENT_ID,
        keyType: 'secret',
        permissions: ['*'],
        rateLimit: {
          requestsPerMinute: 1000,
          requestsPerDay: 100000,
        },
      },
    };
  }

  // 3. 查找project
  const { data: project, error: projectError } = await db()
    .from('projects')
    .select(`
      id,
      team_id,
      client_id,
      status,
      settings
    `)
    .eq('client_id', clientId)
    .single();

  if (projectError || !project) {
    return {
      success: false,
      error: {
        code: 'AUTH_INVALID_CLIENT_ID',
        message: 'Invalid client ID',
      },
    };
  }

  if (project.status !== 'active') {
    return {
      success: false,
      error: {
        code: 'AUTH_PROJECT_INACTIVE',
        message: 'Project is not active',
      },
    };
  }

  // 4. 确定key类型和权限
  let keyType: 'publishable' | 'secret' = 'publishable';
  let apiKeyId: string | undefined;
  let permissions: string[] = ['read']; // publishable默认只读

  // 如果提供了secret key，验证它
  if (apiKey) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const { data: keyRecord, error: keyError } = await db()
      .from('project_api_keys')
      .select('id, key_type, permissions, is_active, allowed_domains, rate_limit_per_minute')
      .eq('project_id', project.id)
      .eq('key_hash', keyHash)
      .single();

    if (keyError || !keyRecord) {
      return {
        success: false,
        error: {
          code: 'AUTH_INVALID_API_KEY',
          message: 'Invalid API key',
        },
      };
    }

    if (!keyRecord.is_active) {
      return {
        success: false,
        error: {
          code: 'AUTH_KEY_INACTIVE',
          message: 'API key is not active',
        },
      };
    }

    keyType = keyRecord.key_type;
    apiKeyId = keyRecord.id;
    permissions = keyRecord.permissions || (keyType === 'secret' ? ['*'] : ['read']);

    // 验证域名限制 (仅publishable key)
    if (keyType === 'publishable' && keyRecord.allowed_domains?.length > 0) {
      const origin = req.headers.get('origin') || '';
      const hostname = new URL(origin || 'http://localhost').hostname;

      if (!keyRecord.allowed_domains.includes(hostname) && !keyRecord.allowed_domains.includes('*')) {
        return {
          success: false,
          error: {
            code: 'AUTH_DOMAIN_NOT_ALLOWED',
            message: 'Domain not in allowlist',
          },
        };
      }
    }

    // 更新最后使用时间
    await db()
      .from('project_api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        total_requests: keyRecord.total_requests + 1,
      })
      .eq('id', keyRecord.id);
  }

  // 5. 构建context
  const settings = project.settings as {
    rateLimit?: { requestsPerMinute?: number; requestsPerDay?: number };
  };

  return {
    success: true,
    context: {
      projectId: project.id,
      teamId: project.team_id,
      clientId: project.client_id,
      apiKeyId,
      keyType,
      permissions,
      rateLimit: {
        requestsPerMinute: settings.rateLimit?.requestsPerMinute || 100,
        requestsPerDay: settings.rateLimit?.requestsPerDay || 10000,
      },
    },
  };
}

/**
 * 检查权限
 */
export function hasPermission(context: ProjectContext, requiredPermission: string): boolean {
  if (context.permissions.includes('*')) return true;
  return context.permissions.includes(requiredPermission);
}

/**
 * 记录API使用
 */
export async function logApiUsage(
  context: ProjectContext,
  req: NextRequest,
  statusCode: number,
  responseTimeMs: number
) {
  const url = new URL(req.url);

  await db().from('api_usage').insert({
    project_id: context.projectId,
    api_key_id: context.apiKeyId,
    endpoint: url.pathname,
    method: req.method,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    user_agent: req.headers.get('user-agent'),
    origin: req.headers.get('origin'),
  });
}

/**
 * Project Auth Middleware Wrapper
 */
export function withProjectAuth(
  handler: (req: NextRequest, context: ProjectContext) => Promise<NextResponse>,
  options: { requireSecret?: boolean; requiredPermission?: string } = {}
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();

    const auth = await authenticateProject(req);

    if (!auth.success || !auth.context) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error,
        },
        { status: 401 }
      );
    }

    // 检查是否需要secret key
    if (options.requireSecret && auth.context.keyType !== 'secret') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_SECRET_KEY_REQUIRED',
            message: 'This endpoint requires a secret key',
          },
        },
        { status: 403 }
      );
    }

    // 检查权限
    if (options.requiredPermission && !hasPermission(auth.context, options.requiredPermission)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_PERMISSION_DENIED',
            message: `Missing permission: ${options.requiredPermission}`,
          },
        },
        { status: 403 }
      );
    }

    // 执行handler
    const response = await handler(req, auth.context);

    // 记录使用量
    const responseTimeMs = Date.now() - startTime;
    await logApiUsage(auth.context, req, response.status, responseTimeMs);

    return response;
  };
}
