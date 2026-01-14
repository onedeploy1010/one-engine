/**
 * Test Setup
 * Global test configuration and utilities
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock environment variables
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    THIRDWEB_CLIENT_ID: 'test-client-id',
    THIRDWEB_SECRET_KEY: 'test-secret-key',
    OPENAI_API_KEY: 'test-openai-key',
    BYBIT_API_KEY: 'test-bybit-key',
    BYBIT_API_SECRET: 'test-bybit-secret',
    BYBIT_TESTNET: true,
    JWT_SECRET: 'test-jwt-secret',
    JWT_EXPIRES_IN: '24h',
    ENCRYPTION_KEY: 'test-encryption-key-32chars123',
    RATE_LIMIT_REQUESTS: 100,
    RATE_LIMIT_WINDOW: 60,
  },
}));

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      admin: {
        createUser: vi.fn(),
        getUserById: vi.fn(),
        updateUserById: vi.fn(),
      },
    },
  })),
  getSupabaseClient: vi.fn(() => ({
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  })),
}));

// Global test hooks
beforeAll(async () => {
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  console.log('✅ Test suite completed');
});

afterEach(() => {
  vi.clearAllMocks();
});

// Test utilities
export const createMockRequest = (
  method: string,
  url: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  }
): Request => {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');

  return new Request(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
};

export const createMockAuthHeader = (userId: string, role: string = 'user'): string => {
  // Create a mock JWT token
  const payload = {
    sub: userId,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `Bearer mock-jwt-${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
};

export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  phone: null,
  wallet_address: '0x1234567890123456789012345678901234567890',
  smart_account_address: '0x0987654321098765432109876543210987654321',
  role: 'user',
  kyc_status: 'none',
  membership_tier: 'free',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockProject = {
  id: 'test-project-id',
  owner_id: 'test-user-id',
  name: 'Test Project',
  slug: 'test-project',
  api_key: 'pk_test_1234567890',
  is_active: true,
  settings: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockWallet = {
  id: 'test-wallet-id',
  user_id: 'test-user-id',
  address: '0x1234567890123456789012345678901234567890',
  type: 'smart',
  chain_id: 1,
  is_primary: true,
  created_at: new Date().toISOString(),
};
