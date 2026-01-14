/**
 * Date Utilities for ONE Engine
 */

import { format, formatDistance, parseISO, addDays, subDays, startOfDay, endOfDay, isAfter, isBefore, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';

/**
 * Format date to ISO string
 */
export function toIsoString(date: Date | string | number): string {
  return new Date(date).toISOString();
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string, formatStr: string = 'yyyy-MM-dd'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(d, new Date(), { addSuffix: true });
}

/**
 * Get current timestamp in seconds
 */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current timestamp in milliseconds
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * Check if date is expired
 */
export function isExpired(expiresAt: Date | string): boolean {
  const d = typeof expiresAt === 'string' ? parseISO(expiresAt) : expiresAt;
  return isBefore(d, new Date());
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isAfter(d, new Date());
}

/**
 * Add days to date
 */
export function addDaysToDate(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return addDays(d, days);
}

/**
 * Subtract days from date
 */
export function subDaysFromDate(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return subDays(d, days);
}

/**
 * Get start of day
 */
export function getStartOfDay(date: Date | string = new Date()): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return startOfDay(d);
}

/**
 * Get end of day
 */
export function getEndOfDay(date: Date | string = new Date()): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return endOfDay(d);
}

/**
 * Get days between two dates
 */
export function getDaysBetween(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;
  return differenceInDays(endDate, startDate);
}

/**
 * Get hours between two dates
 */
export function getHoursBetween(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;
  return differenceInHours(endDate, startDate);
}

/**
 * Get minutes between two dates
 */
export function getMinutesBetween(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;
  return differenceInMinutes(endDate, startDate);
}

/**
 * Create date range for queries
 */
export function createDateRange(
  range: 'today' | '7d' | '30d' | '90d' | '1y' | 'all'
): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;

  switch (range) {
    case 'today':
      start = getStartOfDay();
      break;
    case '7d':
      start = subDays(end, 7);
      break;
    case '30d':
      start = subDays(end, 30);
      break;
    case '90d':
      start = subDays(end, 90);
      break;
    case '1y':
      start = subDays(end, 365);
      break;
    case 'all':
    default:
      start = new Date(0); // Beginning of time
  }

  return { start, end };
}

/**
 * Parse date string safely
 */
export function parseDateSafe(date: string | undefined | null): Date | null {
  if (!date) return null;
  try {
    const parsed = parseISO(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Get UTC date string (YYYY-MM-DD)
 */
export function getUtcDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate time until expiry
 */
export function getTimeUntilExpiry(expiresAt: Date | string): {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  const expiry = typeof expiresAt === 'string' ? parseISO(expiresAt) : expiresAt;
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    expired: false,
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
  };
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
