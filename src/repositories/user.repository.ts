/**
 * User Repository
 * Database abstraction layer for user operations
 */

import { getSupabaseAdmin, getSupabaseClientWithAuth } from '@/lib/supabase';
import type { User, UserRole, KycStatus, MembershipTier } from '@/types';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'UserRepository' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface CreateUserInput {
  email: string;
  authId?: string;
  walletAddress?: string;
  smartAccountAddress?: string;
  role?: UserRole;
  referralCode?: string;
  referredBy?: string;
}

export interface UpdateUserInput {
  email?: string;
  walletAddress?: string;
  smartAccountAddress?: string;
  role?: UserRole;
  kycStatus?: KycStatus;
  membershipTier?: MembershipTier;
  metadata?: Record<string, unknown>;
}

export class UserRepository {
  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<User> {
    const supabase = db();

    const insertData = {
      email: input.email,
      auth_id: input.authId,
      wallet_address: input.walletAddress,
      smart_account_address: input.smartAccountAddress,
      role: input.role || 'user',
      referral_code: this.generateReferralCode(),
      referred_by: input.referredBy,
    };

    const { data, error } = await supabase
      .from('users')
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      log.error('Failed to create user', error, { email: input.email });
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return this.mapToUser(data);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const supabase = db();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data ? this.mapToUser(data) : null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const supabase = db();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data ? this.mapToUser(data) : null;
  }

  /**
   * Find user by wallet address
   */
  async findByWalletAddress(address: string): Promise<User | null> {
    const supabase = db();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`wallet_address.eq.${address},smart_account_address.eq.${address}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data ? this.mapToUser(data) : null;
  }

  /**
   * Find user by Supabase auth ID
   */
  async findByAuthId(authId: string): Promise<User | null> {
    const supabase = db();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data ? this.mapToUser(data) : null;
  }

  /**
   * Update user
   */
  async update(id: string, input: UpdateUserInput): Promise<User> {
    const supabase = db();

    const updateData: Record<string, unknown> = {};
    if (input.email) updateData.email = input.email;
    if (input.walletAddress) updateData.wallet_address = input.walletAddress;
    if (input.smartAccountAddress) updateData.smart_account_address = input.smartAccountAddress;
    if (input.role) updateData.role = input.role;
    if (input.kycStatus) updateData.kyc_status = input.kycStatus;
    if (input.membershipTier) updateData.membership_tier = input.membershipTier;
    if (input.metadata) updateData.metadata = input.metadata;

    const { data, error } = await supabase
      .from('users')
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Failed to update user', error, { id });
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return this.mapToUser(data);
  }

  /**
   * Link wallet address to user
   */
  async linkWallet(id: string, walletAddress: string, smartAccountAddress: string): Promise<User> {
    return this.update(id, { walletAddress, smartAccountAddress });
  }

  /**
   * Update KYC status
   */
  async updateKycStatus(id: string, status: KycStatus): Promise<User> {
    return this.update(id, { kycStatus: status });
  }

  /**
   * Update membership tier
   */
  async updateMembershipTier(id: string, tier: MembershipTier): Promise<User> {
    return this.update(id, { membershipTier: tier });
  }

  /**
   * Find users by referral code
   */
  async findReferrals(userId: string): Promise<User[]> {
    const supabase = db();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('referred_by', userId);

    if (error) {
      throw new Error(`Failed to find referrals: ${error.message}`);
    }

    return data.map((row) => this.mapToUser(row));
  }

  /**
   * Generate unique referral code
   */
  private generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ONE';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Map database row to User type
   */
  private mapToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      walletAddress: row.wallet_address || '',
      smartAccountAddress: row.smart_account_address,
      role: row.role as UserRole,
      kycStatus: row.kyc_status as KycStatus,
      membershipTier: row.membership_tier as MembershipTier,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const userRepository = new UserRepository();
