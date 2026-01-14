-- ONE Engine Database Schema
-- Initial migration for the ONE ecosystem infrastructure
-- Supabase PostgreSQL

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'agent', 'admin', 'superadmin');
CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected');
CREATE TYPE membership_tier AS ENUM ('free', 'basic', 'premium', 'vip');
CREATE TYPE wallet_type AS ENUM ('smart', 'eoa', 'multisig');
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed');
CREATE TYPE transaction_type AS ENUM ('transfer', 'swap', 'contract_call', 'deploy', 'approval');
CREATE TYPE contract_type AS ENUM ('token', 'nft', 'marketplace', 'staking', 'dao', 'custom');
CREATE TYPE fiat_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE payment_type AS ENUM ('qr', 'x402', 'invoice', 'subscription');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'confirmed', 'settled', 'failed', 'refunded');
CREATE TYPE strategy_type AS ENUM ('grid', 'dca', 'arbitrage', 'momentum', 'ai_driven');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'aggressive');
CREATE TYPE position_status AS ENUM ('active', 'paused', 'closed', 'liquidated');
CREATE TYPE order_status AS ENUM ('pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected');
CREATE TYPE order_side AS ENUM ('buy', 'sell');
CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop');
CREATE TYPE exchange_name AS ENUM ('bybit', 'binance');
CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error');

-- ============================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    wallet_address VARCHAR(42),
    smart_account_address VARCHAR(42),
    role user_role DEFAULT 'user',
    kyc_status kyc_status DEFAULT 'none',
    membership_tier membership_tier DEFAULT 'free',
    referral_code VARCHAR(20) UNIQUE,
    referred_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_smart_account ON users(smart_account_address);
CREATE INDEX idx_users_referral ON users(referral_code);

-- ============================================================
-- PROJECTS TABLE (Multi-tenant support)
-- ============================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    api_key VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    api_secret VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    settings JSONB DEFAULT '{
        "allowedDomains": [],
        "rateLimit": 1000,
        "features": {
            "wallet": true,
            "swap": true,
            "contracts": true,
            "fiat": true,
            "payments": true,
            "quant": false
        }
    }',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_api_key ON projects(api_key);

-- ============================================================
-- WALLETS TABLE
-- ============================================================

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    address VARCHAR(42) NOT NULL,
    smart_account_address VARCHAR(42) NOT NULL,
    wallet_type wallet_type DEFAULT 'smart',
    chain_id INTEGER NOT NULL DEFAULT 8453,
    is_default BOOLEAN DEFAULT FALSE,
    encrypted_key TEXT, -- Encrypted private key for server-managed wallets
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_wallets_user_chain ON wallets(user_id, chain_id, is_default) WHERE is_default = TRUE;
CREATE INDEX idx_wallets_address ON wallets(address);
CREATE INDEX idx_wallets_smart_account ON wallets(smart_account_address);

-- ============================================================
-- CONTRACTS REGISTRY
-- ============================================================

