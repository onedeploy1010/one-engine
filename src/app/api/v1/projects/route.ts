/**
 * Projects Endpoints
 * GET /api/v1/projects - Get user's projects
 * POST /api/v1/projects - Create a new project
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { projectService } from '@/services/project/project.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody, validateQuery } from '@/middleware/validation';

const querySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  settings: z.record(z.unknown()).optional(),
});

/**
 * Get user's projects
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const projects = await projectService.getUserProjects(auth.userId, {
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
    });

    return success({
      projects,
      total: projects.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch projects');
  }
}

/**
 * Create a new project
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, createProjectSchema);

    const project = await projectService.createProject({
      ownerId: auth.userId,
      name: body.name,
      slug: body.slug,
      settings: body.settings,
    });

    return success({ project }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create project');
  }
}
