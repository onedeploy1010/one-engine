/**
 * Supabase Client Configuration for ONE Engine
 * Provides both public and admin clients for different access levels
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';
import type { Database } from '@/database/types';

// Singleton instances
let publicClient: SupabaseClient<Database> | null = null;
let adminClient: SupabaseClient<Database> | null = null;

/**
 * Get Supabase client with anon key (for user-context operations)
 * Use this when you need to respect RLS policies
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!publicClient) {
    publicClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return publicClient;
}

/**
 * Get Supabase admin client with service role key
 * Use this for admin operations that bypass RLS
 * IMPORTANT: Only use for server-side operations, never expose to clients
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!adminClient) {
    adminClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}

/**
 * Create a Supabase client with a specific user's access token
 * This respects RLS policies for that user
 */
export function getSupabaseClientWithAuth(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Utility to create a scoped client for a specific project
 * Projects can have their own schema or prefixed tables
 */
export function getProjectScopedClient(
  projectId: string,
  accessToken?: string
): SupabaseClient<Database> {
  const client = accessToken
    ? getSupabaseClientWithAuth(accessToken)
    : getSupabaseClient();

  // Project scoping is handled via RLS policies on project_id column
  return client;
}

// Re-export types
export type { SupabaseClient } from '@supabase/supabase-js';
export type { Database } from '@/database/types';
