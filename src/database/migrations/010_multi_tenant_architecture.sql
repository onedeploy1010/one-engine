-- ============================================================
-- ONE Ecosystem Multi-Tenant Architecture
-- 类似thirdweb的project隔离架构
-- ============================================================

-- ==================== 1. 团队和项目管理 ====================

-- 团队 (一个用户可以属于多个团队)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id),
  billing_plan VARCHAR(50) DEFAULT 'free', -- free, starter, growth, pro
  billing_email VARCHAR(255),

  -- 配额限制
  max_projects INT DEFAULT 3,
  max_api_calls_per_month BIGINT DEFAULT 100000,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 团队成员
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, user_id)
);

-- 项目 (核心：每个项目有独立的client_id，数据隔离)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,

  -- Client凭证 (类似thirdweb的client id)
  client_id VARCHAR(64) NOT NULL UNIQUE, -- one_pk_xxxxxx (公开，可在前端使用)

  -- 状态
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended

  -- 配置
  settings JSONB DEFAULT '{
    "allowedDomains": [],
    "allowedBundleIds": [],
    "enabledServices": {
      "connect": true,
      "wallet": true,
      "contracts": false,
      "pay": false,
      "engine": false
    },
    "rateLimit": {
      "requestsPerMinute": 100,
      "requestsPerDay": 10000
    }
  }',

  -- Thirdweb内部关联 (隐藏)
  thirdweb_client_id VARCHAR(255), -- ONE在thirdweb的client id

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, slug)
);

-- 项目API密钥 (一个项目可以有多个密钥)
CREATE TABLE IF NOT EXISTS project_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL DEFAULT 'Default Key',
  key_type VARCHAR(50) NOT NULL, -- 'publishable' (前端) | 'secret' (后端)

  -- 密钥存储 (hash存储，只显示prefix)
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL, -- one_pk_xxxx 或 one_sk_xxxx

  -- 权限限制
  allowed_domains TEXT[], -- 域名白名单 (仅publishable)
  allowed_ips TEXT[],     -- IP白名单 (仅secret)
  permissions JSONB DEFAULT '["*"]', -- API权限列表

  -- 速率限制
  rate_limit_per_minute INT DEFAULT 100,

  -- 使用统计
  last_used_at TIMESTAMPTZ,
  total_requests BIGINT DEFAULT 0,

  -- 状态
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ, -- 可选过期时间

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 2. 用户数据 (按项目隔离) ====================

-- 项目用户 (用户在特定项目的身份)
-- 核心：一个全局user可以在多个project中有不同的身份
CREATE TABLE IF NOT EXISTS project_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- 用户身份
  external_id VARCHAR(255), -- 项目方自定义的用户ID
  email VARCHAR(255),
  phone VARCHAR(50),

  -- 认证方式
  auth_method VARCHAR(50), -- 'email' | 'phone' | 'social_google' | 'social_apple' | 'passkey' | 'wallet'
  auth_provider_id VARCHAR(255), -- OAuth provider的用户ID

  -- 钱包地址 (项目内的主钱包)
  wallet_address VARCHAR(255),
  smart_account_address VARCHAR(255),

  -- Thirdweb内部关联 (隐藏)
  thirdweb_user_id VARCHAR(255),
  thirdweb_wallet_id VARCHAR(255),

  -- 项目特定数据
  metadata JSONB DEFAULT '{}',

  -- 状态
  status VARCHAR(50) DEFAULT 'active',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 复合唯一约束
  UNIQUE(project_id, email),
  UNIQUE(project_id, wallet_address)
);