CREATE TABLE contracts_registry (
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

CREATE UNIQUE INDEX idx_contracts_address_chain ON contracts_registry(address, chain_id);
CREATE INDEX idx_contracts_project ON contracts_registry(project_id);
CREATE INDEX idx_contracts_type ON contracts_registry(contract_type);

-- ============================================================
-- TRANSACTIONS HISTORY
-- ============================================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    hash VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    value VARCHAR(78), -- Wei as string for precision
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

CREATE UNIQUE INDEX idx_tx_hash_chain ON transactions(hash, chain_id);
CREATE INDEX idx_tx_user ON transactions(user_id);
CREATE INDEX idx_tx_status ON transactions(status);
CREATE INDEX idx_tx_created ON transactions(created_at DESC);

-- ============================================================
-- FIAT TRANSACTIONS
-- ============================================================

CREATE TABLE fiat_transactions (
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

CREATE INDEX idx_fiat_user ON fiat_transactions(user_id);
CREATE INDEX idx_fiat_status ON fiat_transactions(status);
CREATE INDEX idx_fiat_external ON fiat_transactions(external_id);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
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
    qr_code TEXT, -- Base64 encoded QR
    invoice_number VARCHAR(100),
    description TEXT,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_project ON payments(project_id);
CREATE INDEX idx_payments_merchant ON payments(merchant_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================================
-- QUANT STRATEGIES
-- ============================================================

CREATE TABLE quant_strategies (
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
    rebalance_interval INTEGER DEFAULT 86400, -- seconds
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategies_type ON quant_strategies(strategy_type);
CREATE INDEX idx_strategies_active ON quant_strategies(is_active);

-- ============================================================
-- QUANT POSITIONS
-- ============================================================

CREATE TABLE quant_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES quant_strategies(id) ON DELETE RESTRICT,
    status position_status DEFAULT 'active',
    invested_amount DECIMAL(20, 2) NOT NULL,
    current_value DECIMAL(20, 2),
    pnl DECIMAL(20, 2) DEFAULT 0,
    pnl_percent DECIMAL(10, 4) DEFAULT 0,
    shares DECIMAL(30, 18) DEFAULT 0, -- NAV share tokens
    entry_nav DECIMAL(20, 8),
    entry_date TIMESTAMPTZ DEFAULT NOW(),
    exit_date TIMESTAMPTZ,
    last_update TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_user ON quant_positions(user_id);
CREATE INDEX idx_positions_strategy ON quant_positions(strategy_id);
CREATE INDEX idx_positions_status ON quant_positions(status);

-- ============================================================
-- QUANT DAILY PNL
-- ============================================================

CREATE TABLE quant_daily_pnl (
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

CREATE UNIQUE INDEX idx_daily_pnl_position_date ON quant_daily_pnl(position_id, date);
CREATE INDEX idx_daily_pnl_date ON quant_daily_pnl(date DESC);

-- ============================================================
-- TRADE ORDERS (CEX Orders)
-- ============================================================

CREATE TABLE trade_orders (
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

CREATE INDEX idx_orders_position ON trade_orders(position_id);
CREATE INDEX idx_orders_strategy ON trade_orders(strategy_id);
CREATE INDEX idx_orders_status ON trade_orders(status);
CREATE INDEX idx_orders_external ON trade_orders(external_id);

-- ============================================================
-- NAV SNAPSHOTS (Strategy-level)
-- ============================================================

CREATE TABLE nav_snapshots (
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

CREATE UNIQUE INDEX idx_nav_strategy_date ON nav_snapshots(strategy_id, date);
CREATE INDEX idx_nav_date ON nav_snapshots(date DESC);

-- ============================================================
-- SYSTEM LOGS
-- ============================================================

CREATE TABLE system_logs (
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

CREATE INDEX idx_logs_level ON system_logs(level);
CREATE INDEX idx_logs_service ON system_logs(service);
CREATE INDEX idx_logs_created ON system_logs(created_at DESC);

-- Partition logs by month for performance
-- CREATE TABLE system_logs_2024_01 PARTITION OF system_logs FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ============================================================
-- API RATE LIMITS
-- ============================================================

CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_size INTEGER DEFAULT 60, -- seconds
    CONSTRAINT rate_limit_identity CHECK (
        project_id IS NOT NULL OR user_id IS NOT NULL OR ip_address IS NOT NULL
    )
);

CREATE INDEX idx_rate_limits_project ON rate_limits(project_id, endpoint, window_start);
CREATE INDEX idx_rate_limits_user ON rate_limits(user_id, endpoint, window_start);
CREATE INDEX idx_rate_limits_ip ON rate_limits(ip_address, endpoint, window_start);

-- ============================================================
-- WEBHOOKS
-- ============================================================

CREATE TABLE webhooks (
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

CREATE INDEX idx_webhooks_project ON webhooks(project_id);

-- ============================================================
-- WEBHOOK DELIVERIES
-- ============================================================

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER strategies_updated_at BEFORE UPDATE ON quant_strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiat_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_daily_pnl ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = auth_id);

-- Project owners can manage their projects
CREATE POLICY projects_owner_all ON projects FOR ALL USING (
    owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Users can manage their own wallets
CREATE POLICY wallets_user_all ON wallets FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Users can read their own transactions
CREATE POLICY transactions_user_select ON transactions FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Users can manage their own positions
CREATE POLICY positions_user_all ON quant_positions FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Service role bypasses RLS
-- (Supabase service_role key automatically bypasses RLS)

-- ============================================================
-- INITIAL DATA
-- ============================================================

-- Insert default quant strategies
INSERT INTO quant_strategies (name, description, strategy_type, risk_level, min_investment, expected_apy, parameters) VALUES
('Conservative Grid', 'Low-risk grid trading strategy for stable returns', 'grid', 'low', 100, 8.5, '{"gridSize": 10, "priceRange": 0.05}'),
('Momentum Alpha', 'AI-driven momentum strategy with medium risk', 'momentum', 'medium', 500, 15.0, '{"lookbackPeriod": 14, "threshold": 0.02}'),
('Smart DCA', 'Dollar cost averaging with AI timing optimization', 'dca', 'low', 100, 12.0, '{"frequency": "daily", "aiTiming": true}'),
('Arbitrage Pro', 'Cross-exchange arbitrage for consistent profits', 'arbitrage', 'medium', 1000, 20.0, '{"exchanges": ["bybit", "binance"], "minSpread": 0.001}'),
('AI Quant Master', 'Full AI-driven strategy with aggressive growth', 'ai_driven', 'aggressive', 5000, 35.0, '{"model": "gpt-4o", "rebalanceFrequency": 3600}');

COMMENT ON TABLE users IS 'Core user accounts for the ONE ecosystem';
COMMENT ON TABLE projects IS 'Multi-tenant projects using ONE Engine infrastructure';
COMMENT ON TABLE wallets IS 'Smart wallets and EOAs managed by ONE Engine';
COMMENT ON TABLE contracts_registry IS 'Deployed smart contracts registry';
COMMENT ON TABLE quant_strategies IS 'AI/Quant trading strategies';
COMMENT ON TABLE quant_positions IS 'User positions in quant strategies';
COMMENT ON TABLE trade_orders IS 'CEX trade orders for quant strategies';
