/**
 * CORS Configuration for ONE Engine
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Default allowed origins
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:8081', // Expo
  'exp://localhost:8081',
];

// Production origins (add your domains)
const PRODUCTION_ORIGINS = [
  'https://app.one.eco',
  'https://wallet.one.eco',
  'https://dashboard.one.eco',
  'https://api.one.eco',
  'https://app.one23.io',
  'https://api.one23.io',
  'https://*.one23.io',
  'https://*.netlify.app',
];

/**
 * Get allowed origins based on environment
 */
export function getAllowedOrigins(): string[] {
  const origins = [...DEFAULT_ALLOWED_ORIGINS];

  if (process.env.NODE_ENV === 'production') {
    origins.push(...PRODUCTION_ORIGINS);
  }

  // Add any custom origins from environment
  const customOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean);
  if (customOrigins) {
    origins.push(...customOrigins);
  }

  return origins;
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Allow requests without origin (e.g., mobile apps)

  const allowed = getAllowedOrigins();

  // Check exact match
  if (allowed.includes(origin)) return true;

  // Check wildcard subdomains
  for (const pattern of allowed) {
    if (pattern.startsWith('*.')) {
      const domain = pattern.substring(2);
      if (origin.endsWith(domain)) return true;
    }
  }

  return false;
}

/**
 * Check if origin is allowed for a specific project
 */
export async function isProjectOriginAllowed(
  origin: string | null,
  projectId: string
): Promise<boolean> {
  if (!origin) return true;

  // First check global allowed origins
  if (isOriginAllowed(origin)) return true;

  // Then check project-specific allowed domains
  try {
    const supabase = getSupabaseAdmin();
    const { data: project } = await supabase
      .from('projects')
      .select('settings')
      .eq('id', projectId)
      .single();

    if (!project) return false;

    const projectData = project as { settings: { allowedDomains?: string[] } };
    const settings = projectData.settings;
    const allowedDomains = settings?.allowedDomains || [];

    // Check if origin matches project's allowed domains
    const originHost = new URL(origin).host;
    return allowedDomains.some((domain) => {
      if (domain.startsWith('*.')) {
        return originHost.endsWith(domain.substring(2));
      }
      return originHost === domain || origin === domain;
    });
  } catch {
    return false;
  }
}

/**
 * CORS headers
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Project-Id, X-Api-Key, X-Request-Id, X-Client-Id, x-client-id',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

/**
 * Handle CORS preflight (OPTIONS) request
 */
export function handleCorsPrelight(req: NextRequest): NextResponse {
  const origin = req.headers.get('origin');
  const headers = getCorsHeaders(origin);

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(
  response: NextResponse,
  req: NextRequest
): NextResponse {
  const origin = req.headers.get('origin');
  const headers = getCorsHeaders(origin);

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * CORS middleware wrapper
 */
export function withCors<T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return handleCorsPrelight(req);
    }

    // Execute handler
    const response = await handler(req, ...args);

    // Add CORS headers
    return addCorsHeaders(response, req);
  }) as T;
}
