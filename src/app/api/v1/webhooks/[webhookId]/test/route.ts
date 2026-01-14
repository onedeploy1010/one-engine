/**
 * Webhook Test Endpoint
 * POST /api/v1/webhooks/:webhookId/test - Send a test webhook
 */

import { NextRequest } from 'next/server';
import { webhookService } from '@/services/webhook/webhook.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';

interface RouteParams {
  params: Promise<{ webhookId: string }>;
}

/**
 * Send a test webhook
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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
      return errors.forbidden('Not authorized to test this webhook');
    }

    const result = await webhookService.testWebhook(webhookId);

    return success({
      success: result.success,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      error: result.error,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to test webhook');
  }
}
