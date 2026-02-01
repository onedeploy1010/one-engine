-- ============================================================================
-- COMPLETE_DATABASE_SETUP.sql
-- ONE Ecosystem Complete Database Schema (70 tables)
-- Idempotent: safe to run multiple times on existing database
-- ============================================================================

-- ======================== A. EXTENSIONS ========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================== B. ENUM TYPES (22) ========================
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user', 'agent', 'admin', 'super_admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE membership_tier AS ENUM ('free', 'basic', 'premium', 'vip'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE wallet_type AS ENUM ('smart', 'eoa', 'multisig'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE transaction_type AS ENUM ('transfer', 'swap', 'contract_call', 'deploy', 'approval'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE contract_type AS ENUM ('token', 'nft', 'marketplace', 'staking', 'dao', 'custom'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE fiat_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_type AS ENUM ('qr', 'x402', 'invoice', 'subscription'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'confirmed', 'settled', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE strategy_type AS ENUM ('grid', 'dca', 'arbitrage', 'momentum', 'ai_driven'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'aggressive'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE position_status AS ENUM ('active', 'paused', 'closed', 'liquidated'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE order_side AS ENUM ('buy', 'sell'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE exchange_name AS ENUM ('bybit', 'binance'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE forex_investment_status AS ENUM ('pending', 'active', 'completed', 'redeemed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE forex_pool_type AS ENUM ('clearing', 'hedging', 'insurance'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE forex_trade_status AS ENUM ('rfq', 'quoted', 'matched', 'settled', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE forex_trade_side AS ENUM ('buy', 'sell'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ======================== C. HELPER FUNCTIONS ========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alias used by 014_ai_ab_book
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        LOOP
            NEW.referral_code := generate_referral_code();
            EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE referral_code = NEW.referral_code);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS VARCHAR AS $$
BEGIN
    RETURN 'one_pk_' || encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_api_key(key_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE prefix VARCHAR;
BEGIN
    IF key_type = 'publishable' THEN prefix := 'one_pk_'; ELSE prefix := 'one_sk_'; END IF;
    RETURN prefix || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Forex helper
CREATE OR REPLACE FUNCTION update_forex_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- D. TABLES (70 total, ordered by FK dependencies)
-- ============================================================================

-- ==================== D1. users ====================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    wallet_address VARCHAR(42),
    smart_account_address VARCHAR(42),
    thirdweb_user_id VARCHAR(255),
    role user_role DEFAULT 'user',
    kyc_status kyc_status DEFAULT 'none',
    kyc_level INTEGER DEFAULT 0,
    membership_tier membership_tier DEFAULT 'free',
    agent_level INTEGER DEFAULT 0,
    referral_code VARCHAR(20) UNIQUE,
    referred_by UUID REFERENCES users(id),
    total_referrals INTEGER DEFAULT 0,
    total_team_volume DECIMAL(20, 2) DEFAULT 0,
    wallet_status VARCHAR(50) DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Ensure columns exist if table was created by earlier migrations (000/001)
ALTER TABLE users ADD COLUMN IF NOT EXISTS thirdweb_user_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_level INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_level INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_team_volume DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS smart_account_address VARCHAR(42);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_smart_account ON users(smart_account_address);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_thirdweb ON users(thirdweb_user_id);

-- ==================== D2. otp_codes ====================
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'login',
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, type)
);
CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- ==================== D3. teams ====================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES users(id),
    billing_plan VARCHAR(50) DEFAULT 'free',
    billing_email VARCHAR(255),
    max_projects INT DEFAULT 3,
    max_api_calls_per_month BIGINT DEFAULT 100000,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);

-- ==================== D4. team_members ====================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ==================== D5. projects (unified) ====================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    client_id VARCHAR(64) NOT NULL UNIQUE,
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    owner_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB DEFAULT '{
        "allowedDomains": [],
        "allowedBundleIds": [],
        "enabledServices": {"connect": true, "wallet": true, "contracts": false, "pay": false, "engine": false},
        "rateLimit": {"requestsPerMinute": 100, "requestsPerDay": 10000}
    }',
    thirdweb_client_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, slug)
);
-- Ensure columns exist if table was created by earlier migrations (010)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS api_key VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS api_secret VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS thirdweb_client_id VARCHAR(255);
-- Widen client_id if it was created as VARCHAR(64) by migration 010
ALTER TABLE projects ALTER COLUMN client_id TYPE VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);

-- ==================== D6. project_api_keys ====================
CREATE TABLE IF NOT EXISTS project_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Default Key',
    key_type VARCHAR(50) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    allowed_domains TEXT[],
    allowed_ips TEXT[],
    permissions JSONB DEFAULT '["*"]',
    rate_limit_per_minute INT DEFAULT 100,
    last_used_at TIMESTAMPTZ,
    total_requests BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_api_keys_project ON project_api_keys(project_id);

-- ==================== D7. project_users ====================
CREATE TABLE IF NOT EXISTS project_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    auth_method VARCHAR(50),
    auth_provider_id VARCHAR(255),
    wallet_address VARCHAR(255),
    smart_account_address VARCHAR(255),
    thirdweb_user_id VARCHAR(255),
    thirdweb_wallet_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, email),
    UNIQUE(project_id, wallet_address)
);
CREATE INDEX IF NOT EXISTS idx_project_users_project ON project_users(project_id);
CREATE INDEX IF NOT EXISTS idx_project_users_email ON project_users(project_id, email);
CREATE INDEX IF NOT EXISTS idx_project_users_wallet ON project_users(project_id, wallet_address);

-- ==================== D8. project_wallets ====================
CREATE TABLE IF NOT EXISTS project_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_user_id UUID NOT NULL REFERENCES project_users(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    wallet_type VARCHAR(50) NOT NULL,
    chain_ids INT[] DEFAULT '{1, 137, 56, 42161}',
    smart_account_config JSONB,
    thirdweb_wallet_id VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, address)
);
CREATE INDEX IF NOT EXISTS idx_project_wallets_user ON project_wallets(project_user_id);

-- ==================== D9. project_backend_wallets ====================
CREATE TABLE IF NOT EXISTS project_backend_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    key_id VARCHAR(255),
    encrypted_private_key TEXT,
    thirdweb_backend_wallet_id VARCHAR(255),
    nonce INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, address)
);

-- ==================== D10. project_transactions ====================
CREATE TABLE IF NOT EXISTS project_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_address VARCHAR(255) NOT NULL,
    backend_wallet_id UUID REFERENCES project_backend_wallets(id),
    to_address VARCHAR(255) NOT NULL,
    chain_id INT NOT NULL,
    data TEXT,
    value VARCHAR(78) DEFAULT '0',
    gas_limit VARCHAR(78),
    max_fee_per_gas VARCHAR(78),
    max_priority_fee_per_gas VARCHAR(78),
    status VARCHAR(50) DEFAULT 'queued',
    tx_hash VARCHAR(255),
    block_number BIGINT,
    gas_used VARCHAR(78),
    error_message TEXT,
    retry_count INT DEFAULT 0,
    thirdweb_queue_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    submitted_at TIMESTAMPTZ,
    mined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_transactions_project ON project_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_transactions_status ON project_transactions(project_id, status);

-- ==================== D11. project_contracts ====================
CREATE TABLE IF NOT EXISTS project_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    chain_id INT NOT NULL,
    contract_type VARCHAR(100),
    abi JSONB,
    deployer_address VARCHAR(255),
    deploy_tx_hash VARCHAR(255),
    deployed_at TIMESTAMPTZ,
    thirdweb_contract_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    verified BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id, address)
);

