/**
 * Webhook Detail Endpoints
 * GET /api/v1/webhooks/:webhookId - Get webhook details
 * PATCH /api/v1/webhooks/:webhookId - Update webhook
 * DELETE /api/v1/webhooks/:webhookId - Delete webhook
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { webhookService, WebhookEventType } from '@/services/webhook/webhook.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ webhookId: string }>;
}

/**
 * Get webhook details
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

    return success({ webhook });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch webhook');
  }
}

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

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(eventTypes as [WebhookEventType, ...WebhookEventType[]])).min(1).optional(),
  secret: z.string().min(16).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Update a webhook
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { webhookId } = await params;

    if (!auth.projectId) {
      return errors.badRequest('Project context required');
    }

    const body = await validateBody(req, updateWebhookSchema);

    const existingWebhook = await webhookService.getWebhook(webhookId);

    if (!existingWebhook) {
      return errors.notFound('Webhook not found');
    }

    if (existingWebhook.projectId !== auth.projectId) {
      return errors.forbidden('Not authorized to update this webhook');
    }

    const webhook = await webhookService.updateWebhook(webhookId, body);

    return success({ webhook });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to update webhook');
  }
}

/**
 * Delete a webhook
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { webhookId } = await params;

    if (!auth.projectId) {
      return errors.badRequest('Project context required');
    }

    const existingWebhook = await webhookService.getWebhook(webhookId);

    if (!existingWebhook) {
      return errors.notFound('Webhook not found');
    }

    if (existingWebhook.projectId !== auth.projectId) {
      return errors.forbidden('Not authorized to delete this webhook');
    }

    await webhookService.deleteWebhook(webhookId);

    return success({ deleted: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to delete webhook');
  }
}
