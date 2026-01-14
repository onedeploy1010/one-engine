/**
 * Contract Deploy Endpoint
 * POST /api/v1/contracts/deploy - Deploy a new contract
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { contractService } from '@/services/contracts/contract.service';
import { walletService } from '@/services/wallet/wallet.service';
import { success, errors } from '@/lib/response';
import { requireAuth, getProjectId } from '@/middleware/auth';
import { validateBody, chainIdSchema, addressSchema } from '@/middleware/validation';

const deploySchema = z.object({
  chainId: chainIdSchema,
  contractType: z.string().min(1),
  name: z.string().min(1).max(255),
  symbol: z.string().max(20).optional(),
  constructorArgs: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Deploy a new contract using Thirdweb
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const projectId = getProjectId(req, auth);
    const body = await validateBody(req, deploySchema);

    if (!projectId) {
      return errors.badRequest('Project ID is required');
    }

    // Get user's smart account for deployment
    const defaultWallet = await walletService.getDefaultWallet(auth.userId, body.chainId);

    if (!defaultWallet) {
      // Create a wallet for the user if they don't have one
      const { wallet } = await walletService.createWallet({
        userId: auth.userId,
        projectId,
        chainId: body.chainId,
        type: 'smart',
      });

      // Note: In production, we'd need to wait for wallet to be ready
      // and properly fund it for gas
    }

    // For Thirdweb pre-built contracts, we use their deploy methods
    // The contractType format is "thirdweb:ContractName"
    const isThirdwebContract = body.contractType.startsWith('thirdweb:');

    if (isThirdwebContract) {
      const thirdwebType = body.contractType.replace('thirdweb:', '');

      // Deploy using Thirdweb's pre-built contracts
      const result = await deployThirdwebContract({
        projectId,
        chainId: body.chainId,
        contractType: thirdwebType,
        name: body.name,
        symbol: body.symbol,
        constructorArgs: body.constructorArgs || [],
        userId: auth.userId,
      });

      return success({
        contractAddress: result.address,
        transactionHash: result.transactionHash,
        contract: result.contract,
      });
    }

    // For custom contracts with bytecode
    // This would require the bytecode and ABI to be provided
    return errors.badRequest('Custom contract deployment requires bytecode and ABI');

  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Contract deployment error:', error);
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to deploy contract');
  }
}

/**
 * Deploy a Thirdweb pre-built contract
 */
async function deployThirdwebContract(params: {
  projectId: string;
  chainId: number;
  contractType: string;
  name: string;
  symbol?: string;
  constructorArgs: any[];
  userId: string;
}): Promise<{
  address: string;
  transactionHash: string;
  contract: any;
}> {
  // Import Thirdweb deployment functions
  const { createThirdwebClient } = await import('thirdweb');
  const { deployPublishedContract } = await import('thirdweb/deploys');
  const { privateKeyToAccount, smartWallet } = await import('thirdweb/wallets');
  const { getChain } = await import('@/config/chains');
  const { env } = await import('@/config/env');
  const { contractRepository } = await import('@/repositories/contract.repository');
  const { walletRepository } = await import('@/repositories/wallet.repository');
  const crypto = await import('crypto');

  const client = createThirdwebClient({
    clientId: env.THIRDWEB_CLIENT_ID,
    secretKey: env.THIRDWEB_SECRET_KEY,
  });

  const chain = getChain(params.chainId);
  if (!chain) {
    throw new Error(`Unsupported chain: ${params.chainId}`);
  }

  // Get or create deployer wallet
  let wallet = await walletRepository.getDefaultWallet(params.userId, params.chainId);

  if (!wallet) {
    // Create a temporary deployer account
    const privateKey = `0x${crypto.randomBytes(32).toString('hex')}` as `0x${string}`;
    const personalAccount = privateKeyToAccount({
      client,
      privateKey,
    });

    const sw = smartWallet({
      chain,
      sponsorGas: true, // Use gas sponsorship
    });

    const account = await sw.connect({
      client,
      personalAccount,
    });

    // Save wallet for future use
    wallet = await walletRepository.create({
      userId: params.userId,
      projectId: params.projectId,
      address: personalAccount.address,
      smartAccountAddress: account.address,
      walletType: 'smart',
      chainId: params.chainId,
      isDefault: true,
      encryptedKey: Buffer.from(privateKey).toString('base64'),
    });
  }

  // Map contract type to Thirdweb publisher/contract name
  const contractMapping: Record<string, { publisher: string; contractName: string }> = {
    'TokenERC20': { publisher: 'thirdweb.eth', contractName: 'TokenERC20' },
    'TokenERC721': { publisher: 'thirdweb.eth', contractName: 'TokenERC721' },
    'TokenERC1155': { publisher: 'thirdweb.eth', contractName: 'TokenERC1155' },
    'DropERC721': { publisher: 'thirdweb.eth', contractName: 'DropERC721' },
    'Marketplace': { publisher: 'thirdweb.eth', contractName: 'Marketplace' },
    'VoteERC20': { publisher: 'thirdweb.eth', contractName: 'VoteERC20' },
    'Split': { publisher: 'thirdweb.eth', contractName: 'Split' },
    'Staking': { publisher: 'thirdweb.eth', contractName: 'Staking20Base' },
    'AirdropERC20': { publisher: 'thirdweb.eth', contractName: 'AirdropERC20' },
  };

  const mapping = contractMapping[params.contractType];
  if (!mapping) {
    throw new Error(`Unknown contract type: ${params.contractType}`);
  }

  // Reconstruct the smart account for deployment
  const encryptedKey = wallet.encryptedKey;
  if (!encryptedKey) {
    throw new Error('Wallet key not available for deployment');
  }

  const privateKey = Buffer.from(encryptedKey, 'base64').toString() as `0x${string}`;
  const personalAccount = privateKeyToAccount({
    client,
    privateKey,
  });

  const sw = smartWallet({
    chain,
    sponsorGas: true,
  });

  const account = await sw.connect({
    client,
    personalAccount,
  });

  // Deploy the contract
  // Convert array args to named params object if needed
  const contractParams = Array.isArray(params.constructorArgs)
    ? params.constructorArgs.reduce((acc, arg, idx) => ({ ...acc, [`arg${idx}`]: arg }), {} as Record<string, unknown>)
    : (params.constructorArgs as Record<string, unknown>) || {};

  const contractAddress = await deployPublishedContract({
    client,
    chain,
    account,
    contractId: mapping.contractName,
    contractParams,
    publisher: mapping.publisher,
  });

  // Register in database
  const contract = await contractRepository.create({
    projectId: params.projectId,
    address: contractAddress,
    chainId: params.chainId,
    name: params.name,
    contractType: params.contractType.toLowerCase() as any,
    abi: [], // ABI will be fetched from Thirdweb
    deployerAddress: account.address,
    constructorArgs: { args: params.constructorArgs },
  });

  return {
    address: contractAddress,
    transactionHash: '', // Thirdweb doesn't always return this immediately
    contract,
  };
}
