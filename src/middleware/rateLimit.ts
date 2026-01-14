/**
 * Rate Limiting Middleware for ONE Engine
 * Protects API endpoints from abuse
 */

import { NextRequest } from 'next/server';
import { errors } from '@/lib/response';
import { LogService } from '@/lib/logger';

const logger = new LogService({ service: 'RateLimit' });

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: NextRequest) => string;
}

// Default rate limit configurations by endpoint type
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { windowMs: 60000, maxRequests: 100 }, // 100 req/min
  auth: { windowMs: 60000, maxRequests: 10 }, // 10 req/min for auth
  otp: { windowMs: 60000, maxRequests: 5 }, // 5 OTP requests/min
  swap: { windowMs: 60000, maxRequests: 30 }, // 30 swap quotes/min
  deploy: { windowMs: 3600000, maxRequests: 10 }, // 10 deploys/hour
  trading: { windowMs: 1000, maxRequests: 10 }, // 10 trades/second
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  req: NextRequest,
  limitType: keyof typeof RATE_LIMITS = 'default'
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const config = RATE_LIMITS[limitType] || RATE_LIMITS.default;
  const key = generateRateLimitKey(req, limitType);
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  if (!allowed) {
    logger.warn('Rate limit exceeded', {
      key,
      limitType,
      count: entry.count,
      max: config.maxRequests,
    });
  }

  return { allowed, remaining, resetAt: entry.resetAt };
}

/**
 * Rate limit middleware wrapper
 */
export async function withRateLimit(
  req: NextRequest,
  limitType: keyof typeof RATE_LIMITS = 'default'
): Promise<void> {
  const { allowed, remaining, resetAt } = await checkRateLimit(req, limitType);

  if (!allowed) {
    throw errors.rateLimited(
      `Rate limit exceeded. Try again in ${Math.ceil((resetAt - Date.now()) / 1000)} seconds`
    );
  }
}

/**
 * Generate rate limit key from request
 */
function generateRateLimitKey(req: NextRequest, limitType: string): string {
  // Try to get user ID from auth header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Use a hash of the token as part of the key
    const tokenHash = hashString(authHeader.substring(7));
    return `rate:${limitType}:user:${tokenHash}`;
  }

  // Fall back to IP address
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
             req.headers.get('x-real-ip') ||
             'unknown';
  return `rate:${limitType}:ip:${ip}`;
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  let cleaned = 0;

  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  });

  if (cleaned > 0) {
    logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
  }
}

// Run cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 60000);
}
