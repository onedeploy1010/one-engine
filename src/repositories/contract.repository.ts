/**
 * Contract Registry Repository
 * Database abstraction for smart contract registry
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractRegistry, ContractType } from '@/types';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'ContractRepository' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface CreateContractInput {
  projectId: string;
  address: string;
  chainId: number;
  name: string;
  contractType: ContractType;
  abi: any[];
  bytecode?: string;
  verified?: boolean;
  deployTxHash?: string;
  deployerAddress?: string;
  constructorArgs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class ContractRepository {
  private supabase = getSupabaseAdmin();

  /**
   * Register a new contract
   */
  async create(input: CreateContractInput): Promise<ContractRegistry> {
    const insertData = {
      project_id: input.projectId,
      address: input.address,
      chain_id: input.chainId,
      name: input.name,
      contract_type: input.contractType,
      abi: input.abi,
      bytecode: input.bytecode,
      verified: input.verified || false,
      deploy_tx_hash: input.deployTxHash,
      deployer_address: input.deployerAddress,
      constructor_args: input.constructorArgs || {},
      metadata: input.metadata || {},
    };

    const { data, error } = await db()
      .from('contracts_registry')
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      log.error('Failed to register contract', error);
      throw new Error(`Failed to register contract: ${error.message}`);
    }

    return this.mapToContract(data);
  }

  /**
   * Find contract by ID
   */
  async findById(id: string): Promise<ContractRegistry | null> {
    const { data, error } = await db()
      .from('contracts_registry')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find contract: ${error.message}`);
    }

    return data ? this.mapToContract(data) : null;
  }

  /**
   * Find contract by address and chain
   */
  async findByAddress(address: string, chainId: number): Promise<ContractRegistry | null> {
    const { data, error } = await db()
      .from('contracts_registry')
      .select('*')
      .eq('address', address.toLowerCase())
      .eq('chain_id', chainId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find contract: ${error.message}`);
    }

    return data ? this.mapToContract(data) : null;
  }

  /**
   * Find contracts by project
   */
  async findByProject(projectId: string, filters?: {
    chainId?: number;
    contractType?: ContractType;
  }): Promise<ContractRegistry[]> {
    let query = db()
      .from('contracts_registry')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (filters?.chainId) {
      query = query.eq('chain_id', filters.chainId);
    }
    if (filters?.contractType) {
      query = query.eq('contract_type', filters.contractType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find contracts: ${error.message}`);
    }

    return data.map(row => this.mapToContract(row));
  }

  /**
   * Update contract
   */
  async update(id: string, updates: Partial<CreateContractInput>): Promise<ContractRegistry> {
    const updateData: Record<string, unknown> = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.abi) updateData.abi = updates.abi;
    if (updates.verified !== undefined) updateData.verified = updates.verified;
    if (updates.metadata) updateData.metadata = updates.metadata;

    const { data, error } = await db()
      .from('contracts_registry')
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contract: ${error.message}`);
    }

    return this.mapToContract(data);
  }

  /**
   * Delete contract
   */
  async delete(id: string): Promise<void> {
    const { error } = await db()
      .from('contracts_registry')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete contract: ${error.message}`);
    }
  }

  /**
   * Map database row to ContractRegistry type
   */
  private mapToContract(row: any): ContractRegistry {
    return {
      id: row.id,
      projectId: row.project_id,
      address: row.address,
      chainId: row.chain_id,
      name: row.name,
      type: row.contract_type as ContractType,
      abi: row.abi,
      verified: row.verified,
      deployTxHash: row.deploy_tx_hash,
      createdAt: row.created_at,
    };
  }
}

export const contractRepository = new ContractRepository();
