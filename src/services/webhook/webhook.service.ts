/**
 * Webhook Service for ONE Engine
 * Event notifications to external systems
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { generateWebhookSignature } from '@/utils/crypto';
import { LogService } from '@/lib/logger';
import { retryWithBackoff } from '@/utils/date';

const log = new LogService({ service: 'WebhookService' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export type WebhookEvent =
  | 'user.created'
  | 'user.updated'
  | 'wallet.created'
  | 'transaction.pending'
  | 'transaction.confirmed'
  | 'transaction.failed'
  | 'swap.completed'
  | 'payment.created'
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.settled'
  | 'position.opened'
  | 'position.closed'
  | 'order.filled'
  | 'strategy.signal'
  | 'fiat.completed';

// Alias for backward compatibility
export type WebhookEventType = WebhookEvent;

export interface Webhook {
  id: string;
  projectId: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  failureCount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEvent;
  payload: WebhookPayload;
  responseStatus?: number;
  responseBody?: string;
  deliveredAt?: string;
  createdAt: string;
}

export class WebhookService {
  /**
   * Create a webhook
   */
  async createWebhook(config: {
    projectId: string;
    url: string;
    events: WebhookEvent[];
    secret?: string;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<Webhook> {
    // Generate webhook secret if not provided
    const secret = config.secret || require('crypto').randomBytes(32).toString('hex');

    const { data, error } = await db()
      .from('webhooks')
      .insert({
        project_id: config.projectId,
        url: config.url,
        events: config.events,
        secret,
        is_active: config.isActive ?? true,
        metadata: config.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create webhook: ${error.message}`);
    }

    log.info('Webhook created', { webhookId: (data as any).id, projectId: config.projectId });

    return this.mapToWebhook(data);
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId: string): Promise<Webhook | null> {
    const { data, error } = await db()
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get webhook: ${error.message}`);
    }

    return data ? this.mapToWebhook(data) : null;
  }

  /**
   * Get webhooks for a project
   */
  async getProjectWebhooks(projectId: string, options?: { isActive?: boolean }): Promise<Webhook[]> {
    let query = db()
      .from('webhooks')
      .select('*')
      .eq('project_id', projectId);

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get webhooks: ${error.message}`);
    }

    return (data || []).map(row => this.mapToWebhook(row));
  }

  /**
   * Get webhook deliveries
   */
  async getDeliveries(
    webhookId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<WebhookDelivery[]> {
    let query = db()
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhookId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 50) - 1);

    if (error) {
      throw new Error(`Failed to get deliveries: ${error.message}`);
    }

    return (data || []).map(row => ({
      id: row.id,
      webhookId: row.webhook_id,
      eventType: row.event as WebhookEvent,
      payload: row.payload as WebhookPayload,
      responseStatus: row.status_code,
      responseBody: row.error,
      deliveredAt: row.delivered_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    updates: {
      url?: string;
      events?: WebhookEvent[];
      isActive?: boolean;
    }
  ): Promise<Webhook> {
    const updateData: Record<string, unknown> = {};
    if (updates.url) updateData.url = updates.url;
    if (updates.events) updateData.events = updates.events;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await db()
      .from('webhooks')
      .update(updateData)
      .eq('id', webhookId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update webhook: ${error.message}`);
    }

    return this.mapToWebhook(data);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const { error } = await db()
      .from('webhooks')
      .delete()
      .eq('id', webhookId);

    if (error) {
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }

    log.info('Webhook deleted', { webhookId });
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId: string): Promise<{ secret: string }> {
    const secret = require('crypto').randomBytes(32).toString('hex');

    const { error } = await db()
      .from('webhooks')
      .update({ secret })
      .eq('id', webhookId);

    if (error) {
      throw new Error(`Failed to regenerate secret: ${error.message}`);
    }

    return { secret };
  }

  /**
   * Trigger webhooks for an event
   */
  async trigger(
    projectId: string,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<void> {
    // Get active webhooks for this project and event
    const { data: webhooks, error } = await db()
      .from('webhooks')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .contains('events', [event]);

    if (error) {
      log.error('Failed to get webhooks', error);
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      return;
    }

    // Create payload
    const payload: WebhookPayload = {
      id: require('crypto').randomUUID(),
      event,
      createdAt: new Date().toISOString(),
      data,
    };

    // Deliver to each webhook (async, don't wait)
    for (const webhook of webhooks) {
      this.deliverWebhook(webhook, payload).catch((err) => {
        log.error('Webhook delivery failed', err, { webhookId: webhook.id });
      });
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(
    webhook: any,
    payload: WebhookPayload
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(payload);
    const signature = generateWebhookSignature(payloadString, webhook.secret, timestamp);

    try {
      const response = await retryWithBackoff(
        async () => {
          const res = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Id': webhook.id,
              'X-Webhook-Timestamp': timestamp.toString(),
              'X-Webhook-Signature': signature,
            },
            body: payloadString,
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          return res;
        },
        3, // Max retries
        1000 // Base delay
      );

      // Record successful delivery
      await this.recordDelivery(webhook.id, payload, response.status, 'OK');

      // Update webhook last triggered
      await db()
        .from('webhooks')
        .update({
          last_triggered_at: new Date().toISOString(),
          failure_count: 0,
        })
        .eq('id', webhook.id);

      log.info('Webhook delivered', { webhookId: webhook.id, event: payload.event });
    } catch (error) {
      // Record failed delivery
      await this.recordDelivery(
        webhook.id,
        payload,
        0,
        (error as Error).message
      );

      // Increment failure count
      const { data: updated } = await db()
        .from('webhooks')
        .update({ failure_count: webhook.failure_count + 1 })
        .eq('id', webhook.id)
        .select('failure_count')
        .single();

      // Disable webhook after 10 consecutive failures
      if (updated && updated.failure_count >= 10) {
        await db()
          .from('webhooks')
          .update({ is_active: false })
          .eq('id', webhook.id);

        log.warn('Webhook disabled due to failures', { webhookId: webhook.id });
      }

      log.error('Webhook delivery failed', error as Error, {
        webhookId: webhook.id,
        event: payload.event,
      });
    }
  }

  /**
   * Record webhook delivery attempt
   */
  private async recordDelivery(
    webhookId: string,
    payload: WebhookPayload,
    status: number,
    responseBody: string
  ): Promise<void> {
    await db().from('webhook_deliveries').insert({
      webhook_id: webhookId,
      event_type: payload.event,
      payload,
      response_status: status,
      response_body: responseBody.substring(0, 1000), // Limit response body
      delivered_at: status > 0 ? new Date().toISOString() : null,
    });
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(
    webhookId: string,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    const { data, error } = await db()
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get delivery history: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      webhookId: row.webhook_id,
      eventType: row.event_type,
      payload: row.payload,
      responseStatus: row.response_status,
      responseBody: row.response_body,
      deliveredAt: row.delivered_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    statusCode?: number;
    responseTime?: number;
    error?: string;
  }> {
    const { data: webhook } = await db()
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload: WebhookPayload = {
      id: require('crypto').randomUUID(),
      event: 'user.created' as WebhookEvent,
      createdAt: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery',
      },
    };

    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(testPayload);
    const signature = generateWebhookSignature(payloadString, (webhook as any).secret, timestamp);

    const startTime = Date.now();
    try {
      const response = await fetch((webhook as any).url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': (webhook as any).id,
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Signature': signature,
          'X-Webhook-Test': 'true',
        },
        body: payloadString,
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Map database row to Webhook type
   */
  private mapToWebhook(row: any): Webhook {
    return {
      id: row.id,
      projectId: row.project_id,
      url: row.url,
      events: row.events,
      secret: row.secret,
      isActive: row.is_active,
      lastTriggeredAt: row.last_triggered_at,
      failureCount: row.failure_count,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const webhookService = new WebhookService();
