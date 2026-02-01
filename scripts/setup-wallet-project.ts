/**
 * Setup Script - Create ONE Wallet project with API key
 * Creates the system user, team, project, and API key records.
 *
 * Run: npx ts-node scripts/setup-wallet-project.ts
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Config from environment variables with fallback
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fyktnfziqyjbrrzszzuz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5a3RuZnppcXlqYnJyenN6enV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIwNzQyNiwiZXhwIjoyMDc4NzgzNDI2fQ.cf5FqnEcmx6YTLswdiQ3cB_lWoxv3j9M9q4IZwH_oCU';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const SYSTEM_TEAM_ID = '00000000-0000-0000-0000-000000000001';
const WALLET_PROJECT_ID = '00000000-0000-0000-0000-000000000002';
const WALLET_API_KEY_ID = '00000000-0000-0000-0000-000000000003';

function generateClientId(): string {
  return `one_pk_${crypto.randomBytes(32).toString('hex')}`;
}

function generateApiSecret(): string {
  return `one_sk_${crypto.randomBytes(32).toString('hex')}`;
}

async function main() {
  console.log('ONE Wallet Project Setup');
  console.log('========================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('========================================\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Step 1: Ensure system user exists
  console.log('[1/5] Creating system user...');
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: SYSTEM_USER_ID,
      email: 'system@one-wallet.app',
      wallet_address: '0x0000000000000000000000000000000000000000',
      role: 'admin',
      kyc_status: 'verified',
      kyc_level: 3,
      membership_tier: 'vip',
    }, { onConflict: 'id' });

  if (userError) {
    console.error('  Error creating system user:', userError.message);
    return;
  }
  console.log('  System user ready.');

  // Step 2: Ensure system team exists
  console.log('[2/5] Creating system team...');
  const { error: teamError } = await supabase
    .from('teams')
    .upsert({
      id: SYSTEM_TEAM_ID,
      name: 'ONE Ecosystem',
      slug: 'one-ecosystem',
      owner_id: SYSTEM_USER_ID,
      billing_plan: 'enterprise',
      max_projects: 100,
      max_api_calls_per_month: 100000000,
    }, { onConflict: 'id' });

  if (teamError) {
    console.error('  Error creating team:', teamError.message);
    return;
  }

  // Ensure team member record
  await supabase
    .from('team_members')
    .upsert({
      team_id: SYSTEM_TEAM_ID,
      user_id: SYSTEM_USER_ID,
      role: 'owner',
    }, { onConflict: 'team_id,user_id' });

  console.log('  System team ready.');

  // Step 3: Check if project already exists
  console.log('[3/5] Checking existing project...');
  const { data: existing } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', 'one-wallet-app')
    .single();

  if (existing) {
    console.log('\n========================================');
    console.log('Project already exists!');
    console.log('========================================');
    console.log(`Project ID:  ${existing.id}`);
    console.log(`Name:        ${existing.name}`);
    console.log(`Client ID:   ${existing.client_id}`);
    console.log(`API Key:     ${existing.api_key}`);
    console.log(`Status:      ${existing.status}`);
    console.log('========================================\n');
    console.log('Add to your wallet .env:');
    console.log(`EXPO_PUBLIC_ONE_CLIENT_ID=${existing.client_id}`);
    console.log(`EXPO_PUBLIC_ONE_ENGINE_URL=http://localhost:4000/api`);
    console.log('========================================');
    return;
  }

  // Step 4: Create the project
  console.log('[4/5] Creating ONE Wallet project...');
  const clientId = process.env.ONE_WALLET_CLIENT_ID || generateClientId();
  const apiSecret = generateApiSecret();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      id: WALLET_PROJECT_ID,
      team_id: SYSTEM_TEAM_ID,
      name: 'ONE Wallet App',
      slug: 'one-wallet-app',
      description: 'Official ONE Wallet mobile and web application',
      client_id: clientId,
      api_key: clientId,
      api_secret: apiSecret,
      owner_id: SYSTEM_USER_ID,
      status: 'active',
      settings: {
        allowedDomains: ['localhost', '*.netlify.app', '*.one-wallet.app', '*'],
        allowedBundleIds: ['app.onewallet', 'app.one-wallet'],
        enabledServices: {
          connect: true,
          wallet: true,
          contracts: true,
          pay: true,
          engine: true,
        },
        rateLimit: {
          requestsPerMinute: 1000,
          requestsPerDay: 100000,
        },
      },
    })
    .select()
    .single();

  if (projectError) {
    console.error('  Error creating project:', projectError.message);
    if (projectError.code === '42P01') {
      console.log('\n  The projects table does not exist.');
      console.log('  Run COMPLETE_DATABASE_SETUP.sql first.');
    }
    return;
  }

  // Step 5: Create API key record
  console.log('[5/5] Creating API key...');
  const keyHash = crypto.createHash('sha256').update(clientId).digest('hex');

  const { error: keyError } = await supabase
    .from('project_api_keys')
    .insert({
      id: WALLET_API_KEY_ID,
      project_id: WALLET_PROJECT_ID,
      name: 'ONE Wallet Production Key',
      key_type: 'publishable',
      key_hash: keyHash,
      key_prefix: clientId.substring(0, 15),
      allowed_domains: ['localhost', '*.netlify.app', '*.one-wallet.app', '*'],
      permissions: ['*'],
      rate_limit_per_minute: 1000,
      is_active: true,
    });

  if (keyError) {
    console.error('  Error creating API key:', keyError.message);
  }

  // Create project quota record
  await supabase
    .from('project_quotas')
    .insert({ project_id: WALLET_PROJECT_ID })
    .then(() => {});

  console.log('\n========================================');
  console.log('Project created successfully!');
  console.log('========================================');
  console.log(`Project ID:  ${project.id}`);
  console.log(`Name:        ${project.name}`);
  console.log(`Client ID:   ${clientId}`);
  console.log(`API Secret:  ${apiSecret}`);
  console.log('========================================\n');
  console.log('Add to your wallet .env:');
  console.log(`EXPO_PUBLIC_ONE_CLIENT_ID=${clientId}`);
  console.log(`EXPO_PUBLIC_ONE_ENGINE_URL=http://localhost:4000/api`);
  console.log('========================================');
}

main().catch(console.error);
