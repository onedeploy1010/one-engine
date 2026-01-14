/**
 * Project API Keys Management
 * GET /api/v1/teams/:teamId/projects/:projectId/keys - Get all API keys
 * POST /api/v1/teams/:teamId/projects/:projectId/keys - Create new API key
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

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  keyType: z.enum(['publishable', 'secret']),
  allowedDomains: z.array(z.string()).optional(),
  allowedIps: z.array(z.string()).optional(),
  rateLimitPerMinute: z.number().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Get all API keys for a project (without actual key values)
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

    const apiKeys = await apiKeyService.getProjectKeys(projectId);

    return success({
      apiKeys,
      total: apiKeys.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch API keys');
  }
}

/**
 * Create new API key
 * Returns the full key value (only shown once!)
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId, projectId } = await params;
    const body = await validateBody(req, createKeySchema);

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to create API keys for this project');
    }

    const project = await teamService.getProject(projectId);
    if (!project || project.teamId !== teamId) {
      return errors.notFound('Project not found');
    }

    // Create new API key
    const result = await apiKeyService.createApiKey({
      projectId,
      name: body.name,
      keyType: body.keyType,
      allowedDomains: body.allowedDomains,
      allowedIps: body.allowedIps,
      rateLimitPerMinute: body.rateLimitPerMinute,
      expiresAt: body.expiresAt,
    });

    return success({
      key: result.key, // IMPORTANT: Only shown once!
      keyRecord: result.keyRecord,
      warning: 'Save this key now. It will not be shown again.',
    }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create API key');
  }
}
