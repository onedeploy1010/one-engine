/**
 * Provider Status API
 * 获取所有第三方服务提供商的状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthContext } from '@/middleware/auth';
import { ProviderHub, getProviderSummary } from '@/lib/providers';

// GET /api/v1/providers/status - 获取所有 Provider 状态
export const GET = withAuth(async (
  req: NextRequest,
  context: AuthContext
) => {
  try {
    // Only admins can see detailed provider status
    if (context.role !== 'admin' && context.role !== 'superadmin') {
      // Return simplified status for regular users
      const summary = getProviderSummary();
      const simplified: Record<string, {
        name: string;
        status: string;
        available: boolean;
      }> = {};

      for (const [id, provider] of Object.entries(summary)) {
        simplified[id] = {
          name: provider.name,
          status: provider.status,
          available: provider.enabled && provider.status !== 'unhealthy',
        };
      }

      return NextResponse.json({
        success: true,
        data: simplified,
      });
    }

    // Full status for admins
    const fullStatus = ProviderHub.getAllStatus();

    return NextResponse.json({
      success: true,
      data: fullStatus,
    });
  } catch (error) {
    console.error('Provider status fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'E5000', message: 'Failed to fetch provider status' } },
      { status: 500 }
    );
  }
});
