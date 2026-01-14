/**
 * Bills Service for ONE Engine
 * Bill payment and utility management
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import { webhookService } from '@/services/webhook/webhook.service';

const log = new LogService({ service: 'BillsService' });

// Helper to bypass strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

export type BillCategory =
  | 'electricity'
  | 'water'
  | 'gas'
  | 'internet'
  | 'phone'
  | 'cable'
  | 'insurance'
  | 'subscription'
  | 'other';

export type BillStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

export interface Bill {
  id: string;
  userId: string;
  projectId?: string;
  category: BillCategory;
  provider: string;
  accountNumber: string;
  amount: number;
  currency: string;
  dueDate?: string;
  status: BillStatus;
  txHash?: string;
  paidAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateBillInput {
  userId: string;
  projectId?: string;
  category: BillCategory;
  provider: string;
  accountNumber: string;
  amount: number;
  currency: string;
  dueDate?: string;
  metadata?: Record<string, unknown>;
}

export class BillsService {

  /**
   * Create a bill payment request
   */
  async createBill(input: CreateBillInput): Promise<Bill> {
    log.info('Creating bill', {
      userId: input.userId,
      category: input.category,
      provider: input.provider,
    });

    // In production, this table would need to be created
    const insertData = {
      user_id: input.userId,
      project_id: input.projectId,
      category: input.category,
      provider: input.provider,
      account_number: input.accountNumber,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      due_date: input.dueDate,
      status: 'pending',
      metadata: input.metadata || {},
    };

    const { data, error } = await db()
      .from('bills')
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      log.error('Failed to create bill', error);
      throw new Error(`Failed to create bill: ${error.message}`);
    }

    return this.mapToBill(data);
  }

  /**
   * Get bill by ID
   */
  async getBill(billId: string): Promise<Bill | null> {
    const { data, error } = await db()
      .from('bills')
      .select('*')
      .eq('id', billId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get bill: ${error.message}`);
    }

    return data ? this.mapToBill(data) : null;
  }

  /**
   * Get user's bills
   */
  async getUserBills(
    userId: string,
    filters?: {
      category?: BillCategory;
      status?: BillStatus;
      limit?: number;
    }
  ): Promise<Bill[]> {
    let query = db()
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get bills: ${error.message}`);
    }

    return data.map(row => this.mapToBill(row));
  }

  /**
   * Pay a bill
   */
  async payBill(
    billId: string,
    userId: string,
    txHash: string
  ): Promise<Bill> {
    const bill = await this.getBill(billId);

    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (bill.status !== 'pending') {
      throw new Error(`Bill is already ${bill.status}`);
    }

    log.info('Processing bill payment', { billId, txHash });

    const { data, error } = await db()
      .from('bills')
      .update({
        status: 'processing',
        tx_hash: txHash,
      } as any)
      .eq('id', billId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update bill: ${error.message}`);
    }

    // In production, verify transaction and update to 'paid'
    // For now, we'll simulate instant confirmation
    setTimeout(async () => {
      await this.confirmBillPayment(billId);
    }, 5000);

    return this.mapToBill(data);
  }

  /**
   * Confirm bill payment (called after tx confirmation)
   */
  async confirmBillPayment(billId: string): Promise<Bill> {
    const { data, error } = await db()
      .from('bills')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      } as any)
      .eq('id', billId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to confirm bill: ${error.message}`);
    }

    log.info('Bill payment confirmed', { billId });

    const billData = data as { project_id?: string; amount: number; currency: string };

    // Trigger webhook
    if (billData.project_id) {
      await webhookService.trigger(billData.project_id, 'payment.paid', {
        type: 'bill',
        billId,
        amount: billData.amount,
        currency: billData.currency,
      });
    }

    return this.mapToBill(data);
  }

  /**
   * Cancel a bill
   */
  async cancelBill(billId: string, userId: string): Promise<Bill> {
    const bill = await this.getBill(billId);

    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (bill.status !== 'pending') {
      throw new Error('Can only cancel pending bills');
    }

    const { data, error } = await db()
      .from('bills')
      .update({ status: 'cancelled' } as any)
      .eq('id', billId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel bill: ${error.message}`);
    }

    return this.mapToBill(data);
  }

  /**
   * Get supported bill providers
   */
  async getProviders(category?: BillCategory): Promise<Array<{
    id: string;
    name: string;
    category: BillCategory;
    countries: string[];
    logoUrl?: string;
  }>> {
    // In production, fetch from database or external API
    const providers = [
      { id: 'pge', name: 'PG&E', category: 'electricity' as BillCategory, countries: ['US'] },
      { id: 'edison', name: 'Southern California Edison', category: 'electricity' as BillCategory, countries: ['US'] },
      { id: 'comcast', name: 'Comcast Xfinity', category: 'internet' as BillCategory, countries: ['US'] },
      { id: 'att', name: 'AT&T', category: 'phone' as BillCategory, countries: ['US'] },
      { id: 'verizon', name: 'Verizon', category: 'phone' as BillCategory, countries: ['US'] },
      { id: 'netflix', name: 'Netflix', category: 'subscription' as BillCategory, countries: ['US', 'CA', 'UK'] },
      { id: 'spotify', name: 'Spotify', category: 'subscription' as BillCategory, countries: ['US', 'CA', 'UK'] },
    ];

    if (category) {
      return providers.filter(p => p.category === category);
    }

    return providers;
  }

  /**
   * Get bill categories
   */
  getCategories(): Array<{ id: BillCategory; name: string; icon: string }> {
    return [
      { id: 'electricity', name: 'Electricity', icon: 'bolt' },
      { id: 'water', name: 'Water', icon: 'water' },
      { id: 'gas', name: 'Gas', icon: 'flame' },
      { id: 'internet', name: 'Internet', icon: 'wifi' },
      { id: 'phone', name: 'Phone', icon: 'phone' },
      { id: 'cable', name: 'Cable TV', icon: 'tv' },
      { id: 'insurance', name: 'Insurance', icon: 'shield' },
      { id: 'subscription', name: 'Subscriptions', icon: 'repeat' },
      { id: 'other', name: 'Other', icon: 'receipt' },
    ];
  }

  /**
   * Map database row to Bill
   */
  private mapToBill(row: any): Bill {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      category: row.category,
      provider: row.provider,
      accountNumber: row.account_number,
      amount: row.amount,
      currency: row.currency,
      dueDate: row.due_date,
      status: row.status,
      txHash: row.tx_hash,
      paidAt: row.paid_at,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}

export const billsService = new BillsService();
