/**
 * Logging utility for ONE Engine
 * Uses pino for structured, high-performance logging
 */

import
  pino from 'pino';
import { env } from '@/config/env';

const isDevelopment = env.NODE_ENV === 'development';

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'one-engine',
    version: '1.0.0',
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log service for structured logging with common patterns
 */
export class LogService {
  private log: pino.Logger;

  constructor(context: { service: string; [key: string]: unknown }) {
    this.log = logger.child(context);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log.info(data, message);
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    const errorData =
      error instanceof Error
        ? { error: error.message, stack: error.stack }
        : { error };
    this.log.error({ ...data, ...errorData }, message);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log.warn(data, message);
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log.debug(data, message);
  }

  // API request logging
  request(req: { method: string; url: string; userId?: string }, data?: Record<string, unknown>) {
    this.log.info({ ...req, ...data }, `${req.method} ${req.url}`);
  }

  // Transaction logging
  transaction(tx: { hash: string; chainId: number; from: string; to?: string }, data?: Record<string, unknown>) {
    this.log.info({ transaction: tx, ...data }, 'Transaction executed');
  }

  // Trading logging
  trade(trade: { orderId: string; symbol: string; side: string; amount: number }, data?: Record<string, unknown>) {
    this.log.info({ trade, ...data }, 'Trade executed');
  }
}

export default logger;
