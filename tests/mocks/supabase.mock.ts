/**
 * Supabase Mock
 * Mock implementation for Supabase client
 */

import { vi } from 'vitest';

export const createSupabaseMock = () => {
  const mockData: Record<string, unknown[]> = {
    users: [],
    projects: [],
    wallets: [],
    transactions: [],
    payments: [],
    bills: [],
  };

  const createQueryBuilder = (table: string) => {
    let filters: Record<string, unknown> = {};
    let selectedFields = '*';
    let orderField = '';
    let orderAsc = true;
    let limitCount = 100;
    let offsetCount = 0;

    const builder = {
      select: vi.fn((fields = '*', options?: { count?: string; head?: boolean }) => {
        selectedFields = fields;
        return builder;
      }),
      insert: vi.fn((data: unknown | unknown[]) => {
        const items = Array.isArray(data) ? data : [data];
        const newItems = items.map((item, index) => ({
          ...item,
          id: `${table}-${Date.now()}-${index}`,
          created_at: new Date().toISOString(),
        }));
        mockData[table] = [...(mockData[table] || []), ...newItems];
        return builder;
      }),
      update: vi.fn((data: unknown) => {
        return builder;
      }),
      delete: vi.fn(() => {
        return builder;
      }),
      eq: vi.fn((field: string, value: unknown) => {
        filters[field] = value;
        return builder;
      }),
      neq: vi.fn((field: string, value: unknown) => {
        return builder;
      }),
      gt: vi.fn((field: string, value: unknown) => {
        return builder;
      }),
      gte: vi.fn((field: string, value: unknown) => {
        return builder;
      }),
      lt: vi.fn((field: string, value: unknown) => {
        return builder;
      }),
      lte: vi.fn((field: string, value: unknown) => {
        return builder;
      }),
      like: vi.fn((field: string, pattern: string) => {
        return builder;
      }),
      ilike: vi.fn((field: string, pattern: string) => {
        return builder;
      }),
      is: vi.fn((field: string, value: unknown) => {
        return builder;
      }),
      in: vi.fn((field: string, values: unknown[]) => {
        return builder;
      }),
      or: vi.fn((query: string) => {
        return builder;
      }),
      order: vi.fn((field: string, options?: { ascending?: boolean }) => {
        orderField = field;
        orderAsc = options?.ascending ?? true;
        return builder;
      }),
      limit: vi.fn((count: number) => {
        limitCount = count;
        return builder;
      }),
      range: vi.fn((from: number, to: number) => {
        offsetCount = from;
        limitCount = to - from + 1;
        return builder;
      }),
      single: vi.fn(async () => {
        const tableData = mockData[table] || [];
        const filtered = tableData.filter(item => {
          return Object.entries(filters).every(
            ([key, value]) => (item as Record<string, unknown>)[key] === value
          );
        });
        return {
          data: filtered[0] || null,
          error: filtered.length === 0 ? { code: 'PGRST116', message: 'Not found' } : null,
        };
      }),
      maybeSingle: vi.fn(async () => {
        const tableData = mockData[table] || [];
        const filtered = tableData.filter(item => {
          return Object.entries(filters).every(
            ([key, value]) => (item as Record<string, unknown>)[key] === value
          );
        });
        return {
          data: filtered[0] || null,
          error: null,
        };
      }),
      then: vi.fn((resolve: (value: unknown) => void) => {
        const tableData = mockData[table] || [];
        const filtered = tableData.filter(item => {
          return Object.entries(filters).every(
            ([key, value]) => (item as Record<string, unknown>)[key] === value
          );
        });
        resolve({
          data: filtered.slice(offsetCount, offsetCount + limitCount),
          error: null,
          count: filtered.length,
        });
      }),
    };

    return builder;
  };

  return {
    from: vi.fn((table: string) => createQueryBuilder(table)),
    auth: {
      admin: {
        createUser: vi.fn(async ({ email, phone, user_metadata }: any) => ({
          data: {
            user: {
              id: `user-${Date.now()}`,
              email,
              phone,
              user_metadata,
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        })),
        getUserById: vi.fn(async (id: string) => ({
          data: { user: mockData.users?.find((u: any) => u.id === id) || null },
          error: null,
        })),
        updateUserById: vi.fn(async (id: string, updates: any) => ({
          data: { user: { id, ...updates } },
          error: null,
        })),
        deleteUser: vi.fn(async (id: string) => ({
          data: { user: { id } },
          error: null,
        })),
      },
      signInWithOtp: vi.fn(async ({ email, phone }: any) => ({
        data: {},
        error: null,
      })),
      verifyOtp: vi.fn(async ({ email, phone, token, type }: any) => ({
        data: {
          user: { id: `user-${Date.now()}`, email, phone },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      })),
      getSession: vi.fn(async () => ({
        data: { session: null },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'new-mock-access-token',
            refresh_token: 'new-mock-refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      })),
    },
    _mockData: mockData,
    _setMockData: (table: string, data: unknown[]) => {
      mockData[table] = data;
    },
    _clearMockData: () => {
      Object.keys(mockData).forEach(key => {
        mockData[key] = [];
      });
    },
  };
};

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
