/**
 * Project Detail Endpoints
 * GET /api/v1/projects/:projectId - Get project details
 * PATCH /api/v1/projects/:projectId - Update project
 * DELETE /api/v1/projects/:projectId - Delete project
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { projectService } from '@/services/project/project.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * Get project details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { projectId } = await params;

    const project = await projectService.getProject(projectId);

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.userId) {
      return errors.forbidden('Not authorized to view this project');
    }

    return success({ project });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch project');
  }
}

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * Update project
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { projectId } = await params;
    const body = await validateBody(req, updateProjectSchema);

    const existingProject = await projectService.getProject(projectId);

    if (!existingProject) {
      return errors.notFound('Project not found');
    }

    if (existingProject.ownerId !== auth.userId) {
      return errors.forbidden('Not authorized to update this project');
    }

    const project = await projectService.updateProject(projectId, body);

    return success({ project });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to update project');
  }
}

/**
 * Delete project
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { projectId } = await params;

    const existingProject = await projectService.getProject(projectId);

    if (!existingProject) {
      return errors.notFound('Project not found');
    }

    if (existingProject.ownerId !== auth.userId) {
      return errors.forbidden('Not authorized to delete this project');
    }

    await projectService.deleteProject(projectId);

    return success({ deleted: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to delete project');
  }
}
