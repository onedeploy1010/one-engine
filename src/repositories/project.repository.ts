/**
 * Project Repository
 * Database abstraction for project/tenant management
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { generateApiKey, generateApiSecret } from '@/utils/crypto';
import { LogService } from '@/lib/logger';
import type { Project, ProjectSettings } from '@/types';

const log = new LogService({ service: 'ProjectRepository' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface CreateProjectInput {
  name: string;
  slug: string;
  ownerId: string;
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectInput {
  name?: string;
  settings?: Partial<ProjectSettings>;
  isActive?: boolean;
}

const DEFAULT_SETTINGS: ProjectSettings = {
  allowedDomains: [],
  rateLimit: 1000,
  features: {
    wallet: true,
    swap: true,
    contracts: true,
    fiat: true,
    payments: true,
    quant: false,
    ai: true,
    x402: false,
  },
};

export class ProjectRepository {
  private supabase = getSupabaseAdmin();

  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<Project> {
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();

    const settings = {
      ...DEFAULT_SETTINGS,
      ...input.settings,
    };

    const insertData = {
      name: input.name,
      slug: input.slug.toLowerCase(),
      owner_id: input.ownerId,
      api_key: apiKey,
      api_secret: apiSecret,
      settings,
      is_active: true,
    };

    const { data, error } = await db()
      .from('projects')
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      log.error('Failed to create project', error, { name: input.name });
      throw new Error(`Failed to create project: ${error.message}`);
    }

    return this.mapToProject(data);
  }

  /**
   * Find project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const { data, error } = await db()
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find project: ${error.message}`);
    }

    return data ? this.mapToProject(data) : null;
  }

  /**
   * Find project by slug
   */
  async findBySlug(slug: string): Promise<Project | null> {
    const { data, error } = await db()
      .from('projects')
      .select('*')
      .eq('slug', slug.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find project: ${error.message}`);
    }

    return data ? this.mapToProject(data) : null;
  }

  /**
   * Find project by API key
   */
  async findByApiKey(apiKey: string): Promise<Project | null> {
    const { data, error } = await db()
      .from('projects')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find project: ${error.message}`);
    }

    return data ? this.mapToProject(data) : null;
  }

  /**
   * Find projects by owner
   */
  async findByOwner(
    ownerId: string,
    options?: { isActive?: boolean }
  ): Promise<Project[]> {
    let query = db()
      .from('projects')
      .select('*')
      .eq('owner_id', ownerId);

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find projects: ${error.message}`);
    }

    return (data || []).map(row => this.mapToProject(row));
  }

  /**
   * Update project
   */
  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const updates: Record<string, unknown> = {};

    if (input.name) updates.name = input.name;
    if (input.isActive !== undefined) updates.is_active = input.isActive;
    if (input.settings) {
      // Merge settings
      const existing = await this.findById(id);
      updates.settings = {
        ...existing?.settings,
        ...input.settings,
      };
    }

    const { data, error } = await db()
      .from('projects')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return this.mapToProject(data);
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(id: string): Promise<{ apiKey: string }> {
    const apiKey = generateApiKey();

    const { error } = await db()
      .from('projects')
      .update({ api_key: apiKey } as any)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to regenerate API key: ${error.message}`);
    }

    return { apiKey };
  }

  /**
   * Regenerate API secret
   */
  async regenerateApiSecret(id: string): Promise<{ apiSecret: string }> {
    const apiSecret = generateApiSecret();

    const { error } = await db()
      .from('projects')
      .update({ api_secret: apiSecret } as any)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to regenerate API secret: ${error.message}`);
    }

    return { apiSecret };
  }

  /**
   * Delete project
   */
  async delete(id: string): Promise<void> {
    const { error } = await db()
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    let query = db()
      .from('projects')
      .select('id')
      .eq('slug', slug.toLowerCase());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to check slug: ${error.message}`);
    }

    return data.length === 0;
  }

  /**
   * Get project statistics
   */
  async getStats(projectId: string): Promise<{
    totalUsers: number;
    totalWallets: number;
    totalContracts: number;
    totalTransactions: number;
  }> {
    const [users, wallets, contracts, transactions] = await Promise.all([
      db().from('wallets').select('id', { count: 'exact' }).eq('project_id', projectId),
      db().from('wallets').select('id', { count: 'exact' }).eq('project_id', projectId),
      db().from('contracts_registry').select('id', { count: 'exact' }).eq('project_id', projectId),
      db().from('transactions').select('id', { count: 'exact' }).eq('project_id', projectId),
    ]);

    return {
      totalUsers: users.count || 0,
      totalWallets: wallets.count || 0,
      totalContracts: contracts.count || 0,
      totalTransactions: transactions.count || 0,
    };
  }

  /**
   * Map database row to Project type
   */
  private mapToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.owner_id,
      apiKey: row.api_key,
      settings: row.settings as ProjectSettings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const projectRepository = new ProjectRepository();
