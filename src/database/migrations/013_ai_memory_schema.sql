-- AI Memory and Strategy Schema
-- This creates tables for AI agent memory, decision tracking, and performance analysis

-- ============================================
-- AI Agent Memory (Long-term memory for each agent)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('market_pattern', 'successful_trade', 'failed_trade', 'learned_rule', 'risk_event')),

    -- Memory content
    symbol TEXT,
    market_condition JSONB, -- market state when this memory was created
    pattern_description TEXT,
    confidence_score DECIMAL(5,2),

    -- Trade-related (for trade memories)
    trade_action TEXT, -- buy, sell, long, short
    entry_price DECIMAL(20,8),
    exit_price DECIMAL(20,8),
    pnl DECIMAL(20,8),
    pnl_pct DECIMAL(10,4),

    -- Learning outcome
    lesson_learned TEXT,
    should_repeat BOOLEAN DEFAULT TRUE, -- true for successful patterns
    importance_weight DECIMAL(5,4) DEFAULT 1.0, -- how much weight to give this memory

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ, -- some memories can expire

    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_ai_memory_agent ON ai_agent_memory(agent_id);
CREATE INDEX idx_ai_memory_type ON ai_agent_memory(memory_type);
CREATE INDEX idx_ai_memory_symbol ON ai_agent_memory(symbol);
CREATE INDEX idx_ai_memory_importance ON ai_agent_memory(importance_weight DESC);

-- ============================================
-- AI Decision Log (Every decision the AI makes)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_decision_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    strategy_id UUID REFERENCES ai_strategies(id),
    batch_id TEXT NOT NULL, -- groups decisions made at the same time

    -- Decision details
    decision_type TEXT NOT NULL CHECK (decision_type IN ('trade', 'hold', 'rebalance', 'risk_adjust', 'stop_loss', 'take_profit')),
    action TEXT, -- buy, sell, hold, etc.
    symbol TEXT,

    -- Amount and price
    suggested_amount DECIMAL(20,8),
    suggested_price DECIMAL(20,8),
    stop_loss_price DECIMAL(20,8),
    take_profit_price DECIMAL(20,8),
    leverage DECIMAL(5,2) DEFAULT 1,

    -- AI Analysis
    market_analysis TEXT, -- AI's market analysis
    reasoning TEXT NOT NULL, -- why this decision was made
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),

    -- Context at decision time
    market_data JSONB, -- prices, volumes, indicators at decision time
    current_positions JSONB, -- existing positions when decision was made
    pool_capital DECIMAL(20,8),

    -- Execution status
    was_executed BOOLEAN DEFAULT FALSE,
    execution_id UUID, -- link to ai_trade_executions if executed
    execution_price DECIMAL(20,8),
    execution_time TIMESTAMPTZ,

    -- Outcome tracking
    outcome_pnl DECIMAL(20,8), -- actual P&L if executed
    outcome_pnl_pct DECIMAL(10,4),
    was_successful BOOLEAN, -- did this decision lead to profit?

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    evaluated_at TIMESTAMPTZ, -- when outcome was evaluated

    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_ai_decision_agent ON ai_decision_log(agent_id);
CREATE INDEX idx_ai_decision_strategy ON ai_decision_log(strategy_id);
CREATE INDEX idx_ai_decision_batch ON ai_decision_log(batch_id);
CREATE INDEX idx_ai_decision_symbol ON ai_decision_log(symbol);
CREATE INDEX idx_ai_decision_success ON ai_decision_log(was_successful) WHERE was_executed = TRUE;
CREATE INDEX idx_ai_decision_created ON ai_decision_log(created_at DESC);

-- ============================================
-- AI Strategy Pool (Capital pool for each strategy)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_strategy_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES ai_strategies(id) ON DELETE CASCADE,

    -- Pool capital
    total_capital DECIMAL(20,8) NOT NULL DEFAULT 0, -- total invested
    available_capital DECIMAL(20,8) NOT NULL DEFAULT 0, -- not in positions
    locked_capital DECIMAL(20,8) NOT NULL DEFAULT 0, -- in open positions

    -- NAV tracking
    current_nav DECIMAL(20,8) NOT NULL DEFAULT 1.0, -- net asset value per share
    total_shares DECIMAL(20,8) NOT NULL DEFAULT 0, -- total shares issued

    -- Performance
    total_pnl DECIMAL(20,8) DEFAULT 0,
    total_pnl_pct DECIMAL(10,4) DEFAULT 0,
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    total_fees_collected DECIMAL(20,8) DEFAULT 0,

    -- Risk metrics
    current_drawdown DECIMAL(10,4) DEFAULT 0,
    max_drawdown DECIMAL(10,4) DEFAULT 0,
    daily_pnl DECIMAL(20,8) DEFAULT 0,

    -- Trading stats
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    avg_win DECIMAL(20,8) DEFAULT 0,
    avg_loss DECIMAL(20,8) DEFAULT 0,

    -- Position limits
    max_position_size DECIMAL(20,8),
    max_leverage DECIMAL(5,2) DEFAULT 10,
    daily_trade_limit INTEGER DEFAULT 50,
    trades_today INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_trade_at TIMESTAMPTZ,
    last_nav_update_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_pool_strategy ON ai_strategy_pools(strategy_id);

