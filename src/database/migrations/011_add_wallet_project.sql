-- ============================================================
-- Migration 011: Add ONE Wallet Project
-- Adds the default project for ONE Wallet app connection
-- ============================================================

-- First, ensure we have a system user for the owner
INSERT INTO users (id, email, wallet_address, kyc_status, kyc_level, membership_tier)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system@one-wallet.app',
  '0x0000000000000000000000000000000000000000',
  'verified',
  3,
  'pro'
) ON CONFLICT (id) DO NOTHING;

-- Create system team if teams table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
    INSERT INTO teams (id, name, slug, owner_id, billing_plan, max_projects, max_api_calls_per_month)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'ONE Ecosystem',
      'one-ecosystem',
      '00000000-0000-0000-0000-000000000001',
      'pro',
      100,
      10000000
    ) ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- Add api_key and api_secret columns to projects if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'api_key') THEN
    ALTER TABLE projects ADD COLUMN api_key VARCHAR(255);
    ALTER TABLE projects ADD COLUMN api_secret VARCHAR(255);
    ALTER TABLE projects ADD COLUMN owner_id UUID;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);
  END IF;
END $$;

-- Insert the ONE Wallet project
INSERT INTO projects (
  id,
  team_id,
  name,
  slug,
  description,
  client_id,
  api_key,
  api_secret,
  owner_id,
  status,
  settings
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'ONE Wallet App',
  'one-wallet-app',
  'Official ONE Wallet mobile and web application',
  'one_pk_e8f647bfa643fdcfaa3a23f760488e49be09f929296eed4a6c399d437d907f60',
  'one_pk_e8f647bfa643fdcfaa3a23f760488e49be09f929296eed4a6c399d437d907f60',
  'one_sk_' || encode(gen_random_bytes(32), 'hex'),
  '00000000-0000-0000-0000-000000000001',
  'active',
  '{
    "allowedDomains": ["localhost", "*.netlify.app", "*.one-wallet.app", "*"],
    "allowedBundleIds": ["app.onewallet", "app.one-wallet"],
    "enabledServices": {
      "connect": true,
      "wallet": true,
      "contracts": true,
      "pay": true,
      "engine": true
    },
    "rateLimit": {
      "requestsPerMinute": 1000,
      "requestsPerDay": 100000
    }
  }'::jsonb
) ON CONFLICT (client_id) DO UPDATE SET
  api_key = EXCLUDED.api_key,
  settings = EXCLUDED.settings,
  updated_at = NOW();

-- Create API key entry for the project
INSERT INTO project_api_keys (
  id,
  project_id,
  name,
  key_type,
  key_hash,
  key_prefix,
  allowed_domains,
  permissions,
  rate_limit_per_minute,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'ONE Wallet Production Key',
  'publishable',
  encode(sha256('one_pk_e8f647bfa643fdcfaa3a23f760488e49be09f929296eed4a6c399d437d907f60'::bytea), 'hex'),
  'one_pk_e8f647',
  ARRAY['localhost', '*.netlify.app', '*.one-wallet.app', '*'],
  '["*"]'::jsonb,
  1000,
  true
) ON CONFLICT DO NOTHING;

-- Add sample AI strategies if ai_strategies table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_strategies') THEN
    INSERT INTO ai_strategies (name, description, category, risk_level, min_investment, expected_apy_min, expected_apy_max, is_active) VALUES
    ('Conservative DCA', 'Dollar cost averaging into blue-chip assets', 'conservative', 2, 100, 5, 15, true),
    ('Balanced Growth', 'Balanced portfolio with moderate risk', 'balanced', 5, 500, 10, 25, true),
    ('Aggressive Alpha', 'High-frequency trading for alpha', 'aggressive', 8, 1000, 20, 50, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

SELECT 'Migration 011: ONE Wallet project added successfully!' as status;
