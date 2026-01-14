/**
 * Auth Middleware Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'test-user-id',
          role: 'user',
          is_active: true,
        },
        error: null,
      }),
    })),
  })),
}));

vi.mock('jose', () => ({
  jwtVerify: vi.fn().mockResolvedValue({
    payload: {
      sub: 'test-user-id',
      role: 'user',
      projectId: 'test-project-id',
    },
  }),
}));

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should throw error when no authorization header', async () => {
      const { requireAuth } = await import('@/middleware/auth');
      const req = new NextRequest('http://localhost:3000/api/test');

      await expect(requireAuth(req)).rejects.toThrow();
    });

    it('should throw error for invalid token format', async () => {
      const { requireAuth } = await import('@/middleware/auth');
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { Authorization: 'InvalidToken' },
      });

      await expect(requireAuth(req)).rejects.toThrow();
    });

    it('should return auth context for valid token', async () => {
      const { requireAuth } = await import('@/middleware/auth');
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      const result = await requireAuth(req);
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('role');
    });
  });

  describe('requireAdmin', () => {
    it('should throw error for non-admin users', async () => {
      const { requireAdmin } = await import('@/middleware/auth');
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      await expect(requireAdmin(req)).rejects.toThrow();
    });
  });

  describe('optionalAuth', () => {
    it('should return null when no token provided', async () => {
      const { optionalAuth } = await import('@/middleware/auth');
      const req = new NextRequest('http://localhost:3000/api/test');

      const result = await optionalAuth(req);
      expect(result).toBeNull();
    });

    it('should return auth context when token provided', async () => {
      const { optionalAuth } = await import('@/middleware/auth');
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      const result = await optionalAuth(req);
      expect(result).toHaveProperty('userId');
    });
  });
});
