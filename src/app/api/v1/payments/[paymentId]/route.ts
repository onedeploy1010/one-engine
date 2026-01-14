/**
 * Payment Detail Endpoints
 * GET /api/v1/payments/:paymentId - Get payment details
 * POST /api/v1/payments/:paymentId/verify - Verify payment
 * DELETE /api/v1/payments/:paymentId - Cancel payment
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { paymentService } from '@/services/payments/payment.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ paymentId: string }>;
}

/**
 * Get payment details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { paymentId } = await params;

    const payment = await paymentService.getPayment(paymentId);

    if (!payment) {
      return errors.notFound('Payment not found');
    }

    // Check authorization
    if (payment.userId !== auth.userId && payment.recipientId !== auth.userId) {
      return errors.forbidden('Not authorized to view this payment');
    }

    return success({ payment });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch payment');
  }
}

const verifyPaymentSchema = z.object({
  txHash: z.string().min(1),
  chainId: z.number().int().positive(),
});

/**
 * Verify a payment transaction
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { paymentId } = await params;
    const body = await validateBody(req, verifyPaymentSchema);

    const payment = await paymentService.verifyPayment(
      paymentId,
      body.txHash,
      body.chainId
    );

    return success({ payment });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to verify payment');
  }
}

/**
 * Cancel a payment
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { paymentId } = await params;

    const payment = await paymentService.getPayment(paymentId);

    if (!payment) {
      return errors.notFound('Payment not found');
    }

    if (payment.userId !== auth.userId) {
      return errors.forbidden('Not authorized to cancel this payment');
    }

    if (payment.status !== 'pending') {
      return errors.badRequest('Can only cancel pending payments');
    }

    const cancelled = await paymentService.cancelPayment(paymentId);

    return success({ payment: cancelled });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to cancel payment');
  }
}
