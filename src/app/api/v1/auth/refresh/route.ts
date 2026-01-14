/**
 * Token Refresh Endpoint
 * POST /api/v1/auth/refresh
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authService } from '@/services/auth/auth.service';
import { success, errors } from '@/lib/response';
import { validateBody } from '@/middleware/validation';

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await validateBody(req, refreshSchema);
    const result = await authService.refreshToken(body.refreshToken);

    return success({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    if (error instanceof Error) {
      return errors.unauthorized(error.message);
    }
    return errors.internal('Failed to refresh token');
  }
}
