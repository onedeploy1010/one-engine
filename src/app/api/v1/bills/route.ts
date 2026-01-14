/**
 * Bills Endpoints
 * GET /api/v1/bills - Get user's bills
 * POST /api/v1/bills - Create a new bill
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { billsService, BillCategory, BillStatus } from '@/services/bills/bills.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody, validateQuery } from '@/middleware/validation';
import { parsePaginationParams, createPaginationResult } from '@/utils/pagination';

const querySchema = z.object({
  category: z.enum([
    'electricity', 'water', 'gas', 'internet',
    'phone', 'cable', 'insurance', 'subscription', 'other'
  ] as const).optional(),
  status: z.enum([
    'pending', 'processing', 'paid', 'failed', 'cancelled'
  ] as const).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const createBillSchema = z.object({
  category: z.enum([
    'electricity', 'water', 'gas', 'internet',
    'phone', 'cable', 'insurance', 'subscription', 'other'
  ] as const),
  provider: z.string().min(1),
  accountNumber: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  dueDate: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Get user's bills
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const bills = await billsService.getUserBills(auth.userId, {
      category: query.category as BillCategory,
      status: query.status as BillStatus,
      limit: query.limit || 50,
    });

    return success({
      bills,
      total: bills.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to fetch bills');
  }
}

/**
 * Create a new bill
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, createBillSchema);

    const bill = await billsService.createBill({
      userId: auth.userId,
      projectId: auth.projectId,
      ...body,
    } as any);

    return success({ bill }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create bill');
  }
}