-- ============================================
-- AI Open Positions (Real-time position tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_open_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES ai_strategy_pools(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES ai_strategies(id),
    execution_id UUID REFERENCES ai_trade_executions(id),
    decision_id UUID REFERENCES ai_decision_log(id),

    -- Position details
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    quantity DECIMAL(20,8) NOT NULL,
    leverage DECIMAL(5,2) DEFAULT 1,

    -- Value tracking
    notional_value DECIMAL(20,8), -- quantity * current_price
    margin_used DECIMAL(20,8), -- capital locked
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    unrealized_pnl_pct DECIMAL(10,4) DEFAULT 0,

    -- Risk management
    stop_loss_price DECIMAL(20,8),
    take_profit_price DECIMAL(20,8),
    liquidation_price DECIMAL(20,8),

    -- AI reasoning
    entry_reasoning TEXT,
    ai_confidence INTEGER,

    -- Timestamps
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_position_pool ON ai_open_positions(pool_id);
CREATE INDEX idx_position_strategy ON ai_open_positions(strategy_id);
CREATE INDEX idx_position_symbol ON ai_open_positions(symbol);

-- ============================================
-- AI Performance Snapshots (Daily tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES ai_strategy_pools(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES ai_strategies(id),
    snapshot_date DATE NOT NULL,

    -- NAV and capital
    nav DECIMAL(20,8) NOT NULL,
    total_capital DECIMAL(20,8),
    total_shares DECIMAL(20,8),

    -- Daily performance
    daily_return DECIMAL(10,6), -- percentage
    daily_pnl DECIMAL(20,8),
    cumulative_return DECIMAL(10,6),

    -- Trading activity
    trades_executed INTEGER DEFAULT 0,
    volume_traded DECIMAL(20,8) DEFAULT 0,
    fees_paid DECIMAL(20,8) DEFAULT 0,

    -- Risk metrics
    drawdown DECIMAL(10,4),
    sharpe_ratio DECIMAL(10,4),
    volatility DECIMAL(10,4),

    -- Market context
    btc_price DECIMAL(20,8),
    eth_price DECIMAL(20,8),
    market_sentiment TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(pool_id, snapshot_date)
);

CREATE INDEX idx_snapshot_strategy ON ai_performance_snapshots(strategy_id);
CREATE INDEX idx_snapshot_date ON ai_performance_snapshots(snapshot_date DESC);

-- ============================================
-- User Order Allocation (Per-user share tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_order_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES ai_orders(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    pool_id UUID NOT NULL REFERENCES ai_strategy_pools(id),

    -- Share ownership
    shares_owned DECIMAL(20,8) NOT NULL,
    share_percentage DECIMAL(10,6) NOT NULL, -- user's % of pool

    -- Cost basis
    avg_entry_nav DECIMAL(20,8) NOT NULL, -- average NAV at purchase
    total_invested DECIMAL(20,8) NOT NULL,

    -- Current value
    current_value DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8),
    unrealized_pnl_pct DECIMAL(10,4),

    -- Realized
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    fees_paid DECIMAL(20,8) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_order_shares_order ON ai_order_shares(order_id);
CREATE INDEX idx_order_shares_user ON ai_order_shares(user_id);
CREATE INDEX idx_order_shares_pool ON ai_order_shares(pool_id);

-- ============================================
-- Functions for NAV calculation
-- ============================================

-- Calculate current NAV for a strategy pool
CREATE OR REPLACE FUNCTION calculate_pool_nav(p_pool_id UUID)
RETURNS DECIMAL(20,8) AS $$
DECLARE
    v_total_capital DECIMAL(20,8);
    v_total_shares DECIMAL(20,8);
    v_unrealized_pnl DECIMAL(20,8);
    v_nav DECIMAL(20,8);
BEGIN
    -- Get pool data
    SELECT total_capital, total_shares INTO v_total_capital, v_total_shares
    FROM ai_strategy_pools WHERE id = p_pool_id;

    -- If no shares, NAV is 1
    IF v_total_shares IS NULL OR v_total_shares = 0 THEN
        RETURN 1.0;
    END IF;

    -- Calculate unrealized P&L from open positions
    SELECT COALESCE(SUM(unrealized_pnl), 0) INTO v_unrealized_pnl
    FROM ai_open_positions WHERE pool_id = p_pool_id;

    -- NAV = (total capital + unrealized P&L) / total shares
    v_nav := (v_total_capital + v_unrealized_pnl) / v_total_shares;

    RETURN v_nav;
END;
$$ LANGUAGE plpgsql;

-- Calculate user's share value
CREATE OR REPLACE FUNCTION calculate_user_share_value(p_order_id UUID)
RETURNS TABLE(
    shares DECIMAL(20,8),
    current_nav DECIMAL(20,8),
    current_value DECIMAL(20,8),
    pnl DECIMAL(20,8),
    pnl_pct DECIMAL(10,4)
) AS $$
DECLARE
    v_pool_id UUID;
    v_shares DECIMAL(20,8);
    v_entry_nav DECIMAL(20,8);
    v_current_nav DECIMAL(20,8);
    v_current_value DECIMAL(20,8);
    v_invested DECIMAL(20,8);
BEGIN
    -- Get order share data
    SELECT os.pool_id, os.shares_owned, os.avg_entry_nav, os.total_invested
    INTO v_pool_id, v_shares, v_entry_nav, v_invested
    FROM ai_order_shares os WHERE os.order_id = p_order_id;

    -- Calculate current NAV
    v_current_nav := calculate_pool_nav(v_pool_id);
    v_current_value := v_shares * v_current_nav;

    RETURN QUERY SELECT
        v_shares,
        v_current_nav,
        v_current_value,
        v_current_value - v_invested,
        CASE WHEN v_invested > 0 THEN ((v_current_value - v_invested) / v_invested * 100) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers for auto-updating
-- ============================================

-- Update pool stats when trade closes
CREATE OR REPLACE FUNCTION update_pool_on_trade_close()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'closed' AND OLD.status = 'open' THEN
        -- Update pool statistics
        UPDATE ai_strategy_pools
        SET
            realized_pnl = realized_pnl + NEW.pnl,
            total_pnl = total_pnl + NEW.pnl,
            total_trades = total_trades + 1,
            winning_trades = winning_trades + CASE WHEN NEW.pnl > 0 THEN 1 ELSE 0 END,
            losing_trades = losing_trades + CASE WHEN NEW.pnl < 0 THEN 1 ELSE 0 END,
            available_capital = available_capital + (NEW.amount / NEW.leverage) + NEW.pnl,
            locked_capital = locked_capital - (NEW.amount / NEW.leverage),
            updated_at = NOW(),
            last_trade_at = NOW()
        WHERE strategy_id = NEW.strategy_id;

        -- Update win rate
        UPDATE ai_strategy_pools
        SET win_rate = CASE WHEN total_trades > 0 THEN (winning_trades::DECIMAL / total_trades * 100) ELSE 0 END
        WHERE strategy_id = NEW.strategy_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_pool_on_trade
AFTER UPDATE ON ai_trade_executions
FOR EACH ROW
EXECUTE FUNCTION update_pool_on_trade_close();

-- Update order shares when NAV changes
CREATE OR REPLACE FUNCTION update_order_share_values()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all order shares for this pool
    UPDATE ai_order_shares os
    SET
        current_value = os.shares_owned * NEW.current_nav,
        unrealized_pnl = (os.shares_owned * NEW.current_nav) - os.total_invested,
        unrealized_pnl_pct = CASE
            WHEN os.total_invested > 0
            THEN (((os.shares_owned * NEW.current_nav) - os.total_invested) / os.total_invested * 100)
            ELSE 0
        END,
        updated_at = NOW()
    WHERE os.pool_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_order_shares
AFTER UPDATE OF current_nav ON ai_strategy_pools
FOR EACH ROW
EXECUTE FUNCTION update_order_share_values();

-- ============================================
-- Insert some initial data
-- ============================================

-- Create strategy pools for existing strategies
INSERT INTO ai_strategy_pools (strategy_id, current_nav, max_position_size, daily_trade_limit)
SELECT id, 1.0, min_investment * 0.3,
    CASE
        WHEN risk_level <= 2 THEN 20
        WHEN risk_level <= 4 THEN 30
        ELSE 50
    END
FROM ai_strategies
WHERE NOT EXISTS (SELECT 1 FROM ai_strategy_pools WHERE ai_strategy_pools.strategy_id = ai_strategies.id);
