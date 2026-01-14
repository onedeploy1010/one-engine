/**
 * Webhook Deliveries Endpoint
 * GET /api/v1/webhooks/:webhookId/deliveries - Get webhook delivery history
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { webhookService } from '@/services/webhook/webhook.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateQuery } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ webhookId: string }>;
}

const querySchema = z.object({
  status: z.enum(['pending', 'success', 'failed']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * Get webhook delivery history
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { webhookId } = await params;

    if (!auth.projectId) {
      return errors.badRequest('Project context required');
    }

    const webhook = await webhookService.getWebhook(webhookId);

    if (!webhook) {
      return errors.notFound('Webhook not found');
    }

    if (webhook.projectId !== auth.projectId) {
      return errors.forbidden('Not authorized to view this webhook');
    }

    const query = validateQuery(req, querySchema);

    const deliveries = await webhookService.getDeliveries(webhookId, {
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });

    return success({
      deliveries,
      total: deliveries.length,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch deliveries');
  }
}
