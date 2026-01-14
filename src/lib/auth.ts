/**
 * Auth Helper for ONE Engine
 * Provides simplified auth functions for API routes
 */

import { NextRequest } from 'next/server';
import { authenticate, requireAuth, type AuthContext } from '@/middleware/auth';

export interface User {
  id: string;
  email: string;
  walletAddress?: string;
  role: string;
  projectId?: string;
}

/**
 * Get the current authenticated user from request
 * Returns null if not authenticated
 */
export async function getUser(request: NextRequest): Promise<User | null> {
  const auth = await authenticate(request);

  if (!auth) {
    return null;
  }

  return {
    id: auth.userId,
    email: auth.email,
    walletAddress: auth.walletAddress,
    role: auth.role,
    projectId: auth.projectId,
  };
}

/**
 * Require authenticated user - throws error if not authenticated
 */
export async function requireUser(request: NextRequest): Promise<User> {
  const auth = await requireAuth(request);

  return {
    id: auth.userId,
    email: auth.email,
    walletAddress: auth.walletAddress,
    role: auth.role,
    projectId: auth.projectId,
  };
}

// Re-export auth context and functions
export { authenticate, requireAuth, type AuthContext } from '@/middleware/auth';
