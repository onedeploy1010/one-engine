-- Provider Usage Table
-- 追踪所有第三方服务的使用情况，用于计费和监控

-- 1. 创建 provider_usage 表
CREATE TABLE IF NOT EXISTS provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(20) NOT NULL,
  request_size INTEGER DEFAULT 0,
  response_size INTEGER DEFAULT 0,
  latency_ms INTEGER NOT NULL,
  success BOOLEAN DEFAULT true,
  error_code VARCHAR(100),
  cost_units INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_provider_usage_project_created
  ON provider_usage(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_usage_provider_created
  ON provider_usage(provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_usage_created
  ON provider_usage(created_at DESC);

-- 3. 创建聚合视图 - 按小时统计
CREATE OR REPLACE VIEW provider_usage_hourly AS
SELECT
  project_id,
  provider_id,
  date_trunc('hour', created_at) AS hour,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE success = true) AS successful_requests,
  COUNT(*) FILTER (WHERE success = false) AS failed_requests,
  AVG(latency_ms)::INTEGER AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p95_latency_ms,
  SUM(cost_units) AS total_cost_units
FROM provider_usage
GROUP BY project_id, provider_id, date_trunc('hour', created_at);

-- 4. 创建聚合视图 - 按天统计
CREATE OR REPLACE VIEW provider_usage_daily AS
SELECT
  project_id,
  provider_id,
  date_trunc('day', created_at) AS day,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE success = true) AS successful_requests,
  COUNT(*) FILTER (WHERE success = false) AS failed_requests,
  AVG(latency_ms)::INTEGER AS avg_latency_ms,
  SUM(cost_units) AS total_cost_units
FROM provider_usage
GROUP BY project_id, provider_id, date_trunc('day', created_at);

-- 5. 创建聚合视图 - 按月统计 (用于账单)
CREATE OR REPLACE VIEW provider_usage_monthly AS
SELECT
  project_id,
  provider_id,
  date_trunc('month', created_at) AS month,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE success = true) AS successful_requests,
  COUNT(*) FILTER (WHERE success = false) AS failed_requests,
  AVG(latency_ms)::INTEGER AS avg_latency_ms,
  SUM(cost_units) AS total_cost_units
FROM provider_usage
GROUP BY project_id, provider_id, date_trunc('month', created_at);

-- 6. 更新 api_usage 表结构 (添加缺失字段)
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS cost_units INTEGER DEFAULT 1;
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS provider_id VARCHAR(50);
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS error_code VARCHAR(100);

-- 7. 创建 api_usage 索引
CREATE INDEX IF NOT EXISTS idx_api_usage_project_created
  ON api_usage(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_created
  ON api_usage(api_key_id, created_at DESC);

-- 8. 创建项目配额表
CREATE TABLE IF NOT EXISTS project_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,

  -- API 请求配额
  api_requests_monthly_limit INTEGER DEFAULT 100000,
  api_requests_monthly_used INTEGER DEFAULT 0,

  -- Cost Units 配额 (用于计费)
  cost_units_monthly_limit INTEGER DEFAULT 10000,
  cost_units_monthly_used INTEGER DEFAULT 0,

  -- 当前周期
  current_period_start TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
  current_period_end TIMESTAMPTZ DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month',

  -- 警告阈值 (百分比)
  warning_threshold INTEGER DEFAULT 80,

  -- 是否发送过警告
  warning_sent BOOLEAN DEFAULT false,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 创建配额更新触发器
CREATE OR REPLACE FUNCTION update_project_quota()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新 API 请求计数
  UPDATE project_quotas
  SET
    api_requests_monthly_used = api_requests_monthly_used + 1,
    cost_units_monthly_used = cost_units_monthly_used + COALESCE(NEW.cost_units, 1),
    updated_at = NOW()
  WHERE project_id = NEW.project_id
    AND current_period_start <= NOW()
    AND current_period_end > NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除旧触发器如果存在
DROP TRIGGER IF EXISTS trg_update_quota_on_api_usage ON api_usage;

-- 创建触发器
CREATE TRIGGER trg_update_quota_on_api_usage
AFTER INSERT ON api_usage
FOR EACH ROW
EXECUTE FUNCTION update_project_quota();

-- 10. 创建配额重置函数 (每月调用)
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
  UPDATE project_quotas
  SET
    api_requests_monthly_used = 0,
    cost_units_monthly_used = 0,
    warning_sent = false,
    current_period_start = date_trunc('month', NOW()),
    current_period_end = date_trunc('month', NOW()) + INTERVAL '1 month',
    updated_at = NOW()
  WHERE current_period_end <= NOW();
END;
$$ LANGUAGE plpgsql;

-- 11. RLS 策略
ALTER TABLE provider_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_quotas ENABLE ROW LEVEL SECURITY;

-- provider_usage RLS
CREATE POLICY "Users can view their project provider usage"
  ON provider_usage FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- project_quotas RLS
CREATE POLICY "Users can view their project quotas"
  ON project_quotas FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- 12. 为每个现有项目创建配额记录
INSERT INTO project_quotas (project_id)
SELECT id FROM projects
WHERE id NOT IN (SELECT project_id FROM project_quotas)
ON CONFLICT (project_id) DO NOTHING;

COMMENT ON TABLE provider_usage IS '第三方服务使用量追踪，用于监控和计费';
COMMENT ON TABLE project_quotas IS '项目配额管理，用于限制和计费';
