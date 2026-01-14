-- AI A/B Book Trading Schema
-- Tracks real (A-Book) vs simulated (B-Book) trades

-- A/B Book trades table
CREATE TABLE IF NOT EXISTS ai_ab_book_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES ai_strategy_pools(id),
  strategy_id UUID REFERENCES ai_strategies(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(24,8) NOT NULL,
  book_type CHAR(1) NOT NULL CHECK (book_type IN ('A', 'B')),  -- A=Real, B=Simulated
  order_id TEXT NOT NULL,
  external_id TEXT,  -- Exchange order ID for A-Book
  filled_qty DECIMAL(24,8) NOT NULL DEFAULT 0,
  avg_price DECIMAL(24,8) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  is_simulated BOOLEAN NOT NULL DEFAULT false,
  slippage_pct DECIMAL(10,6),  -- Actual slippage percentage
  execution_time_ms INTEGER,   -- Execution time in milliseconds
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for A/B Book trades
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_pool ON ai_ab_book_trades(pool_id);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_strategy ON ai_ab_book_trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_book_type ON ai_ab_book_trades(book_type);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_created ON ai_ab_book_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_book_trades_is_simulated ON ai_ab_book_trades(is_simulated);

-- A/B Book configuration table (admin only)
CREATE TABLE IF NOT EXISTS ai_ab_book_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default configuration
INSERT INTO ai_ab_book_config (config_key, config_value, description) VALUES
  ('default_book_type', '"B"', 'Default book type for new trades (A=Real, B=Simulated)'),
  ('simulation_params', '{
    "slippageMin": 0.0001,
    "slippageMax": 0.001,
    "fillRate": 0.98,
    "executionDelayMin": 50,
    "executionDelayMax": 200,
    "recordTrades": true
  }', 'Parameters for B-Book simulation'),
  ('strategy_overrides', '{}', 'Per-strategy book type overrides'),
  ('pool_overrides', '{}', 'Per-pool book type overrides')
ON CONFLICT (config_key) DO NOTHING;

-- View for A/B Book trade summary (admin only)
CREATE OR REPLACE VIEW ai_ab_book_summary AS
SELECT
  book_type,
  COUNT(*) as total_trades,
  SUM(filled_qty * avg_price) as total_volume,
  AVG(slippage_pct) as avg_slippage,
  COUNT(CASE WHEN status = 'filled' THEN 1 END) as filled_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  MIN(created_at) as first_trade,
  MAX(created_at) as last_trade
FROM ai_ab_book_trades
GROUP BY book_type;

-- Function to update A/B Book config
CREATE OR REPLACE FUNCTION update_ab_book_config(
  p_key TEXT,
  p_value JSONB,
  p_updated_by TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ai_ab_book_config
  SET config_value = p_value,
      updated_by = p_updated_by,
      updated_at = now()
  WHERE config_key = p_key;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies (admin only access)
ALTER TABLE ai_ab_book_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ab_book_config ENABLE ROW LEVEL SECURITY;

-- Only allow service role access
CREATE POLICY "Service role access for ab_book_trades" ON ai_ab_book_trades
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access for ab_book_config" ON ai_ab_book_config
  FOR ALL USING (auth.role() = 'service_role');

-- Add updated_at trigger
CREATE TRIGGER update_ab_book_trades_updated_at
  BEFORE UPDATE ON ai_ab_book_trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_book_config_updated_at
  BEFORE UPDATE ON ai_ab_book_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
