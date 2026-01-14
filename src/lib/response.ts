/**
 * API Response Utilities for ONE Engine
 * Provides consistent response formatting across all endpoints
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * Standard API Response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

/**
 * Success response helper
 * @param data - The response data
 * @param statusOrMeta - HTTP status code (number) or meta object
 */
export function success<T>(
  data: T,
  statusOrMeta?: number | Partial<ApiResponse['meta']>
): NextResponse<ApiResponse<T>> {
  const status = typeof statusOrMeta === 'number' ? statusOrMeta : 200;
  const meta = typeof statusOrMeta === 'object' ? statusOrMeta : undefined;

  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status }
  );
}

/**
 * Paginated response helper
 */
export function paginated<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number }
): NextResponse<ApiResponse<T[]>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        ...pagination,
        hasMore: pagination.page * pagination.limit < pagination.total,
      },
    },
  });
}

/**
 * Error codes for the API
 */
export const ErrorCodes = {
  // Auth errors (1xxx)
  UNAUTHORIZED: 'E1001',
  INVALID_TOKEN: 'E1002',
  TOKEN_EXPIRED: 'E1003',
  FORBIDDEN: 'E1004',
  INVALID_CREDENTIALS: 'E1005',

  // Validation errors (2xxx)
  VALIDATION_ERROR: 'E2001',
  INVALID_INPUT: 'E2002',
  MISSING_FIELD: 'E2003',

  // Resource errors (3xxx)
  NOT_FOUND: 'E3001',
  ALREADY_EXISTS: 'E3002',
  CONFLICT: 'E3003',

  // Blockchain errors (4xxx)
  CHAIN_NOT_SUPPORTED: 'E4001',
  TRANSACTION_FAILED: 'E4002',
  INSUFFICIENT_BALANCE: 'E4003',
  CONTRACT_ERROR: 'E4004',
  WALLET_ERROR: 'E4005',

  // External service errors (5xxx)
  THIRDWEB_ERROR: 'E5001',
  SUPABASE_ERROR: 'E5002',
  OPENAI_ERROR: 'E5003',
  EXCHANGE_ERROR: 'E5004',
  ONRAMPER_ERROR: 'E5005',

  // Server errors (9xxx)
  INTERNAL_ERROR: 'E9001',
  SERVICE_UNAVAILABLE: 'E9002',
  RATE_LIMITED: 'E9003',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Error response helper
 */
export function error(
  code: string,
  message: string,
  status = 500,
  details?: unknown
): NextResponse<ApiResponse<never>> {
  logger.error({ code, details }, `API Error [${code}]: ${message}`);

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Common error responses
 */
export const errors = {
  unauthorized: (message = 'Authentication required') =>
    error(ErrorCodes.UNAUTHORIZED, message, 401),

  forbidden: (message = 'Access denied') =>
    error(ErrorCodes.FORBIDDEN, message, 403),

  notFound: (resource = 'Resource') =>
    error(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),

  badRequest: (message: string, details?: unknown) =>
    error(ErrorCodes.VALIDATION_ERROR, message, 400, details),

  conflict: (message: string) =>
    error(ErrorCodes.CONFLICT, message, 409),

  internal: (message = 'Internal server error') =>
    error(ErrorCodes.INTERNAL_ERROR, message, 500),

  chainNotSupported: (chainId: number) =>
    error(ErrorCodes.CHAIN_NOT_SUPPORTED, `Chain ${chainId} is not supported`, 400),

  transactionFailed: (message: string, details?: unknown) =>
    error(ErrorCodes.TRANSACTION_FAILED, message, 500, details),

  insufficientBalance: (message = 'Insufficient balance') =>
    error(ErrorCodes.INSUFFICIENT_BALANCE, message, 400),

  rateLimited: (message = 'Too many requests') =>
    error(ErrorCodes.RATE_LIMITED, message, 429),
};