-- 用户钱包 (In-App Wallets，按项目)
CREATE TABLE IF NOT EXISTS project_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_user_id UUID NOT NULL REFERENCES project_users(id) ON DELETE CASCADE,

  -- 钱包信息
  address VARCHAR(255) NOT NULL,
  wallet_type VARCHAR(50) NOT NULL, -- 'eoa' | 'smart_account'

  -- 支持的链
  chain_ids INT[] DEFAULT '{1, 137, 56, 42161}',

  -- Smart Account配置
  smart_account_config JSONB, -- factory, entrypoint等

  -- Thirdweb内部关联
  thirdweb_wallet_id VARCHAR(255),

  -- 状态
  is_primary BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, address)
);

-- ==================== 3. 后端钱包 (Engine) ====================

-- Backend Wallets (服务端钱包，按项目)
CREATE TABLE IF NOT EXISTS project_backend_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  label VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,

  -- 密钥类型
  key_type VARCHAR(50) NOT NULL, -- 'local' | 'aws_kms' | 'gcp_kms'
  key_id VARCHAR(255), -- KMS key id (如果使用云KMS)

  -- 加密存储的私钥 (仅local类型)
  encrypted_private_key TEXT,

  -- Thirdweb Engine关联
  thirdweb_backend_wallet_id VARCHAR(255),

  -- 状态
  nonce INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, address)
);

-- ==================== 4. 交易记录 ====================

-- 交易队列 (Engine transactions)
CREATE TABLE IF NOT EXISTS project_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- 发送者
  from_address VARCHAR(255) NOT NULL,
  backend_wallet_id UUID REFERENCES project_backend_wallets(id),

  -- 交易详情
  to_address VARCHAR(255) NOT NULL,
  chain_id INT NOT NULL,
  data TEXT,
  value VARCHAR(78) DEFAULT '0',

  -- Gas配置
  gas_limit VARCHAR(78),
  max_fee_per_gas VARCHAR(78),
  max_priority_fee_per_gas VARCHAR(78),

  -- 状态
  status VARCHAR(50) DEFAULT 'queued', -- queued, submitted, mined, failed
  tx_hash VARCHAR(255),
  block_number BIGINT,
  gas_used VARCHAR(78),

  -- 错误信息
  error_message TEXT,
  retry_count INT DEFAULT 0,

  -- Thirdweb关联
  thirdweb_queue_id VARCHAR(255),

  -- 元数据
  metadata JSONB DEFAULT '{}',

  submitted_at TIMESTAMPTZ,
  mined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 5. API使用量统计 ====================

-- API调用记录 (用于计费和分析)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES project_api_keys(id),

  -- 请求信息
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,

  -- 响应
  status_code INT,
  response_time_ms INT,

  -- 来源
  ip_address VARCHAR(45),
  user_agent TEXT,
  origin VARCHAR(255),

  -- 时间 (用于聚合)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API使用量日聚合 (用于dashboard显示)
CREATE TABLE IF NOT EXISTS api_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  -- 聚合数据
  total_requests BIGINT DEFAULT 0,
  successful_requests BIGINT DEFAULT 0,
  failed_requests BIGINT DEFAULT 0,

  -- 按端点
  requests_by_endpoint JSONB DEFAULT '{}',

  -- 按服务
  connect_requests BIGINT DEFAULT 0,
  wallet_requests BIGINT DEFAULT 0,
  contract_requests BIGINT DEFAULT 0,
  pay_requests BIGINT DEFAULT 0,

  UNIQUE(project_id, date)
);

-- ==================== 6. 合约管理 ====================

-- 已部署合约 (按项目)
CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  chain_id INT NOT NULL,

  -- 合约类型
  contract_type VARCHAR(100), -- 'ERC20' | 'ERC721' | 'ERC1155' | 'Custom'

  -- ABI
  abi JSONB,

  -- 部署信息
  deployer_address VARCHAR(255),
  deploy_tx_hash VARCHAR(255),
  deployed_at TIMESTAMPTZ,

  -- Thirdweb关联
  thirdweb_contract_id VARCHAR(255),

  -- 状态
  status VARCHAR(50) DEFAULT 'active',
  verified BOOLEAN DEFAULT false,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chain_id, address)
);

