-- ============================================================================
-- 015_forex_stablefx.sql
-- StableFX On-chain Forex Custody Trading Module
-- USDC stablecoin pair trading with RFQ+PvP settlement
-- ============================================================================

-- ── ENUM Types ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE forex_investment_status AS ENUM (
    'pending', 'active', 'completed', 'redeemed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE forex_pool_type AS ENUM (
    'clearing', 'hedging', 'insurance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE forex_trade_status AS ENUM (
    'rfq', 'quoted', 'matched', 'settled', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE forex_trade_side AS ENUM ('buy', 'sell');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Forex Pools ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forex_pools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_type     forex_pool_type NOT NULL UNIQUE,
  total_size    DECIMAL(20,2) NOT NULL DEFAULT 0,
  utilization   DECIMAL(5,4) NOT NULL DEFAULT 0,
  allocation    DECIMAL(5,4) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default pools
INSERT INTO forex_pools (pool_type, total_size, utilization, allocation)
VALUES
  ('clearing',  12500000, 0.7800, 0.50),
  ('hedging',    7500000, 0.6500, 0.30),
  ('insurance',  5000000, 0.4200, 0.20)
ON CONFLICT (pool_type) DO NOTHING;

-- ── Forex Investments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forex_investments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            DECIMAL(20,2) NOT NULL CHECK (amount >= 100 AND amount <= 1000000),
  current_value     DECIMAL(20,4) NOT NULL DEFAULT 0,
  profit            DECIMAL(20,4) NOT NULL DEFAULT 0,
  status            forex_investment_status NOT NULL DEFAULT 'pending',
  selected_pairs    TEXT[] NOT NULL,
  cycle_days        INTEGER NOT NULL CHECK (cycle_days IN (30, 60, 90, 180, 360)),
  fee_rate          DECIMAL(5,4) NOT NULL,
  commission_rate   DECIMAL(5,4) NOT NULL,
  pool_clearing     DECIMAL(20,2) NOT NULL DEFAULT 0,
  pool_hedging      DECIMAL(20,2) NOT NULL DEFAULT 0,
  pool_insurance    DECIMAL(20,2) NOT NULL DEFAULT 0,
  trade_weight      DECIMAL(12,8) NOT NULL DEFAULT 0,
  total_lots        DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_pips        DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_trades      INTEGER NOT NULL DEFAULT 0,
  start_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ NOT NULL,
  redeemed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forex_investments_user
  ON forex_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_forex_investments_status
  ON forex_investments(status);
CREATE INDEX IF NOT EXISTS idx_forex_investments_user_status
  ON forex_investments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_forex_investments_end_date
  ON forex_investments(end_date) WHERE status = 'active';

-- ── Forex Trades ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forex_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id   UUID NOT NULL REFERENCES forex_investments(id) ON DELETE CASCADE,
  pair_id         TEXT NOT NULL,
  side            forex_trade_side NOT NULL,
  lots            DECIMAL(10,4) NOT NULL CHECK (lots > 0),
  rfq_price       DECIMAL(20,6) NOT NULL,
  quote_price     DECIMAL(20,6) NOT NULL,
  match_price     DECIMAL(20,6) NOT NULL DEFAULT 0,
  settle_price    DECIMAL(20,6) NOT NULL DEFAULT 0,
  pips            DECIMAL(12,4) NOT NULL DEFAULT 0,
  pnl             DECIMAL(20,4) NOT NULL DEFAULT 0,
  status          forex_trade_status NOT NULL DEFAULT 'rfq',
  pvp_settled     BOOLEAN NOT NULL DEFAULT FALSE,
  counterparty    TEXT,
  gas_cost        DECIMAL(10,4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_forex_trades_investment
  ON forex_trades(investment_id);
CREATE INDEX IF NOT EXISTS idx_forex_trades_pair
  ON forex_trades(pair_id);
CREATE INDEX IF NOT EXISTS idx_forex_trades_status
  ON forex_trades(status);
CREATE INDEX IF NOT EXISTS idx_forex_trades_created
  ON forex_trades(created_at DESC);

-- ── Forex Daily Snapshots ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forex_daily_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id   UUID NOT NULL REFERENCES forex_investments(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  opening_value   DECIMAL(20,4) NOT NULL,
  closing_value   DECIMAL(20,4) NOT NULL,
  daily_pnl       DECIMAL(20,4) NOT NULL DEFAULT 0,
  daily_pnl_pct   DECIMAL(8,4) NOT NULL DEFAULT 0,
  trades_count    INTEGER NOT NULL DEFAULT 0,
  lots_traded     DECIMAL(12,4) NOT NULL DEFAULT 0,
  pips_earned     DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(investment_id, date)
);

CREATE INDEX IF NOT EXISTS idx_forex_snapshots_inv_date
  ON forex_daily_snapshots(investment_id, date DESC);

-- ── Updated-at Triggers ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_forex_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_forex_investments_updated
    BEFORE UPDATE ON forex_investments
    FOR EACH ROW EXECUTE FUNCTION update_forex_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_forex_pools_updated
    BEFORE UPDATE ON forex_pools
    FOR EACH ROW EXECUTE FUNCTION update_forex_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RPC: Atomic Pool Size Increment ──────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_pool_size(
  p_pool_type forex_pool_type,
  p_amount    DECIMAL
)
RETURNS void AS $$
BEGIN
  UPDATE forex_pools
  SET total_size = total_size + p_amount,
      updated_at = now()
  WHERE pool_type = p_pool_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS Policies ───────────────────────────────────────────────────────────

ALTER TABLE forex_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_pools ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY forex_investments_user_select
    ON forex_investments FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY forex_investments_user_insert
    ON forex_investments FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY forex_trades_user_select
    ON forex_trades FOR SELECT
    USING (
      investment_id IN (
        SELECT id FROM forex_investments WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY forex_snapshots_user_select
    ON forex_daily_snapshots FOR SELECT
    USING (
      investment_id IN (
        SELECT id FROM forex_investments WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY forex_pools_read_all
    ON forex_pools FOR SELECT
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RPC Functions ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_pool_size(p_pool_type forex_pool_type, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE forex_pools
  SET total_size = total_size + p_amount,
      updated_at = now()
  WHERE pool_type = p_pool_type;
END;
$$ LANGUAGE plpgsql;
