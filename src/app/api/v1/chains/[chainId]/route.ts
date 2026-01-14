/**
 * Chain Detail API
 * Get details for a specific chain
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getChainConfig,
  checkChainHealth,
  getChainRPCs,
  getExplorerUrl,
  getTxExplorerUrl,
  getAddressExplorerUrl,
  getChainFaucets,
} from '@/config/chains';

interface RouteParams {
  params: Promise<{
    chainId: string;
  }>;
}

/**
 * GET /api/v1/chains/[chainId]
 * Get details for a specific chain
 *
 * Query params:
 * - health: true - include health check (adds latency)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { chainId: chainIdParam } = await params;
    const chainId = parseInt(chainIdParam);
    const { searchParams } = new URL(request.url);
    const includeHealth = searchParams.get('health') === 'true';

    if (isNaN(chainId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CHAIN_ID',
            message: 'Chain ID must be a number',
          },
        },
        { status: 400 }
      );
    }

    const chain = getChainConfig(chainId);

    if (!chain) {
      // Return basic info for unknown chains (Thirdweb may still support them)
      return NextResponse.json({
        success: true,
        data: {
          id: chainId,
          name: `Chain ${chainId}`,
          known: false,
          rpc: [`https://${chainId}.rpc.thirdweb.com`],
          message: 'Chain not in registry, but may be supported via Thirdweb',
        },
      });
    }

    // Build response
    const response: Record<string, any> = {
      id: chain.id,
      name: chain.name,
      shortName: chain.shortName,
      slug: chain.slug,
      nativeCurrency: chain.nativeCurrency,
      rpc: getChainRPCs(chainId),
      blockExplorers: chain.blockExplorers,
      testnet: chain.testnet,
      features: chain.features,
      infoUrl: chain.infoUrl,
      parent: chain.parent,
      popularTokens: chain.popularTokens,
      known: true,
    };

    // Add faucets for testnets
    if (chain.testnet) {
      response.faucets = getChainFaucets(chainId);
    }

    // Add explorer URL helpers
    response.explorerUrl = getExplorerUrl(chainId);

    // Include health check if requested
    if (includeHealth) {
      const health = await checkChainHealth(chainId);
      response.health = {
        isHealthy: health.isHealthy,
        latency: health.latency,
        blockNumber: health.blockNumber,
        lastChecked: health.lastChecked.toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Failed to get chain details:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get chain details',
        },
      },
      { status: 500 }
    );
  }
}
