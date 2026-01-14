/**
 * Payment Service for ONE Engine
 * QR payments and X402 protocol support
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import type { Payment, PaymentType, PaymentStatus } from '@/types';

const log = new LogService({ service: 'PaymentService' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export interface CreatePaymentParams {
  projectId?: string;
  merchantId?: string;
  userId: string;
  recipientId?: string;
  type: PaymentType;
  amount: string | number;
  currency: string;
  chainId: number;
  tokenAddress?: string;
  toAddress?: string;
  description?: string;
  resource?: string; // For X402 payments
  metadata?: Record<string, unknown>;
  expiresIn?: number; // seconds
  expiresAt?: string;
}

export interface CreateQRPaymentParams {
  userId: string;
  projectId?: string;
  amount: number;
  currency: string;
  tokenAddress?: string;
  chainId: number;
  description?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateX402PaymentParams {
  userId: string;
  projectId?: string;
  amount: number;
  currency: string;
  tokenAddress?: string;
  chainId: number;
  resource: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface X402PaymentRequest {
  paymentId: string;
  amount: string;
  currency: string;
  chainId: number;
  recipient: string;
  memo?: string;
  expiresAt: string;
}

export class PaymentService {
  /**
   * Create a new payment request
   */
  async createPayment(params: CreatePaymentParams): Promise<Payment> {
    log.info('Creating payment', {
      projectId: params.projectId,
      userId: params.userId,
      type: params.type,
      amount: params.amount,
    });

    const expiresAt = params.expiresAt
      ? new Date(params.expiresAt)
      : params.expiresIn
        ? new Date(Date.now() + params.expiresIn * 1000)
        : new Date(Date.now() + 30 * 60 * 1000); // 30 min default

    const insertData = {
      project_id: params.projectId,
      merchant_id: params.merchantId,
      user_id: params.userId,
      recipient_id: params.recipientId,
      payment_type: params.type,
      status: 'pending',
      amount: String(params.amount),
      currency: params.currency.toUpperCase(),
      chain_id: params.chainId,
      token_address: params.tokenAddress,
      to_address: params.toAddress,
      description: params.description,
      resource: params.resource,
      expires_at: expiresAt.toISOString(),
      metadata: params.metadata || {},
    };

    const { data, error } = await db()
      .from('payments')
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      log.error('Failed to create payment', error);
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    const payment = this.mapToPayment(data);

    // Generate QR code data if QR payment
    if (params.type === 'qr') {
      await this.generateQRCode(payment);
    }

    return payment;
  }

  /**
   * Create QR payment
   */
  async createQRPayment(params: CreateQRPaymentParams): Promise<Payment> {
    return this.createPayment({
      ...params,
      type: 'qr',
      amount: params.amount,
    });
  }

  /**
   * Create X402 payment
   */
  async createX402Payment(params: CreateX402PaymentParams): Promise<Payment> {
    return this.createPayment({
      ...params,
      type: 'x402',
      amount: params.amount,
    });
  }

  /**
   * Get user's payments
   */
  async getUserPayments(
    userId: string,
    options?: {
      status?: string;
      type?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Payment[]> {
    let query = db()
      .from('payments')
      .select('*')
      .or(`user_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.type) {
      query = query.eq('payment_type', options.type);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }

    return (data || []).map(row => this.mapToPayment(row));
  }

  /**
   * Verify payment transaction
   */
  async verifyPayment(
    paymentId: string,
    txHash: string,
    chainId: number
  ): Promise<Payment> {
    log.info('Verifying payment', { paymentId, txHash, chainId });

    // Get the payment first
    const payment = await this.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'pending') {
      throw new Error(`Payment is already ${payment.status}`);
    }

    // Verify the transaction on-chain (simplified - in production, verify on blockchain)
    // For now, just update the payment status
    const { data, error } = await db()
      .from('payments')
      .update({
        status: 'paid',
        tx_hash: txHash,
        paid_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to verify payment: ${error.message}`);
    }

    return this.mapToPayment(data);
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(paymentId: string): Promise<Payment> {
    log.info('Cancelling payment', { paymentId });

    const { data, error } = await db()
      .from('payments')
      .update({
        status: 'failed',
      })
      .eq('id', paymentId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel payment: ${error.message}`);
    }

    return this.mapToPayment(data);
  }

  /**
   * Generate X402 payment request
   */
  async createX402Request(params: CreatePaymentParams): Promise<X402PaymentRequest> {
    const payment = await this.createPayment({
      ...params,
      type: 'x402',
    });

    return {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      chainId: payment.chainId,
      recipient: payment.toAddress,
      memo: params.description,
      expiresAt: new Date(Date.now() + (params.expiresIn || 1800) * 1000).toISOString(),
    };
  }

  /**
   * Process payment confirmation
   */
  async confirmPayment(
    paymentId: string,
    txHash: string,
    fromAddress: string
  ): Promise<Payment> {
    log.info('Confirming payment', { paymentId, txHash });

    const { data, error } = await db()
      .from('payments')
      .update({
        status: 'paid',
        tx_hash: txHash,
        from_address: fromAddress,
        paid_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to confirm payment: ${error.message}`);
    }

    return this.mapToPayment(data);
  }

  /**
   * Settle payment (after blockchain confirmation)
   */
  async settlePayment(paymentId: string): Promise<Payment> {
    log.info('Settling payment', { paymentId });

    const { data, error } = await db()
      .from('payments')
      .update({
        status: 'settled',
        settled_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to settle payment: ${error.message}`);
    }

    return this.mapToPayment(data);
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<Payment | null> {
    const { data, error } = await db()
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get payment: ${error.message}`);
    }

    return data ? this.mapToPayment(data) : null;
  }

  /**
   * Get payments for a project
   */
  async getProjectPayments(
    projectId: string,
    filters?: {
      status?: PaymentStatus;
      type?: PaymentType;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ payments: Payment[]; total: number }> {
    let query = db()
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.type) {
      query = query.eq('payment_type', filters.type);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }

    return {
      payments: data.map(row => this.mapToPayment(row)),
      total: count || 0,
    };
  }

  /**
   * Get merchant payments
   */
  async getMerchantPayments(
    merchantId: string,
    filters?: {
      status?: PaymentStatus;
      limit?: number;
    }
  ): Promise<Payment[]> {
    let query = db()
      .from('payments')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }

    return data.map(row => this.mapToPayment(row));
  }

  /**
   * Cancel expired payments
   */
  async cancelExpiredPayments(): Promise<number> {
    const { data, error } = await db()
      .from('payments')
      .update({ status: 'failed' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      log.error('Failed to cancel expired payments', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Generate QR code for payment
   */
  private async generateQRCode(payment: Payment): Promise<void> {
    // Generate EIP-681 style payment URI
    const paymentUri = this.buildPaymentUri(payment);

    // In production, generate actual QR code image
    // For now, store the URI
    await db()
      .from('payments')
      .update({ qr_code: paymentUri })
      .eq('id', payment.id);
  }

  /**
   * Build EIP-681 payment URI
   */
  private buildPaymentUri(payment: Payment): string {
    // ethereum:0xAddress@chainId?value=amount
    const chainIdPart = payment.chainId !== 1 ? `@${payment.chainId}` : '';
    return `ethereum:${payment.toAddress}${chainIdPart}?value=${payment.amount}`;
  }

  /**
   * Map database row to Payment
   */
  private mapToPayment(row: any): Payment {
    return {
      id: row.id,
      projectId: row.project_id,
      merchantId: row.merchant_id,
      userId: row.user_id,
      recipientId: row.recipient_id,
      type: row.payment_type,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      chainId: row.chain_id,
      tokenAddress: row.token_address,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      txHash: row.tx_hash,
      description: row.description,
      resource: row.resource,
      qrCode: row.qr_code,
      expiresAt: row.expires_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      settledAt: row.settled_at,
    };
  }
}

export const paymentService = new PaymentService();
