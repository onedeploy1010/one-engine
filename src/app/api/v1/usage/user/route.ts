/**
 * User AI Usage Tracking API
 * POST /api/v1/usage/user - Record user usage
 * GET /api/v1/usage/user - Get user's AI usage summary
 *
 * Categories:
 * - wallet, payment, exchange_onramper, exchange_swap (backend only)
 * - ai_thirdweb → Personal Assistant (client display)
 * - ai_trading_engine → Trading Agent (client display)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Valid categories
const CATEGORIES = [
  'wallet',
  'payment',
  'exchange_onramper',
  'exchange_swap',
  'ai_thirdweb',
  'ai_trading_engine',
] as const;

const recordUsageSchema = z.object({
  userId: z.string().uuid(),
  category: z.enum(CATEGORIES),
  action: z.string().min(1),
  requestTokens: z.number().int().min(0).optional().default(0),
  responseTokens: z.number().int().min(0).optional().default(0),
  creditsUsed: z.number().min(0).optional().default(0),
  metadata: z.record(z.any()).optional().default({}),
});

/**
 * POST - Record user usage
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = recordUsageSchema.parse(body);

    const { error } = await supabase
      .from('usage_records')
      .insert({
        user_id: data.userId,
        category: data.category,
        action: data.action,
        request_tokens: data.requestTokens,
        response_tokens: data.responseTokens,
        credits_used: data.creditsUsed,
        metadata: data.metadata,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent'),
      });

    if (error) {
      console.error('Failed to record usage:', error);
      return NextResponse.json(
        { success: false, error: { message: 'Failed to record usage' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Usage record error:', error);
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Invalid request' } },
      { status: 400 }
    );
  }
}

/**
 * GET - Get user's AI usage summary (for client display)
 * Returns Personal Assistant & Trading Agent usage
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { message: 'userId required' } },
        { status: 400 }
      );
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get AI usage records
    const { data: aiUsage, error: aiError } = await supabase
      .from('usage_records')
      .select('category, action, request_tokens, response_tokens, credits_used, created_at')
      .eq('user_id', userId)
      .in('category', ['ai_thirdweb', 'ai_trading_engine'])
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (aiError) {
      throw new Error(aiError.message);
    }

    // Aggregate by display category
    const summary = {
      personal_assistant: {
        requestCount: 0,
        totalTokens: 0,
        totalCredits: 0,
      },
      trading_agent: {
        requestCount: 0,
        totalTokens: 0,
        totalCredits: 0,
      },
    };

    // Daily breakdown for charts
    const dailyUsage: Record<string, { personal_assistant: number; trading_agent: number }> = {};

    for (const record of aiUsage || []) {
      const displayCategory = record.category === 'ai_thirdweb'
        ? 'personal_assistant'
        : 'trading_agent';

      summary[displayCategory].requestCount++;
      summary[displayCategory].totalTokens += (record.request_tokens || 0) + (record.response_tokens || 0);
      summary[displayCategory].totalCredits += parseFloat(record.credits_used || '0');

      // Daily breakdown
      const date = record.created_at.slice(0, 10);
      if (!dailyUsage[date]) {
        dailyUsage[date] = { personal_assistant: 0, trading_agent: 0 };
      }
      dailyUsage[date][displayCategory]++;
    }

    // Recent activity
    const recentActivity = (aiUsage || []).slice(0, 20).map(record => ({
      type: record.category === 'ai_thirdweb' ? 'personal_assistant' : 'trading_agent',
      action: record.action,
      tokens: (record.request_tokens || 0) + (record.response_tokens || 0),
      credits: parseFloat(record.credits_used || '0'),
      timestamp: record.created_at,
    }));

    // Convert daily usage to array sorted by date
    const dailyBreakdown = Object.entries(dailyUsage)
      .map(([date, usage]) => ({ date, ...usage }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        summary,
        dailyBreakdown,
        recentActivity,
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error('Get usage error:', error);
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to get usage' } },
      { status: 500 }
    );
  }
}
