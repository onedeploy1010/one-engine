/**
 * API Key Service for ONE Engine
 * Multi-tenant API key management with secure hash storage
 */

import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import {
  generateClientId,
  generatePublishableKey,
  generateSecretKey,
  hashSha256,
  getKeyPrefix,
} from '@/utils/crypto';

const log = new LogService({ service: 'ApiKeyService' });

// Helper to get typed supabase client (bypasses strict type checking for new tables)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface ApiKeyRecord {
  id: string;
  projectId: string;
  name: string;
  keyType: 'publishable' | 'secret';
  keyPrefix: string;
  allowedDomains: string[];
  allowedIps: string[];
  permissions: string[];
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  totalRequests: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyInput {
  projectId: string;
  name: string;
  keyType: 'publishable' | 'secret';
  allowedDomains?: string[];
  allowedIps?: string[];
  permissions?: string[];
  rateLimitPerMinute?: number;
  expiresAt?: string;
}

export interface CreateApiKeyResult {
  key: string; // Full key - only returned once!
  keyRecord: ApiKeyRecord;
}

export class ApiKeyService {
  /**
   * Generate a new Client ID for a project
   * Client ID is public and used to identify the project
   */
  generateClientId(): string {
    return generateClientId();
  }

  /**
   * Create a new API key for a project
   * Returns the full key (only shown once) and the key record
   */
  async createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    // Generate the appropriate key type
    const key = input.keyType === 'publishable'
      ? generatePublishableKey()
      : generateSecretKey();

    // Hash the key for storage (never store plain keys)
    const keyHash = hashSha256(key);
    const keyPrefix = getKeyPrefix(key);

    // Default permissions based on key type
    const defaultPermissions = input.keyType === 'secret'
      ? ['*'] // Secret keys have full access
      : ['read']; // Publishable keys have read-only access

    const insertData = {
      project_id: input.projectId,
      name: input.name,
      key_type: input.keyType,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      allowed_domains: input.allowedDomains || [],
      allowed_ips: input.allowedIps || [],
      permissions: input.permissions || defaultPermissions,
      rate_limit_per_minute: input.rateLimitPerMinute || 100,
      is_active: true,
      expires_at: input.expiresAt || null,
    };

    const { data, error } = await db()
      .from('project_api_keys')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      log.error('Failed to create API key', error, { projectId: input.projectId });
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    log.info('API key created', { projectId: input.projectId, keyType: input.keyType });

    return {
      key, // Return full key - user must save this!
      keyRecord: this.mapToApiKeyRecord(data),
    };
  }

  /**
   * Validate an API key and return the key record
   * Uses hash comparison for security
   */
  async validateKey(key: string): Promise<{
    valid: boolean;
    keyRecord?: ApiKeyRecord;
    projectId?: string;
  }> {
    const keyHash = hashSha256(key);

    const { data, error } = await db()
      .from('project_api_keys')
      .select('*, projects(id, status)')
      .eq('key_hash', keyHash)
      .single();

    if (error || !data) {
      return { valid: false };
    }

    // Check if key is active
    if (!data.is_active) {
      return { valid: false };
    }

    // Check if key is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { valid: false };
    }

    // Check if project is active
    if (data.projects?.status !== 'active') {
      return { valid: false };
    }

    // Update usage stats
    await this.updateKeyUsage(data.id);

    return {
      valid: true,
      keyRecord: this.mapToApiKeyRecord(data),
      projectId: data.project_id,
    };
  }

  /**
   * Get all API keys for a project (without the actual keys)
   */
  async getProjectKeys(projectId: string): Promise<ApiKeyRecord[]> {
    const { data, error } = await db()
      .from('project_api_keys')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get project keys: ${error.message}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => this.mapToApiKeyRecord(row));
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeKey(keyId: string): Promise<void> {
    const { error } = await db()
      .from('project_api_keys')
      .update({ is_active: false })
      .eq('id', keyId);

    if (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }

    log.info('API key revoked', { keyId });
  }

  /**
   * Delete an API key permanently
   */
  async deleteKey(keyId: string): Promise<void> {
    const { error } = await db()
      .from('project_api_keys')
      .delete()
      .eq('id', keyId);

    if (error) {
      throw new Error(`Failed to delete API key: ${error.message}`);
    }

    log.info('API key deleted', { keyId });
  }

  /**
   * Update key settings
   */
  async updateKey(
    keyId: string,
    updates: {
      name?: string;
      allowedDomains?: string[];
      allowedIps?: string[];
      rateLimitPerMinute?: number;
    }
  ): Promise<ApiKeyRecord> {
    const updateData: Record<string, unknown> = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.allowedDomains) updateData.allowed_domains = updates.allowedDomains;
    if (updates.allowedIps) updateData.allowed_ips = updates.allowedIps;
    if (updates.rateLimitPerMinute) updateData.rate_limit_per_minute = updates.rateLimitPerMinute;

    const { data, error } = await db()
      .from('project_api_keys')
      .update(updateData)
      .eq('id', keyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update API key: ${error.message}`);
    }

    return this.mapToApiKeyRecord(data);
  }

  /**
   * Update key usage statistics
   */
  private async updateKeyUsage(keyId: string): Promise<void> {
    // First get current count, then increment
    const { data } = await db()
      .from('project_api_keys')
      .select('total_requests')
      .eq('id', keyId)
      .single();

    await db()
      .from('project_api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        total_requests: ((data?.total_requests as number) || 0) + 1,
      })
      .eq('id', keyId);
  }

  /**
   * Check if domain is allowed for a publishable key
   */
  checkDomainAllowed(keyRecord: ApiKeyRecord, origin: string): boolean {
    if (keyRecord.keyType !== 'publishable') return true;
    if (keyRecord.allowedDomains.length === 0) return true;
    if (keyRecord.allowedDomains.includes('*')) return true;

    try {
      const hostname = new URL(origin).hostname;
      return keyRecord.allowedDomains.includes(hostname);
    } catch {
      return false;
    }
  }

  /**
   * Check if IP is allowed for a secret key
   */
  checkIpAllowed(keyRecord: ApiKeyRecord, ip: string): boolean {
    if (keyRecord.keyType !== 'secret') return true;
    if (keyRecord.allowedIps.length === 0) return true;
    if (keyRecord.allowedIps.includes('*')) return true;

    return keyRecord.allowedIps.includes(ip);
  }

  /**
   * Map database row to ApiKeyRecord
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToApiKeyRecord(row: any): ApiKeyRecord {
    if (!row) {
      throw new Error('Invalid row data');
    }
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as string,
      keyType: row.key_type as 'publishable' | 'secret',
      keyPrefix: row.key_prefix as string,
      allowedDomains: (row.allowed_domains as string[]) || [],
      allowedIps: (row.allowed_ips as string[]) || [],
      permissions: (row.permissions as string[]) || [],
      rateLimitPerMinute: row.rate_limit_per_minute as number,
      lastUsedAt: row.last_used_at as string | null,
      totalRequests: (row.total_requests as number) || 0,
      isActive: row.is_active as boolean,
      expiresAt: row.expires_at as string | null,
      createdAt: row.created_at as string,
    };
  }
}

export const apiKeyService = new ApiKeyService();
