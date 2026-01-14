import { NextRequest, NextResponse } from 'next/server';

// Thirdweb In-App Wallet API
const THIRDWEB_API_BASE = 'https://embedded-wallet.thirdweb.com/api/2024-05-05';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email required' },
        { status: 400 }
      );
    }

    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    const clientId = process.env.THIRDWEB_CLIENT_ID;

    if (!secretKey || secretKey === 'placeholder-secret-key') {
      throw new Error('THIRDWEB_SECRET_KEY not configured');
    }

    if (!clientId) {
      throw new Error('THIRDWEB_CLIENT_ID not configured');
    }

    // Use Thirdweb In-App Wallet API - initiate email auth (sends OTP)
    const response = await fetch(`${THIRDWEB_API_BASE}/login/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-secret-key': secretKey,
        'x-client-id': clientId,
      },
      body: JSON.stringify({
        email,
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.error('Thirdweb API error:', response.status, result);
      throw new Error(result.message || result.error || `API error: ${response.status}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      email,
    });
  } catch (error: any) {
    console.error('OTP send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send verification code',
        code: 'OTP_SEND_FAILED'
      },
      { status: 500 }
    );
  }
}
