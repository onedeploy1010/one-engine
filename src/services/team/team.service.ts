/**
 * Team Service for ONE Engine
 * Multi-tenant team and member management
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import { generateClientId, generatePublishableKey, hashSha256, getKeyPrefix } from '@/utils/crypto';

const log = new LogService({ service: 'TeamService' });

// Helper to get typed supabase client (bypasses strict type checking for new tables)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface Team {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  billingPlan: 'free' | 'starter' | 'growth' | 'pro';
  billingEmail: string | null;
  maxProjects: number;
  maxApiCallsPerMonth: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  invitedBy: string | null;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  description: string | null;
  clientId: string;
  status: 'active' | 'inactive' | 'suspended';
  settings: ProjectSettings;
  thirdwebClientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  allowedDomains?: string[];
  allowedBundleIds?: string[];
  enabledServices?: {
    connect?: boolean;
    wallet?: boolean;
    contracts?: boolean;
    pay?: boolean;
    engine?: boolean;
  };
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
}

const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  allowedDomains: [],
  allowedBundleIds: [],
  enabledServices: {
    connect: true,
    wallet: true,
    contracts: false,
    pay: false,
    engine: false,
  },
  rateLimit: {
    requestsPerMinute: 100,
    requestsPerDay: 10000,
  },
};

export interface CreateTeamInput {
  name: string;
  slug?: string;
  ownerId: string;
  billingEmail?: string;
}

export interface CreateProjectInput {
  teamId: string;
  name: string;
  slug?: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
}

export interface CreateProjectResult {
  project: Project;
  clientId: string;
  publishableKey: string; // Only shown once!
}

export class TeamService {
  /**
   * Create a new team and add owner as member
   */
  async createTeam(input: CreateTeamInput): Promise<Team> {
    const slug = input.slug || this.generateSlug(input.name);

    // Check slug availability
    const { data: existing } = await db()
      .from('teams')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      throw new Error(`Team slug "${slug}" is already taken`);
    }

    const { data: team, error } = await db()
      .from('teams')
      .insert({
        name: input.name,
        slug,
        owner_id: input.ownerId,
        billing_email: input.billingEmail,
        billing_plan: 'free',
        max_projects: 3,
        max_api_calls_per_month: 100000,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create team', error, { name: input.name });
      throw new Error(`Failed to create team: ${error.message}`);
    }

    // Add owner as team member
    await db().from('team_members').insert({
      team_id: team.id,
      user_id: input.ownerId,
      role: 'owner',
    });

    log.info('Team created', { teamId: team.id, name: input.name });

    return this.mapToTeam(team);
  }

  /**
   * Create a new project with auto-generated client ID and keys
   */
  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    const slug = input.slug || this.generateSlug(input.name);
    const clientId = generateClientId();

    // Check slug uniqueness within team
    const { data: existing } = await db()
      .from('projects')
      .select('id')
      .eq('team_id', input.teamId)
      .eq('slug', slug)
      .single();

    if (existing) {
      throw new Error(`Project slug "${slug}" already exists in this team`);
    }

    // Create project
    const settings = {
      ...DEFAULT_PROJECT_SETTINGS,
      ...input.settings,
    };

    const { data: project, error } = await db()
      .from('projects')
      .insert({
        team_id: input.teamId,
        name: input.name,
        slug,
        description: input.description,
        client_id: clientId,
        status: 'active',
        settings,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create project', error, { name: input.name });
      throw new Error(`Failed to create project: ${error.message}`);
    }

    // Create default publishable key
    const publishableKey = generatePublishableKey();
    const keyHash = hashSha256(publishableKey);
    const keyPrefix = getKeyPrefix(publishableKey);

    await db().from('project_api_keys').insert({
      project_id: project.id,
      name: 'Default Publishable Key',
      key_type: 'publishable',
      key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions: ['read'],
      rate_limit_per_minute: 100,
      is_active: true,
    });

    log.info('Project created', { projectId: project.id, clientId });

    return {
      project: this.mapToProject(project),
      clientId,
      publishableKey,
    };
  }

  /**
   * Create default team and project for new user registration
   */
  async createDefaultTeamAndProject(
    userId: string,
    email: string
  ): Promise<{ team: Team; project: Project; clientId: string; publishableKey: string }> {
    // Create default team
    const teamName = `${email.split('@')[0]}'s Team`;
    const team = await this.createTeam({
      name: teamName,
      ownerId: userId,
      billingEmail: email,
    });

    // Create default project
    const result = await this.createProject({
      teamId: team.id,
      name: 'My First Project',
      slug: 'default',
    });

    return {
      team,
      ...result,
    };
  }

  /**
   * Get team by ID
   */
  async getTeam(teamId: string): Promise<Team | null> {
    const { data, error } = await db()
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get team: ${error.message}`);
    }

    return data ? this.mapToTeam(data) : null;
  }

  /**
   * Get team by slug
   */
  async getTeamBySlug(slug: string): Promise<Team | null> {
    const { data, error } = await db()
      .from('teams')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get team: ${error.message}`);
    }

    return data ? this.mapToTeam(data) : null;
  }

  /**
   * Get user's teams
   */
  async getUserTeams(userId: string): Promise<Team[]> {
    const { data, error } = await db()
      .from('team_members')
      .select('teams(*)')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get user teams: ${error.message}`);
    }

    return (data || [])
      .map((row: { teams: Record<string, unknown> }) => row.teams)
      .filter(Boolean)
      .map((team: Record<string, unknown>) => this.mapToTeam(team));
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const { data, error } = await db()
      .from('team_members')
      .select('*, users(id, email, name)')
      .eq('team_id', teamId);

    if (error) {
      throw new Error(`Failed to get team members: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => this.mapToTeamMember(row));
  }

  /**
   * Add member to team
   */
  async addTeamMember(
    teamId: string,
    userId: string,
    role: 'admin' | 'member' = 'member',
    invitedBy?: string
  ): Promise<TeamMember> {
    const { data, error } = await db()
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
        invited_by: invitedBy,
      })
      .select('*, users(id, email, name)')
      .single();

    if (error) {
      throw new Error(`Failed to add team member: ${error.message}`);
    }

    return this.mapToTeamMember(data);
  }

  /**
   * Remove member from team
   */
  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    // Prevent removing owner
    const { data: member } = await db()
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (member?.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    const { error } = await db()
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to remove team member: ${error.message}`);
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await db()
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get project: ${error.message}`);
    }

    return data ? this.mapToProject(data) : null;
  }

  /**
   * Get project by client ID
   */
  async getProjectByClientId(clientId: string): Promise<Project | null> {
    const { data, error } = await db()
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get project: ${error.message}`);
    }

    return data ? this.mapToProject(data) : null;
  }

  /**
   * Get team's projects
   */
  async getTeamProjects(teamId: string): Promise<Project[]> {
    const { data, error } = await db()
      .from('projects')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get team projects: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => this.mapToProject(row));
  }

  /**
   * Update project settings
   */
  async updateProject(
    projectId: string,
    updates: {
      name?: string;
      description?: string;
      status?: 'active' | 'inactive' | 'suspended';
      settings?: Partial<ProjectSettings>;
    }
  ): Promise<Project> {
    const updateData: Record<string, unknown> = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status) updateData.status = updates.status;
    if (updates.settings) {
      const project = await this.getProject(projectId);
      updateData.settings = {
        ...project?.settings,
        ...updates.settings,
      };
    }

    const { data, error } = await db()
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return this.mapToProject(data);
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    const { error } = await db()
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }

    log.info('Project deleted', { projectId });
  }

  /**
   * Check if user has access to team
   */
  async userHasTeamAccess(userId: string, teamId: string): Promise<boolean> {
    const { data } = await db()
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    return !!data;
  }

  /**
   * Check if user has access to project
   */
  async userHasProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const { data: project } = await db()
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .single();

    if (!project) return false;

    return this.userHasTeamAccess(userId, project.team_id);
  }

  /**
   * Generate URL-friendly slug
   */
  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Add random suffix for uniqueness
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${baseSlug}-${suffix}`;
  }

  /**
   * Map database row to Team
   */
  private mapToTeam(row: Record<string, unknown>): Team {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      ownerId: row.owner_id as string,
      billingPlan: row.billing_plan as Team['billingPlan'],
      billingEmail: row.billing_email as string | null,
      maxProjects: row.max_projects as number,
      maxApiCallsPerMonth: row.max_api_calls_per_month as number,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  /**
   * Map database row to TeamMember
   */
  private mapToTeamMember(row: Record<string, unknown>): TeamMember {
    const users = row.users as { id: string; email: string; name: string } | null;
    return {
      id: row.id as string,
      teamId: row.team_id as string,
      userId: row.user_id as string,
      role: row.role as TeamMember['role'],
      invitedBy: row.invited_by as string | null,
      joinedAt: row.joined_at as string,
      user: users || undefined,
    };
  }

  /**
   * Map database row to Project
   */
  private mapToProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      teamId: row.team_id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: row.description as string | null,
      clientId: row.client_id as string,
      status: row.status as Project['status'],
      settings: row.settings as ProjectSettings,
      thirdwebClientId: row.thirdweb_client_id as string | null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export const teamService = new TeamService();
