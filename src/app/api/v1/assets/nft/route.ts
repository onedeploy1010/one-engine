/**
 * NFT Assets Endpoint
 * GET /api/v1/assets/nft - Get user's NFT assets
 */

import { NextRequest } from 'next/server';
import { createThirdwebClient, getContract } from 'thirdweb';
import { getOwnedNFTs } from 'thirdweb/extensions/erc721';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { walletService } from '@/services/wallet/wallet.service';
import { getChain } from '@/config/chains';
import { env } from '@/config/env';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'NFTAssets' });

// Supported chains for NFT fetching
const NFT_SUPPORTED_CHAINS = [1, 8453, 42161, 137, 10];

interface NFTAsset {
  contractAddress: string;
  tokenId: string;
  name: string;
  description?: string;
  image?: string;
  chainId: number;
  tokenType: 'ERC721' | 'ERC1155';
  attributes?: Array<{ trait_type: string; value: string }>;
  collection?: {
    name: string;
    symbol: string;
  };
}

/**
 * Get user's NFT assets across chains
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const chainIdParam = searchParams.get('chainId');
    const walletAddress = searchParams.get('address');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get wallet address
    let address = walletAddress;
    if (!address) {
      const wallet = await walletService.getDefaultWallet(auth.userId);
      if (wallet) {
        address = wallet.smartAccountAddress || wallet.address;
      }
    }

    if (!address) {
      return errors.badRequest('No wallet address provided or found');
    }

    // Determine which chains to query
    const chainsToQuery = chainIdParam
      ? [parseInt(chainIdParam)]
      : NFT_SUPPORTED_CHAINS;

    const client = createThirdwebClient({
      clientId: env.THIRDWEB_CLIENT_ID,
      secretKey: env.THIRDWEB_SECRET_KEY,
    });

    const allNFTs: NFTAsset[] = [];
    const chainResults: Record<number, { count: number; error?: string }> = {};

    // Fetch NFTs from each chain
    for (const chainId of chainsToQuery) {
      try {
        const chain = getChain(chainId);
        if (!chain) {
          chainResults[chainId] = { count: 0, error: 'Unsupported chain' };
          continue;
        }

        // Use Thirdweb's NFT fetching or external APIs
        // Note: For production, consider using Alchemy, Moralis, or similar NFT APIs
        const nfts = await fetchNFTsForChain(client, address, chainId);

        allNFTs.push(...nfts);
        chainResults[chainId] = { count: nfts.length };

      } catch (error) {
        log.warn(`Failed to fetch NFTs for chain ${chainId}`, { error: (error as Error).message });
        chainResults[chainId] = { count: 0, error: (error as Error).message };
      }
    }

    // Apply pagination
    const paginatedNFTs = allNFTs.slice(offset, offset + limit);

    return success({
      nfts: paginatedNFTs,
      pagination: {
        total: allNFTs.length,
        limit,
        offset,
        hasMore: offset + limit < allNFTs.length,
      },
      chainResults,
      address,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    log.error('Failed to fetch NFTs', error as Error);
    return errors.internal('Failed to fetch NFT assets');
  }
}

/**
 * Fetch NFTs for a specific chain
 * In production, integrate with Alchemy, Moralis, or similar NFT APIs
 */
async function fetchNFTsForChain(
  client: any,
  owner: string,
  chainId: number
): Promise<NFTAsset[]> {
  // This is a simplified implementation
  // For production, use proper NFT indexing APIs

  // Known NFT contracts to check (example)
  const knownContracts: Record<number, string[]> = {
    1: [
      '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', // BAYC
      '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB', // CryptoPunks
    ],
    8453: [
      '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', // Base example
    ],
    137: [
      '0x2953399124F0cBB46d2CbACD8A89cF0599974963', // OpenSea Polygon
    ],
  };

  const nfts: NFTAsset[] = [];
  const chain = getChain(chainId);

  if (!chain) return nfts;

  const contracts = knownContracts[chainId] || [];

  for (const contractAddress of contracts) {
    try {
      const contract = getContract({
        client,
        chain,
        address: contractAddress,
      });

      // Try to get NFTs owned by address
      // This is simplified - use proper APIs in production
      const owned = await getOwnedNFTs({
        contract,
        owner,
      });

      for (const nft of owned) {
        nfts.push({
          contractAddress,
          tokenId: nft.id.toString(),
          name: nft.metadata?.name || `NFT #${nft.id}`,
          description: nft.metadata?.description,
          image: nft.metadata?.image,
          chainId,
          tokenType: 'ERC721',
          attributes: nft.metadata?.attributes as any,
          collection: {
            name: 'Unknown Collection',
            symbol: 'NFT',
          },
        });
      }
    } catch {
      // Continue to next contract
    }
  }

  return nfts;
}
