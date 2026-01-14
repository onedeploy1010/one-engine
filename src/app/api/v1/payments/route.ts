/**
 * Payments Endpoints
 * GET /api/v1/payments - Get user's payments
 * POST /api/v1/payments - Create a payment request
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { paymentService } from '@/services/payments/payment.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody, validateQuery } from '@/middleware/validation';

const querySchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'expired', 'refunded']).optional(),
  type: z.enum(['qr', 'x402', 'invoice', 'recurring']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const createPaymentSchema = z.object({
  type: z.enum(['qr', 'x402', 'invoice', 'recurring']).default('qr'),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  tokenAddress: z.string().optional(),
  chainId: z.number().int().positive().default(1),
  description: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  // X402 specific
  resource: z.string().url().optional(),
  // Recurring specific
  interval: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  intervalCount: z.number().int().positive().optional(),
});

/**
 * Get user's payments
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const query = validateQuery(req, querySchema);

    const payments = await paymentService.getUserPayments(auth.userId, {
      status: query.status,
      type: query.type,
      limit: query.limit,
      offset: query.offset,
    });

    return success({
      payments,
      total: payments.length,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to fetch payments');
  }
}

/**
 * Create a payment request
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await validateBody(req, createPaymentSchema);

    let payment;

    if (body.type === 'qr') {
      payment = await paymentService.createQRPayment({
        userId: auth.userId,
        projectId: auth.projectId,
        amount: body.amount,
        currency: body.currency,
        tokenAddress: body.tokenAddress,
        chainId: body.chainId,
        description: body.description,
        expiresAt: body.expiresAt,
        metadata: body.metadata,
      });
    } else if (body.type === 'x402') {
      if (!body.resource) {
        return errors.badRequest('Resource URL is required for X402 payments');
      }
      payment = await paymentService.createX402Payment({
        userId: auth.userId,
        projectId: auth.projectId,
        amount: body.amount,
        currency: body.currency,
        tokenAddress: body.tokenAddress,
        chainId: body.chainId,
        resource: body.resource,
        description: body.description,
        metadata: body.metadata,
      });
    } else {
      payment = await paymentService.createQRPayment({
        userId: auth.userId,
        projectId: auth.projectId,
        amount: body.amount,
        currency: body.currency,
        tokenAddress: body.tokenAddress,
        chainId: body.chainId,
        description: body.description,
        metadata: body.metadata,
      });
    }

    return success({ payment }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create payment');
  }
}
