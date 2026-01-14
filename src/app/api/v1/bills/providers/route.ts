/**
 * Bill Providers Endpoints
 * GET /api/v1/bills/providers - Get available bill providers
 * GET /api/v1/bills/categories - Get bill categories
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { billsService, BillCategory } from '@/services/bills/bills.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateQuery } from '@/middleware/validation';

const querySchema = z.object({
  category: z.enum([
    'electricity', 'water', 'gas', 'internet',
    'phone', 'cable', 'insurance', 'subscription', 'other'
  ] as const).optional(),
});

/**
 * Get available bill providers
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const providers = await billsService.getProviders(query.category as BillCategory);

    return success({
      providers,
      total: providers.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch providers');
  }
}
