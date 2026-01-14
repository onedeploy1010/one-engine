-- ============================================================
-- Migration 012: Wallet App Schema
-- Creates tables required by the ONE Wallet mobile/web app
-- ============================================================

-- ============================================================
-- USER PROFILES (Extended user data for wallet app)
-- ============================================================
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

-- ============================================================
-- USER SETTINGS
-- ============================================================
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

-- ============================================================
-- WALLET ASSETS
-- ============================================================
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

-- ============================================================
-- WALLET TRANSACTIONS (Extended for wallet app)
-- ============================================================
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

-- ============================================================
-- CARDS (Virtual/Physical cards)
-- ============================================================
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

-- ============================================================
-- MERCHANT PROFILES
-- ============================================================
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

-- ============================================================
-- X402 PAYMENT URLS
-- ============================================================
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

-- ============================================================
-- X402 PAYMENT QR CODES
-- ============================================================
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

-- ============================================================
-- X402 PAYMENTS
-- ============================================================
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

-- ============================================================
-- X402 INVOICES
-- ============================================================
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

-- ============================================================
-- X402 RECEIPTS
-- ============================================================
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

-- ============================================================
-- USER SECURITY EVENTS
-- ============================================================
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

-- ============================================================
-- USER DEVICES
-- ============================================================
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

-- ============================================================
-- QR SCAN EVENTS
-- ============================================================
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

-- ============================================================
-- REFERRAL REWARDS
-- ============================================================
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

-- ============================================================
-- AI STRATEGIES (Wallet specific view)
-- ============================================================
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

-- ============================================================
-- AI ORDERS
-- ============================================================
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

-- ============================================================
-- AI NAV SNAPSHOTS
-- ============================================================
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

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER wallet_assets_updated_at BEFORE UPDATE ON wallet_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cards_updated_at BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER merchant_profiles_updated_at BEFORE UPDATE ON merchant_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER wallet_ai_strategies_updated_at BEFORE UPDATE ON wallet_ai_strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER wallet_ai_orders_updated_at BEFORE UPDATE ON wallet_ai_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
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
ALTER TABLE wallet_referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ai_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ai_nav_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "Service role full access user_profiles" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Service role full access user_settings" ON user_settings FOR ALL USING (true);
CREATE POLICY "Service role full access wallet_assets" ON wallet_assets FOR ALL USING (true);
CREATE POLICY "Service role full access wallet_transactions" ON wallet_transactions FOR ALL USING (true);
CREATE POLICY "Service role full access cards" ON cards FOR ALL USING (true);
CREATE POLICY "Service role full access merchant_profiles" ON merchant_profiles FOR ALL USING (true);
CREATE POLICY "Service role full access x402_payment_urls" ON x402_payment_urls FOR ALL USING (true);
CREATE POLICY "Service role full access x402_payment_qr_codes" ON x402_payment_qr_codes FOR ALL USING (true);
CREATE POLICY "Service role full access x402_payments" ON x402_payments FOR ALL USING (true);
CREATE POLICY "Service role full access x402_invoices" ON x402_invoices FOR ALL USING (true);
CREATE POLICY "Service role full access x402_receipts" ON x402_receipts FOR ALL USING (true);
CREATE POLICY "Service role full access user_security_events" ON user_security_events FOR ALL USING (true);
CREATE POLICY "Service role full access user_devices" ON user_devices FOR ALL USING (true);
CREATE POLICY "Service role full access wallet_referral_rewards" ON wallet_referral_rewards FOR ALL USING (true);
CREATE POLICY "Service role full access wallet_ai_strategies" ON wallet_ai_strategies FOR ALL USING (true);
CREATE POLICY "Service role full access wallet_ai_orders" ON wallet_ai_orders FOR ALL USING (true);
CREATE POLICY "Service role full access wallet_ai_nav_snapshots" ON wallet_ai_nav_snapshots FOR ALL USING (true);

-- ============================================================
-- INITIAL DATA: Demo Users
-- ============================================================

-- Demo user profiles
INSERT INTO user_profiles (id, email, wallet_address, wallet_type, wallet_status, kyc_status, kyc_level, membership_tier, referral_code, agent_level)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'john@demo.onewallet.app', '0x742d35Cc6634C0532925a3b844Bc9e7595f8c5F4', 'smart', 'active', 'verified', 2, 'premium', 'JOHNDEMO', 3),
    ('22222222-2222-2222-2222-222222222222', 'alice@demo.onewallet.app', '0x8Ba1f109551bD432803012645Ac136ddd64DBa72', 'smart', 'active', 'verified', 1, 'basic', 'ALICEDEMO', 1),
    ('33333333-3333-3333-3333-333333333333', 'bob@demo.onewallet.app', '0xdD870fA1b7C4700F2BD7f44238821C26f7392148', 'smart', 'active', 'pending', 0, 'free', 'BOBDEMO', 0)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    wallet_address = EXCLUDED.wallet_address;

