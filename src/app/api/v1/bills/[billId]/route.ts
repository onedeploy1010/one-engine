/**
 * Bill Detail Endpoints
 * GET /api/v1/bills/:billId - Get bill details
 * POST /api/v1/bills/:billId/pay - Pay a bill
 * DELETE /api/v1/bills/:billId - Cancel a bill
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { billsService } from '@/services/bills/bills.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ billId: string }>;
}

/**
 * Get bill details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { billId } = await params;

    const bill = await billsService.getBill(billId);

    if (!bill) {
      return errors.notFound('Bill not found');
    }

    if (bill.userId !== auth.userId) {
      return errors.forbidden('Not authorized to view this bill');
    }

    return success({ bill });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch bill');
  }
}

const payBillSchema = z.object({
  txHash: z.string().min(1),
});

/**
 * Pay a bill
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { billId } = await params;
    const body = await validateBody(req, payBillSchema);

    const bill = await billsService.payBill(billId, auth.userId, body.txHash);

    return success({ bill });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to pay bill');
  }
}

/**
 * Cancel a bill
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { billId } = await params;

    const bill = await billsService.cancelBill(billId, auth.userId);

    return success({ bill });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to cancel bill');
  }
}
