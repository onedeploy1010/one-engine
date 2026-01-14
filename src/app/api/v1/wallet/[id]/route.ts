/**
 * Single Wallet Operations
 * GET /api/v1/wallet/[id] - Get wallet details
 * PUT /api/v1/wallet/[id] - Update wallet
 * DELETE /api/v1/wallet/[id] - Delete wallet
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { walletService } from '@/services/wallet/wallet.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';
import { getSupabaseAdmin } from '@/lib/supabase';

const updateWalletSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get single wallet details
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await requireAuth(req);
    const { id } = await params;

    const walletData = await walletService.getWalletById(id, auth.userId) as any;

    if (!walletData) {
      return errors.notFound('Wallet not found');
    }

    // Get balance for the wallet
    const balance = await walletService.getWalletBalance(
      walletData.smartAccountAddress || walletData.address,
      walletData.chainId
    );

    return success({
      wallet: {
        id: walletData.id,
        address: walletData.address,
        smartAccountAddress: walletData.smartAccountAddress,
        chainId: walletData.chainId,
        walletType: walletData.walletType,
        name: walletData.name,
        isDefault: walletData.isDefault,
        createdAt: walletData.createdAt,
        balance,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to get wallet');
  }
}

/**
 * Update wallet
 */
export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await requireAuth(req);
    const { id } = await params;
    const body = await validateBody(req, updateWalletSchema);

    // Verify wallet ownership
    const walletToUpdate = await walletService.getWalletById(id, auth.userId);
    if (!walletToUpdate) {
      return errors.notFound('Wallet not found');
    }

    const supabase = getSupabaseAdmin() as any;

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata;
    }

    // Update wallet
    const { data, error } = await supabase
      .from('wallets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select()
      .single();

    if (error) {
      return errors.internal('Failed to update wallet');
    }

    // Handle default wallet setting
    if (body.isDefault === true) {
      await walletService.setDefaultWallet(auth.userId, id);
    }

    return success({
      wallet: {
        id: data.id,
        address: data.address,
        smartAccountAddress: data.smart_account_address,
        chainId: data.chain_id,
        walletType: data.wallet_type,
        name: data.name,
        isDefault: data.is_default,
        updatedAt: data.updated_at,
      },
      message: 'Wallet updated successfully',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to update wallet');
  }
}

/**
 * Delete wallet
 */
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await requireAuth(req);
    const { id } = await params;

    // Verify wallet ownership
    const walletToDelete = await walletService.getWalletById(id, auth.userId) as any;
    if (!walletToDelete) {
      return errors.notFound('Wallet not found');
    }

    // Cannot delete default wallet
    if (walletToDelete.isDefault) {
      return errors.badRequest('Cannot delete default wallet. Set another wallet as default first.');
    }

    const supabase = getSupabaseAdmin() as any;

    // Soft delete by setting updated_at (soft delete)
    const { error } = await supabase
      .from('wallets')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', auth.userId);

    if (error) {
      return errors.internal('Failed to delete wallet');
    }

    return success({
      message: 'Wallet deleted successfully',
      deletedId: id,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to delete wallet');
  }
}
