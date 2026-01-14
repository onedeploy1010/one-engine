/**
 * Cryptographic Utilities for ONE Engine
 */

import crypto from 'crypto';
import { env } from '@/config/env';

/**
 * Generate a secure random string
 */
export function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Generate Client ID (public identifier for project)
 * Format: one_pk_[48 hex chars]
 */
export function generateClientId(): string {
  return `one_pk_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Generate Publishable API Key (for frontend/client-side)
 * Format: one_pk_[64 hex chars]
 */
export function generatePublishableKey(): string {
  return `one_pk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Generate Secret API Key (for backend/server-side)
 * Format: one_sk_[64 hex chars]
 */
export function generateSecretKey(): string {
  return `one_sk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Generate API key (legacy - maps to publishable key)
 * @deprecated Use generatePublishableKey() or generateSecretKey() instead
 */
export function generateApiKey(): string {
  return generatePublishableKey();
}

/**
 * Generate API secret (legacy - maps to secret key)
 * @deprecated Use generateSecretKey() instead
 */
export function generateApiSecret(): string {
  return generateSecretKey();
}

/**
 * Get key type from key string
 */
export function getKeyType(key: string): 'publishable' | 'secret' | 'unknown' {
  if (key.startsWith('one_pk_')) return 'publishable';
  if (key.startsWith('one_sk_')) return 'secret';
  return 'unknown';
}

/**
 * Get key prefix (first 15 characters) for display
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 15) + '...';
}

/**
 * Generate referral code
 */
export function generateReferralCode(prefix: string = 'ONE'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix;
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Hash a string using SHA256
 */
export function hashSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash a string using SHA512
 */
export function hashSha512(data: string): string {
  return crypto.createHash('sha512').update(data).digest('hex');
}

/**
 * Create HMAC signature
 */
export function createHmac(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHmac(data: string, signature: string, secret: string): boolean {
  const expected = createHmac(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(plaintext: string, key?: string): string {
  const encryptionKey = key || env.JWT_SECRET;
  const keyBuffer = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(ciphertext: string, key?: string): string {
  const encryptionKey = key || env.JWT_SECRET;
  const keyBuffer = crypto.scryptSync(encryptionKey, 'salt', 32);

  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate OTP code
 */
export function generateOtp(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return otp;
}

/**
 * Hash password using bcrypt-like algorithm (simplified)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify password hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
}

/**
 * Generate webhook signature
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signaturePayload = `${timestamp}.${payload}`;
  return createHmac(signaturePayload, secret);
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: number,
  tolerance: number = 300 // 5 minutes
): boolean {
  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return false;
  }

  const expectedSignature = generateWebhookSignature(payload, secret, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
