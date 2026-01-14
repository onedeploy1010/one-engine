/**
 * Ecosystem Sync Service
 * Manages synchronization between One-Engine and sub-ecosystem apps
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'EcosystemService' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => db();

export interface EcosystemApp {
  id: string;
  name: string;
  slug: string;
  description?: string;
  supabaseUrl?: string;
  supabaseProjectId?: string;
  apiEndpoint?: string;
  isActive: boolean;
  syncConfig: SyncConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SyncConfig {
  syncUsers: boolean;
  syncWallets: boolean;
  syncTransactions: boolean;
  syncIntervalSeconds: number;
}

export interface UserAppMapping {
  id: string;
  userId: string;
  appId: string;
  externalUserId: string;
  appSpecificData: Record<string, unknown>;
  syncedAt: string;
  createdAt: string;
}

export interface WalletUserData {
  id: string;
  email: string;
  wallet_address?: string;
  thirdweb_user_id?: string;
  kyc_status?: string;
  kyc_level?: number;
  membership_tier?: string;
  agent_level?: number;
  referral_code?: string;
  referred_by?: string;
  total_referrals?: number;
  total_team_volume?: number;
  wallet_status?: string;
  wallet_type?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  last_login_at?: string;
}

export interface SyncResult {
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export class EcosystemService {
  /**
   * Get all registered ecosystem apps
   */
  async getApps(): Promise<EcosystemApp[]> {
    const { data, error } = await db()
      .from('ecosystem_apps')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      log.error('Failed to fetch ecosystem apps', error);
      throw new Error(`Failed to fetch apps: ${error.message}`);
    }

    return (data || []).map(this.mapAppFromDb);
  }

  /**
   * Get app by slug
   */
  async getAppBySlug(slug: string): Promise<EcosystemApp | null> {
    const { data, error } = await db()
      .from('ecosystem_apps')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch app: ${error.message}`);
    }

    return data ? this.mapAppFromDb(data) : null;
  }

  /**
   * Register a new ecosystem app
   */
  async registerApp(app: Partial<EcosystemApp>): Promise<EcosystemApp> {
    const { data, error } = await db()
      .from('ecosystem_apps')
      .insert({
        name: app.name,
        slug: app.slug,
        description: app.description,
        supabase_url: app.supabaseUrl,
        supabase_project_id: app.supabaseProjectId,
        api_endpoint: app.apiEndpoint,
        sync_config: app.syncConfig,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to register ecosystem app', error);
      throw new Error(`Failed to register app: ${error.message}`);
    }

    log.info('Registered new ecosystem app', { slug: app.slug });
    return this.mapAppFromDb(data);
  }

  /**
   * Sync users from an external app
   */
  async syncUsersFromApp(appSlug: string, users: WalletUserData[]): Promise<SyncResult> {
    log.info('Starting user sync', { appSlug, userCount: users.length });

    const { data, error } = await db().rpc('batch_import_users_from_wallet', {
      p_users: users,
    });

    if (error) {
      log.error('User sync failed', error);
      throw new Error(`Sync failed: ${error.message}`);
    }

    const result: SyncResult = {
      imported: data?.[0]?.imported_count || 0,
      updated: data?.[0]?.updated_count || 0,
      failed: data?.[0]?.failed_count || 0,
      errors: data?.[0]?.errors || [],
    };

    log.info('User sync completed', result as unknown as Record<string, unknown>);
    return result;
  }

  /**
   * Get user by external app ID
   */
  async getUserByAppId(appSlug: string, externalUserId: string) {
    const { data, error } = await db().rpc('get_user_by_app_id', {
      p_app_slug: appSlug,
      p_external_user_id: externalUserId,
    });

    if (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data?.[0] || null;
  }

  /**
   * Get user's external app mappings
   */
  async getUserAppMappings(userId: string): Promise<UserAppMapping[]> {
    const { data, error } = await db()
      .from('user_app_mappings')
      .select(`
        *,
        ecosystem_apps (name, slug)
      `)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get user mappings: ${error.message}`);
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      appId: m.app_id,
      externalUserId: m.external_user_id,
      appSpecificData: m.app_specific_data,
      syncedAt: m.synced_at,
      createdAt: m.created_at,
      appName: m.ecosystem_apps?.name,
      appSlug: m.ecosystem_apps?.slug,
    }));
  }

  /**
   * Create or update user app mapping
   */
  async upsertUserMapping(
    userId: string,
    appSlug: string,
    externalUserId: string,
    appSpecificData?: Record<string, unknown>
  ): Promise<void> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      throw new Error(`App not found: ${appSlug}`);
    }

    const { error } = await db()
      .from('user_app_mappings')
      .upsert(
        {
          user_id: userId,
          app_id: app.id,
          external_user_id: externalUserId,
          app_specific_data: appSpecificData || {},
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,app_id' }
      );

    if (error) {
      throw new Error(`Failed to update mapping: ${error.message}`);
    }
  }

  /**
   * Get sync logs for an app
   */
  async getSyncLogs(appSlug: string, limit = 10) {
    const app = await this.getAppBySlug(appSlug);
    if (!app) return [];

    const { data, error } = await db()
      .from('sync_logs')
      .select('*')
      .eq('app_id', app.id)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get sync logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Resolve referral relationships after migration
   */
  async resolveReferralRelationships(): Promise<void> {
    const { error } = await db().rpc('resolve_referral_relationships');

    if (error) {
      throw new Error(`Failed to resolve referrals: ${error.message}`);
    }

    log.info('Referral relationships resolved');
  }

  private mapAppFromDb(data: any): EcosystemApp {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      supabaseUrl: data.supabase_url,
      supabaseProjectId: data.supabase_project_id,
      apiEndpoint: data.api_endpoint,
      isActive: data.is_active,
      syncConfig: {
        syncUsers: data.sync_config?.sync_users ?? true,
        syncWallets: data.sync_config?.sync_wallets ?? true,
        syncTransactions: data.sync_config?.sync_transactions ?? false,
        syncIntervalSeconds: data.sync_config?.sync_interval_seconds ?? 300,
      },
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export const ecosystemService = new EcosystemService();
