/**
 * Authentication Service for ONE Engine
 * Handles Supabase Auth + Thirdweb JWT integration
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { getThirdwebClient } from '@/lib/thirdweb';
import { generateToken } from '@/middleware/auth';
import { userRepository } from '@/repositories/user.repository';
import { LogService } from '@/lib/logger';
import { env } from '@/config/env';
import type { User, UserRole } from '@/types';

const log = new LogService({ service: 'AuthService' });

export interface SignUpInput {
  email: string;
  password?: string;
  referralCode?: string;
}

export interface SignInInput {
  email: string;
  password?: string;
  otp?: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface OtpResult {
  success: boolean;
  message: string;
}

export class AuthService {
  private supabase = getSupabaseAdmin();

  /**
   * Send OTP to email for authentication
   */
  async sendOtp(email: string): Promise<OtpResult> {
    log.info('Sending OTP', { email });

    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      log.error('Failed to send OTP', error, { email });
      throw new Error(`Failed to send OTP: ${error.message}`);
    }

    return {
      success: true,
      message: 'OTP sent successfully',
    };
  }

  /**
   * Verify OTP and authenticate user
   */
  async verifyOtp(email: string, otp: string): Promise<AuthResult> {
    log.info('Verifying OTP', { email });

    const { data: authData, error } = await this.supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    if (error || !authData.user) {
      log.error('OTP verification failed', error, { email });
      throw new Error('Invalid or expired OTP');
    }

    // Find or create user in our users table
    let user = await userRepository.findByEmail(email);

    if (!user) {
      user = await userRepository.create({
        email,
        authId: authData.user.id,
      });
      log.info('New user created via OTP', { userId: user.id, email });
    }

    // Generate ONE Engine JWT
    const accessToken = await generateToken({
      sub: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return {
      user,
      accessToken,
      refreshToken: authData.session?.refresh_token,
      expiresIn: 7 * 24 * 60 * 60, // 7 days
    };
  }

  /**
   * Sign up with email and password
   */
  async signUp(input: SignUpInput): Promise<AuthResult> {
    log.info('User signup', { email: input.email });

    if (!input.password) {
      throw new Error('Password is required for signup');
    }

    const { data: authData, error } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });

    if (error || !authData.user) {
      log.error('Signup failed', error, { email: input.email });
      throw new Error(`Signup failed: ${error?.message}`);
    }

    // Find referrer if code provided
    let referredBy: string | undefined;
    if (input.referralCode) {
      const referrer = await this.findUserByReferralCode(input.referralCode);
      referredBy = referrer?.id;
    }

    // Create user in our table
    const user = await userRepository.create({
      email: input.email,
      authId: authData.user.id,
      referredBy,
    });

    const accessToken = await generateToken({
      sub: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return {
      user,
      accessToken,
      refreshToken: authData.session?.refresh_token,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * Sign in with email and password
   */
  async signIn(input: SignInInput): Promise<AuthResult> {
    log.info('User signin', { email: input.email });

    if (!input.password) {
      throw new Error('Password is required for signin');
    }

    const { data: authData, error } = await this.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !authData.user) {
      log.error('Signin failed', error, { email: input.email });
      throw new Error('Invalid credentials');
    }

    let user = await userRepository.findByEmail(input.email);

    if (!user) {
      // Create user if they don't exist in our table (migration case)
      user = await userRepository.create({
        email: input.email,
        authId: authData.user.id,
      });
    }

    const accessToken = await generateToken({
      sub: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return {
      user,
      accessToken,
      refreshToken: authData.session?.refresh_token,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * Authenticate with Thirdweb wallet signature
   * Used when user connects wallet first (social auth, etc.)
   */
  async authenticateWithWallet(
    walletAddress: string,
    smartAccountAddress: string,
    email?: string
  ): Promise<AuthResult> {
    log.info('Wallet authentication', { walletAddress, smartAccountAddress });

    // Find user by wallet address
    let user = await userRepository.findByWalletAddress(smartAccountAddress);

    if (!user && email) {
      // Try to find by email
      user = await userRepository.findByEmail(email);

      if (user) {
        // Link wallet to existing user
        user = await userRepository.linkWallet(user.id, walletAddress, smartAccountAddress);
      }
    }

    if (!user) {
      // Create new user with wallet
      if (!email) {
        // Generate placeholder email for wallet-only users
        email = `${smartAccountAddress.toLowerCase()}@wallet.one.eco`;
      }

      user = await userRepository.create({
        email,
        walletAddress,
        smartAccountAddress,
      });
      log.info('New user created via wallet', { userId: user.id, walletAddress });
    }

    const accessToken = await generateToken({
      sub: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return {
      user,
      accessToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    const { data: authData, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !authData.user) {
      throw new Error('Failed to refresh token');
    }

    const user = await userRepository.findByAuthId(authData.user.id);

    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = await generateToken({
      sub: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return {
      user,
      accessToken,
      refreshToken: authData.session?.refresh_token,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * Get user from access token
   */
  async getUserFromToken(userId: string): Promise<User | null> {
    return userRepository.findById(userId);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: { email?: string }): Promise<User> {
    return userRepository.update(userId, updates);
  }

  /**
   * Find user by referral code
   */
  private async findUserByReferralCode(code: string): Promise<User | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('referral_code', code)
      .single();

    if (error || !data) {
      return null;
    }

    const userData = data as {
      id: string;
      email: string | null;
      wallet_address: string | null;
      smart_account_address: string | null;
      role: string;
      kyc_status: string;
      membership_tier: string;
      created_at: string;
      updated_at: string;
    };

    return {
      id: userData.id,
      email: userData.email || '',
      walletAddress: userData.wallet_address || '',
      smartAccountAddress: userData.smart_account_address,
      role: userData.role as UserRole,
      kycStatus: userData.kyc_status as any,
      membershipTier: userData.membership_tier as any,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    };
  }

  /**
   * Sign out user
   */
  async signOut(accessToken?: string): Promise<void> {
    if (accessToken) {
      await this.supabase.auth.signOut();
    }
    log.info('User signed out');
  }
}

export const authService = new AuthService();
