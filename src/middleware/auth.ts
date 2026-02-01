/**
 * Authentication Middleware for ONE Engine
 * Validates JWT tokens and extracts user context
 */

import { NextRequest } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '@/config/env';
import { errors } from '@/lib/response';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { AuthContext, AuthTokenPayload, UserRole } from '@/types';
import { logger } from '@/lib/logger';

// Create secret key for jose
const getJwtSecret = () => new TextEncoder().encode(env.JWT_SECRET);

/**
 * Extract and validate the access token from request headers
 */
export async function authenticate(req: NextRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // Try ONE Engine JWT first
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const tokenPayload = payload as unknown as AuthTokenPayload;

    return {
      userId: tokenPayload.sub,
      email: tokenPayload.email,
      walletAddress: tokenPayload.walletAddress,
      projectId: tokenPayload.projectId,
      role: tokenPayload.role,
      accessToken: token,
    };
  } catch {
    // Engine JWT failed, try Supabase token fallback
  }

  // Fallback: validate as Supabase session token
  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Auth failed: neither Engine JWT nor Supabase token valid');
      return null;
    }

    return {
      userId: user.id,
      email: user.email || '',
      walletAddress: (user.user_metadata?.wallet_address as string) || '',
      projectId: undefined,
      role: (user.user_metadata?.role as UserRole) || 'user',
      accessToken: token,
    };
  } catch (error) {
    logger.warn('Supabase token validation failed', { error });
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const auth = await authenticate(req);

  if (!auth) {
    throw errors.unauthorized('Invalid or missing authentication token');
  }

  return auth;
}

/**
 * Optional authentication - returns null if not authenticated
 */
export async function optionalAuth(req: NextRequest): Promise<AuthContext | null> {
  return authenticate(req);
}

/**
 * Require specific role(s)
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: UserRole[]
): Promise<AuthContext> {
  const auth = await requireAuth(req);

  if (!allowedRoles.includes(auth.role)) {
    throw errors.forbidden('Insufficient permissions');
  }

  return auth;
}

/**
 * Require admin role
 */
export async function requireAdmin(req: NextRequest): Promise<AuthContext> {
  return requireRole(req, ['admin']);
}

/**
 * Validate project API key (for server-to-server calls)
 */
export async function validateApiKey(req: NextRequest): Promise<{
  projectId: string;
  settings: Record<string, unknown>;
} | null> {
  const apiKey = req.headers.get('x-api-key');

  if (!apiKey) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, settings')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !project) {
    return null;
  }

  const projectData = project as { id: string; settings: Record<string, unknown> };

  return {
    projectId: projectData.id,
    settings: projectData.settings,
  };
}

/**
 * Extract project ID from header or auth context
 */
export function getProjectId(req: NextRequest, auth?: AuthContext): string | undefined {
  return req.headers.get('x-project-id') || auth?.projectId;
}

/**
 * Generate a JWT token for a user
 */
export async function generateToken(payload: Omit<AuthTokenPayload, 'iat' | 'exp'>): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(getJwtSecret());

  return token;
}

/**
 * Decode token without verification (for reading payload)
 */
export async function decodeToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Refresh token if close to expiration
 */
export async function refreshTokenIfNeeded(token: string): Promise<string | null> {
  try {
    const payload = await decodeToken(token);
    if (!payload) return null;

    const expiresIn = (payload.exp || 0) - Math.floor(Date.now() / 1000);

    // Refresh if less than 1 hour remaining
    if (expiresIn < 3600) {
      return generateToken({
        sub: payload.sub,
        email: payload.email,
        walletAddress: payload.walletAddress,
        projectId: payload.projectId,
        role: payload.role,
      });
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Higher-order function to wrap API route handlers with authentication
 */
export function withAuth<T>(
  handler: (req: NextRequest, context: AuthContext) => Promise<T>
): (req: NextRequest) => Promise<T> {
  return async (req: NextRequest) => {
    const auth = await requireAuth(req);
    return handler(req, auth);
  };
}

// Re-export AuthContext type for convenience
export type { AuthContext } from '@/types';
