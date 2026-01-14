/**
 * Bill Categories Endpoint
 * GET /api/v1/bills/categories - Get all bill categories
 */

import { NextRequest } from 'next/server';
import { billsService } from '@/services/bills/bills.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';

/**
 * Get all bill categories
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const categories = billsService.getCategories();

    return success({
      categories,
      total: categories.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch categories');
  }
}
