/**
 * Thirdweb Configuration API
 * Provides centralized thirdweb clientId for all ONE ecosystem apps
 * Users don't need their own thirdweb clientId - Engine manages it
 *
 * ONE Client ID: 55c901cbfcccbc3592ae2157f8c7c3b5
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublicThirdwebConfig } from '@/lib/thirdweb';

export async function GET(request: NextRequest) {
  try {
    // Return the centralized thirdweb config managed by ONE Engine
    // All ecosystem projects use this - users don't need their own clientId
    const config = getPublicThirdwebConfig();

    if (!config.clientId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Thirdweb configuration not available',
        },
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Failed to get thirdweb config:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to load configuration',
      },
    }, { status: 500 });
  }
}
