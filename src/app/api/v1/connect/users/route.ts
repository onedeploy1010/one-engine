/**
 * Connect Users API
 * 获取项目的用户列表 (In-App Wallets用户)
 *
 * 使用示例:
 * GET /api/v1/connect/users
 * Headers:
 *   x-client-id: one_pk_xxxxx
 *   x-secret-key: one_sk_xxxxx (可选，但需要secret才能看到完整数据)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withProjectAuth, ProjectContext } from '@/middleware/projectAuth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Helper to bypass strict type checking for new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

async function handler(req: NextRequest, ctx: ProjectContext) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const authMethod = url.searchParams.get('auth_method');

  // 构建查询 - 数据自动按project_id隔离
  let query = db()
    .from('project_users')
    .select('*', { count: 'exact' })
    .eq('project_id', ctx.projectId) // 核心：数据隔离
    .order('created_at', { ascending: false });

  if (authMethod) {
    query = query.eq('auth_method', authMethod);
  }

  const { data: users, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to fetch users' },
      },
      { status: 500 }
    );
  }

  // 根据key类型返回不同级别的数据
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sanitizedUsers = users?.map((user: any) => {
    const base = {
      id: user.id,
      wallet_address: user.wallet_address,
      auth_method: user.auth_method,
      status: user.status,
      last_active_at: user.last_active_at,
      created_at: user.created_at,
    };

    // Secret key可以看到更多数据
    if (ctx.keyType === 'secret') {
      return {
        ...base,
        email: user.email,
        phone: user.phone,
        smart_account_address: user.smart_account_address,
        external_id: user.external_id,
        metadata: user.metadata,
      };
    }

    return base;
  });

  // 统计数据
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count: activeCount } = await db()
    .from('project_users')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', ctx.projectId)
    .gte('last_active_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const { count: newTodayCount } = await db()
    .from('project_users')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', ctx.projectId)
    .gte('created_at', today.toISOString());

  return NextResponse.json({
    success: true,
    data: sanitizedUsers,
    stats: {
      total: count || 0,
      active: activeCount || 0,
      newToday: newTodayCount || 0,
    },
    pagination: {
      total: count || 0,
      limit,
      offset,
    },
  });
}

// 导出时包装认证中间件
export const GET = withProjectAuth(handler);
