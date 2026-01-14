/**
 * OTP Verification Endpoint
 * POST /api/v1/auth/otp/verify - Verify OTP and create/update user
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Thirdweb Embedded Wallet API
const THIRDWEB_EMBEDDED_WALLET_API = 'https://embedded-wallet.thirdweb.com/api/2024-05-05';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both 'otp' and 'verificationCode' field names
    const { email, otp, verificationCode } = body;
    const code = otp || verificationCode;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: { message: 'Valid email required' } },
        { status: 400 }
      );
    }

    if (!code || code.length < 4) {
      return NextResponse.json(
        { success: false, error: { message: 'Valid verification code required' } },
        { status: 400 }
      );
    }

    const clientId = process.env.THIRDWEB_CLIENT_ID;
    const secretKey = process.env.THIRDWEB_SECRET_KEY;

    if (!clientId || !secretKey) {
      console.error('Missing THIRDWEB_CLIENT_ID or THIRDWEB_SECRET_KEY');
      throw new Error('Thirdweb credentials not configured');
    }

    // Verify OTP with Thirdweb Embedded Wallet API
    console.log('Verifying OTP via Thirdweb API for:', email);
    const thirdwebResponse = await fetch(`${THIRDWEB_EMBEDDED_WALLET_API}/login/email/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-secret-key': secretKey,
      },
      body: JSON.stringify({
        email,
        code,
      }),
    });

    const thirdwebResult = await thirdwebResponse.json();

    if (!thirdwebResponse.ok) {
      console.error('Thirdweb verify error:', thirdwebResponse.status, thirdwebResult);
      throw new Error(thirdwebResult.message || 'Invalid verification code');
    }

    // Extract wallet address from response (nested in storedToken.authDetails)
    const walletAddress =
      thirdwebResult.storedToken?.authDetails?.walletAddress ||
      thirdwebResult.walletAddress ||
      thirdwebResult.address ||
      thirdwebResult.user?.walletAddress;

    if (!walletAddress) {
      console.error('Thirdweb response missing wallet address:', JSON.stringify(thirdwebResult, null, 2));
      throw new Error('Failed to get wallet address from Thirdweb');
    }

    console.log('OTP verified successfully, wallet:', walletAddress);

    // Save user to database
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, wallet_address, smart_account_address')
      .eq('email', email)
      .single();

    let userId: string;
    if (existingUser && existingUser.id) {
      // Update existing user's wallet address
      userId = existingUser.id;
      if (!existingUser.wallet_address || existingUser.wallet_address !== walletAddress) {
        await supabase
          .from('users')
          .update({
            wallet_address: walletAddress,
            smart_account_address: walletAddress,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      }
    } else {
      // Create new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email,
          wallet_address: walletAddress,
          smart_account_address: walletAddress,
          role: 'user',
          kyc_status: 'none',
          membership_tier: 'free',
        })
        .select('id')
        .single();

      if (error || !newUser) {
        console.error('Failed to create user:', error);
        throw new Error('Failed to create user');
      }
      userId = newUser.id;
    }

    // Generate JWT token
    const accessToken = jwt.sign(
      {
        sub: userId,
        userId,
        email,
        walletAddress: walletAddress,
        type: 'email',
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '30d' }
    );

    // Return in SDK expected format
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: userId,
          email,
          walletAddress: walletAddress,
          smartAccountAddress: walletAddress,
          role: 'user',
          kycStatus: 'none',
          membershipTier: 'free',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        accessToken,
      },
    });
  } catch (error: any) {
    console.error('OTP verify error:', error);

    if (error.message?.includes('invalid') || error.message?.includes('expired')) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid or expired verification code', code: 'INVALID_CODE' } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { message: error.message || 'Failed to verify code', code: 'VERIFICATION_FAILED' }
      },
      { status: 500 }
    );
  }
}
