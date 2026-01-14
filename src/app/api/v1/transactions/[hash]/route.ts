/**
 * Single Transaction Endpoint
 * GET /api/v1/transactions/[hash] - Get transaction details and status
 */

import { NextRequest } from 'next/server';
import { createThirdwebClient } from 'thirdweb';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getChain } from '@/config/chains';
import { env } from '@/config/env';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'TransactionDetails' });

interface RouteParams {
  params: Promise<{ hash: string }>;
}

/**
 * Get transaction details and on-chain status
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await requireAuth(req);
    const { hash } = await params;

    const { searchParams } = new URL(req.url);
    const chainId = parseInt(searchParams.get('chainId') || '1');

    const supabase = getSupabaseAdmin() as any;

    // Try to get from our database first
    const { data: dbTransaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('hash', hash.toLowerCase())
      .eq('user_id', auth.userId)
      .single();

    // Get on-chain data
    const chain = getChain(chainId);
    if (!chain) {
      return errors.badRequest(`Unsupported chain: ${chainId}`);
    }

    const client = createThirdwebClient({
      clientId: env.THIRDWEB_CLIENT_ID,
      secretKey: env.THIRDWEB_SECRET_KEY,
    });

    // Fetch transaction receipt from chain
    let onChainData = null;
    let status = 'pending';

    try {
      const response = await fetch(chain.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [hash],
        }),
      });

      const result = await response.json();

      if (result.result) {
        const receipt = result.result;
        onChainData = {
          blockNumber: parseInt(receipt.blockNumber, 16),
          blockHash: receipt.blockHash,
          transactionIndex: parseInt(receipt.transactionIndex, 16),
          gasUsed: parseInt(receipt.gasUsed, 16).toString(),
          effectiveGasPrice: receipt.effectiveGasPrice
            ? parseInt(receipt.effectiveGasPrice, 16).toString()
            : null,
          status: receipt.status === '0x1' ? 'success' : 'failed',
          logs: receipt.logs?.length || 0,
        };
        status = receipt.status === '0x1' ? 'confirmed' : 'failed';

        // Update database if we have a record
        if (dbTransaction && dbTransaction.status !== status) {
          await supabase
            .from('transactions')
            .update({
              status,
              block_number: onChainData.blockNumber,
              gas_used: onChainData.gasUsed,
              gas_price: onChainData.effectiveGasPrice,
              updated_at: new Date().toISOString(),
            })
            .eq('id', dbTransaction.id);
        }
      }

      // If no receipt, try to get pending transaction
      if (!result.result) {
        const txResponse = await fetch(chain.rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionByHash',
            params: [hash],
          }),
        });

        const txResult = await txResponse.json();

        if (txResult.result) {
          onChainData = {
            from: txResult.result.from,
            to: txResult.result.to,
            value: parseInt(txResult.result.value, 16).toString(),
            gasLimit: parseInt(txResult.result.gas, 16).toString(),
            gasPrice: txResult.result.gasPrice
              ? parseInt(txResult.result.gasPrice, 16).toString()
              : null,
            nonce: parseInt(txResult.result.nonce, 16),
            input: txResult.result.input,
            status: 'pending',
          };
          status = 'pending';
        } else {
          status = 'not_found';
        }
      }
    } catch (error) {
      log.warn('Failed to fetch on-chain data', { error: (error as Error).message });
    }

    // Combine database and on-chain data
    const transaction = {
      hash,
      chainId,
      status,
      ...(dbTransaction && {
        id: dbTransaction.id,
        type: dbTransaction.type,
        from: dbTransaction.from_address,
        to: dbTransaction.to_address,
        value: dbTransaction.value,
        metadata: dbTransaction.metadata,
        createdAt: dbTransaction.created_at,
      }),
      onChain: onChainData,
    };

    // Get block timestamp if confirmed
    if (onChainData?.blockNumber) {
      try {
        const blockResponse = await fetch(chain.rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBlockByNumber',
            params: [`0x${onChainData.blockNumber.toString(16)}`, false],
          }),
        });

        const blockResult = await blockResponse.json();
        if (blockResult.result?.timestamp) {
          transaction.onChain.timestamp = new Date(
            parseInt(blockResult.result.timestamp, 16) * 1000
          ).toISOString();
        }
      } catch {
        // Continue without timestamp
      }
    }

    return success({ transaction });
  } catch (error) {
    if (error instanceof Response) return error;
    log.error('Failed to get transaction', error as Error);
    return errors.internal('Failed to get transaction details');
  }
}
