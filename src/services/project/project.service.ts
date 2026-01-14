/**
 * Project Service for ONE Engine
 * Multi-tenant project management
 */

import { projectRepository } from '@/repositories/project.repository';
import { LogService } from '@/lib/logger';
import type { Project, ProjectSettings } from '@/types';
import { slugify } from '@/utils/formatting';

const log = new LogService({ service: 'ProjectService' });

export interface CreateProjectInput {
  name: string;
  slug?: string;
  ownerId: string;
  settings?: Partial<ProjectSettings>;
}

export class ProjectService {
  /**
   * Create a new project
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    // Generate slug from name if not provided
    const slug = input.slug || slugify(input.name);

    // Check if slug is available
    const isAvailable = await projectRepository.isSlugAvailable(slug);
    if (!isAvailable) {
      throw new Error(`Project slug "${slug}" is already taken`);
    }

    log.info('Creating project', { name: input.name, slug, ownerId: input.ownerId });

    const project = await projectRepository.create({
      name: input.name,
      slug,
      ownerId: input.ownerId,
      settings: input.settings,
    });

    log.info('Project created', { projectId: project.id });

    return project;
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    return projectRepository.findById(projectId);
  }

  /**
   * Get project by slug
   */
  async getProjectBySlug(slug: string): Promise<Project | null> {
    return projectRepository.findBySlug(slug);
  }

  /**
   * Get project by API key
   */
  async getProjectByApiKey(apiKey: string): Promise<Project | null> {
    return projectRepository.findByApiKey(apiKey);
  }

  /**
   * Get user's projects
   */
  async getUserProjects(
    userId: string,
    options?: { isActive?: boolean }
  ): Promise<Project[]> {
    return projectRepository.findByOwner(userId, options);
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    updates: {
      name?: string;
      isActive?: boolean;
      settings?: Partial<ProjectSettings> | Record<string, unknown>;
    }
  ): Promise<Project> {
    return projectRepository.update(projectId, updates);
  }

  /**
   * Update project settings
   */
  async updateSettings(
    projectId: string,
    settings: Partial<ProjectSettings>
  ): Promise<Project> {
    return this.updateProject(projectId, { settings });
  }

  /**
   * Enable/disable a feature
   */
  async toggleFeature(
    projectId: string,
    feature: keyof ProjectSettings['features'],
    enabled: boolean
  ): Promise<Project> {
    const project = await this.getProject(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    const settings: Partial<ProjectSettings> = {
      features: {
        ...project.settings.features,
        [feature]: enabled,
      },
    };

    return projectRepository.update(projectId, { settings });
  }

  /**
   * Add allowed domain
   */
  async addAllowedDomain(
    projectId: string,
    domain: string
  ): Promise<Project> {
    const project = await this.getProject(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    const allowedDomains = [...(project.settings.allowedDomains || [])];
    if (!allowedDomains.includes(domain)) {
      allowedDomains.push(domain);
    }

    return projectRepository.update(projectId, {
      settings: { allowedDomains },
    });
  }

  /**
   * Remove allowed domain
   */
  async removeAllowedDomain(
    projectId: string,
    domain: string
  ): Promise<Project> {
    const project = await this.getProject(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    const allowedDomains = (project.settings.allowedDomains || []).filter(
      (d) => d !== domain
    );

    return projectRepository.update(projectId, {
      settings: { allowedDomains },
    });
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(projectId: string): Promise<string> {
    log.info('Regenerating API key', { projectId });
    const result = await projectRepository.regenerateApiKey(projectId);
    return result.apiKey;
  }

  /**
   * Regenerate API secret
   */
  async regenerateApiSecret(projectId: string): Promise<string> {
    log.info('Regenerating API secret', { projectId });
    const result = await projectRepository.regenerateApiSecret(projectId);
    return result.apiSecret;
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    log.info('Deleting project', { projectId });
    await projectRepository.delete(projectId);
  }

  /**
   * Get project statistics
   */
  async getProjectStats(projectId: string): Promise<{
    totalUsers: number;
    totalWallets: number;
    totalContracts: number;
    totalTransactions: number;
  }> {
    return projectRepository.getStats(projectId);
  }

  /**
   * Check if project has feature enabled
   */
  async hasFeature(
    projectId: string,
    feature: keyof ProjectSettings['features']
  ): Promise<boolean> {
    const project = await this.getProject(projectId);

    if (!project) {
      return false;
    }

    return project.settings.features[feature] ?? false;
  }

  /**
   * Validate API key and return project
   */
  async validateApiKey(apiKey: string): Promise<Project | null> {
    if (!apiKey || !apiKey.startsWith('one_')) {
      return null;
    }

    return this.getProjectByApiKey(apiKey);
  }
}

export const projectService = new ProjectService();
