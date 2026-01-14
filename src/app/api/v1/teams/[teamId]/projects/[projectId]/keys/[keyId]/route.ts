/**
 * Individual API Key Management
 * PATCH /api/v1/teams/:teamId/projects/:projectId/keys/:keyId - Update key settings
 * DELETE /api/v1/teams/:teamId/projects/:projectId/keys/:keyId - Delete/revoke key
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { teamService } from '@/services/team/team.service';
import { apiKeyService } from '@/services/project/apiKey.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ teamId: string; projectId: string; keyId: string }>;
}

const updateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  allowedDomains: z.array(z.string()).optional(),
  allowedIps: z.array(z.string()).optional(),
  rateLimitPerMinute: z.number().min(1).max(10000).optional(),
});

/**
 * Update API key settings
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId, projectId, keyId } = await params;
    const body = await validateBody(req, updateKeySchema);

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to update this API key');
    }

    const project = await teamService.getProject(projectId);
    if (!project || project.teamId !== teamId) {
      return errors.notFound('Project not found');
    }

    // Update key
    const keyRecord = await apiKeyService.updateKey(keyId, body);

    return success({ keyRecord });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to update API key');
  }
}

/**
 * Revoke/Delete API key
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId, projectId, keyId } = await params;

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to delete this API key');
    }

    const project = await teamService.getProject(projectId);
    if (!project || project.teamId !== teamId) {
      return errors.notFound('Project not found');
    }

    // Check if this is the last active key
    const keys = await apiKeyService.getProjectKeys(projectId);
    const activeKeys = keys.filter(k => k.isActive);

    if (activeKeys.length === 1 && activeKeys[0].id === keyId) {
      return errors.badRequest('Cannot delete the last active API key. Create a new key first.');
    }

    // Revoke (soft delete) the key
    await apiKeyService.revokeKey(keyId);

    return success({ message: 'API key revoked successfully' });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to revoke API key');
  }
}
