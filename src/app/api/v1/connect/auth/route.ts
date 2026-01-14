/**
 * Connect Auth API
 * 用户认证入口 - 创建In-App Wallet用户
 *
 * 使用示例:
 * POST /api/v1/connect/auth
 * Headers:
 *   x-client-id: one_pk_xxxxx
 * Body:
 *   { "method": "email", "email": "user@example.com" }
 *   { "method": "phone", "phone": "+1234567890" }
 *   { "method": "wallet", "wallet_address": "0x...", "signature": "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withProjectAuth, ProjectContext } from '@/middleware/projectAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getThirdwebClient } from '@/lib/thirdweb'; // 内部使用thirdweb

// Helper to bypass strict type checking for new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

interface AuthRequest {
  method: 'email' | 'phone' | 'wallet' | 'social';
  email?: string;
  phone?: string;
  wallet_address?: string;
  signature?: string;
  social_provider?: string;
  social_token?: string;
}

async function handler(req: NextRequest, ctx: ProjectContext) {
  const body: AuthRequest = await req.json();

  // 验证请求
  if (!body.method) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Missing auth method' },
      },
      { status: 400 }
    );
  }

  let identifier: string;
  let thirdwebResult: { userId: string; walletAddress: string } | null = null;

  try {
    // 根据认证方式处理
    switch (body.method) {
      case 'email':
        if (!body.email) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_REQUEST', message: 'Email required' } },
            { status: 400 }
          );
        }
        identifier = body.email;

        // 内部调用thirdweb创建/获取用户 (对外隐藏)
        thirdwebResult = await createThirdwebUser(body.method, body.email);
        break;

      case 'phone':
        if (!body.phone) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_REQUEST', message: 'Phone required' } },
            { status: 400 }
          );
        }
        identifier = body.phone;
        thirdwebResult = await createThirdwebUser(body.method, body.phone);
        break;

      case 'wallet':
        if (!body.wallet_address || !body.signature) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_REQUEST', message: 'Wallet address and signature required' } },
            { status: 400 }
          );
        }
        identifier = body.wallet_address;
        // 验证签名
        // thirdwebResult = await verifyWalletSignature(body.wallet_address, body.signature);
        break;

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_METHOD', message: 'Unsupported auth method' } },
          { status: 400 }
        );
    }

    // 在project_users中创建或获取用户 (按project隔离)
    const { data: existingUser } = await db()
      .from('project_users')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq(body.method === 'email' ? 'email' : body.method === 'phone' ? 'phone' : 'wallet_address', identifier)
      .single();

    let user;

    if (existingUser) {
      // 更新用户
      const { data: updatedUser, error } = await db()
        .from('project_users')
        .update({
          last_active_at: new Date().toISOString(),
          wallet_address: thirdwebResult?.walletAddress || existingUser.wallet_address,
          thirdweb_user_id: thirdwebResult?.userId || existingUser.thirdweb_user_id,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error) throw error;
      user = updatedUser;
    } else {
      // 创建新用户
      const { data: newUser, error } = await db()
        .from('project_users')
        .insert({
          project_id: ctx.projectId, // 核心：绑定到项目
          email: body.method === 'email' ? body.email : null,
          phone: body.method === 'phone' ? body.phone : null,
          wallet_address: thirdwebResult?.walletAddress || body.wallet_address,
          auth_method: body.method,
          thirdweb_user_id: thirdwebResult?.userId,
          status: 'active',
          last_active_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      user = newUser;
    }

    // 返回用户信息 (不暴露thirdweb内部ID)
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          wallet_address: user.wallet_address,
          auth_method: user.auth_method,
          created_at: user.created_at,
        },
        // 如果是OTP登录，返回需要验证
        requires_verification: body.method === 'email' || body.method === 'phone',
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Authentication failed' },
      },
      { status: 500 }
    );
  }
}

/**
 * 内部函数：调用thirdweb创建用户 (对外隐藏)
 */
async function createThirdwebUser(
  method: string,
  identifier: string
): Promise<{ userId: string; walletAddress: string }> {
  // 这里调用thirdweb SDK创建In-App Wallet用户
  // 使用ONE自己的thirdweb client id

  // 示例：thirdweb Connect API
  // const result = await thirdwebClient.connect.createUser({
  //   strategy: method,
  //   identifier,
  // });

  // 返回thirdweb的内部ID和钱包地址
  // 这些ID对外不暴露，只用于内部追踪

  // Mock response for now
  return {
    userId: `tw_${Date.now()}`,
    walletAddress: `0x${Buffer.from(identifier).toString('hex').slice(0, 40)}`,
  };
}

export const POST = withProjectAuth(handler);
