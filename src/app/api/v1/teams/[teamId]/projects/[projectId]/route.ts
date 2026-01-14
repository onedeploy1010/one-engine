/**
 * Project Detail API
 * GET /api/v1/teams/:teamId/projects/:projectId - Get project details
 * PATCH /api/v1/teams/:teamId/projects/:projectId - Update project
 * DELETE /api/v1/teams/:teamId/projects/:projectId - Delete project
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { teamService } from '@/services/team/team.service';
import { apiKeyService } from '@/services/project/apiKey.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ teamId: string; projectId: string }>;
}

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  settings: z.object({
    allowedDomains: z.array(z.string()).optional(),
    allowedBundleIds: z.array(z.string()).optional(),
    enabledServices: z.object({
      connect: z.boolean().optional(),
      wallet: z.boolean().optional(),
      contracts: z.boolean().optional(),
      pay: z.boolean().optional(),
      engine: z.boolean().optional(),
    }).optional(),
    rateLimit: z.object({
      requestsPerMinute: z.number().optional(),
      requestsPerDay: z.number().optional(),
    }).optional(),
  }).optional(),
});

/**
 * Get project details with API keys
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId, projectId } = await params;

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to access this project');
    }

    const project = await teamService.getProject(projectId);
    if (!project || project.teamId !== teamId) {
      return errors.notFound('Project not found');
    }

    // Get API keys (without actual key values)
    const apiKeys = await apiKeyService.getProjectKeys(projectId);

    return success({
      project,
      apiKeys,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch project');
  }
}

/**
 * Update project
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId, projectId } = await params;
    const body = await validateBody(req, updateProjectSchema);

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to update this project');
    }

    const existingProject = await teamService.getProject(projectId);
    if (!existingProject || existingProject.teamId !== teamId) {
      return errors.notFound('Project not found');
    }

    const project = await teamService.updateProject(projectId, body);

    return success({ project });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to update project');
  }
}

/**
 * Delete project
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId, projectId } = await params;

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to delete this project');
    }

    const project = await teamService.getProject(projectId);
    if (!project || project.teamId !== teamId) {
      return errors.notFound('Project not found');
    }

    // Only team owner can delete projects
    const team = await teamService.getTeam(teamId);
    if (team?.ownerId !== auth.userId) {
      return errors.forbidden('Only team owner can delete projects');
    }

    await teamService.deleteProject(projectId);

    return success({ message: 'Project deleted successfully' });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to delete project');
  }
}