-- Demo user settings
INSERT INTO user_settings (user_id, language, currency, theme, push_notifications, biometric_enabled, default_chain, default_token)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'en', 'USD', 'dark', true, true, 'base', 'ETH'),
    ('22222222-2222-2222-2222-222222222222', 'zh', 'CNY', 'light', true, false, 'ethereum', 'USDC'),
    ('33333333-3333-3333-3333-333333333333', 'en', 'EUR', 'system', true, false, 'polygon', 'MATIC')
ON CONFLICT (user_id) DO UPDATE SET
    language = EXCLUDED.language,
    currency = EXCLUDED.currency;

-- Demo wallet assets
INSERT INTO wallet_assets (user_id, chain, token_symbol, balance_formatted, value_usd, price_usd, price_change_24h, is_native, decimals)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'base', 'ETH', '2.5', 6250.00, 2500.00, 2.35, true, 18),
    ('11111111-1111-1111-1111-111111111111', 'base', 'USDC', '5000', 5000.00, 1.00, 0.01, false, 6),
    ('11111111-1111-1111-1111-111111111111', 'ethereum', 'ETH', '1.2', 3000.00, 2500.00, 2.35, true, 18),
    ('22222222-2222-2222-2222-222222222222', 'ethereum', 'ETH', '0.8', 2000.00, 2500.00, 2.35, true, 18),
    ('22222222-2222-2222-2222-222222222222', 'ethereum', 'USDC', '1500', 1500.00, 1.00, 0.01, false, 6),
    ('33333333-3333-3333-3333-333333333333', 'polygon', 'MATIC', '1000', 500.00, 0.50, -1.25, true, 18),
    ('33333333-3333-3333-3333-333333333333', 'polygon', 'USDT', '200', 200.00, 1.00, 0.00, false, 6)
ON CONFLICT (user_id, chain, token_symbol) DO UPDATE SET
    balance_formatted = EXCLUDED.balance_formatted,
    value_usd = EXCLUDED.value_usd,
    price_usd = EXCLUDED.price_usd;

-- Demo cards
INSERT INTO cards (user_id, card_type, card_tier, status, card_number_masked, expiry_month, expiry_year, cardholder_name, daily_limit, monthly_limit)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'virtual', 'platinum', 'active', '**** **** **** 4532', 12, 2027, 'JOHN DEMO', 10000, 100000),
    ('22222222-2222-2222-2222-222222222222', 'virtual', 'gold', 'active', '**** **** **** 8721', 6, 2026, 'ALICE DEMO', 5000, 50000),
    ('33333333-3333-3333-3333-333333333333', 'virtual', 'standard', 'pending', '**** **** **** 1234', 3, 2026, 'BOB DEMO', 1000, 10000)
ON CONFLICT DO NOTHING;

-- Demo AI strategies
INSERT INTO wallet_ai_strategies (id, name, description, category, risk_level, min_investment, max_investment, lock_period_days, expected_apy_min, expected_apy_max, is_active, tvl, total_users)
VALUES
    ('conservative-01', 'Stable Growth', 'Low-risk dollar cost averaging into blue-chip cryptocurrencies', 'conservative', 2, 100, 50000, 30, 8, 15, true, 2500000, 1250),
    ('balanced-01', 'Smart Balance', 'Balanced approach with diversified portfolio management', 'balanced', 5, 500, 100000, 30, 15, 35, true, 5000000, 850),
    ('aggressive-01', 'Alpha Hunter', 'High-frequency momentum trading for maximum returns', 'aggressive', 8, 1000, 500000, 30, 30, 80, true, 8000000, 420),
    ('grid-01', 'Grid Trader Pro', 'Automated grid trading strategy for volatile markets', 'grid', 4, 200, 50000, 14, 10, 25, true, 1500000, 680)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tvl = EXCLUDED.tvl,
    total_users = EXCLUDED.total_users;

-- Demo AI orders
INSERT INTO wallet_ai_orders (user_id, strategy_id, amount, currency, chain, status, lock_end_date, lock_period_days, realized_profit, unrealized_profit, current_nav)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'balanced-01', 5000, 'USDT', 'arbitrum', 'active', NOW() + INTERVAL '25 days', 30, 125.50, 87.25, 5212.75),
    ('11111111-1111-1111-1111-111111111111', 'conservative-01', 2000, 'USDT', 'base', 'active', NOW() + INTERVAL '15 days', 30, 45.00, 22.50, 2067.50),
    ('22222222-2222-2222-2222-222222222222', 'aggressive-01', 3000, 'USDT', 'arbitrum', 'active', NOW() + INTERVAL '20 days', 30, 280.00, 150.00, 3430.00)
ON CONFLICT DO NOTHING;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Wallet App Schema Migration Complete!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Tables created: 17';
    RAISE NOTICE 'Demo users: 3';
    RAISE NOTICE 'Demo assets: 7';
    RAISE NOTICE 'Demo cards: 3';
    RAISE NOTICE 'Demo AI strategies: 4';
    RAISE NOTICE '=========================================';
END $$;
