/**
 * Chains API
 * Provides chain information for the ONE ecosystem
 * Supports 200+ EVM chains
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllChains,
  getMainnetChains,
  getL2Chains,
  getTestnetChains,
  getGamingChains,
  getSmartWalletChains,
  getGasSponsorshipChains,
  searchChains,
  getChainStats,
  RECOMMENDED_CHAINS,
  RECOMMENDED_TESTNETS,
} from '@/config/chains';

/**
 * GET /api/v1/chains
 * Get list of supported chains
 *
 * Query params:
 * - category: mainnet | l2 | testnet | gaming | all (default: all)
 * - smartWallet: true | false - filter chains with smart wallet support
 * - gasSponsorship: true | false - filter chains with gas sponsorship
 * - search: string - search by name or symbol
 * - limit: number - limit results (default: 50, max: 200)
 * - offset: number - pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const smartWallet = searchParams.get('smartWallet');
    const gasSponsorship = searchParams.get('gasSponsorship');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    let chains;

    // Get chains by category
    switch (category) {
      case 'mainnet':
        chains = getMainnetChains();
        break;
      case 'l2':
        chains = getL2Chains();
        break;
      case 'testnet':
        chains = getTestnetChains();
        break;
      case 'gaming':
        chains = getGamingChains();
        break;
      case 'recommended':
        chains = getAllChains().filter(c => (RECOMMENDED_CHAINS as readonly number[]).includes(c.id));
        break;
      case 'recommended-testnet':
        chains = getAllChains().filter(c => (RECOMMENDED_TESTNETS as readonly number[]).includes(c.id));
        break;
      default:
        chains = getAllChains();
    }

    // Filter by smart wallet support
    if (smartWallet === 'true') {
      chains = chains.filter(c => c.features?.smartWallet === true);
    }

    // Filter by gas sponsorship support
    if (gasSponsorship === 'true') {
      chains = chains.filter(c => c.features?.gasSponsorship === true);
    }

    // Search
    if (search) {
      const searchResults = searchChains(search);
      const searchIds = new Set(searchResults.map(c => c.id));
      chains = chains.filter(c => searchIds.has(c.id));
    }

    // Get total before pagination
    const total = chains.length;

    // Paginate
    chains = chains.slice(offset, offset + limit);

    // Transform for response (remove internal fields)
    const response = chains.map(chain => ({
      id: chain.id,
      name: chain.name,
      shortName: chain.shortName,
      slug: chain.slug,
      nativeCurrency: chain.nativeCurrency,
      rpc: chain.rpc[0], // Primary RPC
      blockExplorer: chain.blockExplorers[0]?.url,
      testnet: chain.testnet,
      features: chain.features,
    }));

    // Get stats
    const stats = getChainStats();

    return NextResponse.json({
      success: true,
      data: {
        chains: response,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        stats,
      },
    });
  } catch (error) {
    console.error('Failed to get chains:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get chains',
        },
      },
      { status: 500 }
    );
  }
}
