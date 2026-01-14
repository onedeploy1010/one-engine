/**
 * Project API Key Endpoint
 * POST /api/v1/projects/:projectId/api-key - Regenerate API key
 */

import { NextRequest } from 'next/server';
import { projectService } from '@/services/project/project.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * Regenerate project API key
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { projectId } = await params;

    const project = await projectService.getProject(projectId);

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.userId) {
      return errors.forbidden('Not authorized to regenerate API key');
    }

    const newApiKey = await projectService.regenerateApiKey(projectId);

    return success({
      apiKey: newApiKey,
      message: 'API key regenerated successfully. Please update your application.',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to regenerate API key');
  }
}
