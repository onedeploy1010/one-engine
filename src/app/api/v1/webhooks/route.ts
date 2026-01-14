/**
 * Webhooks Management Endpoints
 * GET /api/v1/webhooks - Get project's webhooks
 * POST /api/v1/webhooks - Create a webhook
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { webhookService, WebhookEventType } from '@/services/webhook/webhook.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody, validateQuery } from '@/middleware/validation';

const querySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
});

const eventTypes: WebhookEventType[] = [
  'user.created',
  'user.updated',
  'wallet.created',
  'transaction.pending',
  'transaction.confirmed',
  'transaction.failed',
  'payment.created',
  'payment.paid',
  'payment.failed',
  'position.opened',
  'position.closed',
  'order.filled',
  'strategy.signal',
];

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(eventTypes as [WebhookEventType, ...WebhookEventType[]])).min(1),
  secret: z.string().min(16).optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Get project's webhooks
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);

    if (!auth.projectId) {
      return errors.badRequest('Project context required');
    }

    const query = validateQuery(req, querySchema);

    const webhooks = await webhookService.getProjectWebhooks(auth.projectId, {
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
    });

    return success({
      webhooks,
      total: webhooks.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch webhooks');
  }
}

/**
 * Create a new webhook
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);

    if (!auth.projectId) {
      return errors.badRequest('Project context required');
    }

    const body = await validateBody(req, createWebhookSchema);

    const webhook = await webhookService.createWebhook({
      projectId: auth.projectId,
      url: body.url,
      events: body.events,
      secret: body.secret,
      isActive: body.isActive,
      metadata: body.metadata,
    });

    return success({ webhook }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create webhook');
  }
}
