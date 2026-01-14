/**
 * Setup Script - Create wallet project with API key
 * Run: npx ts-node scripts/setup-wallet-project.ts
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Config from .env
const SUPABASE_URL = 'https://fyktnfziqyjbrrzszzuz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5a3RuZnppcXlqYnJyenN6enV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIwNzQyNiwiZXhwIjoyMDc4NzgzNDI2fQ.cf5FqnEcmx6YTLswdiQ3cB_lWoxv3j9M9q4IZwH_oCU';

// Generate API key
function generateApiKey(): string {
  return `one_pk_${crypto.randomBytes(32).toString('hex')}`;
}

function generateApiSecret(): string {
  return `one_sk_${crypto.randomBytes(32).toString('hex')}`;
}

async function main() {
  console.log('Creating Supabase client...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const projectName = 'ONE Wallet App';
  const projectSlug = 'one-wallet-app';

  // Check if project exists
  const { data: existing } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', projectSlug)
    .single();

  if (existing) {
    console.log('\n========================================');
    console.log('Project already exists!');
    console.log('========================================');
    console.log(`Project ID: ${existing.id}`);
    console.log(`Project Name: ${existing.name}`);
    console.log(`API Key: ${existing.api_key}`);
    console.log('========================================\n');
    console.log('Add this to your wallet .env file:');
    console.log(`EXPO_PUBLIC_ONE_CLIENT_ID=${existing.api_key}`);
    console.log('========================================');
    return;
  }

  // Generate keys
  const apiKey = generateApiKey();
  const apiSecret = generateApiSecret();

  console.log('Creating project...');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: projectName,
      slug: projectSlug,
      owner_id: '00000000-0000-0000-0000-000000000000', // System owner
      api_key: apiKey,
      api_secret: apiSecret,
      is_active: true,
      settings: {
        allowedDomains: ['localhost', '*.netlify.app', '*.one-wallet.app'],
        rateLimit: 10000,
        features: {
          wallet: true,
          swap: true,
          contracts: true,
          fiat: true,
          payments: true,
          quant: true,
        },
      },
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);

    // If projects table doesn't exist, create the SQL
    if (error.code === '42P01') {
      console.log('\nThe projects table does not exist. Run this SQL in Supabase:');
      console.log(`
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  api_secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_api_key ON projects(api_key);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
      `);
    }
    return;
  }

  console.log('\n========================================');
  console.log('Project created successfully!');
  console.log('========================================');
  console.log(`Project ID: ${data.id}`);
  console.log(`Project Name: ${data.name}`);
  console.log(`API Key: ${apiKey}`);
  console.log(`API Secret: ${apiSecret}`);
  console.log('========================================\n');
  console.log('Add these to your wallet .env file:');
  console.log(`EXPO_PUBLIC_ONE_CLIENT_ID=${apiKey}`);
  console.log(`EXPO_PUBLIC_ONE_ENGINE_URL=http://localhost:4000/api`);
  console.log('========================================');
}

main().catch(console.error);
