-- ============================================================
-- ONE Ecosystem Complete Database Schema
-- Unified schema for ONE Engine, Dashboard, and Wallet
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
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

-- ============================================================
-- 1. CORE USERS TABLE
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_thirdweb ON users(thirdweb_user_id);

-- ============================================================
-- 2. OTP CODES (Dashboard Auth)
-- ============================================================
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

-- ============================================================
-- 3. TEAMS (Multi-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 4. TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============================================================
-- 5. PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    client_id VARCHAR(64) NOT NULL UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

-- ============================================================
-- 6. PROJECT API KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 7. PROJECT USERS (Per-project user identity)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 8. PROJECT WALLETS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 9. PROJECT BACKEND WALLETS (Engine)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_backend_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 10. PROJECT TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 11. PROJECT CONTRACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 12. PROJECT PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 13. API USAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES project_api_keys(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT,
    response_time_ms INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    origin VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_project ON api_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(project_id, created_at);

-- ============================================================
-- 14. API USAGE DAILY (Aggregated)
-- ============================================================
CREATE TABLE IF NOT EXISTS api_usage_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================
-- 15. ECOSYSTEM APPS
-- ============================================================
CREATE TABLE IF NOT EXISTS ecosystem_apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    supabase_url VARCHAR(500),
    supabase_project_id VARCHAR(100),
    api_endpoint VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    sync_config JSONB DEFAULT '{"sync_users": true, "sync_wallets": true}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. USER APP MAPPINGS
-- ============================================================
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

-- ============================================================
-- 17. AGENT RANKS
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_ranks (
    level INTEGER PRIMARY KEY CHECK (level >= 0 AND level <= 7),
    name TEXT NOT NULL,
    required_referrals INTEGER NOT NULL,
    required_team_volume DECIMAL(20, 2) NOT NULL,
    commission_rate DECIMAL(5, 4) NOT NULL,
    team_bonus_rate DECIMAL(5, 4) DEFAULT 0,
    benefits JSONB DEFAULT '{}'
);

INSERT INTO agent_ranks (level, name, required_referrals, required_team_volume, commission_rate, team_bonus_rate, benefits)
VALUES
    (0, 'Member', 0, 0, 0.0000, 0.0000, '{}'),
    (1, 'Bronze Agent', 3, 1000, 0.0500, 0.0100, '{"support": "email"}'),
    (2, 'Silver Agent', 10, 5000, 0.0700, 0.0150, '{"support": "priority_email"}'),
    (3, 'Gold Agent', 25, 20000, 0.0900, 0.0200, '{"support": "chat", "analytics": true}'),
    (4, 'Platinum Agent', 50, 50000, 0.1100, 0.0250, '{"support": "priority_chat", "analytics": true}'),
    (5, 'Diamond Agent', 100, 150000, 0.1300, 0.0300, '{"support": "phone", "analytics": true, "events": true}'),
    (6, 'Elite Agent', 200, 500000, 0.1500, 0.0350, '{"support": "dedicated", "analytics": true, "events": true}'),
    (7, 'Master Agent', 500, 1500000, 0.1800, 0.0400, '{"support": "vip", "analytics": true, "events": true, "custom_rates": true}')
ON CONFLICT (level) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================
-- 18. AI STRATEGIES
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_strategies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    risk_level INTEGER NOT NULL CHECK (risk_level >= 1 AND risk_level <= 5),
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

INSERT INTO ai_strategies (id, name, description, category, risk_level, min_investment, lock_period_days, expected_apy_min, expected_apy_max) VALUES
    ('conservative-01', 'Stable Growth', 'Low-risk DCA strategy', 'conservative', 1, 100, 30, 8, 15),
    ('balanced-01', 'Smart Balance', 'Balanced risk-reward', 'balanced', 2, 200, 30, 15, 35),
    ('aggressive-01', 'Alpha Hunter', 'High-frequency momentum', 'aggressive', 4, 500, 30, 30, 80),
    ('grid-01', 'Grid Trader Pro', 'Automated grid trading', 'grid', 2, 200, 14, 10, 25)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================
-- 19. AI ORDERS
-- ============================================================
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

-- ============================================================
-- 20. AI TRADE BATCHES
-- ============================================================
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

-- ============================================================
-- 21. AI NAV SNAPSHOTS
-- ============================================================
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

-- ============================================================
-- 22. REFERRAL REWARDS
-- ============================================================
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

-- ============================================================
-- 23. QUANT STRATEGIES (Engine)
-- ============================================================
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

-- ============================================================
-- 24. QUANT POSITIONS
-- ============================================================
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

-- ============================================================
-- 25. SYSTEM LOGS
-- ============================================================
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

-- ============================================================
-- 26. WEBHOOKS
-- ============================================================
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

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Generate referral code
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

-- Generate client_id
CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS VARCHAR AS $$
BEGIN
    RETURN 'one_pk_' || encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate referral code trigger
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

DROP TRIGGER IF EXISTS tr_generate_referral_code ON users;
CREATE TRIGGER tr_generate_referral_code
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_referral_code();

-- Update triggers
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS teams_updated_at ON teams;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "Service role full access users" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access otp" ON otp_codes FOR ALL USING (true);
CREATE POLICY "Service role full access teams" ON teams FOR ALL USING (true);
CREATE POLICY "Service role full access team_members" ON team_members FOR ALL USING (true);
CREATE POLICY "Service role full access projects" ON projects FOR ALL USING (true);
CREATE POLICY "Service role full access project_api_keys" ON project_api_keys FOR ALL USING (true);
CREATE POLICY "Service role full access project_users" ON project_users FOR ALL USING (true);
CREATE POLICY "Service role full access project_wallets" ON project_wallets FOR ALL USING (true);
CREATE POLICY "Service role full access project_transactions" ON project_transactions FOR ALL USING (true);
CREATE POLICY "Service role full access ai_strategies" ON ai_strategies FOR ALL USING (true);
CREATE POLICY "Service role full access ai_orders" ON ai_orders FOR ALL USING (true);
CREATE POLICY "Service role full access referral_rewards" ON referral_rewards FOR ALL USING (true);

-- ============================================================
-- INITIAL DATA
-- ============================================================

-- Insert default ecosystem app
INSERT INTO ecosystem_apps (name, slug, description)
VALUES ('One Wallet', 'one-wallet', 'Main consumer wallet application')
ON CONFLICT (slug) DO NOTHING;

-- Insert admin user
INSERT INTO users (email, role, metadata)
VALUES ('admin@one23.io', 'admin', '{"name": "Admin User", "registered_from": "system"}')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'ONE Ecosystem Database Setup Complete!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Tables created: 26';
    RAISE NOTICE 'Admin user: admin@one23.io';
    RAISE NOTICE '=========================================';
END $$;
