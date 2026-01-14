/**
 * Error Handler Middleware for ONE Engine
 * Centralized error handling and formatting
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { LogService } from '@/lib/logger';
import { error, ErrorCodes } from '@/lib/response';

const logger = new LogService({ service: 'ErrorHandler' });

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = ErrorCodes.INTERNAL_ERROR,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(message, 400, ErrorCodes.VALIDATION_ERROR, details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(message, 401, ErrorCodes.UNAUTHORIZED);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(message, 403, ErrorCodes.FORBIDDEN);
  }

  static notFound(resource = 'Resource'): ApiError {
    return new ApiError(`${resource} not found`, 404, ErrorCodes.NOT_FOUND);
  }

  static conflict(message: string): ApiError {
    return new ApiError(message, 409, ErrorCodes.CONFLICT);
  }

  static tooManyRequests(message = 'Too many requests'): ApiError {
    return new ApiError(message, 429, ErrorCodes.RATE_LIMITED);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(message, 500, ErrorCodes.INTERNAL_ERROR);
  }

  static chainNotSupported(chainId: number): ApiError {
    return new ApiError(
      `Chain ${chainId} is not supported`,
      400,
      ErrorCodes.CHAIN_NOT_SUPPORTED
    );
  }

  static insufficientBalance(message = 'Insufficient balance'): ApiError {
    return new ApiError(message, 400, ErrorCodes.INSUFFICIENT_BALANCE);
  }

  static transactionFailed(message: string, details?: unknown): ApiError {
    return new ApiError(message, 500, ErrorCodes.TRANSACTION_FAILED, details);
  }
}

/**
 * Handle errors and return appropriate response
 */
export function handleError(err: unknown): NextResponse {
  // Already a NextResponse (from our error helpers)
  if (err instanceof NextResponse) {
    return err;
  }

  // Our custom API error
  if (err instanceof ApiError) {
    logger.error(`API Error: ${err.message}`, undefined, {
      code: err.errorCode,
      statusCode: err.statusCode,
      details: err.details,
    });

    return error(
      err.errorCode as any,
      err.message,
      err.statusCode,
      err.details
    );
  }

  // Zod validation error
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    logger.warn('Validation error', { details });

    return error(ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400, details);
  }

  // Standard Error
  if (err instanceof Error) {
    // Log the full error for debugging
    logger.error(`Unhandled error: ${err.message}`, err, {
      stack: err.stack,
    });

    // Check for specific error types
    if (err.message.includes('unauthorized') || err.message.includes('Unauthorized')) {
      return error(ErrorCodes.UNAUTHORIZED, 'Unauthorized', 401);
    }

    if (err.message.includes('not found') || err.message.includes('Not found')) {
      return error(ErrorCodes.NOT_FOUND, err.message, 404);
    }

    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      return error(ErrorCodes.ALREADY_EXISTS, err.message, 409);
    }

    // Generic server error - don't expose internal details
    return error(
      ErrorCodes.INTERNAL_ERROR,
      process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      500
    );
  }

  // Unknown error type
  logger.error('Unknown error type', undefined, { error: String(err) });

  return error(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred', 500);
}

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      return handleError(err);
    }
  }) as T;
}

/**
 * Type-safe try-catch wrapper for async operations
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      errorMessage || (err instanceof Error ? err.message : 'Operation failed'),
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}