-- ==================== 7. 支付记录 ====================

-- 支付/On-ramp记录
CREATE TABLE IF NOT EXISTS project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_user_id UUID REFERENCES project_users(id),

  -- 类型
  payment_type VARCHAR(50) NOT NULL, -- 'onramp' | 'offramp' | 'checkout'

  -- 金额
  fiat_amount DECIMAL(18, 2),
  fiat_currency VARCHAR(10),
  crypto_amount VARCHAR(78),
  crypto_currency VARCHAR(20),
  chain_id INT,

  -- 提供商
  provider VARCHAR(50), -- 'onramper' | 'moonpay' | 'stripe'
  provider_tx_id VARCHAR(255),

  -- 状态
  status VARCHAR(50) DEFAULT 'pending',

  -- 目标地址
  destination_address VARCHAR(255),
  tx_hash VARCHAR(255),

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 索引 ====================

CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_project_api_keys_project ON project_api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_project_users_project ON project_users(project_id);
CREATE INDEX IF NOT EXISTS idx_project_users_email ON project_users(project_id, email);
CREATE INDEX IF NOT EXISTS idx_project_users_wallet ON project_users(project_id, wallet_address);
CREATE INDEX IF NOT EXISTS idx_project_wallets_user ON project_wallets(project_user_id);
CREATE INDEX IF NOT EXISTS idx_project_transactions_project ON project_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_transactions_status ON project_transactions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_api_usage_project ON api_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(project_id, created_at);

-- ==================== 函数 ====================

-- 生成client_id
CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'one_pk_' || encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;

-- 生成API key
CREATE OR REPLACE FUNCTION generate_api_key(key_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  prefix VARCHAR;
BEGIN
  IF key_type = 'publishable' THEN
    prefix := 'one_pk_';
  ELSE
    prefix := 'one_sk_';
  END IF;
  RETURN prefix || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- 创建默认团队和项目 (新用户注册时调用)
CREATE OR REPLACE FUNCTION create_default_team_and_project(p_user_id UUID, p_email VARCHAR)
RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
  v_project_id UUID;
  v_client_id VARCHAR;
BEGIN
  -- 创建默认团队
  INSERT INTO teams (name, slug, owner_id, billing_email)
  VALUES (
    split_part(p_email, '@', 1) || '''s Team',
    'team-' || encode(gen_random_bytes(8), 'hex'),
    p_user_id,
    p_email
  )
  RETURNING id INTO v_team_id;

  -- 添加为团队owner
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (v_team_id, p_user_id, 'owner');

  -- 创建默认项目
  v_client_id := generate_client_id();
  INSERT INTO projects (team_id, name, slug, client_id)
  VALUES (
    v_team_id,
    'My First Project',
    'default',
    v_client_id
  )
  RETURNING id INTO v_project_id;

  -- 创建默认API key (publishable)
  INSERT INTO project_api_keys (project_id, name, key_type, key_hash, key_prefix)
  VALUES (
    v_project_id,
    'Default Publishable Key',
    'publishable',
    encode(sha256(v_client_id::bytea), 'hex'),
    substring(v_client_id, 1, 15)
  );

  RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;

-- ==================== RLS策略 ====================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_transactions ENABLE ROW LEVEL SECURITY;

-- 团队成员可以访问自己团队的数据
CREATE POLICY team_access ON teams
  FOR ALL USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY project_access ON projects
  FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- ==================== 注释 ====================

COMMENT ON TABLE projects IS '项目表 - 核心数据隔离单位，类似thirdweb的project';
COMMENT ON COLUMN projects.client_id IS '公开的Client ID，用于前端SDK调用';
COMMENT ON COLUMN project_users.thirdweb_user_id IS '内部关联到thirdweb的用户ID，对外隐藏';
COMMENT ON TABLE project_backend_wallets IS 'Engine后端钱包，用于服务端签名交易';
