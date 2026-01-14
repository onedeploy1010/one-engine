/**
 * Team Detail API
 * GET /api/v1/teams/:teamId - Get team details
 * PATCH /api/v1/teams/:teamId - Update team
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { teamService } from '@/services/team/team.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  billingEmail: z.string().email().optional(),
});

/**
 * Get team details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId } = await params;

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to access this team');
    }

    const team = await teamService.getTeam(teamId);
    if (!team) {
      return errors.notFound('Team not found');
    }

    const members = await teamService.getTeamMembers(teamId);
    const projects = await teamService.getTeamProjects(teamId);

    return success({
      team,
      members,
      projects,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch team');
  }
}

/**
 * Update team
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId } = await params;
    const body = await validateBody(req, updateTeamSchema);

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to update this team');
    }

    // For now, simple update - in production, check if user is admin/owner
    const team = await teamService.getTeam(teamId);
    if (!team) {
      return errors.notFound('Team not found');
    }

    // Only owner can update team
    if (team.ownerId !== auth.userId) {
      return errors.forbidden('Only team owner can update team settings');
    }

    // Update team - TODO: implement updateTeam in teamService
    return success({ team });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to update team');
  }
}
