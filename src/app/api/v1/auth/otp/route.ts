/**
 * OTP Authentication Endpoints
 * POST /api/v1/auth/otp - Send OTP via Thirdweb SDK
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/middleware/validation';
import { preAuthenticate } from 'thirdweb/wallets/in-app';
import { getThirdwebClient } from '@/lib/thirdweb';

const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Send OTP to email via Thirdweb SDK
 */
export async function POST(req: NextRequest) {
  try {
    const body = await validateBody(req, sendOtpSchema);
    const { email } = body;

    const client = getThirdwebClient();

    // Use Thirdweb SDK to send OTP
    console.log('Sending OTP via Thirdweb SDK to:', email);
    await preAuthenticate({
      client,
      strategy: 'email',
      email,
    });

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      data: { email },
    });
  } catch (error) {
    console.error('OTP send error:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: { message: error.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: { message: 'Failed to send OTP' } },
      { status: 500 }
    );
  }
}