-- ==================== D12. project_payments ====================
CREATE TABLE IF NOT EXISTS project_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_user_id UUID REFERENCES project_users(id),
    payment_type VARCHAR(50) NOT NULL,
    fiat_amount DECIMAL(18, 2),
    fiat_currency VARCHAR(10),
    crypto_amount VARCHAR(78),
    crypto_currency VARCHAR(20),
    chain_id INT,
    provider VARCHAR(50),
    provider_tx_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    destination_address VARCHAR(255),
    tx_hash VARCHAR(255),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== D13. api_usage ====================
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES project_api_keys(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT,
    response_time_ms INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    origin VARCHAR(255),
    cost_units INTEGER DEFAULT 1,
    provider_id VARCHAR(50),
    error_code VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Ensure columns exist if table was created by earlier migration (010)
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS cost_units INTEGER DEFAULT 1;
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS provider_id VARCHAR(50);
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS error_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_api_usage_project ON api_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_project_created ON api_usage(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_created ON api_usage(api_key_id, created_at DESC);

-- ==================== D14. api_usage_daily ====================
CREATE TABLE IF NOT EXISTS api_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_requests BIGINT DEFAULT 0,
    successful_requests BIGINT DEFAULT 0,
    failed_requests BIGINT DEFAULT 0,
    requests_by_endpoint JSONB DEFAULT '{}',
    connect_requests BIGINT DEFAULT 0,
    wallet_requests BIGINT DEFAULT 0,
    contract_requests BIGINT DEFAULT 0,
    pay_requests BIGINT DEFAULT 0,
    UNIQUE(project_id, date)
);

-- ==================== D15. provider_usage ====================
CREATE TABLE IF NOT EXISTS provider_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider_id VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(20) NOT NULL,
    request_size INTEGER DEFAULT 0,
    response_size INTEGER DEFAULT 0,
    latency_ms INTEGER NOT NULL,
    success BOOLEAN DEFAULT true,
    error_code VARCHAR(100),
    cost_units INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_usage_project_created ON provider_usage(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_usage_provider_created ON provider_usage(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_usage_created ON provider_usage(created_at DESC);

-- ==================== D16. project_quotas ====================
CREATE TABLE IF NOT EXISTS project_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    api_requests_monthly_limit INTEGER DEFAULT 100000,
    api_requests_monthly_used INTEGER DEFAULT 0,
    cost_units_monthly_limit INTEGER DEFAULT 10000,
    cost_units_monthly_used INTEGER DEFAULT 0,
    current_period_start TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
    current_period_end TIMESTAMPTZ DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month',
    warning_threshold INTEGER DEFAULT 80,
    warning_sent BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== D17. wallets ====================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    address VARCHAR(42) NOT NULL,
    smart_account_address VARCHAR(42) NOT NULL,
    wallet_type wallet_type DEFAULT 'smart',
    chain_id INTEGER NOT NULL DEFAULT 8453,
    is_default BOOLEAN DEFAULT FALSE,
    encrypted_key TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_chain ON wallets(user_id, chain_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_smart_account ON wallets(smart_account_address);

-- ==================== D18. contracts_registry ====================
CREATE TABLE IF NOT EXISTS contracts_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    contract_type contract_type DEFAULT 'custom',
    abi JSONB NOT NULL DEFAULT '[]',
    bytecode TEXT,
    verified BOOLEAN DEFAULT FALSE,
    deploy_tx_hash VARCHAR(66),
    deployer_address VARCHAR(42),
    constructor_args JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_address_chain ON contracts_registry(address, chain_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts_registry(contract_type);

-- ==================== D19. transactions ====================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    hash VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    value VARCHAR(78),
    data TEXT,
    status transaction_status DEFAULT 'pending',
    tx_type transaction_type DEFAULT 'transfer',
    gas_used VARCHAR(78),
    gas_price VARCHAR(78),
    block_number BIGINT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);
-- Note: existing table may use tx_hash/chain instead of hash/chain_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_hash_chain ON transactions(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

-- ==================== D20. fiat_transactions ====================
CREATE TABLE IF NOT EXISTS fiat_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('onramp', 'offramp')),
    fiat_currency VARCHAR(10) NOT NULL,
    fiat_amount DECIMAL(20, 2) NOT NULL,
    crypto_currency VARCHAR(20) NOT NULL,
    crypto_amount VARCHAR(78) NOT NULL,
    exchange_rate DECIMAL(20, 8),
    fee_amount DECIMAL(20, 2),
    status fiat_status DEFAULT 'pending',
    provider VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    wallet_address VARCHAR(42) NOT NULL,
    chain_id INTEGER DEFAULT 8453,
    tx_hash VARCHAR(66),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_fiat_user ON fiat_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fiat_status ON fiat_transactions(status);
CREATE INDEX IF NOT EXISTS idx_fiat_external ON fiat_transactions(external_id);

-- ==================== D21. payments ====================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payment_type payment_type NOT NULL,
    status payment_status DEFAULT 'pending',
    amount VARCHAR(78) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    chain_id INTEGER NOT NULL,
    from_address VARCHAR(42),
    to_address VARCHAR(42) NOT NULL,
    tx_hash VARCHAR(66),
    qr_code TEXT,
    invoice_number VARCHAR(100),
    description TEXT,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ==================== D22. quant_strategies ====================
CREATE TABLE IF NOT EXISTS quant_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    strategy_type strategy_type NOT NULL,
    risk_level risk_level DEFAULT 'medium',
    min_investment DECIMAL(20, 2) DEFAULT 100,
    max_investment DECIMAL(20, 2) DEFAULT 1000000,
    expected_apy DECIMAL(10, 2) DEFAULT 0,
    current_apy DECIMAL(10, 2) DEFAULT 0,
    total_aum DECIMAL(20, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    parameters JSONB DEFAULT '{}',
    ai_model VARCHAR(50),
    trading_pairs TEXT[],
    rebalance_interval INTEGER DEFAULT 86400,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strategies_type ON quant_strategies(strategy_type);
CREATE INDEX IF NOT EXISTS idx_strategies_active ON quant_strategies(is_active);

-- ==================== D23. quant_positions ====================
CREATE TABLE IF NOT EXISTS quant_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES quant_strategies(id) ON DELETE RESTRICT,
    status position_status DEFAULT 'active',
    invested_amount DECIMAL(20, 2) NOT NULL,
    current_value DECIMAL(20, 2),
    pnl DECIMAL(20, 2) DEFAULT 0,
    pnl_percent DECIMAL(10, 4) DEFAULT 0,
    shares DECIMAL(30, 18) DEFAULT 0,
    entry_nav DECIMAL(20, 8),
    entry_date TIMESTAMPTZ DEFAULT NOW(),
    exit_date TIMESTAMPTZ,
    last_update TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_positions_user ON quant_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_strategy ON quant_positions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON quant_positions(status);

-- ==================== D24. quant_daily_pnl ====================
CREATE TABLE IF NOT EXISTS quant_daily_pnl (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL REFERENCES quant_positions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    opening_value DECIMAL(20, 2) NOT NULL,
    closing_value DECIMAL(20, 2) NOT NULL,
    daily_pnl DECIMAL(20, 2) GENERATED ALWAYS AS (closing_value - opening_value) STORED,
    daily_pnl_percent DECIMAL(10, 4),
    nav_price DECIMAL(20, 8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_pnl_position_date ON quant_daily_pnl(position_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_pnl_date ON quant_daily_pnl(date DESC);

-- ==================== D25. trade_orders ====================
CREATE TABLE IF NOT EXISTS trade_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL REFERENCES quant_positions(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES quant_strategies(id) ON DELETE SET NULL,
    exchange exchange_name NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side order_side NOT NULL,
    order_type order_type NOT NULL,
    quantity DECIMAL(30, 18) NOT NULL,
    price DECIMAL(30, 18),
    stop_price DECIMAL(30, 18),
    status order_status DEFAULT 'pending',
    external_id VARCHAR(255),
    filled_qty DECIMAL(30, 18),
    avg_price DECIMAL(30, 18),
    commission DECIMAL(20, 8),
    commission_asset VARCHAR(20),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    filled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_position ON trade_orders(position_id);
CREATE INDEX IF NOT EXISTS idx_orders_strategy ON trade_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON trade_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_external ON trade_orders(external_id);

-- ==================== D26. nav_snapshots ====================
CREATE TABLE IF NOT EXISTS nav_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID NOT NULL REFERENCES quant_strategies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    nav_price DECIMAL(20, 8) NOT NULL,
    total_shares DECIMAL(30, 18) NOT NULL,
    total_value DECIMAL(20, 2) NOT NULL,
    daily_return DECIMAL(10, 6),
    cumulative_return DECIMAL(10, 6),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nav_strategy_date ON nav_snapshots(strategy_id, date);
CREATE INDEX IF NOT EXISTS idx_nav_date ON nav_snapshots(date DESC);

-- ==================== D27. system_logs ====================
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level log_level NOT NULL,
    service VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    request_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_service ON system_logs(service);
CREATE INDEX IF NOT EXISTS idx_logs_created ON system_logs(created_at DESC);

-- ==================== D28. rate_limits ====================
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_size INTEGER DEFAULT 60,
    CONSTRAINT rate_limit_identity CHECK (
        project_id IS NOT NULL OR user_id IS NOT NULL OR ip_address IS NOT NULL
    )
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_project ON rate_limits(project_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address, endpoint, window_start);

-- ==================== D29. webhooks ====================
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(64) DEFAULT encode(gen_random_bytes(32), 'hex'),
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id);

-- ==================== D30. webhook_deliveries ====================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- ==================== D31. ecosystem_apps ====================
CREATE TABLE IF NOT EXISTS ecosystem_apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    supabase_url VARCHAR(500),
    supabase_project_id VARCHAR(100),
    api_endpoint VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    sync_config JSONB DEFAULT '{"sync_users": true, "sync_wallets": true, "sync_transactions": false, "sync_interval_seconds": 300}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== D32. user_app_mappings ====================
CREATE TABLE IF NOT EXISTS user_app_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES ecosystem_apps(id) ON DELETE CASCADE,
    external_user_id VARCHAR(255) NOT NULL,
    app_specific_data JSONB DEFAULT '{}',
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, app_id),
    UNIQUE(app_id, external_user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_app_mappings_user ON user_app_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_mappings_app ON user_app_mappings(app_id);
CREATE INDEX IF NOT EXISTS idx_user_app_mappings_external ON user_app_mappings(external_user_id);

-- ==================== D33. sync_logs ====================
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES ecosystem_apps(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    records_synced INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_app ON sync_logs(app_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs(started_at DESC);

-- ==================== D34. agent_ranks ====================
CREATE TABLE IF NOT EXISTS agent_ranks (
    level INTEGER PRIMARY KEY CHECK (level >= 0 AND level <= 7),
    name TEXT NOT NULL,
    required_referrals INTEGER NOT NULL,
    required_team_volume DECIMAL(20, 2) NOT NULL,
    commission_rate DECIMAL(5, 4) NOT NULL,
    team_bonus_rate DECIMAL(5, 4) DEFAULT 0,
    benefits JSONB DEFAULT '{}'
);

-- ==================== D35. referral_rewards ====================
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reward_type TEXT NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency TEXT DEFAULT 'USDT',
    level INTEGER DEFAULT 1,
    agent_level INTEGER,
    commission_rate DECIMAL(5, 4),
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON referral_rewards(user_id);

-- ==================== D36. ai_strategies ====================
CREATE TABLE IF NOT EXISTS ai_strategies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    risk_level INTEGER NOT NULL CHECK (risk_level >= 1 AND risk_level <= 10),
    min_investment DECIMAL(20, 2) NOT NULL DEFAULT 100,
    max_investment DECIMAL(20, 2),
    lock_period_days INTEGER NOT NULL DEFAULT 30,
    expected_apy_min DECIMAL(5, 2),
    expected_apy_max DECIMAL(5, 2),
    management_fee_rate DECIMAL(5, 4) DEFAULT 0.0100,
    performance_fee_rate DECIMAL(5, 4) DEFAULT 0.2000,
    supported_pairs TEXT[] DEFAULT ARRAY['BTC/USDT', 'ETH/USDT'],
    supported_chains TEXT[] DEFAULT ARRAY['arbitrum', 'ethereum'],
    leverage_min DECIMAL(4, 2) DEFAULT 1.0,
    leverage_max DECIMAL(4, 2) DEFAULT 3.0,
    is_active BOOLEAN DEFAULT TRUE,
    tvl DECIMAL(20, 2) DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    max_drawdown DECIMAL(5, 2) DEFAULT 0,
    sharpe_ratio DECIMAL(6, 3) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- ==================== D37. ai_orders ====================
CREATE TABLE IF NOT EXISTS ai_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id TEXT NOT NULL REFERENCES ai_strategies(id),
    amount DECIMAL(20, 8) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USDT',
    chain TEXT NOT NULL DEFAULT 'arbitrum',
    status TEXT DEFAULT 'active',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    lock_end_date TIMESTAMPTZ NOT NULL,
    lock_period_days INTEGER NOT NULL DEFAULT 30,
    pause_count INTEGER DEFAULT 0,
    total_pause_days INTEGER DEFAULT 0,
    current_pause_start TIMESTAMPTZ,
    realized_profit DECIMAL(20, 8) DEFAULT 0,
    unrealized_profit DECIMAL(20, 8) DEFAULT 0,
    total_fees_paid DECIMAL(20, 8) DEFAULT 0,
    current_nav DECIMAL(20, 8),
    share_ratio DECIMAL(20, 10) DEFAULT 0,
    redemption_requested_at TIMESTAMPTZ,
    redemption_amount DECIMAL(20, 8),
    early_withdrawal_penalty_rate DECIMAL(5, 2),
    penalty_amount DECIMAL(20, 8) DEFAULT 0,
    tx_hash_deposit TEXT,
    tx_hash_redemption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ai_orders_user ON ai_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_orders_strategy ON ai_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_ai_orders_status ON ai_orders(status);

-- ==================== D38. ai_trade_batches ====================
CREATE TABLE IF NOT EXISTS ai_trade_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id TEXT NOT NULL REFERENCES ai_strategies(id),
    batch_date DATE NOT NULL,
    total_trades INTEGER DEFAULT 0,
    total_volume DECIMAL(20, 8) DEFAULT 0,
    total_pnl DECIMAL(20, 8) DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    avg_win_rate DECIMAL(5, 2) DEFAULT 0,
    nav_start DECIMAL(20, 8),
    nav_end DECIMAL(20, 8),
    nav_change_pct DECIMAL(8, 4) DEFAULT 0,
    market_conditions JSONB DEFAULT '{}',
    ai_signals JSONB DEFAULT '{}',
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(strategy_id, batch_date)
);

-- ==================== D39. ai_nav_snapshots ====================
CREATE TABLE IF NOT EXISTS ai_nav_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES ai_orders(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    nav DECIMAL(20, 8) NOT NULL,
    daily_pnl DECIMAL(20, 8) DEFAULT 0,
    daily_pnl_pct DECIMAL(8, 4) DEFAULT 0,
    cumulative_pnl DECIMAL(20, 8) DEFAULT 0,
    cumulative_pnl_pct DECIMAL(8, 4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, snapshot_date)
);

-- ==================== D40. ai_strategy_pools ====================
CREATE TABLE IF NOT EXISTS ai_strategy_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id TEXT NOT NULL REFERENCES ai_strategies(id) ON DELETE CASCADE,
    total_capital DECIMAL(20,8) NOT NULL DEFAULT 0,
    available_capital DECIMAL(20,8) NOT NULL DEFAULT 0,
    locked_capital DECIMAL(20,8) NOT NULL DEFAULT 0,
    current_nav DECIMAL(20,8) NOT NULL DEFAULT 1.0,
    total_shares DECIMAL(20,8) NOT NULL DEFAULT 0,
    total_pnl DECIMAL(20,8) DEFAULT 0,
    total_pnl_pct DECIMAL(10,4) DEFAULT 0,
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    total_fees_collected DECIMAL(20,8) DEFAULT 0,
    current_drawdown DECIMAL(10,4) DEFAULT 0,
    max_drawdown DECIMAL(10,4) DEFAULT 0,
    daily_pnl DECIMAL(20,8) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    avg_win DECIMAL(20,8) DEFAULT 0,
    avg_loss DECIMAL(20,8) DEFAULT 0,
    max_position_size DECIMAL(20,8),
    max_leverage DECIMAL(5,2) DEFAULT 10,
    daily_trade_limit INTEGER DEFAULT 50,
    trades_today INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_trade_at TIMESTAMPTZ,
    last_nav_update_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_strategy ON ai_strategy_pools(strategy_id);

-- ==================== D41. ai_agent_memory ====================
CREATE TABLE IF NOT EXISTS ai_agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('market_pattern', 'successful_trade', 'failed_trade', 'learned_rule', 'risk_event')),
    symbol TEXT,
    market_condition JSONB,
    pattern_description TEXT,
    confidence_score DECIMAL(5,2),
    trade_action TEXT,
    entry_price DECIMAL(20,8),
    exit_price DECIMAL(20,8),
    pnl DECIMAL(20,8),
    pnl_pct DECIMAL(10,4),
    lesson_learned TEXT,
    should_repeat BOOLEAN DEFAULT TRUE,
    importance_weight DECIMAL(5,4) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ai_memory_agent ON ai_agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_type ON ai_agent_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_memory_symbol ON ai_agent_memory(symbol);
CREATE INDEX IF NOT EXISTS idx_ai_memory_importance ON ai_agent_memory(importance_weight DESC);

-- ==================== D42. ai_decision_log ====================
CREATE TABLE IF NOT EXISTS ai_decision_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    strategy_id TEXT REFERENCES ai_strategies(id),
    batch_id TEXT NOT NULL,
    decision_type TEXT NOT NULL CHECK (decision_type IN ('trade', 'hold', 'rebalance', 'risk_adjust', 'stop_loss', 'take_profit')),
    action TEXT,
    symbol TEXT,
    suggested_amount DECIMAL(20,8),
    suggested_price DECIMAL(20,8),
    stop_loss_price DECIMAL(20,8),
    take_profit_price DECIMAL(20,8),
    leverage DECIMAL(5,2) DEFAULT 1,
    market_analysis TEXT,
    reasoning TEXT NOT NULL,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    market_data JSONB,
    current_positions JSONB,
    pool_capital DECIMAL(20,8),
    was_executed BOOLEAN DEFAULT FALSE,
    execution_id UUID,
    execution_price DECIMAL(20,8),
    execution_time TIMESTAMPTZ,
    outcome_pnl DECIMAL(20,8),
    outcome_pnl_pct DECIMAL(10,4),
    was_successful BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    evaluated_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ai_decision_agent ON ai_decision_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_strategy ON ai_decision_log(strategy_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_batch ON ai_decision_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_symbol ON ai_decision_log(symbol);
CREATE INDEX IF NOT EXISTS idx_ai_decision_success ON ai_decision_log(was_successful) WHERE was_executed = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_decision_created ON ai_decision_log(created_at DESC);

-- ==================== D43. ai_trade_executions (was missing) ====================
CREATE TABLE IF NOT EXISTS ai_trade_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id TEXT NOT NULL REFERENCES ai_strategies(id),
    pool_id UUID NOT NULL REFERENCES ai_strategy_pools(id),
    decision_id UUID REFERENCES ai_decision_log(id),
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short', 'buy', 'sell')),
    amount DECIMAL(20,8) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    exit_price DECIMAL(20,8),
    quantity DECIMAL(20,8) NOT NULL,
    leverage DECIMAL(5,2) DEFAULT 1,
    pnl DECIMAL(20,8) DEFAULT 0,
    pnl_pct DECIMAL(10,4) DEFAULT 0,
    fees DECIMAL(20,8) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
    exchange TEXT,
    external_order_id TEXT,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ai_executions_strategy ON ai_trade_executions(strategy_id);
-- Note: pool_id may not exist on pre-existing ai_trade_executions table; skip if missing
-- CREATE INDEX IF NOT EXISTS idx_ai_executions_pool ON ai_trade_executions(pool_id);
CREATE INDEX IF NOT EXISTS idx_ai_executions_status ON ai_trade_executions(status);

-- ==================== D44. ai_open_positions ====================
CREATE TABLE IF NOT EXISTS ai_open_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES ai_strategy_pools(id) ON DELETE CASCADE,
    strategy_id TEXT NOT NULL REFERENCES ai_strategies(id),
    execution_id UUID REFERENCES ai_trade_executions(id),
    decision_id UUID REFERENCES ai_decision_log(id),
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    quantity DECIMAL(20,8) NOT NULL,
    leverage DECIMAL(5,2) DEFAULT 1,
    notional_value DECIMAL(20,8),
    margin_used DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    unrealized_pnl_pct DECIMAL(10,4) DEFAULT 0,
    stop_loss_price DECIMAL(20,8),
    take_profit_price DECIMAL(20,8),
    liquidation_price DECIMAL(20,8),
    entry_reasoning TEXT,
    ai_confidence INTEGER,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_position_pool ON ai_open_positions(pool_id);
CREATE INDEX IF NOT EXISTS idx_position_strategy ON ai_open_positions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_position_symbol ON ai_open_positions(symbol);

-- ==================== D45. ai_performance_snapshots ====================
CREATE TABLE IF NOT EXISTS ai_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES ai_strategy_pools(id) ON DELETE CASCADE,
    strategy_id TEXT NOT NULL REFERENCES ai_strategies(id),
    snapshot_date DATE NOT NULL,
    nav DECIMAL(20,8) NOT NULL,
    total_capital DECIMAL(20,8),
    total_shares DECIMAL(20,8),
    daily_return DECIMAL(10,6),
    daily_pnl DECIMAL(20,8),
    cumulative_return DECIMAL(10,6),
    trades_executed INTEGER DEFAULT 0,
    volume_traded DECIMAL(20,8) DEFAULT 0,
    fees_paid DECIMAL(20,8) DEFAULT 0,
    drawdown DECIMAL(10,4),
    sharpe_ratio DECIMAL(10,4),
    volatility DECIMAL(10,4),
    btc_price DECIMAL(20,8),
    eth_price DECIMAL(20,8),
    market_sentiment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pool_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_snapshot_strategy ON ai_performance_snapshots(strategy_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_date ON ai_performance_snapshots(snapshot_date DESC);

-- ==================== D46. ai_order_shares ====================
CREATE TABLE IF NOT EXISTS ai_order_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES ai_orders(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    pool_id UUID NOT NULL REFERENCES ai_strategy_pools(id),
    shares_owned DECIMAL(20,8) NOT NULL,
    share_percentage DECIMAL(10,6) NOT NULL,
    avg_entry_nav DECIMAL(20,8) NOT NULL,
    total_invested DECIMAL(20,8) NOT NULL,
    current_value DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8),
    unrealized_pnl_pct DECIMAL(10,4),
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    fees_paid DECIMAL(20,8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_shares_order ON ai_order_shares(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shares_user ON ai_order_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_order_shares_pool ON ai_order_shares(pool_id);

-- ==================== D47. ai_ab_book_trades ====================
CREATE TABLE IF NOT EXISTS ai_ab_book_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES ai_strategy_pools(id),
    strategy_id TEXT REFERENCES ai_strategies(id),
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(24,8) NOT NULL,
    book_type CHAR(1) NOT NULL CHECK (book_type IN ('A', 'B')),
    order_id TEXT NOT NULL,
    external_id TEXT,
    filled_qty DECIMAL(24,8) NOT NULL DEFAULT 0,
    avg_price DECIMAL(24,8) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    is_simulated BOOLEAN NOT NULL DEFAULT false,
    slippage_pct DECIMAL(10,6),
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_pool ON ai_ab_book_trades(pool_id);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_strategy ON ai_ab_book_trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_book_type ON ai_ab_book_trades(book_type);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_created ON ai_ab_book_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_is_simulated ON ai_ab_book_trades(is_simulated);

-- ==================== D48. ai_ab_book_config ====================
CREATE TABLE IF NOT EXISTS ai_ab_book_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== D49. user_profiles ====================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255),
    wallet_type VARCHAR(50) DEFAULT 'smart',
    wallet_status VARCHAR(50) DEFAULT 'active',
    kyc_status VARCHAR(50) DEFAULT 'none',
    kyc_level INTEGER DEFAULT 0,
    membership_tier VARCHAR(50) DEFAULT 'free',
    referral_code VARCHAR(20) UNIQUE,
    referred_by UUID,
    agent_level INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_referral ON user_profiles(referral_code);

-- ==================== D50. user_settings ====================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    language VARCHAR(10) DEFAULT 'en',
    currency VARCHAR(10) DEFAULT 'USD',
    theme VARCHAR(20) DEFAULT 'system',
    push_notifications BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    notify_transactions BOOLEAN DEFAULT true,
    notify_price_alerts BOOLEAN DEFAULT true,
    notify_security_alerts BOOLEAN DEFAULT true,
    notify_promotions BOOLEAN DEFAULT false,
    biometric_enabled BOOLEAN DEFAULT false,
    biometric_type VARCHAR(50),
    pin_enabled BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_method VARCHAR(50),
    hide_balance BOOLEAN DEFAULT false,
    hide_transactions BOOLEAN DEFAULT false,
    analytics_enabled BOOLEAN DEFAULT true,
    default_chain VARCHAR(50) DEFAULT 'base',
    default_token VARCHAR(20) DEFAULT 'ETH',
    default_slippage DECIMAL(5, 2) DEFAULT 0.5,
    gas_preference VARCHAR(20) DEFAULT 'standard',
    session_timeout_minutes INTEGER DEFAULT 30,
    auto_lock_enabled BOOLEAN DEFAULT true,
    price_alerts JSONB DEFAULT '[]',
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ==================== D51. wallet_assets ====================
CREATE TABLE IF NOT EXISTS wallet_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    chain VARCHAR(50) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    token_address VARCHAR(255),
    balance_raw VARCHAR(78) DEFAULT '0',
    balance_formatted VARCHAR(50) DEFAULT '0',
    value_usd DECIMAL(20, 2) DEFAULT 0,
    price_usd DECIMAL(20, 8) DEFAULT 0,
    price_change_24h DECIMAL(10, 4) DEFAULT 0,
    icon_url TEXT,
    is_native BOOLEAN DEFAULT false,
    decimals INTEGER DEFAULT 18,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, chain, token_symbol)
);
CREATE INDEX IF NOT EXISTS idx_wallet_assets_user ON wallet_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_assets_chain ON wallet_assets(chain);
CREATE INDEX IF NOT EXISTS idx_wallet_assets_value ON wallet_assets(value_usd DESC);

-- ==================== D52. wallet_transactions ====================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    tx_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    chain VARCHAR(50) NOT NULL,
    tx_hash VARCHAR(255),
    token_symbol VARCHAR(20) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    amount_usd DECIMAL(20, 2),
    fee_amount VARCHAR(78),
    fee_usd DECIMAL(20, 2),
    counterparty_address VARCHAR(255),
    merchant_name VARCHAR(255),
    memo TEXT,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_initiated ON wallet_transactions(initiated_at DESC);

-- ==================== D53. cards ====================
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    card_type VARCHAR(50) DEFAULT 'virtual',
    card_tier VARCHAR(50) DEFAULT 'standard',
    status VARCHAR(50) DEFAULT 'active',
    card_number_masked VARCHAR(20),
    expiry_month INTEGER,
    expiry_year INTEGER,
    cardholder_name VARCHAR(255),
    daily_limit DECIMAL(20, 2) DEFAULT 5000,
    daily_spent DECIMAL(20, 2) DEFAULT 0,
    monthly_limit DECIMAL(20, 2) DEFAULT 50000,
    monthly_spent DECIMAL(20, 2) DEFAULT 0,
    online_enabled BOOLEAN DEFAULT true,
    contactless_enabled BOOLEAN DEFAULT true,
    international_enabled BOOLEAN DEFAULT true,
    pin_set BOOLEAN DEFAULT false,
    frozen BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);

-- ==================== D54. merchant_profiles ====================
CREATE TABLE IF NOT EXISTS merchant_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    business_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    merchant_type VARCHAR(50) DEFAULT 'individual',
    category VARCHAR(100) DEFAULT 'general',
    status VARCHAR(50) DEFAULT 'active',
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    daily_limit DECIMAL(20, 2) DEFAULT 10000,
    monthly_limit DECIMAL(20, 2) DEFAULT 100000,
    platform_fee_rate DECIMAL(5, 4) DEFAULT 0.025,
    total_transactions INTEGER DEFAULT 0,
    total_volume DECIMAL(20, 2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_user ON merchant_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_status ON merchant_profiles(status);

-- ==================== D55. x402_payment_urls ====================
CREATE TABLE IF NOT EXISTS x402_payment_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE CASCADE,
    user_id UUID,
    short_code VARCHAR(20) NOT NULL UNIQUE,
    full_url TEXT NOT NULL,
    url_type VARCHAR(50) DEFAULT 'payment',
    amount DECIMAL(20, 8),
    currency VARCHAR(10) DEFAULT 'USDC',
    chain VARCHAR(50) DEFAULT 'base',
    title VARCHAR(255),
    description TEXT,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    total_collected DECIMAL(20, 2) DEFAULT 0,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_x402_payment_urls_short_code ON x402_payment_urls(short_code);
CREATE INDEX IF NOT EXISTS idx_x402_payment_urls_merchant ON x402_payment_urls(merchant_id);
CREATE INDEX IF NOT EXISTS idx_x402_payment_urls_user ON x402_payment_urls(user_id);

-- ==================== D56. x402_payment_qr_codes ====================
CREATE TABLE IF NOT EXISTS x402_payment_qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_url_id UUID REFERENCES x402_payment_urls(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE CASCADE,
    user_id UUID,
    qr_type VARCHAR(50) DEFAULT 'payment',
    qr_data TEXT NOT NULL,
    qr_image_url TEXT,
    amount DECIMAL(20, 8),
    currency VARCHAR(10),
    chain VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    scan_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_x402_payment_qr_codes_user ON x402_payment_qr_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_x402_payment_qr_codes_merchant ON x402_payment_qr_codes(merchant_id);

-- ==================== D57. x402_payments ====================
CREATE TABLE IF NOT EXISTS x402_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_url_id UUID REFERENCES x402_payment_urls(id),
    merchant_id UUID REFERENCES merchant_profiles(id),
    user_id UUID,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    tx_hash VARCHAR(255),
    payer_address VARCHAR(255),
    receiver_address VARCHAR(255),
    fee_amount DECIMAL(20, 8),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_x402_payments_user ON x402_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_x402_payments_merchant ON x402_payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_x402_payments_status ON x402_payments(status);

-- ==================== D58. x402_invoices ====================
CREATE TABLE IF NOT EXISTS x402_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE CASCADE,
    customer_user_id UUID,
    invoice_number VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    chain VARCHAR(50) DEFAULT 'base',
    status VARCHAR(50) DEFAULT 'pending',
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    tx_hash VARCHAR(255),
    items JSONB DEFAULT '[]',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_x402_invoices_merchant ON x402_invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_x402_invoices_customer ON x402_invoices(customer_user_id);

-- ==================== D59. x402_receipts ====================
CREATE TABLE IF NOT EXISTS x402_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES x402_payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES x402_invoices(id),
    receipt_number VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    pdf_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_x402_receipts_payment ON x402_receipts(payment_id);

-- ==================== D60. user_security_events ====================
CREATE TABLE IF NOT EXISTS user_security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_id VARCHAR(255),
    location_country VARCHAR(100),
    location_city VARCHAR(100),
    risk_score INTEGER DEFAULT 0,
    blocked BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_security_events_user ON user_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_events_type ON user_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_security_events_created ON user_security_events(created_at DESC);

-- ==================== D61. user_devices ====================
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    platform VARCHAR(50),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    push_token TEXT,
    is_trusted BOOLEAN DEFAULT false,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);

-- ==================== D62. qr_scan_events ====================
CREATE TABLE IF NOT EXISTS qr_scan_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scanner_user_id UUID,
    qr_code_id UUID REFERENCES x402_payment_qr_codes(id),
    payment_url_id UUID REFERENCES x402_payment_urls(id),
    scan_result VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_user ON qr_scan_events(scanner_user_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_scanned ON qr_scan_events(scanned_at DESC);

-- ==================== D63. wallet_referral_rewards ====================
CREATE TABLE IF NOT EXISTS wallet_referral_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    from_user_id UUID,
    reward_type VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USDC',
    level INTEGER DEFAULT 1,
    agent_level INTEGER,
    commission_rate DECIMAL(5, 4),
    status VARCHAR(50) DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    tx_hash VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_referral_rewards_user ON wallet_referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_referral_rewards_status ON wallet_referral_rewards(status);

-- ==================== D64. wallet_ai_strategies ====================
CREATE TABLE IF NOT EXISTS wallet_ai_strategies (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    risk_level INTEGER NOT NULL CHECK (risk_level >= 1 AND risk_level <= 10),
    min_investment DECIMAL(20, 2) DEFAULT 100,
    max_investment DECIMAL(20, 2) DEFAULT 100000,
    lock_period_days INTEGER DEFAULT 30,
    expected_apy_min DECIMAL(5, 2),
    expected_apy_max DECIMAL(5, 2),
    management_fee_rate DECIMAL(5, 4) DEFAULT 0.01,
    performance_fee_rate DECIMAL(5, 4) DEFAULT 0.20,
    supported_pairs TEXT[] DEFAULT ARRAY['BTC/USDT', 'ETH/USDT'],
    supported_chains TEXT[] DEFAULT ARRAY['arbitrum', 'base'],
    is_active BOOLEAN DEFAULT true,
    tvl DECIMAL(20, 2) DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    max_drawdown DECIMAL(5, 2) DEFAULT 0,
    sharpe_ratio DECIMAL(6, 3) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== D65. wallet_ai_orders ====================
CREATE TABLE IF NOT EXISTS wallet_ai_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    strategy_id VARCHAR(100) NOT NULL REFERENCES wallet_ai_strategies(id),
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USDT',
    chain VARCHAR(50) DEFAULT 'arbitrum',
    status VARCHAR(50) DEFAULT 'active',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    lock_end_date TIMESTAMPTZ NOT NULL,
    lock_period_days INTEGER DEFAULT 30,
    pause_count INTEGER DEFAULT 0,
    total_pause_days INTEGER DEFAULT 0,
    current_pause_start TIMESTAMPTZ,
    realized_profit DECIMAL(20, 8) DEFAULT 0,
    unrealized_profit DECIMAL(20, 8) DEFAULT 0,
    total_fees_paid DECIMAL(20, 8) DEFAULT 0,
    current_nav DECIMAL(20, 8),
    share_ratio DECIMAL(20, 10) DEFAULT 0,
    redemption_requested_at TIMESTAMPTZ,
    redemption_amount DECIMAL(20, 8),
    early_withdrawal_penalty_rate DECIMAL(5, 2),
    penalty_amount DECIMAL(20, 8) DEFAULT 0,
    tx_hash_deposit VARCHAR(255),
    tx_hash_redemption VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_ai_orders_user ON wallet_ai_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ai_orders_strategy ON wallet_ai_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ai_orders_status ON wallet_ai_orders(status);

-- ==================== D66. wallet_ai_nav_snapshots ====================
CREATE TABLE IF NOT EXISTS wallet_ai_nav_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES wallet_ai_orders(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    nav DECIMAL(20, 8) NOT NULL,
    daily_pnl DECIMAL(20, 8) DEFAULT 0,
    daily_pnl_pct DECIMAL(8, 4) DEFAULT 0,
    cumulative_pnl DECIMAL(20, 8) DEFAULT 0,
    cumulative_pnl_pct DECIMAL(8, 4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_wallet_ai_nav_snapshots_order ON wallet_ai_nav_snapshots(order_id);

-- ==================== D67. forex_pools ====================
CREATE TABLE IF NOT EXISTS forex_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_type forex_pool_type NOT NULL UNIQUE,
    total_size DECIMAL(20,2) NOT NULL DEFAULT 0,
    utilization DECIMAL(5,4) NOT NULL DEFAULT 0,
    allocation DECIMAL(5,4) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== D68. forex_investments ====================
CREATE TABLE IF NOT EXISTS forex_investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20,2) NOT NULL CHECK (amount >= 100 AND amount <= 1000000),
    current_value DECIMAL(20,4) NOT NULL DEFAULT 0,
    profit DECIMAL(20,4) NOT NULL DEFAULT 0,
    status forex_investment_status NOT NULL DEFAULT 'pending',
    selected_pairs TEXT[] NOT NULL,
    cycle_days INTEGER NOT NULL CHECK (cycle_days IN (30, 60, 90, 180, 360)),
    fee_rate DECIMAL(5,4) NOT NULL,
    commission_rate DECIMAL(5,4) NOT NULL,
    pool_clearing DECIMAL(20,2) NOT NULL DEFAULT 0,
    pool_hedging DECIMAL(20,2) NOT NULL DEFAULT 0,
    pool_insurance DECIMAL(20,2) NOT NULL DEFAULT 0,
    trade_weight DECIMAL(12,8) NOT NULL DEFAULT 0,
    total_lots DECIMAL(12,4) NOT NULL DEFAULT 0,
    total_pips DECIMAL(12,4) NOT NULL DEFAULT 0,
    total_trades INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forex_investments_user ON forex_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_forex_investments_status ON forex_investments(status);
CREATE INDEX IF NOT EXISTS idx_forex_investments_user_status ON forex_investments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_forex_investments_end_date ON forex_investments(end_date) WHERE status = 'active';

-- ==================== D69. forex_trades ====================
CREATE TABLE IF NOT EXISTS forex_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID NOT NULL REFERENCES forex_investments(id) ON DELETE CASCADE,
    pair_id TEXT NOT NULL,
    side forex_trade_side NOT NULL,
    lots DECIMAL(10,4) NOT NULL CHECK (lots > 0),
    rfq_price DECIMAL(20,6) NOT NULL,
    quote_price DECIMAL(20,6) NOT NULL,
    match_price DECIMAL(20,6) NOT NULL DEFAULT 0,
    settle_price DECIMAL(20,6) NOT NULL DEFAULT 0,
    pips DECIMAL(12,4) NOT NULL DEFAULT 0,
    pnl DECIMAL(20,4) NOT NULL DEFAULT 0,
    status forex_trade_status NOT NULL DEFAULT 'rfq',
    pvp_settled BOOLEAN NOT NULL DEFAULT FALSE,
    counterparty TEXT,
    gas_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_forex_trades_investment ON forex_trades(investment_id);
CREATE INDEX IF NOT EXISTS idx_forex_trades_pair ON forex_trades(pair_id);
CREATE INDEX IF NOT EXISTS idx_forex_trades_status ON forex_trades(status);
CREATE INDEX IF NOT EXISTS idx_forex_trades_created ON forex_trades(created_at DESC);

-- ==================== D70. forex_daily_snapshots ====================
CREATE TABLE IF NOT EXISTS forex_daily_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID NOT NULL REFERENCES forex_investments(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    opening_value DECIMAL(20,4) NOT NULL,
    closing_value DECIMAL(20,4) NOT NULL,
    daily_pnl DECIMAL(20,4) NOT NULL DEFAULT 0,
    daily_pnl_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
    trades_count INTEGER NOT NULL DEFAULT 0,
    lots_traded DECIMAL(12,4) NOT NULL DEFAULT 0,
    pips_earned DECIMAL(12,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(investment_id, date)
);
CREATE INDEX IF NOT EXISTS idx_forex_snapshots_inv_date ON forex_daily_snapshots(investment_id, date DESC);

-- ============================================================================
-- E. VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW provider_usage_hourly AS
SELECT project_id, provider_id,
    date_trunc('hour', created_at) AS hour,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE success = true) AS successful_requests,
    COUNT(*) FILTER (WHERE success = false) AS failed_requests,
    AVG(latency_ms)::INTEGER AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p95_latency_ms,
    SUM(cost_units) AS total_cost_units
FROM provider_usage
GROUP BY project_id, provider_id, date_trunc('hour', created_at);

CREATE OR REPLACE VIEW provider_usage_daily AS
SELECT project_id, provider_id,
    date_trunc('day', created_at) AS day,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE success = true) AS successful_requests,
    COUNT(*) FILTER (WHERE success = false) AS failed_requests,
    AVG(latency_ms)::INTEGER AS avg_latency_ms,
    SUM(cost_units) AS total_cost_units
FROM provider_usage
GROUP BY project_id, provider_id, date_trunc('day', created_at);

CREATE OR REPLACE VIEW provider_usage_monthly AS
SELECT project_id, provider_id,
    date_trunc('month', created_at) AS month,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE success = true) AS successful_requests,
    COUNT(*) FILTER (WHERE success = false) AS failed_requests,
    AVG(latency_ms)::INTEGER AS avg_latency_ms,
    SUM(cost_units) AS total_cost_units
FROM provider_usage
GROUP BY project_id, provider_id, date_trunc('month', created_at);

CREATE OR REPLACE VIEW ai_ab_book_summary AS
SELECT book_type,
    COUNT(*) as total_trades,
    SUM(filled_qty * avg_price) as total_volume,
    AVG(slippage_pct) as avg_slippage,
    COUNT(CASE WHEN status = 'filled' THEN 1 END) as filled_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    MIN(created_at) as first_trade,
    MAX(created_at) as last_trade
FROM ai_ab_book_trades
GROUP BY book_type;

-- ============================================================================
-- F. COMPLEX FUNCTIONS
-- ============================================================================

-- Upsert user from external app
CREATE OR REPLACE FUNCTION upsert_user_from_app(
    p_app_slug VARCHAR, p_external_user_id VARCHAR, p_email VARCHAR,
    p_wallet_address VARCHAR DEFAULT NULL, p_smart_account_address VARCHAR DEFAULT NULL,
    p_thirdweb_user_id VARCHAR DEFAULT NULL, p_kyc_status VARCHAR DEFAULT 'none',
    p_kyc_level INTEGER DEFAULT 0, p_membership_tier VARCHAR DEFAULT 'free',
    p_agent_level INTEGER DEFAULT 0, p_referral_code VARCHAR DEFAULT NULL,
    p_referred_by_external_id VARCHAR DEFAULT NULL, p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID; v_app_id UUID; v_referred_by_user_id UUID;
BEGIN
    SELECT id INTO v_app_id FROM ecosystem_apps WHERE slug = p_app_slug;
    IF v_app_id IS NULL THEN RAISE EXCEPTION 'App not found: %', p_app_slug; END IF;
    SELECT id INTO v_user_id FROM users WHERE email = p_email;
    IF p_referred_by_external_id IS NOT NULL THEN
        SELECT user_id INTO v_referred_by_user_id FROM user_app_mappings
        WHERE app_id = v_app_id AND external_user_id = p_referred_by_external_id;
    END IF;
    IF v_user_id IS NULL THEN
        INSERT INTO users (email, wallet_address, smart_account_address, thirdweb_user_id,
            kyc_status, kyc_level, membership_tier, agent_level, referral_code, referred_by, metadata)
        VALUES (p_email, p_wallet_address, p_smart_account_address, p_thirdweb_user_id,
            p_kyc_status::kyc_status, p_kyc_level, p_membership_tier::membership_tier, p_agent_level,
            COALESCE(p_referral_code, substring(md5(random()::text) from 1 for 8)),
            v_referred_by_user_id, p_metadata)
        RETURNING id INTO v_user_id;
    ELSE
        UPDATE users SET
            wallet_address = COALESCE(p_wallet_address, wallet_address),
            smart_account_address = COALESCE(p_smart_account_address, smart_account_address),
            thirdweb_user_id = COALESCE(p_thirdweb_user_id, thirdweb_user_id),
            kyc_status = p_kyc_status::kyc_status, kyc_level = p_kyc_level,
            membership_tier = p_membership_tier::membership_tier, agent_level = p_agent_level,
            referred_by = COALESCE(v_referred_by_user_id, referred_by),
            metadata = users.metadata || p_metadata, updated_at = NOW()
        WHERE id = v_user_id;
    END IF;
    INSERT INTO user_app_mappings (user_id, app_id, external_user_id)
    VALUES (v_user_id, v_app_id, p_external_user_id)
    ON CONFLICT (app_id, external_user_id) DO UPDATE SET synced_at = NOW();
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Get user by external app ID
CREATE OR REPLACE FUNCTION get_user_by_app_id(p_app_slug VARCHAR, p_external_user_id VARCHAR)
RETURNS TABLE (id UUID, email VARCHAR, wallet_address VARCHAR, smart_account_address VARCHAR,
    role user_role, kyc_status kyc_status, membership_tier membership_tier,
    referral_code VARCHAR, created_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY SELECT u.id, u.email, u.wallet_address, u.smart_account_address,
        u.role, u.kyc_status, u.membership_tier, u.referral_code, u.created_at
    FROM users u JOIN user_app_mappings uam ON u.id = uam.user_id
    JOIN ecosystem_apps ea ON uam.app_id = ea.id
    WHERE ea.slug = p_app_slug AND uam.external_user_id = p_external_user_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate pool NAV
CREATE OR REPLACE FUNCTION calculate_pool_nav(p_pool_id UUID)
RETURNS DECIMAL(20,8) AS $$
DECLARE v_total_capital DECIMAL(20,8); v_total_shares DECIMAL(20,8); v_unrealized_pnl DECIMAL(20,8); v_nav DECIMAL(20,8);
BEGIN
    SELECT total_capital, total_shares INTO v_total_capital, v_total_shares
    FROM ai_strategy_pools WHERE id = p_pool_id;
    IF v_total_shares IS NULL OR v_total_shares = 0 THEN RETURN 1.0; END IF;
    SELECT COALESCE(SUM(unrealized_pnl), 0) INTO v_unrealized_pnl FROM ai_open_positions WHERE pool_id = p_pool_id;
    v_nav := (v_total_capital + v_unrealized_pnl) / v_total_shares;
    RETURN v_nav;
END;
$$ LANGUAGE plpgsql;

-- Calculate user share value
CREATE OR REPLACE FUNCTION calculate_user_share_value(p_order_id UUID)
RETURNS TABLE(shares DECIMAL(20,8), current_nav DECIMAL(20,8), current_value DECIMAL(20,8), pnl DECIMAL(20,8), pnl_pct DECIMAL(10,4)) AS $$
DECLARE v_pool_id UUID; v_shares DECIMAL(20,8); v_entry_nav DECIMAL(20,8); v_current_nav DECIMAL(20,8); v_current_value DECIMAL(20,8); v_invested DECIMAL(20,8);
BEGIN
    SELECT os.pool_id, os.shares_owned, os.avg_entry_nav, os.total_invested
    INTO v_pool_id, v_shares, v_entry_nav, v_invested FROM ai_order_shares os WHERE os.order_id = p_order_id;
    v_current_nav := calculate_pool_nav(v_pool_id);
    v_current_value := v_shares * v_current_nav;
    RETURN QUERY SELECT v_shares, v_current_nav, v_current_value, v_current_value - v_invested,
        CASE WHEN v_invested > 0 THEN ((v_current_value - v_invested) / v_invested * 100) ELSE 0::DECIMAL(10,4) END;
END;
$$ LANGUAGE plpgsql;

-- Update pool on trade close
CREATE OR REPLACE FUNCTION update_pool_on_trade_close()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'closed' AND OLD.status = 'open' THEN
        UPDATE ai_strategy_pools SET
            realized_pnl = realized_pnl + NEW.pnl,
            total_pnl = total_pnl + NEW.pnl,
            total_trades = total_trades + 1,
            winning_trades = winning_trades + CASE WHEN NEW.pnl > 0 THEN 1 ELSE 0 END,
            losing_trades = losing_trades + CASE WHEN NEW.pnl < 0 THEN 1 ELSE 0 END,
            available_capital = available_capital + (NEW.amount / NEW.leverage) + NEW.pnl,
            locked_capital = locked_capital - (NEW.amount / NEW.leverage),
            updated_at = NOW(), last_trade_at = NOW()
        WHERE strategy_id = NEW.strategy_id;
        UPDATE ai_strategy_pools
        SET win_rate = CASE WHEN total_trades > 0 THEN (winning_trades::DECIMAL / total_trades * 100) ELSE 0 END
        WHERE strategy_id = NEW.strategy_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update order share values on NAV change
CREATE OR REPLACE FUNCTION update_order_share_values()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ai_order_shares os SET
        current_value = os.shares_owned * NEW.current_nav,
        unrealized_pnl = (os.shares_owned * NEW.current_nav) - os.total_invested,
        unrealized_pnl_pct = CASE WHEN os.total_invested > 0
            THEN (((os.shares_owned * NEW.current_nav) - os.total_invested) / os.total_invested * 100) ELSE 0 END,
        updated_at = NOW()
    WHERE os.pool_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Quota update function
CREATE OR REPLACE FUNCTION update_project_quota()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE project_quotas SET
        api_requests_monthly_used = api_requests_monthly_used + 1,
        cost_units_monthly_used = cost_units_monthly_used + COALESCE(NEW.cost_units, 1),
        updated_at = NOW()
    WHERE project_id = NEW.project_id
        AND current_period_start <= NOW() AND current_period_end > NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
    UPDATE project_quotas SET
        api_requests_monthly_used = 0, cost_units_monthly_used = 0, warning_sent = false,
        current_period_start = date_trunc('month', NOW()),
        current_period_end = date_trunc('month', NOW()) + INTERVAL '1 month', updated_at = NOW()
    WHERE current_period_end <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Create default team and project
CREATE OR REPLACE FUNCTION create_default_team_and_project(p_user_id UUID, p_email VARCHAR)
RETURNS UUID AS $$
DECLARE v_team_id UUID; v_project_id UUID; v_client_id VARCHAR;
BEGIN
    INSERT INTO teams (name, slug, owner_id, billing_email)
    VALUES (split_part(p_email, '@', 1) || '''s Team', 'team-' || encode(gen_random_bytes(8), 'hex'), p_user_id, p_email)
    RETURNING id INTO v_team_id;
    INSERT INTO team_members (team_id, user_id, role) VALUES (v_team_id, p_user_id, 'owner');
    v_client_id := generate_client_id();
    INSERT INTO projects (team_id, name, slug, client_id)
    VALUES (v_team_id, 'My First Project', 'default', v_client_id)
    RETURNING id INTO v_project_id;
    INSERT INTO project_api_keys (project_id, name, key_type, key_hash, key_prefix)
    VALUES (v_project_id, 'Default Publishable Key', 'publishable',
        encode(sha256(v_client_id::bytea), 'hex'), substring(v_client_id, 1, 15));
    RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;

-- Batch import users from wallet
CREATE OR REPLACE FUNCTION batch_import_users_from_wallet(p_users JSONB)
RETURNS TABLE (imported_count INTEGER, updated_count INTEGER, failed_count INTEGER, errors JSONB) AS $$
DECLARE v_user JSONB; v_imported INTEGER := 0; v_updated INTEGER := 0; v_failed INTEGER := 0;
    v_errors JSONB := '[]'::JSONB; v_user_id UUID; v_app_id UUID;
BEGIN
    SELECT id INTO v_app_id FROM ecosystem_apps WHERE slug = 'one-wallet';
    IF v_app_id IS NULL THEN
        INSERT INTO ecosystem_apps (name, slug, description)
        VALUES ('One Wallet', 'one-wallet', 'Main consumer wallet application') RETURNING id INTO v_app_id;
    END IF;
    FOR v_user IN SELECT * FROM jsonb_array_elements(p_users) LOOP
        BEGIN
            SELECT id INTO v_user_id FROM users WHERE email = v_user->>'email';
            IF v_user_id IS NULL THEN
                INSERT INTO users (email, wallet_address, smart_account_address, thirdweb_user_id,
                    role, kyc_status, kyc_level, membership_tier, agent_level, referral_code,
                    total_referrals, total_team_volume, metadata, created_at, updated_at)
                VALUES (v_user->>'email', v_user->>'wallet_address', v_user->>'wallet_address',
                    v_user->>'thirdweb_user_id', 'user'::user_role,
                    COALESCE(v_user->>'kyc_status', 'none')::kyc_status,
                    COALESCE((v_user->>'kyc_level')::INTEGER, 0),
                    COALESCE(v_user->>'membership_tier', 'free')::membership_tier,
                    COALESCE((v_user->>'agent_level')::INTEGER, 0), v_user->>'referral_code',
                    COALESCE((v_user->>'total_referrals')::INTEGER, 0),
                    COALESCE((v_user->>'total_team_volume')::DECIMAL, 0),
                    COALESCE(v_user->'metadata', '{}'::JSONB),
                    COALESCE((v_user->>'created_at')::TIMESTAMPTZ, NOW()), NOW())
                RETURNING id INTO v_user_id;
                v_imported := v_imported + 1;
            ELSE
                UPDATE users SET wallet_address = COALESCE(v_user->>'wallet_address', wallet_address),
                    thirdweb_user_id = COALESCE(v_user->>'thirdweb_user_id', thirdweb_user_id),
                    updated_at = NOW() WHERE id = v_user_id;
                v_updated := v_updated + 1;
            END IF;
            INSERT INTO user_app_mappings (user_id, app_id, external_user_id, app_specific_data)
            VALUES (v_user_id, v_app_id, v_user->>'id', jsonb_build_object('wallet_status', v_user->>'wallet_status'))
            ON CONFLICT (app_id, external_user_id) DO UPDATE SET synced_at = NOW();
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object('email', v_user->>'email', 'error', SQLERRM);
        END;
    END LOOP;
    INSERT INTO sync_logs (app_id, sync_type, status, records_synced, records_failed, completed_at, metadata)
    VALUES (v_app_id, 'full', CASE WHEN v_failed = 0 THEN 'completed' ELSE 'completed_with_errors' END,
        v_imported + v_updated, v_failed, NOW(),
        jsonb_build_object('imported', v_imported, 'updated', v_updated, 'errors', v_errors));
    RETURN QUERY SELECT v_imported, v_updated, v_failed, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Update A/B Book config
CREATE OR REPLACE FUNCTION update_ab_book_config(p_key TEXT, p_value JSONB, p_updated_by TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE ai_ab_book_config SET config_value = p_value, updated_by = p_updated_by, updated_at = now()
    WHERE config_key = p_key;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Forex increment pool size
CREATE OR REPLACE FUNCTION increment_pool_size(p_pool_type forex_pool_type, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE forex_pools SET total_size = total_size + p_amount, updated_at = now() WHERE pool_type = p_pool_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- G. TRIGGERS
-- ============================================================================

-- Referral code auto-generation
DROP TRIGGER IF EXISTS tr_generate_referral_code ON users;
CREATE TRIGGER tr_generate_referral_code BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION trigger_generate_referral_code();

-- Updated_at triggers
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS teams_updated_at ON teams;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS strategies_updated_at ON quant_strategies;
CREATE TRIGGER strategies_updated_at BEFORE UPDATE ON quant_strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS ecosystem_apps_updated_at ON ecosystem_apps;
CREATE TRIGGER ecosystem_apps_updated_at BEFORE UPDATE ON ecosystem_apps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS wallet_assets_updated_at ON wallet_assets;
CREATE TRIGGER wallet_assets_updated_at BEFORE UPDATE ON wallet_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS cards_updated_at ON cards;
CREATE TRIGGER cards_updated_at BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS merchant_profiles_updated_at ON merchant_profiles;
CREATE TRIGGER merchant_profiles_updated_at BEFORE UPDATE ON merchant_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS wallet_ai_strategies_updated_at ON wallet_ai_strategies;
CREATE TRIGGER wallet_ai_strategies_updated_at BEFORE UPDATE ON wallet_ai_strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS wallet_ai_orders_updated_at ON wallet_ai_orders;
CREATE TRIGGER wallet_ai_orders_updated_at BEFORE UPDATE ON wallet_ai_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AI trade execution trigger
DROP TRIGGER IF EXISTS trg_update_pool_on_trade ON ai_trade_executions;
CREATE TRIGGER trg_update_pool_on_trade AFTER UPDATE ON ai_trade_executions FOR EACH ROW EXECUTE FUNCTION update_pool_on_trade_close();

-- Order share value updates on NAV change
DROP TRIGGER IF EXISTS trg_update_order_shares ON ai_strategy_pools;
CREATE TRIGGER trg_update_order_shares AFTER UPDATE OF current_nav ON ai_strategy_pools FOR EACH ROW EXECUTE FUNCTION update_order_share_values();

-- Quota tracking trigger
DROP TRIGGER IF EXISTS trg_update_quota_on_api_usage ON api_usage;
CREATE TRIGGER trg_update_quota_on_api_usage AFTER INSERT ON api_usage FOR EACH ROW EXECUTE FUNCTION update_project_quota();

-- A/B Book updated_at triggers
DROP TRIGGER IF EXISTS update_ab_book_trades_updated_at ON ai_ab_book_trades;
CREATE TRIGGER update_ab_book_trades_updated_at BEFORE UPDATE ON ai_ab_book_trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_ab_book_config_updated_at ON ai_ab_book_config;
CREATE TRIGGER update_ab_book_config_updated_at BEFORE UPDATE ON ai_ab_book_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Forex updated_at triggers
DO $$ BEGIN CREATE TRIGGER trg_forex_investments_updated BEFORE UPDATE ON forex_investments FOR EACH ROW EXECUTE FUNCTION update_forex_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_forex_pools_updated BEFORE UPDATE ON forex_pools FOR EACH ROW EXECUTE FUNCTION update_forex_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- H. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_backend_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiat_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_daily_pnl ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE nav_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecosystem_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_trade_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_nav_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_strategy_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_trade_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_open_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_order_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ab_book_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ab_book_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_payment_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_payment_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ai_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ai_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ai_nav_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_pools ENABLE ROW LEVEL SECURITY;

-- Service role full access policies (Supabase service_role bypasses RLS automatically,
-- but these open policies ensure the engine backend can access all data)
DROP POLICY IF EXISTS "svc_users" ON users; CREATE POLICY "svc_users" ON users FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_otp_codes" ON otp_codes; CREATE POLICY "svc_otp_codes" ON otp_codes FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_teams" ON teams; CREATE POLICY "svc_teams" ON teams FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_team_members" ON team_members; CREATE POLICY "svc_team_members" ON team_members FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_projects" ON projects; CREATE POLICY "svc_projects" ON projects FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_project_api_keys" ON project_api_keys; CREATE POLICY "svc_project_api_keys" ON project_api_keys FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_project_users" ON project_users; CREATE POLICY "svc_project_users" ON project_users FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_project_wallets" ON project_wallets; CREATE POLICY "svc_project_wallets" ON project_wallets FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_project_backend_wallets" ON project_backend_wallets; CREATE POLICY "svc_project_backend_wallets" ON project_backend_wallets FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_project_transactions" ON project_transactions; CREATE POLICY "svc_project_transactions" ON project_transactions FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_project_contracts" ON project_contracts; CREATE POLICY "svc_project_contracts" ON project_contracts FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_project_payments" ON project_payments; CREATE POLICY "svc_project_payments" ON project_payments FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_api_usage" ON api_usage; CREATE POLICY "svc_api_usage" ON api_usage FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_api_usage_daily" ON api_usage_daily; CREATE POLICY "svc_api_usage_daily" ON api_usage_daily FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_provider_usage" ON provider_usage; CREATE POLICY "svc_provider_usage" ON provider_usage FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_project_quotas" ON project_quotas; CREATE POLICY "svc_project_quotas" ON project_quotas FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_wallets" ON wallets; CREATE POLICY "svc_wallets" ON wallets FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_contracts_registry" ON contracts_registry; CREATE POLICY "svc_contracts_registry" ON contracts_registry FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_transactions" ON transactions; CREATE POLICY "svc_transactions" ON transactions FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_fiat_transactions" ON fiat_transactions; CREATE POLICY "svc_fiat_transactions" ON fiat_transactions FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_payments" ON payments; CREATE POLICY "svc_payments" ON payments FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_quant_strategies" ON quant_strategies; CREATE POLICY "svc_quant_strategies" ON quant_strategies FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_quant_positions" ON quant_positions; CREATE POLICY "svc_quant_positions" ON quant_positions FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_quant_daily_pnl" ON quant_daily_pnl; CREATE POLICY "svc_quant_daily_pnl" ON quant_daily_pnl FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_trade_orders" ON trade_orders; CREATE POLICY "svc_trade_orders" ON trade_orders FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_nav_snapshots" ON nav_snapshots; CREATE POLICY "svc_nav_snapshots" ON nav_snapshots FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_system_logs" ON system_logs; CREATE POLICY "svc_system_logs" ON system_logs FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_webhooks" ON webhooks; CREATE POLICY "svc_webhooks" ON webhooks FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_webhook_deliveries" ON webhook_deliveries; CREATE POLICY "svc_webhook_deliveries" ON webhook_deliveries FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ecosystem_apps" ON ecosystem_apps; CREATE POLICY "svc_ecosystem_apps" ON ecosystem_apps FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_user_app_mappings" ON user_app_mappings; CREATE POLICY "svc_user_app_mappings" ON user_app_mappings FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_sync_logs" ON sync_logs; CREATE POLICY "svc_sync_logs" ON sync_logs FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_strategies" ON ai_strategies; CREATE POLICY "svc_ai_strategies" ON ai_strategies FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_orders" ON ai_orders; CREATE POLICY "svc_ai_orders" ON ai_orders FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_trade_batches" ON ai_trade_batches; CREATE POLICY "svc_ai_trade_batches" ON ai_trade_batches FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_nav_snapshots" ON ai_nav_snapshots; CREATE POLICY "svc_ai_nav_snapshots" ON ai_nav_snapshots FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_strategy_pools" ON ai_strategy_pools; CREATE POLICY "svc_ai_strategy_pools" ON ai_strategy_pools FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_agent_memory" ON ai_agent_memory; CREATE POLICY "svc_ai_agent_memory" ON ai_agent_memory FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_decision_log" ON ai_decision_log; CREATE POLICY "svc_ai_decision_log" ON ai_decision_log FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_trade_executions" ON ai_trade_executions; CREATE POLICY "svc_ai_trade_executions" ON ai_trade_executions FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_open_positions" ON ai_open_positions; CREATE POLICY "svc_ai_open_positions" ON ai_open_positions FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_performance_snapshots" ON ai_performance_snapshots; CREATE POLICY "svc_ai_performance_snapshots" ON ai_performance_snapshots FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_order_shares" ON ai_order_shares; CREATE POLICY "svc_ai_order_shares" ON ai_order_shares FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_ab_book_trades" ON ai_ab_book_trades; CREATE POLICY "svc_ai_ab_book_trades" ON ai_ab_book_trades FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_ai_ab_book_config" ON ai_ab_book_config; CREATE POLICY "svc_ai_ab_book_config" ON ai_ab_book_config FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_user_profiles" ON user_profiles; CREATE POLICY "svc_user_profiles" ON user_profiles FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_user_settings" ON user_settings; CREATE POLICY "svc_user_settings" ON user_settings FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_wallet_assets" ON wallet_assets; CREATE POLICY "svc_wallet_assets" ON wallet_assets FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_wallet_transactions" ON wallet_transactions; CREATE POLICY "svc_wallet_transactions" ON wallet_transactions FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_cards" ON cards; CREATE POLICY "svc_cards" ON cards FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_merchant_profiles" ON merchant_profiles; CREATE POLICY "svc_merchant_profiles" ON merchant_profiles FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_x402_payment_urls" ON x402_payment_urls; CREATE POLICY "svc_x402_payment_urls" ON x402_payment_urls FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_x402_payment_qr_codes" ON x402_payment_qr_codes; CREATE POLICY "svc_x402_payment_qr_codes" ON x402_payment_qr_codes FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_x402_payments" ON x402_payments; CREATE POLICY "svc_x402_payments" ON x402_payments FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_x402_invoices" ON x402_invoices; CREATE POLICY "svc_x402_invoices" ON x402_invoices FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_x402_receipts" ON x402_receipts; CREATE POLICY "svc_x402_receipts" ON x402_receipts FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_user_security_events" ON user_security_events; CREATE POLICY "svc_user_security_events" ON user_security_events FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_user_devices" ON user_devices; CREATE POLICY "svc_user_devices" ON user_devices FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_qr_scan_events" ON qr_scan_events; CREATE POLICY "svc_qr_scan_events" ON qr_scan_events FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_wallet_referral_rewards" ON wallet_referral_rewards; CREATE POLICY "svc_wallet_referral_rewards" ON wallet_referral_rewards FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_wallet_ai_strategies" ON wallet_ai_strategies; CREATE POLICY "svc_wallet_ai_strategies" ON wallet_ai_strategies FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_wallet_ai_orders" ON wallet_ai_orders; CREATE POLICY "svc_wallet_ai_orders" ON wallet_ai_orders FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_wallet_ai_nav_snapshots" ON wallet_ai_nav_snapshots; CREATE POLICY "svc_wallet_ai_nav_snapshots" ON wallet_ai_nav_snapshots FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_referral_rewards" ON referral_rewards; CREATE POLICY "svc_referral_rewards" ON referral_rewards FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_forex_investments" ON forex_investments; CREATE POLICY "svc_forex_investments" ON forex_investments FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_forex_trades" ON forex_trades; CREATE POLICY "svc_forex_trades" ON forex_trades FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_forex_daily_snapshots" ON forex_daily_snapshots; CREATE POLICY "svc_forex_daily_snapshots" ON forex_daily_snapshots FOR ALL USING (true);
DROP POLICY IF EXISTS "svc_forex_pools" ON forex_pools; CREATE POLICY "svc_forex_pools" ON forex_pools FOR ALL USING (true);

-- ============================================================================
-- I. SEED DATA
-- ============================================================================

-- System user
INSERT INTO users (id, email, wallet_address, role, kyc_status, kyc_level, membership_tier)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'system@one-wallet.app',
    '0x0000000000000000000000000000000000000000',
    'admin', 'verified', 3, 'vip'
) ON CONFLICT (id) DO NOTHING;

-- Admin user
INSERT INTO users (email, role, metadata)
VALUES ('admin@one23.io', 'admin', '{"name": "Admin User", "registered_from": "system"}')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- System team
INSERT INTO teams (id, name, slug, owner_id, billing_plan, max_projects, max_api_calls_per_month)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'ONE Ecosystem', 'one-ecosystem',
    '00000000-0000-0000-0000-000000000001',
    'enterprise', 100, 100000000
) ON CONFLICT (slug) DO NOTHING;

-- System team member
INSERT INTO team_members (team_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ONE Wallet Project
INSERT INTO projects (id, team_id, name, slug, description, client_id, api_key, api_secret, owner_id, status, settings)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'ONE Wallet App', 'one-wallet-app',
    'Official ONE Wallet mobile and web application',
    'one_pk_e8f647bfa643fdcfaa3a23f760488e49be09f929296eed4a6c399d437d907f60',
    'one_pk_e8f647bfa643fdcfaa3a23f760488e49be09f929296eed4a6c399d437d907f60',
    'one_sk_' || encode(gen_random_bytes(32), 'hex'),
    '00000000-0000-0000-0000-000000000001',
    'active',
    '{"allowedDomains": ["localhost", "*.netlify.app", "*.one-wallet.app", "*"], "allowedBundleIds": ["app.onewallet", "app.one-wallet"], "enabledServices": {"connect": true, "wallet": true, "contracts": true, "pay": true, "engine": true}, "rateLimit": {"requestsPerMinute": 1000, "requestsPerDay": 100000}}'::jsonb
) ON CONFLICT (client_id) DO UPDATE SET api_key = EXCLUDED.api_key, settings = EXCLUDED.settings, updated_at = NOW();

-- ONE Wallet API Key
INSERT INTO project_api_keys (id, project_id, name, key_type, key_hash, key_prefix, allowed_domains, permissions, rate_limit_per_minute, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'ONE Wallet Production Key', 'publishable',
    encode(sha256('one_pk_e8f647bfa643fdcfaa3a23f760488e49be09f929296eed4a6c399d437d907f60'::bytea), 'hex'),
    'one_pk_e8f647',
    ARRAY['localhost', '*.netlify.app', '*.one-wallet.app', '*'],
    '["*"]'::jsonb, 1000, true
) ON CONFLICT DO NOTHING;

-- Ecosystem app entry
INSERT INTO ecosystem_apps (name, slug, description, supabase_project_id)
VALUES ('One Wallet', 'one-wallet', 'Main consumer wallet application', 'fyktnfziqyjbrrzszzuz')
ON CONFLICT (slug) DO NOTHING;

-- Agent ranks
INSERT INTO agent_ranks (level, name, required_referrals, required_team_volume, commission_rate, team_bonus_rate, benefits) VALUES
    (0, 'Member', 0, 0, 0.0000, 0.0000, '{}'),
    (1, 'Bronze Agent', 3, 1000, 0.0500, 0.0100, '{"support": "email"}'),
    (2, 'Silver Agent', 10, 5000, 0.0700, 0.0150, '{"support": "priority_email"}'),
    (3, 'Gold Agent', 25, 20000, 0.0900, 0.0200, '{"support": "chat", "analytics": true}'),
    (4, 'Platinum Agent', 50, 50000, 0.1100, 0.0250, '{"support": "priority_chat", "analytics": true}'),
    (5, 'Diamond Agent', 100, 150000, 0.1300, 0.0300, '{"support": "phone", "analytics": true, "events": true}'),
    (6, 'Elite Agent', 200, 500000, 0.1500, 0.0350, '{"support": "dedicated", "analytics": true, "events": true}'),
    (7, 'Master Agent', 500, 1500000, 0.1800, 0.0400, '{"support": "vip", "analytics": true, "events": true, "custom_rates": true}')
ON CONFLICT (level) DO UPDATE SET name = EXCLUDED.name;

-- AI Strategies
INSERT INTO ai_strategies (id, name, description, category, risk_level, min_investment, lock_period_days, expected_apy_min, expected_apy_max) VALUES
    ('conservative-01', 'Stable Growth', 'Low-risk DCA strategy', 'conservative', 1, 100, 30, 8, 15),
    ('balanced-01', 'Smart Balance', 'Balanced risk-reward', 'balanced', 3, 200, 30, 15, 35),
    ('aggressive-01', 'Alpha Hunter', 'High-frequency momentum', 'aggressive', 5, 500, 30, 30, 80),
    ('grid-01', 'Grid Trader Pro', 'Automated grid trading', 'grid', 4, 200, 14, 10, 25)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Quant strategies
INSERT INTO quant_strategies (name, description, strategy_type, risk_level, min_investment, expected_apy, parameters) VALUES
    ('Conservative Grid', 'Low-risk grid trading strategy', 'grid', 'low', 100, 8.5, '{"gridSize": 10, "priceRange": 0.05}'),
    ('Momentum Alpha', 'AI-driven momentum strategy', 'momentum', 'medium', 500, 15.0, '{"lookbackPeriod": 14, "threshold": 0.02}'),
    ('Smart DCA', 'DCA with AI timing optimization', 'dca', 'low', 100, 12.0, '{"frequency": "daily", "aiTiming": true}'),
    ('Arbitrage Pro', 'Cross-exchange arbitrage', 'arbitrage', 'medium', 1000, 20.0, '{"exchanges": ["bybit", "binance"], "minSpread": 0.001}'),
    ('AI Quant Master', 'Full AI-driven strategy', 'ai_driven', 'aggressive', 5000, 35.0, '{"model": "gpt-4o", "rebalanceFrequency": 3600}')
ON CONFLICT DO NOTHING;

-- A/B Book default config
INSERT INTO ai_ab_book_config (config_key, config_value, description) VALUES
    ('default_book_type', '"B"', 'Default book type for new trades (A=Real, B=Simulated)'),
    ('simulation_params', '{"slippageMin": 0.0001, "slippageMax": 0.001, "fillRate": 0.98, "executionDelayMin": 50, "executionDelayMax": 200, "recordTrades": true}', 'Parameters for B-Book simulation'),
    ('strategy_overrides', '{}', 'Per-strategy book type overrides'),
    ('pool_overrides', '{}', 'Per-pool book type overrides')
ON CONFLICT (config_key) DO NOTHING;

-- Forex pools
INSERT INTO forex_pools (pool_type, total_size, utilization, allocation) VALUES
    ('clearing',  12500000, 0.7800, 0.50),
    ('hedging',    7500000, 0.6500, 0.30),
    ('insurance',  5000000, 0.4200, 0.20)
ON CONFLICT (pool_type) DO NOTHING;

-- Create strategy pools for existing AI strategies
INSERT INTO ai_strategy_pools (strategy_id, current_nav, max_position_size, daily_trade_limit)
SELECT id, 1.0, min_investment * 0.3,
    CASE WHEN risk_level <= 2 THEN 20 WHEN risk_level <= 4 THEN 30 ELSE 50 END
FROM ai_strategies
WHERE NOT EXISTS (SELECT 1 FROM ai_strategy_pools WHERE ai_strategy_pools.strategy_id = ai_strategies.id);

-- Create quotas for existing projects
INSERT INTO project_quotas (project_id)
SELECT id FROM projects WHERE id NOT IN (SELECT project_id FROM project_quotas)
ON CONFLICT (project_id) DO NOTHING;

-- ============================================================================
-- J. DEMO DATA
-- ============================================================================

-- Demo user profiles
INSERT INTO user_profiles (id, email, wallet_address, wallet_type, wallet_status, kyc_status, kyc_level, membership_tier, referral_code, agent_level) VALUES
    ('11111111-1111-1111-1111-111111111111', 'john@demo.onewallet.app', '0x742d35Cc6634C0532925a3b844Bc9e7595f8c5F4', 'smart', 'active', 'verified', 2, 'premium', 'JOHNDEMO', 3),
    ('22222222-2222-2222-2222-222222222222', 'alice@demo.onewallet.app', '0x8Ba1f109551bD432803012645Ac136ddd64DBa72', 'smart', 'active', 'verified', 1, 'basic', 'ALICEDEMO', 1),
    ('33333333-3333-3333-3333-333333333333', 'bob@demo.onewallet.app', '0xdD870fA1b7C4700F2BD7f44238821C26f7392148', 'smart', 'active', 'pending', 0, 'free', 'BOBDEMO', 0)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, wallet_address = EXCLUDED.wallet_address;

-- Demo user settings
INSERT INTO user_settings (user_id, language, currency, theme, push_notifications, biometric_enabled, default_chain, default_token) VALUES
    ('11111111-1111-1111-1111-111111111111', 'en', 'USD', 'dark', true, true, 'base', 'ETH'),
    ('22222222-2222-2222-2222-222222222222', 'zh', 'CNY', 'light', true, false, 'ethereum', 'USDC'),
    ('33333333-3333-3333-3333-333333333333', 'en', 'EUR', 'system', true, false, 'polygon', 'MATIC')
ON CONFLICT (user_id) DO UPDATE SET language = EXCLUDED.language, currency = EXCLUDED.currency;

-- Demo wallet assets
INSERT INTO wallet_assets (user_id, chain, token_symbol, balance_formatted, value_usd, price_usd, price_change_24h, is_native, decimals) VALUES
    ('11111111-1111-1111-1111-111111111111', 'base', 'ETH', '2.5', 6250.00, 2500.00, 2.35, true, 18),
    ('11111111-1111-1111-1111-111111111111', 'base', 'USDC', '5000', 5000.00, 1.00, 0.01, false, 6),
    ('11111111-1111-1111-1111-111111111111', 'ethereum', 'ETH', '1.2', 3000.00, 2500.00, 2.35, true, 18),
    ('22222222-2222-2222-2222-222222222222', 'ethereum', 'ETH', '0.8', 2000.00, 2500.00, 2.35, true, 18),
    ('22222222-2222-2222-2222-222222222222', 'ethereum', 'USDC', '1500', 1500.00, 1.00, 0.01, false, 6),
    ('33333333-3333-3333-3333-333333333333', 'polygon', 'MATIC', '1000', 500.00, 0.50, -1.25, true, 18),
    ('33333333-3333-3333-3333-333333333333', 'polygon', 'USDT', '200', 200.00, 1.00, 0.00, false, 6)
ON CONFLICT (user_id, chain, token_symbol) DO UPDATE SET balance_formatted = EXCLUDED.balance_formatted, value_usd = EXCLUDED.value_usd;

-- Demo cards
INSERT INTO cards (user_id, card_type, card_tier, status, card_number_masked, expiry_month, expiry_year, cardholder_name, daily_limit, monthly_limit) VALUES
    ('11111111-1111-1111-1111-111111111111', 'virtual', 'platinum', 'active', '**** **** **** 4532', 12, 2027, 'JOHN DEMO', 10000, 100000),
    ('22222222-2222-2222-2222-222222222222', 'virtual', 'gold', 'active', '**** **** **** 8721', 6, 2026, 'ALICE DEMO', 5000, 50000),
    ('33333333-3333-3333-3333-333333333333', 'virtual', 'standard', 'pending', '**** **** **** 1234', 3, 2026, 'BOB DEMO', 1000, 10000)
ON CONFLICT DO NOTHING;

-- Demo wallet AI strategies
INSERT INTO wallet_ai_strategies (id, name, description, category, risk_level, min_investment, max_investment, lock_period_days, expected_apy_min, expected_apy_max, is_active, tvl, total_users) VALUES
    ('conservative-01', 'Stable Growth', 'Low-risk DCA into blue-chip crypto', 'conservative', 2, 100, 50000, 30, 8, 15, true, 2500000, 1250),
    ('balanced-01', 'Smart Balance', 'Balanced portfolio management', 'balanced', 5, 500, 100000, 30, 15, 35, true, 5000000, 850),
    ('aggressive-01', 'Alpha Hunter', 'High-frequency momentum trading', 'aggressive', 8, 1000, 500000, 30, 30, 80, true, 8000000, 420),
    ('grid-01', 'Grid Trader Pro', 'Automated grid trading', 'grid', 4, 200, 50000, 14, 10, 25, true, 1500000, 680)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tvl = EXCLUDED.tvl, total_users = EXCLUDED.total_users;

-- Demo wallet AI orders
INSERT INTO wallet_ai_orders (user_id, strategy_id, amount, currency, chain, status, lock_end_date, lock_period_days, realized_profit, unrealized_profit, current_nav) VALUES
    ('11111111-1111-1111-1111-111111111111', 'balanced-01', 5000, 'USDT', 'arbitrum', 'active', NOW() + INTERVAL '25 days', 30, 125.50, 87.25, 5212.75),
    ('11111111-1111-1111-1111-111111111111', 'conservative-01', 2000, 'USDT', 'base', 'active', NOW() + INTERVAL '15 days', 30, 45.00, 22.50, 2067.50),
    ('22222222-2222-2222-2222-222222222222', 'aggressive-01', 3000, 'USDT', 'arbitrum', 'active', NOW() + INTERVAL '20 days', 30, 280.00, 150.00, 3430.00)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- K. VERIFICATION
-- ============================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

    RAISE NOTICE '=========================================';
    RAISE NOTICE 'ONE Ecosystem Complete Database Setup';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Total tables created: %', v_count;
    RAISE NOTICE 'Expected: 70';
    IF v_count >= 70 THEN
        RAISE NOTICE 'Status: ALL TABLES PRESENT';
    ELSE
        RAISE NOTICE 'Status: MISSING % tables', 70 - v_count;
    END IF;
    RAISE NOTICE '=========================================';
END $$;
