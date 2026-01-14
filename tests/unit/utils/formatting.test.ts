/**
 * Formatting Utils Tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatBalance,
  formatUSD,
  truncateAddress,
  formatDate,
  formatPercentage,
  formatNumber,
} from '@/utils/formatting';

describe('Formatting Utils', () => {
  describe('formatBalance', () => {
    it('should format balance with default decimals', () => {
      expect(formatBalance('1000000000000000000', 18)).toBe('1.0000');
      expect(formatBalance('500000000000000000', 18)).toBe('0.5000');
    });

    it('should format balance with custom display decimals', () => {
      expect(formatBalance('1000000000000000000', 18, 2)).toBe('1.00');
      expect(formatBalance('1234567890000000000', 18, 6)).toBe('1.234568');
    });

    it('should handle different token decimals', () => {
      expect(formatBalance('1000000', 6, 2)).toBe('1.00'); // USDC
      expect(formatBalance('100000000', 8, 4)).toBe('1.0000'); // BTC
    });

    it('should handle zero balance', () => {
      expect(formatBalance('0', 18)).toBe('0.0000');
    });

    it('should handle large balances', () => {
      expect(formatBalance('1000000000000000000000', 18, 2)).toBe('1000.00');
    });
  });

  describe('formatUSD', () => {
    it('should format USD amounts', () => {
      expect(formatUSD(1000)).toBe('$1,000.00');
      expect(formatUSD(1234.56)).toBe('$1,234.56');
      expect(formatUSD(0.99)).toBe('$0.99');
    });

    it('should handle zero', () => {
      expect(formatUSD(0)).toBe('$0.00');
    });

    it('should handle large amounts', () => {
      expect(formatUSD(1000000)).toBe('$1,000,000.00');
    });
  });

  describe('truncateAddress', () => {
    it('should truncate address with default length', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(truncateAddress(address)).toBe('0x1234...7890');
    });

    it('should truncate address with custom length', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(truncateAddress(address, 6)).toBe('0x123456...567890');
    });

    it('should handle short addresses', () => {
      expect(truncateAddress('0x1234')).toBe('0x1234');
    });

    it('should handle null/undefined', () => {
      expect(truncateAddress('')).toBe('');
    });
  });

  describe('formatDate', () => {
    it('should format date strings', () => {
      const date = '2024-01-15T12:00:00Z';
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Jan.*15.*2024/);
    });

    it('should format Date objects', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Jan.*15.*2024/);
    });
  });

  describe('formatPercentage', () => {
    it('should format positive percentages', () => {
      expect(formatPercentage(5.5)).toBe('+5.50%');
      expect(formatPercentage(100)).toBe('+100.00%');
    });

    it('should format negative percentages', () => {
      expect(formatPercentage(-3.25)).toBe('-3.25%');
    });

    it('should format zero', () => {
      expect(formatPercentage(0)).toBe('0.00%');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should format decimal numbers', () => {
      expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(0.001234, 4)).toBe('0.0012');
    });
  });
});
