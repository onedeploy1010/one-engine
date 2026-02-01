/**
 * Network Configuration API
 * GET /api/v1/config/network - Get current network mode and supported chains
 * POST /api/v1/config/network - Set network mode (per-session, not persistent)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import {
  getCircleNetworkMode,
  setCircleNetworkMode,
  isCircleConfigured,
  getSupportedChainIds,
  CIRCLE_TESTNET_CHAINS,
  CIRCLE_MAINNET_CHAINS,
  NetworkMode,
} from '@/lib/circle';
import { env } from '@/config/env';

export async function GET(request: NextRequest) {
  try {
    const currentMode = getCircleNetworkMode();

    return NextResponse.json({
      success: true,
      data: {
        currentNetwork: currentMode,
        defaultNetwork: env.CIRCLE_NETWORK_MODE || 'testnet',
        circleEnabled: env.ENABLE_CIRCLE_WALLETS,
        testnet: {
          configured: isCircleConfigured('testnet'),
          supportedChains: Object.entries(CIRCLE_TESTNET_CHAINS).map(([chainId, blockchain]) => ({
            chainId: Number(chainId),
            blockchain,
          })),
        },
        mainnet: {
          configured: isCircleConfigured('mainnet'),
          supportedChains: Object.entries(CIRCLE_MAINNET_CHAINS).map(([chainId, blockchain]) => ({
            chainId: Number(chainId),
            blockchain,
          })),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK_CONFIG_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth required for changing network mode
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { network } = body as { network: NetworkMode };

    if (!network || !['testnet', 'mainnet'].includes(network)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NETWORK', message: 'Network must be "testnet" or "mainnet"' } },
        { status: 400 }
      );
    }

    // Check if the network is configured
    if (!isCircleConfigured(network)) {
      return NextResponse.json(
        { success: false, error: { code: 'NETWORK_NOT_CONFIGURED', message: `Circle ${network} credentials not configured` } },
        { status: 400 }
      );
    }

    // Set network mode (this is per-process, not persistent)
    setCircleNetworkMode(network);

    return NextResponse.json({
      success: true,
      data: {
        network,
        message: `Network mode set to ${network}`,
        supportedChains: getSupportedChainIds(network),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK_SET_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
