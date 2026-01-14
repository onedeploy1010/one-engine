/**
 * Contract Service for ONE Engine
 * Deploy, read, write smart contracts via Thirdweb SDK
 */

import { createThirdwebClient } from 'thirdweb';
import { getContract, readContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { deployContract } from 'thirdweb/deploys';
import { env } from '@/config/env';
import { getChain } from '@/config/chains';
import { contractRepository } from '@/repositories/contract.repository';
import { LogService } from '@/lib/logger';
import type { ContractRegistry, ContractType, ContractCallRequest } from '@/types';

const log = new LogService({ service: 'ContractService' });

export interface DeployParams {
  projectId: string;
  chainId: number;
  contractType: ContractType;
  name: string;
  bytecode: string;
  abi: any[];
  constructorArgs?: unknown[];
  account: any; // Smart account
}

export interface ReadParams {
  contractAddress: string;
  chainId: number;
  method: string;
  args?: unknown[];
  abi?: any[];
}

export interface WriteParams {
  contractAddress: string;
  chainId: number;
  method: string;
  args?: unknown[];
  value?: bigint;
  abi?: any[];
  account: any; // Smart account
}

export class ContractService {
  private client;

  constructor() {
    this.client = createThirdwebClient({
      clientId: env.THIRDWEB_CLIENT_ID,
      secretKey: env.THIRDWEB_SECRET_KEY,
    });
  }

  /**
   * Deploy a new smart contract
   */
  async deploy(params: DeployParams): Promise<{
    contract: ContractRegistry;
    contractAddress: string;
  }> {
    const chain = getChain(params.chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${params.chainId}`);
    }

    log.info('Deploying contract', {
      projectId: params.projectId,
      chainId: params.chainId,
      name: params.name,
    });

    try {
      // Deploy via Thirdweb
      const contractAddress = await deployContract({
        client: this.client,
        chain,
        account: params.account,
        bytecode: params.bytecode as `0x${string}`,
        abi: params.abi,
        constructorParams: params.constructorArgs as any || [],
      });

      // Register in our database
      const contract = await contractRepository.create({
        projectId: params.projectId,
        address: contractAddress,
        chainId: params.chainId,
        name: params.name,
        contractType: params.contractType,
        abi: params.abi,
        bytecode: params.bytecode,
        deployerAddress: params.account.address,
        constructorArgs: { args: params.constructorArgs },
      });

      log.info('Contract deployed', {
        contractId: contract.id,
        address: contractAddress,
      });

      return {
        contract,
        contractAddress,
      };
    } catch (error) {
      log.error('Contract deployment failed', error as Error);
      throw new Error(`Deployment failed: ${(error as Error).message}`);
    }
  }

  /**
   * Read from a contract (view/pure functions)
   */
  async read<T = unknown>(params: ReadParams): Promise<T> {
    const chain = getChain(params.chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${params.chainId}`);
    }

    // Try to get ABI from registry if not provided
    let abi = params.abi;
    if (!abi) {
      const registered = await contractRepository.findByAddress(params.contractAddress, params.chainId);
      if (registered) {
        abi = registered.abi;
      }
    }

    const contract = getContract({
      client: this.client,
      chain,
      address: params.contractAddress,
      abi,
    });

    try {
      const result = await readContract({
        contract,
        method: params.method,
        params: params.args || [],
      });

      return result as T;
    } catch (error) {
      log.error('Contract read failed', error as Error, {
        address: params.contractAddress,
        method: params.method,
      });
      throw new Error(`Read failed: ${(error as Error).message}`);
    }
  }

  /**
   * Write to a contract (state-changing functions)
   */
  async write(params: WriteParams): Promise<{
    transactionHash: string;
    blockNumber?: number;
  }> {
    const chain = getChain(params.chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${params.chainId}`);
    }

    // Try to get ABI from registry if not provided
    let abi = params.abi;
    if (!abi) {
      const registered = await contractRepository.findByAddress(params.contractAddress, params.chainId);
      if (registered) {
        abi = registered.abi;
      }
    }

    const contract = getContract({
      client: this.client,
      chain,
      address: params.contractAddress,
      abi,
    });

    try {
      // Prepare the transaction
      const transaction = prepareContractCall({
        contract,
        method: params.method,
        params: params.args || [],
        value: params.value,
      });

      // Send the transaction
      const result = await sendTransaction({
        account: params.account,
        transaction,
      });

      log.info('Contract write executed', {
        address: params.contractAddress,
        method: params.method,
        txHash: result.transactionHash,
      });

      return {
        transactionHash: result.transactionHash,
      };
    } catch (error) {
      log.error('Contract write failed', error as Error, {
        address: params.contractAddress,
        method: params.method,
      });
      throw new Error(`Write failed: ${(error as Error).message}`);
    }
  }

  /**
   * Register an existing contract
   */
  async register(
    projectId: string,
    address: string,
    chainId: number,
    name: string,
    contractType: ContractType,
    abi: any[]
  ): Promise<ContractRegistry> {
    // Check if already registered
    const existing = await contractRepository.findByAddress(address, chainId);
    if (existing) {
      throw new Error('Contract already registered');
    }

    return contractRepository.create({
      projectId,
      address: address.toLowerCase(),
      chainId,
      name,
      contractType,
      abi,
    });
  }

  /**
   * Get contract from registry
   */
  async getContract(id: string): Promise<ContractRegistry | null> {
    return contractRepository.findById(id);
  }

  /**
   * Get contract by address
   */
  async getContractByAddress(address: string, chainId: number): Promise<ContractRegistry | null> {
    return contractRepository.findByAddress(address, chainId);
  }

  /**
   * Get project contracts
   */
  async getProjectContracts(
    projectId: string,
    filters?: { chainId?: number; contractType?: ContractType }
  ): Promise<ContractRegistry[]> {
    return contractRepository.findByProject(projectId, filters);
  }

  /**
   * Update contract metadata
   */
  async updateContract(id: string, updates: { name?: string; abi?: any[] }): Promise<ContractRegistry> {
    return contractRepository.update(id, updates);
  }

  /**
   * Remove contract from registry
   */
  async removeContract(id: string): Promise<void> {
    return contractRepository.delete(id);
  }

  /**
   * Verify contract on block explorer (placeholder)
   */
  async verifyContract(id: string): Promise<ContractRegistry> {
    // In production, integrate with Etherscan/Basescan API
    return contractRepository.update(id, { verified: true });
  }
}

export const contractService = new ContractService();
