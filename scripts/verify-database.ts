/**
 * Verify Database Schema
 * Checks that all 70 expected tables exist in the Supabase database
 * Run: npx ts-node scripts/verify-database.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fyktnfziqyjbrrzszzuz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5a3RuZnppcXlqYnJyenN6enV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIwNzQyNiwiZXhwIjoyMDc4NzgzNDI2fQ.cf5FqnEcmx6YTLswdiQ3cB_lWoxv3j9M9q4IZwH_oCU';

const EXPECTED_TABLES = [
  // Core Infrastructure (6)
  'users', 'otp_codes', 'teams', 'team_members', 'projects', 'project_api_keys',
  // Engine Project Tables (10)
  'project_users', 'project_wallets', 'project_backend_wallets', 'project_transactions',
  'project_contracts', 'project_payments', 'api_usage', 'api_usage_daily',
  'provider_usage', 'project_quotas',
  // Original Engine Tables (5)
  'wallets', 'contracts_registry', 'transactions', 'fiat_transactions', 'payments',
  // Quant Tables (5)
  'quant_strategies', 'quant_positions', 'quant_daily_pnl', 'trade_orders', 'nav_snapshots',
  // System Tables (4)
  'system_logs', 'rate_limits', 'webhooks', 'webhook_deliveries',
  // Ecosystem Tables (3)
  'ecosystem_apps', 'user_app_mappings', 'sync_logs',
  // Agent & Referral (2)
  'agent_ranks', 'referral_rewards',
  // AI Strategy Tables (4)
  'ai_strategies', 'ai_orders', 'ai_trade_batches', 'ai_nav_snapshots',
  // AI Advanced Tables (7)
  'ai_strategy_pools', 'ai_agent_memory', 'ai_decision_log', 'ai_trade_executions',
  'ai_open_positions', 'ai_performance_snapshots', 'ai_order_shares',
  // AI A/B Book (2)
  'ai_ab_book_trades', 'ai_ab_book_config',
  // Wallet App Tables (18)
  'user_profiles', 'user_settings', 'wallet_assets', 'wallet_transactions', 'cards',
  'merchant_profiles', 'x402_payment_urls', 'x402_payment_qr_codes', 'x402_payments',
  'x402_invoices', 'x402_receipts', 'user_security_events', 'user_devices',
  'qr_scan_events', 'wallet_referral_rewards', 'wallet_ai_strategies',
  'wallet_ai_orders', 'wallet_ai_nav_snapshots',
  // Forex Tables (4)
  'forex_pools', 'forex_investments', 'forex_trades', 'forex_daily_snapshots',
];

async function main() {
  console.log('🔍 ONE Ecosystem Database Verification');
  console.log('========================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Expected tables: ${EXPECTED_TABLES.length}`);
  console.log('========================================\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Query all public tables
  const { data: tables, error } = await supabase.rpc('get_tables').catch(() => ({ data: null, error: { message: 'RPC not available' } }));

  let existingTables: string[] = [];

  if (tables && !error) {
    existingTables = tables.map((t: any) => t.table_name || t.tablename || t);
  } else {
    // Fallback: check each table individually
    console.log('Using fallback method (checking tables individually)...\n');
    for (const table of EXPECTED_TABLES) {
      const { error: tableError } = await supabase.from(table).select('*').limit(0);
      if (!tableError) {
        existingTables.push(table);
      }
    }
  }

  // Compare
  const missing: string[] = [];
  const present: string[] = [];

  for (const table of EXPECTED_TABLES) {
    if (existingTables.includes(table)) {
      present.push(table);
    } else {
      missing.push(table);
    }
  }

  // Report
  console.log(`✅ Present: ${present.length}/${EXPECTED_TABLES.length} tables`);

  if (missing.length > 0) {
    console.log(`\n❌ Missing ${missing.length} tables:`);
    for (const t of missing) {
      console.log(`   - ${t}`);
    }
  }

  // Check ONE Wallet project
  console.log('\n--- ONE Wallet Project ---');
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, slug, client_id, status')
    .eq('slug', 'one-wallet-app')
    .single();

  if (project) {
    console.log(`✅ Project: ${project.name} (${project.id})`);
    console.log(`   Client ID: ${project.client_id}`);
    console.log(`   Status: ${project.status}`);
  } else {
    console.log(`❌ ONE Wallet project not found: ${projectError?.message}`);
  }

  // Check system user
  console.log('\n--- System User ---');
  const { data: systemUser } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single();

  if (systemUser) {
    console.log(`✅ System user: ${systemUser.email} (role: ${systemUser.role})`);
  } else {
    console.log('❌ System user not found');
  }

  // Check demo data
  console.log('\n--- Demo Data ---');
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('email')
    .like('email', '%@demo.onewallet.app');

  if (profiles && profiles.length > 0) {
    console.log(`✅ Demo profiles: ${profiles.length} found`);
  } else {
    console.log(`❌ Demo profiles not found: ${profilesError?.message || 'no rows'}`);
  }

  // Check AI strategies
  console.log('\n--- AI Strategies ---');
  const { data: strategies } = await supabase.from('ai_strategies').select('id, name');
  if (strategies && strategies.length > 0) {
    console.log(`✅ AI strategies: ${strategies.length}`);
    for (const s of strategies) {
      console.log(`   - ${s.id}: ${s.name}`);
    }
  } else {
    console.log('❌ No AI strategies found');
  }

  // Check agent ranks
  console.log('\n--- Agent Ranks ---');
  const { data: ranks } = await supabase.from('agent_ranks').select('level, name');
  if (ranks && ranks.length > 0) {
    console.log(`✅ Agent ranks: ${ranks.length} levels`);
  } else {
    console.log('❌ No agent ranks found');
  }

  // Summary
  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================');
  console.log(`Tables: ${present.length}/${EXPECTED_TABLES.length} ${missing.length === 0 ? '✅ ALL PRESENT' : '❌ INCOMPLETE'}`);
  console.log(`Project: ${project ? '✅' : '❌'}`);
  console.log(`System User: ${systemUser ? '✅' : '❌'}`);
  console.log(`Demo Data: ${profiles && profiles.length > 0 ? '✅' : '❌'}`);
  console.log('========================================');

  if (missing.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
