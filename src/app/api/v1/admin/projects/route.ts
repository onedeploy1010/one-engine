/**
 * Admin Projects Endpoints
 * GET /api/v1/admin/projects - List all projects (admin only)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { success, errors } from '@/lib/response';
import { requireAdmin } from '@/middleware/auth';
import { validateQuery } from '@/middleware/validation';
import { parsePaginationParams, createPaginationResult } from '@/utils/pagination';

const querySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * List all projects (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const query = validateQuery(req, querySchema);
    const pagination = parsePaginationParams(query);

    const supabase = getSupabaseAdmin();
    let dbQuery = supabase
      .from('projects')
      .select('*, owner:users(email)', { count: 'exact' });

    // Apply filters
    if (query.search) {
      dbQuery = dbQuery.or(`name.ilike.%${query.search}%,slug.ilike.%${query.search}%`);
    }
    if (query.isActive !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.isActive === 'true');
    }

    // Apply pagination
    const offset = (pagination.page - 1) * pagination.limit;
    dbQuery = dbQuery
      .order(pagination.sortBy || 'created_at', { ascending: pagination.sortOrder === 'asc' })
      .range(offset, offset + pagination.limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      return errors.internal(`Failed to fetch projects: ${error.message}`);
    }

    interface ProjectRow {
      id: string;
      name: string;
      slug: string;
      owner_id: string;
      owner?: { email?: string };
      api_key: string;
      is_active: boolean;
      settings: Record<string, unknown>;
      created_at: string;
      updated_at: string;
    }

    const projects = (data as ProjectRow[]).map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.owner_id,
      ownerEmail: row.owner?.email,
      apiKey: row.api_key,
      isActive: row.is_active,
      settings: row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const result = createPaginationResult(projects, count || 0, pagination);

    return success(result);
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch projects');
  }
}
