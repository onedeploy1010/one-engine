/**
 * Health API Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/route';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    })),
  })),
}));

describe('Health API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('status', 'healthy');
      expect(data.data).toHaveProperty('timestamp');
      expect(data.data).toHaveProperty('version');
      expect(data.data).toHaveProperty('services');
    });

    it('should include service health checks', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.data.services).toHaveProperty('database');
      expect(data.data.services).toHaveProperty('thirdweb');
    });
  });
});
