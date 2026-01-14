/**
 * Validation Utils Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  isValidAddress,
  isValidTxHash,
  isValidUUID,
  isValidChainId,
  sanitizeString,
  isValidUrl,
} from '@/utils/validation';

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should return true for valid phone numbers', () => {
      expect(isValidPhone('+1234567890')).toBe(true);
      expect(isValidPhone('+12345678901234')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone('1234567890')).toBe(false);
      expect(isValidPhone('+123')).toBe(false);
      expect(isValidPhone('+abc123')).toBe(false);
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid Ethereum addresses', () => {
      expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
      expect(isValidAddress('0xABCDEF1234567890abcdef1234567890ABCDEF12')).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress('0x123')).toBe(false);
      expect(isValidAddress('1234567890123456789012345678901234567890')).toBe(false);
      expect(isValidAddress('0xGHIJKL1234567890123456789012345678901234')).toBe(false);
    });
  });

  describe('isValidTxHash', () => {
    it('should return true for valid transaction hashes', () => {
      expect(isValidTxHash('0x' + 'a'.repeat(64))).toBe(true);
      expect(isValidTxHash('0x' + '1234567890abcdef'.repeat(4))).toBe(true);
    });

    it('should return false for invalid transaction hashes', () => {
      expect(isValidTxHash('')).toBe(false);
      expect(isValidTxHash('0x123')).toBe(false);
      expect(isValidTxHash('a'.repeat(64))).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
    });
  });

  describe('isValidChainId', () => {
    it('should return true for valid chain IDs', () => {
      expect(isValidChainId(1)).toBe(true);
      expect(isValidChainId(137)).toBe(true);
      expect(isValidChainId(42161)).toBe(true);
    });

    it('should return false for invalid chain IDs', () => {
      expect(isValidChainId(0)).toBe(false);
      expect(isValidChainId(-1)).toBe(false);
      expect(isValidChainId(1.5)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('');
      expect(sanitizeString('<p>Hello</p>')).toBe('Hello');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://api.example.com/v1/endpoint')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });
});
