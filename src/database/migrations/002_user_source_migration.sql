-- ONE Engine Database Migration 002
-- User Source Migration: Make One-Engine the central user repository
-- This migration updates the users table and adds ecosystem support

-- ============================================================
-- UPDATE USERS TABLE - Add fields from One-Wallet
-- ============================================================

-- Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS thirdweb_user_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_level INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_level INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_team_volume DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create index for thirdweb_user_id
CREATE INDEX IF NOT EXISTS idx_users_thirdweb ON users(thirdweb_user_id);

-- ============================================================
-- ECOSYSTEM PROJECTS TABLE - Track sub-ecosystems
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
    sync_config JSONB DEFAULT '{
        "sync_users": true,
        "sync_wallets": true,
        "sync_transactions": false,
        "sync_interval_seconds": 300
    }',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial ecosystem app: One-Wallet
INSERT INTO ecosystem_apps (name, slug, description, supabase_project_id)
VALUES ('One Wallet', 'one-wallet', 'Main consumer wallet application', 'fyktnfziqyjbrrzszzuz')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- USER APP MAPPING - Link users to ecosystem apps
-- ============================================================

CREATE TABLE IF NOT EXISTS user_app_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES ecosystem_apps(id) ON DELETE CASCADE,
    external_user_id VARCHAR(255) NOT NULL, -- User ID in the external app
    app_specific_data JSONB DEFAULT '{}',   -- App-specific user data
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, app_id),
    UNIQUE(app_id, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_app_mappings_user ON user_app_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_mappings_app ON user_app_mappings(app_id);
CREATE INDEX IF NOT EXISTS idx_user_app_mappings_external ON user_app_mappings(external_user_id);

-- ============================================================
-- SYNC LOGS - Track synchronization history
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES ecosystem_apps(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'user', 'wallet'
    status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed'
    records_synced INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_app ON sync_logs(app_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs(started_at DESC);

-- ============================================================
-- FUNCTIONS FOR USER SYNC
-- ============================================================

-- Function to upsert user from external app
CREATE OR REPLACE FUNCTION upsert_user_from_app(
    p_app_slug VARCHAR,
    p_external_user_id VARCHAR,
    p_email VARCHAR,
    p_wallet_address VARCHAR DEFAULT NULL,
    p_smart_account_address VARCHAR DEFAULT NULL,
    p_thirdweb_user_id VARCHAR DEFAULT NULL,
    p_kyc_status VARCHAR DEFAULT 'none',
    p_kyc_level INTEGER DEFAULT 0,
    p_membership_tier VARCHAR DEFAULT 'free',
    p_agent_level INTEGER DEFAULT 0,
    p_referral_code VARCHAR DEFAULT NULL,
    p_referred_by_external_id VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_app_id UUID;
    v_referred_by_user_id UUID;
BEGIN
    -- Get app ID
    SELECT id INTO v_app_id FROM ecosystem_apps WHERE slug = p_app_slug;
    IF v_app_id IS NULL THEN
        RAISE EXCEPTION 'App not found: %', p_app_slug;
    END IF;

    -- Check if user already exists by email
    SELECT id INTO v_user_id FROM users WHERE email = p_email;

    -- Resolve referred_by if provided
    IF p_referred_by_external_id IS NOT NULL THEN
        SELECT user_id INTO v_referred_by_user_id
        FROM user_app_mappings
        WHERE app_id = v_app_id AND external_user_id = p_referred_by_external_id;
    END IF;

    IF v_user_id IS NULL THEN
        -- Create new user
        INSERT INTO users (
            email, wallet_address, smart_account_address, thirdweb_user_id,
            kyc_status, kyc_level, membership_tier, agent_level,
            referral_code, referred_by, metadata
        ) VALUES (
            p_email, p_wallet_address, p_smart_account_address, p_thirdweb_user_id,
            p_kyc_status::kyc_status, p_kyc_level, p_membership_tier::membership_tier, p_agent_level,
            COALESCE(p_referral_code, substring(md5(random()::text) from 1 for 8)),
            v_referred_by_user_id, p_metadata
        ) RETURNING id INTO v_user_id;
    ELSE
        -- Update existing user
        UPDATE users SET
            wallet_address = COALESCE(p_wallet_address, wallet_address),
            smart_account_address = COALESCE(p_smart_account_address, smart_account_address),
            thirdweb_user_id = COALESCE(p_thirdweb_user_id, thirdweb_user_id),
            kyc_status = p_kyc_status::kyc_status,
            kyc_level = p_kyc_level,
            membership_tier = p_membership_tier::membership_tier,
            agent_level = p_agent_level,
            referred_by = COALESCE(v_referred_by_user_id, referred_by),
            metadata = users.metadata || p_metadata,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Create or update app mapping
    INSERT INTO user_app_mappings (user_id, app_id, external_user_id)
    VALUES (v_user_id, v_app_id, p_external_user_id)
    ON CONFLICT (app_id, external_user_id)
    DO UPDATE SET synced_at = NOW();

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user by external app ID
CREATE OR REPLACE FUNCTION get_user_by_app_id(
    p_app_slug VARCHAR,
    p_external_user_id VARCHAR
) RETURNS TABLE (
    id UUID,
    email VARCHAR,
    wallet_address VARCHAR,
    smart_account_address VARCHAR,
    role user_role,
    kyc_status kyc_status,
    membership_tier membership_tier,
    referral_code VARCHAR,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id, u.email, u.wallet_address, u.smart_account_address,
        u.role, u.kyc_status, u.membership_tier, u.referral_code, u.created_at
    FROM users u
    JOIN user_app_mappings uam ON u.id = uam.user_id
    JOIN ecosystem_apps ea ON uam.app_id = ea.id
    WHERE ea.slug = p_app_slug AND uam.external_user_id = p_external_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER ecosystem_apps_updated_at
    BEFORE UPDATE ON ecosystem_apps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE ecosystem_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Service role can access all
CREATE POLICY ecosystem_apps_service ON ecosystem_apps FOR ALL TO service_role USING (true);
CREATE POLICY user_app_mappings_service ON user_app_mappings FOR ALL TO service_role USING (true);
CREATE POLICY sync_logs_service ON sync_logs FOR ALL TO service_role USING (true);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE ecosystem_apps IS 'Registry of sub-ecosystem applications that sync with One-Engine';
COMMENT ON TABLE user_app_mappings IS 'Maps One-Engine users to their IDs in external apps';
COMMENT ON TABLE sync_logs IS 'Tracks synchronization history between One-Engine and sub-ecosystems';
COMMENT ON FUNCTION upsert_user_from_app IS 'Upserts a user from an external app into One-Engine';
