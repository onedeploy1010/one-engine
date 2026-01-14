/**
 * Request Validation Middleware for ONE Engine
 * Uses Zod for schema validation
 */

import { NextRequest } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';
import { errors, ErrorCodes, error } from '@/lib/response';

/**
 * Parse and validate JSON body against a Zod schema
 */
export async function validateBody<T extends ZodSchema>(
  req: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw error(ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400, details);
    }
    throw errors.badRequest('Invalid JSON body');
  }
}

/**
 * Parse and validate query parameters against a Zod schema
 */
export function validateQuery<T extends ZodSchema>(
  req: NextRequest,
  schema: T
): z.infer<T> {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());

  try {
    return schema.parse(searchParams);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw error(ErrorCodes.VALIDATION_ERROR, 'Invalid query parameters', 400, details);
    }
    throw errors.badRequest('Invalid query parameters');
  }
}

/**
 * Validate route parameters
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string>,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(params);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw error(ErrorCodes.VALIDATION_ERROR, 'Invalid route parameters', 400, details);
    }
    throw errors.badRequest('Invalid route parameters');
  }
}

// ============ Common Validation Schemas ============

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const chainIdSchema = z.coerce.number().int().positive();

export const uuidSchema = z.string().uuid();

export const emailSchema = z.string().email();

export const amountSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format');

// ============ Common Request Schemas ============

export const walletQuerySchema = z.object({
  chainId: chainIdSchema.optional(),
  address: addressSchema.optional(),
});

export const transactionQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  chainId: chainIdSchema.optional(),
  status: z.enum(['pending', 'confirmed', 'failed']).optional(),
  type: z.enum(['transfer', 'swap', 'contract_call', 'deploy', 'approval']).optional(),
});

export const contractCallSchema = z.object({
  contractAddress: addressSchema,
  chainId: chainIdSchema,
  method: z.string().min(1),
  args: z.array(z.unknown()).default([]),
  value: amountSchema.optional(),
  abi: z.array(z.unknown()).optional(),
});

export const swapRequestSchema = z.object({
  fromChainId: chainIdSchema,
  toChainId: chainIdSchema,
  fromToken: addressSchema,
  toToken: addressSchema,
  amount: amountSchema,
  slippage: z.number().min(0).max(50).default(0.5),
  recipient: addressSchema.optional(),
});
