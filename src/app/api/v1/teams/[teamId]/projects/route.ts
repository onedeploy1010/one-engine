/**
 * Team Projects API
 * GET /api/v1/teams/:teamId/projects - Get team's projects
 * POST /api/v1/teams/:teamId/projects - Create a new project
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

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
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
 * Get team's projects
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

    const projects = await teamService.getTeamProjects(teamId);

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
 * Returns client_id and publishable_key (only shown once!)
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { teamId } = await params;
    const body = await validateBody(req, createProjectSchema);

    // Check access
    const hasAccess = await teamService.userHasTeamAccess(auth.userId, teamId);
    if (!hasAccess) {
      return errors.forbidden('Not authorized to create projects in this team');
    }

    // Check project limit
    const team = await teamService.getTeam(teamId);
    if (!team) {
      return errors.notFound('Team not found');
    }

    const existingProjects = await teamService.getTeamProjects(teamId);
    if (existingProjects.length >= team.maxProjects) {
      return errors.badRequest(`Team has reached maximum project limit (${team.maxProjects}). Upgrade your plan to create more projects.`);
    }

    // Create project with auto-generated credentials
    const result = await teamService.createProject({
      teamId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      settings: body.settings,
    });

    return success({
      project: result.project,
      credentials: {
        clientId: result.clientId,
        publishableKey: result.publishableKey,
        // IMPORTANT: These credentials are only shown once!
        warning: 'Save these credentials now. The publishable key will not be shown again.',
      },
    }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create project');
  }
}
