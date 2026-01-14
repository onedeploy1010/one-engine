-- ONE Engine Database Migration 003
-- Migrate existing users from One-Wallet to One-Engine
-- Run this AFTER migration 002

-- ============================================================
-- MIGRATION SCRIPT: One-Wallet Users -> One-Engine
-- ============================================================

-- This script should be run with access to both databases
-- Option 1: Use dblink extension
-- Option 2: Use external migration script
-- Option 3: Use Supabase Edge Function

-- For Supabase, we'll create a migration function that can be called
-- with user data from the One-Wallet database

-- ============================================================
-- BATCH IMPORT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION batch_import_users_from_wallet(
    p_users JSONB -- Array of user objects from One-Wallet
) RETURNS TABLE (
    imported_count INTEGER,
    updated_count INTEGER,
    failed_count INTEGER,
    errors JSONB
) AS $$
DECLARE
    v_user JSONB;
    v_imported INTEGER := 0;
    v_updated INTEGER := 0;
    v_failed INTEGER := 0;
    v_errors JSONB := '[]'::JSONB;
    v_user_id UUID;
    v_app_id UUID;
BEGIN
    -- Get One-Wallet app ID
    SELECT id INTO v_app_id FROM ecosystem_apps WHERE slug = 'one-wallet';

    IF v_app_id IS NULL THEN
        INSERT INTO ecosystem_apps (name, slug, description)
        VALUES ('One Wallet', 'one-wallet', 'Main consumer wallet application')
        RETURNING id INTO v_app_id;
    END IF;

    -- Process each user
    FOR v_user IN SELECT * FROM jsonb_array_elements(p_users)
    LOOP
        BEGIN
            -- Try to find existing user by email
            SELECT id INTO v_user_id FROM users WHERE email = v_user->>'email';

            IF v_user_id IS NULL THEN
                -- Insert new user
                INSERT INTO users (
                    email,
                    wallet_address,
                    smart_account_address,
                    thirdweb_user_id,
                    role,
                    kyc_status,
                    kyc_level,
                    membership_tier,
                    agent_level,
                    referral_code,
                    total_referrals,
                    total_team_volume,
                    metadata,
                    created_at,
                    updated_at
                ) VALUES (
                    v_user->>'email',
                    v_user->>'wallet_address',
                    v_user->>'wallet_address', -- Use wallet_address as smart_account if not provided
                    v_user->>'thirdweb_user_id',
                    'user'::user_role,
                    COALESCE(v_user->>'kyc_status', 'none')::kyc_status,
                    COALESCE((v_user->>'kyc_level')::INTEGER, 0),
                    COALESCE(v_user->>'membership_tier', 'free')::membership_tier,
                    COALESCE((v_user->>'agent_level')::INTEGER, 0),
                    v_user->>'referral_code',
                    COALESCE((v_user->>'total_referrals')::INTEGER, 0),
                    COALESCE((v_user->>'total_team_volume')::DECIMAL, 0),
                    COALESCE(v_user->'metadata', '{}'::JSONB),
                    COALESCE((v_user->>'created_at')::TIMESTAMPTZ, NOW()),
                    NOW()
                )
                RETURNING id INTO v_user_id;

                v_imported := v_imported + 1;
            ELSE
                -- Update existing user
                UPDATE users SET
                    wallet_address = COALESCE(v_user->>'wallet_address', wallet_address),
                    thirdweb_user_id = COALESCE(v_user->>'thirdweb_user_id', thirdweb_user_id),
                    kyc_status = COALESCE(v_user->>'kyc_status', kyc_status::TEXT)::kyc_status,
                    kyc_level = COALESCE((v_user->>'kyc_level')::INTEGER, kyc_level),
                    membership_tier = COALESCE(v_user->>'membership_tier', membership_tier::TEXT)::membership_tier,
                    agent_level = COALESCE((v_user->>'agent_level')::INTEGER, agent_level),
                    total_referrals = COALESCE((v_user->>'total_referrals')::INTEGER, total_referrals),
                    total_team_volume = COALESCE((v_user->>'total_team_volume')::DECIMAL, total_team_volume),
                    updated_at = NOW()
                WHERE id = v_user_id;

                v_updated := v_updated + 1;
            END IF;

            -- Create app mapping
            INSERT INTO user_app_mappings (user_id, app_id, external_user_id, app_specific_data)
            VALUES (
                v_user_id,
                v_app_id,
                v_user->>'id',
                jsonb_build_object(
                    'wallet_status', v_user->>'wallet_status',
                    'wallet_type', v_user->>'wallet_type',
                    'last_login_at', v_user->>'last_login_at'
                )
            )
            ON CONFLICT (app_id, external_user_id)
            DO UPDATE SET
                synced_at = NOW(),
                app_specific_data = user_app_mappings.app_specific_data || EXCLUDED.app_specific_data;

        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object(
                'email', v_user->>'email',
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- Log sync
    INSERT INTO sync_logs (app_id, sync_type, status, records_synced, records_failed, completed_at, metadata)
    VALUES (
        v_app_id,
        'full',
        CASE WHEN v_failed = 0 THEN 'completed' ELSE 'completed_with_errors' END,
        v_imported + v_updated,
        v_failed,
        NOW(),
        jsonb_build_object('imported', v_imported, 'updated', v_updated, 'errors', v_errors)
    );

    RETURN QUERY SELECT v_imported, v_updated, v_failed, v_errors;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RESOLVE REFERRAL RELATIONSHIPS
-- ============================================================

-- After initial import, resolve referred_by relationships
CREATE OR REPLACE FUNCTION resolve_referral_relationships() RETURNS void AS $$
DECLARE
    v_app_id UUID;
BEGIN
    SELECT id INTO v_app_id FROM ecosystem_apps WHERE slug = 'one-wallet';

    -- Update referred_by based on app mappings
    UPDATE users u
    SET referred_by = ref_user.user_id
    FROM user_app_mappings uam
    JOIN user_app_mappings ref_user ON ref_user.app_id = uam.app_id
    WHERE u.id = uam.user_id
      AND uam.app_id = v_app_id
      AND u.referred_by IS NULL
      AND (uam.app_specific_data->>'original_referred_by') IS NOT NULL
      AND ref_user.external_user_id = (uam.app_specific_data->>'original_referred_by');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION batch_import_users_from_wallet IS 'Batch imports users from One-Wallet into One-Engine';
COMMENT ON FUNCTION resolve_referral_relationships IS 'Resolves referral relationships after user migration';
