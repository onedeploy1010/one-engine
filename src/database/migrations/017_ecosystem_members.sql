-- Migration: Create ecosystem_members table
-- Description: Stores ecosystem membership data for users

-- Create ecosystem_members table
CREATE TABLE IF NOT EXISTS public.ecosystem_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    wallet_address TEXT,
    auth_method TEXT NOT NULL DEFAULT 'wallet',
    membership_tier TEXT DEFAULT 'free',
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT ecosystem_members_user_id_unique UNIQUE (user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ecosystem_members_user_id ON public.ecosystem_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ecosystem_members_email ON public.ecosystem_members(email);
CREATE INDEX IF NOT EXISTS idx_ecosystem_members_wallet_address ON public.ecosystem_members(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ecosystem_members_membership_tier ON public.ecosystem_members(membership_tier);

-- Enable RLS
ALTER TABLE public.ecosystem_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own membership
CREATE POLICY "Users can read own membership"
    ON public.ecosystem_members
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own membership
CREATE POLICY "Users can update own membership"
    ON public.ecosystem_members
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can manage all memberships
CREATE POLICY "Service role full access"
    ON public.ecosystem_members
    FOR ALL
    USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ecosystem_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ecosystem_members_updated_at_trigger ON public.ecosystem_members;
CREATE TRIGGER ecosystem_members_updated_at_trigger
    BEFORE UPDATE ON public.ecosystem_members
    FOR EACH ROW
    EXECUTE FUNCTION update_ecosystem_members_updated_at();

-- Create ecosystem_projects table (referenced in types)
CREATE TABLE IF NOT EXISTS public.ecosystem_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.ecosystem_members(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    project_type TEXT,
    blockchain_network TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for ecosystem_projects
CREATE INDEX IF NOT EXISTS idx_ecosystem_projects_member_id ON public.ecosystem_projects(member_id);

-- Enable RLS for ecosystem_projects
ALTER TABLE public.ecosystem_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ecosystem_projects
CREATE POLICY "Users can manage own projects"
    ON public.ecosystem_projects
    FOR ALL
    USING (
        member_id IN (
            SELECT id FROM public.ecosystem_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access projects"
    ON public.ecosystem_projects
    FOR ALL
    USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON public.ecosystem_members TO authenticated;
GRANT ALL ON public.ecosystem_members TO service_role;
GRANT ALL ON public.ecosystem_projects TO authenticated;
GRANT ALL ON public.ecosystem_projects TO service_role;

COMMENT ON TABLE public.ecosystem_members IS 'Stores membership information for ONE ecosystem users';
COMMENT ON TABLE public.ecosystem_projects IS 'Stores projects created by ecosystem members';
