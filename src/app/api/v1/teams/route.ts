/**
 * Teams API
 * GET /api/v1/teams - Get user's teams
 * POST /api/v1/teams - Create a new team
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { teamService } from '@/services/team/team.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  billingEmail: z.string().email().optional(),
});

/**
 * Get user's teams
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const teams = await teamService.getUserTeams(auth.userId);

    return success({
      teams,
      total: teams.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch teams');
  }
}

/**
 * Create a new team
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, createTeamSchema);

    const team = await teamService.createTeam({
      name: body.name,
      slug: body.slug,
      ownerId: auth.userId,
      billingEmail: body.billingEmail,
    });

    return success({ team }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create team');
  }
}
