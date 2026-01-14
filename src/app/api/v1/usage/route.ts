/**
 * Usage Statistics API
 * 客户用度统计报表
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthContext } from '@/middleware/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const supabase = getSupabaseAdmin();

// Type for project_quotas table (new table not yet in generated types)
interface ProjectQuota {
  id: string;
  project_id: string;
  api_requests_monthly_limit: number;
  api_requests_monthly_used: number;
  cost_units_monthly_limit: number;
  cost_units_monthly_used: number;
  current_period_start: string;
  current_period_end: string;
  warning_threshold: number;
  warning_sent: boolean;
  updated_at: string;
}

// Type for api_usage table records
interface ApiUsageRecord {
  created_at: string;
  status_code: number | null;
  response_time_ms: number | null;
  cost_units: number | null;
  provider_id: string | null;
  endpoint: string | null;
}

// GET /api/v1/usage - 获取用度统计
export const GET = withAuth(async (
  req: NextRequest,
  context: AuthContext
) => {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    const period = searchParams.get('period') || 'daily'; // hourly, daily, monthly
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const providerId = searchParams.get('provider_id');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: { code: 'E4001', message: 'project_id is required' } },
        { status: 400 }
      );
    }

    // Verify user has access to project
    const { data: projectAccess } = await supabase
      .from('projects')
      .select('id, team_id')
      .eq('id', projectId)
      .single();

    if (!projectAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'E4004', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Build date range
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1); // First of month
    const start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : now;

    // Get usage data based on period
    let usageData;

    if (period === 'hourly') {
      usageData = await getHourlyUsage(projectId, start, end, providerId);
    } else if (period === 'monthly') {
      usageData = await getMonthlyUsage(projectId, start, end, providerId);
    } else {
      usageData = await getDailyUsage(projectId, start, end, providerId);
    }

    // Get current quota status
    const { data: quotaData } = await supabase
      .from('project_quotas')
      .select('*')
      .eq('project_id', projectId)
      .single();

    const quota = quotaData as ProjectQuota | null;

    // Get summary statistics
    const summary = await getUsageSummary(projectId, start, end);

    return NextResponse.json({
      success: true,
      data: {
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        usage: usageData,
        summary,
        quota: quota ? {
          apiRequests: {
            used: quota.api_requests_monthly_used,
            limit: quota.api_requests_monthly_limit,
            percentage: Math.round((quota.api_requests_monthly_used / quota.api_requests_monthly_limit) * 100),
          },
          costUnits: {
            used: quota.cost_units_monthly_used,
            limit: quota.cost_units_monthly_limit,
            percentage: Math.round((quota.cost_units_monthly_used / quota.cost_units_monthly_limit) * 100),
          },
          periodStart: quota.current_period_start,
          periodEnd: quota.current_period_end,
        } : null,
      },
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'E5000', message: 'Failed to fetch usage data' } },
      { status: 500 }
    );
  }
});

async function getHourlyUsage(projectId: string, start: Date, end: Date, providerId?: string | null) {
  let query = supabase
    .from('api_usage')
    .select('created_at, status_code, response_time_ms, cost_units, provider_id')
    .eq('project_id', projectId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true });

  if (providerId) {
    query = query.eq('provider_id', providerId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const records = data as ApiUsageRecord[] | null;

  // Group by hour
  const hourlyData: Record<string, {
    hour: string;
    requests: number;
    successful: number;
    failed: number;
    avgLatency: number;
    costUnits: number;
  }> = {};

  records?.forEach((row) => {
    const hour = new Date(row.created_at).toISOString().slice(0, 13) + ':00:00Z';
    if (!hourlyData[hour]) {
      hourlyData[hour] = {
        hour,
        requests: 0,
        successful: 0,
        failed: 0,
        avgLatency: 0,
        costUnits: 0,
      };
    }
    hourlyData[hour].requests++;
    if (row.status_code && row.status_code < 400) {
      hourlyData[hour].successful++;
    } else {
      hourlyData[hour].failed++;
    }
    hourlyData[hour].avgLatency += row.response_time_ms || 0;
    hourlyData[hour].costUnits += row.cost_units || 1;
  });

  // Calculate averages
  return Object.values(hourlyData).map((h) => ({
    ...h,
    avgLatency: h.requests > 0 ? Math.round(h.avgLatency / h.requests) : 0,
  }));
}

async function getDailyUsage(projectId: string, start: Date, end: Date, providerId?: string | null) {
  let query = supabase
    .from('api_usage')
    .select('created_at, status_code, response_time_ms, cost_units, provider_id, endpoint')
    .eq('project_id', projectId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true });

  if (providerId) {
    query = query.eq('provider_id', providerId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const records = data as ApiUsageRecord[] | null;

  // Group by day
  const dailyData: Record<string, {
    date: string;
    requests: number;
    successful: number;
    failed: number;
    avgLatency: number;
    costUnits: number;
    topEndpoints: Record<string, number>;
  }> = {};

  records?.forEach((row) => {
    const date = new Date(row.created_at).toISOString().slice(0, 10);
    if (!dailyData[date]) {
      dailyData[date] = {
        date,
        requests: 0,
        successful: 0,
        failed: 0,
        avgLatency: 0,
        costUnits: 0,
        topEndpoints: {},
      };
    }
    dailyData[date].requests++;
    if (row.status_code && row.status_code < 400) {
      dailyData[date].successful++;
    } else {
      dailyData[date].failed++;
    }
    dailyData[date].avgLatency += row.response_time_ms || 0;
    dailyData[date].costUnits += row.cost_units || 1;

    // Track endpoint usage
    if (row.endpoint) {
      dailyData[date].topEndpoints[row.endpoint] =
        (dailyData[date].topEndpoints[row.endpoint] || 0) + 1;
    }
  });

  return Object.values(dailyData).map((d) => ({
    date: d.date,
    requests: d.requests,
    successful: d.successful,
    failed: d.failed,
    avgLatency: d.requests > 0 ? Math.round(d.avgLatency / d.requests) : 0,
    costUnits: d.costUnits,
    successRate: d.requests > 0 ? Math.round((d.successful / d.requests) * 100) : 0,
    topEndpoints: Object.entries(d.topEndpoints)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count })),
  }));
}

async function getMonthlyUsage(projectId: string, start: Date, end: Date, providerId?: string | null) {
  let query = supabase
    .from('api_usage')
    .select('created_at, status_code, response_time_ms, cost_units, provider_id')
    .eq('project_id', projectId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true });

  if (providerId) {
    query = query.eq('provider_id', providerId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const records = data as ApiUsageRecord[] | null;

  // Group by month
  const monthlyData: Record<string, {
    month: string;
    requests: number;
    successful: number;
    failed: number;
    avgLatency: number;
    costUnits: number;
  }> = {};

  records?.forEach((row) => {
    const month = new Date(row.created_at).toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = {
        month,
        requests: 0,
        successful: 0,
        failed: 0,
        avgLatency: 0,
        costUnits: 0,
      };
    }
    monthlyData[month].requests++;
    if (row.status_code && row.status_code < 400) {
      monthlyData[month].successful++;
    } else {
      monthlyData[month].failed++;
    }
    monthlyData[month].avgLatency += row.response_time_ms || 0;
    monthlyData[month].costUnits += row.cost_units || 1;
  });

  return Object.values(monthlyData).map((m) => ({
    ...m,
    avgLatency: m.requests > 0 ? Math.round(m.avgLatency / m.requests) : 0,
    successRate: m.requests > 0 ? Math.round((m.successful / m.requests) * 100) : 0,
  }));
}

async function getUsageSummary(projectId: string, start: Date, end: Date) {
  const { data, error } = await supabase
    .from('api_usage')
    .select('status_code, response_time_ms, cost_units, endpoint, provider_id')
    .eq('project_id', projectId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (error) throw error;

  const records = data as ApiUsageRecord[] | null;

  const summary = {
    totalRequests: records?.length || 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgLatency: 0,
    totalCostUnits: 0,
    byEndpoint: {} as Record<string, number>,
    byProvider: {} as Record<string, number>,
  };

  let totalLatency = 0;

  records?.forEach((row) => {
    if (row.status_code && row.status_code < 400) {
      summary.successfulRequests++;
    } else {
      summary.failedRequests++;
    }
    totalLatency += row.response_time_ms || 0;
    summary.totalCostUnits += row.cost_units || 1;

    if (row.endpoint) {
      summary.byEndpoint[row.endpoint] = (summary.byEndpoint[row.endpoint] || 0) + 1;
    }
    if (row.provider_id) {
      summary.byProvider[row.provider_id] = (summary.byProvider[row.provider_id] || 0) + 1;
    }
  });

  summary.avgLatency = summary.totalRequests > 0
    ? Math.round(totalLatency / summary.totalRequests)
    : 0;

  return {
    ...summary,
    successRate: summary.totalRequests > 0
      ? Math.round((summary.successfulRequests / summary.totalRequests) * 100)
      : 0,
    topEndpoints: Object.entries(summary.byEndpoint)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count })),
    topProviders: Object.entries(summary.byProvider)
      .sort(([, a], [, b]) => b - a)
      .map(([provider, count]) => ({ provider, count })),
  };
}
