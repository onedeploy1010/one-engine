-- Quick Start Schema for ONE Dashboard
-- Run this in Supabase SQL Editor to get started quickly

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User Role Enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'agent', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- KYC Status Enum
DO $$ BEGIN
    CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Membership Tier Enum
DO $$ BEGIN
    CREATE TYPE membership_tier AS ENUM ('free', 'basic', 'premium', 'vip');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users Table (without auth.users FK for quick setup)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- OTP Codes Table for authentication
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access users" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access otp" ON otp_codes FOR ALL USING (true);

-- Create a test admin user
INSERT INTO users (email, role, metadata)
VALUES ('admin@one23.io', 'admin', '{"name": "Admin User", "registered_from": "system"}')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

SELECT 'Database setup complete!' as status;
