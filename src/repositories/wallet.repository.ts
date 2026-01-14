/**
 * Wallet Repository
 * Database abstraction layer for wallet operations
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import type { Wallet, WalletType } from '@/types';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'WalletRepository' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface CreateWalletInput {
  userId: string;
  projectId?: string;
  address: string;
  smartAccountAddress: string;
  walletType?: WalletType;
  chainId?: number;
  isDefault?: boolean;
  encryptedKey?: string;
  metadata?: Record<string, unknown>;
}

export class WalletRepository {
  private supabase = getSupabaseAdmin();

  /**
   * Create a new wallet
   */
  async create(input: CreateWalletInput): Promise<Wallet> {
    // If this is default wallet, unset other defaults
    if (input.isDefault) {
      await db()
        .from('wallets')
        .update({ is_default: false } as any)
        .eq('user_id', input.userId)
        .eq('chain_id', input.chainId || 8453);
    }

    const insertData = {
      user_id: input.userId,
      project_id: input.projectId,
      address: input.address,
      smart_account_address: input.smartAccountAddress,
      wallet_type: input.walletType || 'smart',
      chain_id: input.chainId || 8453,
      is_default: input.isDefault ?? true,
      encrypted_key: input.encryptedKey,
      metadata: input.metadata || {},
    };

    const { data, error } = await db()
      .from('wallets')
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      log.error('Failed to create wallet', error, { userId: input.userId });
      throw new Error(`Failed to create wallet: ${error.message}`);
    }

    return this.mapToWallet(data);
  }

  /**
   * Find wallet by ID
   */
  async findById(id: string): Promise<Wallet | null> {
    const { data, error } = await db()
      .from('wallets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find wallet: ${error.message}`);
    }

    return data ? this.mapToWallet(data) : null;
  }

  /**
   * Find user's wallets
   */
  async findByUserId(userId: string, chainId?: number): Promise<Wallet[]> {
    let query = db()
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (chainId) {
      query = query.eq('chain_id', chainId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find wallets: ${error.message}`);
    }

    return data.map((row) => this.mapToWallet(row));
  }

  /**
   * Find wallet by address
   */
  async findByAddress(address: string, chainId?: number): Promise<Wallet | null> {
    let query = db()
      .from('wallets')
      .select('*')
      .or(`address.eq.${address},smart_account_address.eq.${address}`);

    if (chainId) {
      query = query.eq('chain_id', chainId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find wallet: ${error.message}`);
    }

    return data ? this.mapToWallet(data) : null;
  }

  /**
   * Get user's default wallet for a chain
   */
  async getDefaultWallet(userId: string, chainId = 8453): Promise<Wallet | null> {
    const { data, error } = await db()
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('chain_id', chainId)
      .eq('is_default', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get default wallet: ${error.message}`);
    }

    return data ? this.mapToWallet(data) : null;
  }

  /**
   * Set default wallet
   */
  async setDefault(id: string, userId: string, chainId: number): Promise<void> {
    // Unset current default
    await db()
      .from('wallets')
      .update({ is_default: false } as any)
      .eq('user_id', userId)
      .eq('chain_id', chainId);

    // Set new default
    const { error } = await db()
      .from('wallets')
      .update({ is_default: true } as any)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to set default wallet: ${error.message}`);
    }
  }

  /**
   * Delete wallet
   */
  async delete(id: string): Promise<void> {
    const { error } = await db()
      .from('wallets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete wallet: ${error.message}`);
    }
  }

  /**
   * Map database row to Wallet type
   */
  private mapToWallet(row: any): Wallet {
    return {
      id: row.id,
      userId: row.user_id,
      address: row.address,
      smartAccountAddress: row.smart_account_address,
      type: row.wallet_type as WalletType,
      chainId: row.chain_id,
      isDefault: row.is_default,
      createdAt: row.created_at,
    };
  }
}

export const walletRepository = new WalletRepository();
