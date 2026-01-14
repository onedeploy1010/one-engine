/**
 * Test Fixtures
 * Reusable test data
 */

// User fixtures
export const users = {
  regular: {
    id: 'user-regular-1',
    email: 'regular@example.com',
    phone: null,
    wallet_address: '0x1111111111111111111111111111111111111111',
    smart_account_address: '0x2222222222222222222222222222222222222222',
    role: 'user',
    kyc_status: 'none',
    membership_tier: 'free',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_active_at: '2024-01-15T00:00:00Z',
  },
  admin: {
    id: 'user-admin-1',
    email: 'admin@example.com',
    phone: null,
    wallet_address: '0x3333333333333333333333333333333333333333',
    smart_account_address: '0x4444444444444444444444444444444444444444',
    role: 'admin',
    kyc_status: 'verified',
    membership_tier: 'premium',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_active_at: '2024-01-15T00:00:00Z',
  },
  verified: {
    id: 'user-verified-1',
    email: 'verified@example.com',
    phone: '+1234567890',
    wallet_address: '0x5555555555555555555555555555555555555555',
    smart_account_address: '0x6666666666666666666666666666666666666666',
    role: 'user',
    kyc_status: 'verified',
    membership_tier: 'plus',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_active_at: '2024-01-15T00:00:00Z',
  },
};

// Project fixtures
export const projects = {
  default: {
    id: 'project-1',
    owner_id: 'user-regular-1',
    name: 'Test Project',
    slug: 'test-project',
    api_key: 'pk_live_test1234567890',
    is_active: true,
    settings: {
      allowedChains: [1, 137, 42161],
      webhookEnabled: true,
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  inactive: {
    id: 'project-2',
    owner_id: 'user-regular-1',
    name: 'Inactive Project',
    slug: 'inactive-project',
    api_key: 'pk_live_inactive1234',
    is_active: false,
    settings: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

// Wallet fixtures
export const wallets = {
  primary: {
    id: 'wallet-1',
    user_id: 'user-regular-1',
    address: '0x1111111111111111111111111111111111111111',
    type: 'smart',
    chain_id: 1,
    is_primary: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  secondary: {
    id: 'wallet-2',
    user_id: 'user-regular-1',
    address: '0x7777777777777777777777777777777777777777',
    type: 'eoa',
    chain_id: 137,
    is_primary: false,
    created_at: '2024-01-02T00:00:00Z',
  },
};

// Transaction fixtures
export const transactions = {
  pending: {
    id: 'tx-1',
    user_id: 'user-regular-1',
    wallet_id: 'wallet-1',
    chain_id: 1,
    tx_hash: null,
    type: 'transfer',
    status: 'pending',
    from_address: '0x1111111111111111111111111111111111111111',
    to_address: '0x8888888888888888888888888888888888888888',
    value: '1000000000000000000',
    token_address: null,
    gas_used: null,
    gas_price: null,
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  confirmed: {
    id: 'tx-2',
    user_id: 'user-regular-1',
    wallet_id: 'wallet-1',
    chain_id: 1,
    tx_hash: '0x' + 'a'.repeat(64),
    type: 'transfer',
    status: 'confirmed',
    from_address: '0x1111111111111111111111111111111111111111',
    to_address: '0x9999999999999999999999999999999999999999',
    value: '500000000000000000',
    token_address: null,
    gas_used: '21000',
    gas_price: '50000000000',
    metadata: {},
    created_at: '2024-01-14T00:00:00Z',
    updated_at: '2024-01-14T00:01:00Z',
  },
};

// Payment fixtures
export const payments = {
  pending: {
    id: 'payment-1',
    user_id: 'user-regular-1',
    project_id: 'project-1',
    type: 'qr',
    amount: '10.00',
    currency: 'USD',
    status: 'pending',
    recipient_address: '0x1111111111111111111111111111111111111111',
    chain_id: 1,
    tx_hash: null,
    qr_code: 'data:image/png;base64,mock',
    expires_at: '2024-01-16T00:00:00Z',
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  completed: {
    id: 'payment-2',
    user_id: 'user-regular-1',
    project_id: 'project-1',
    type: 'x402',
    amount: '5.00',
    currency: 'USD',
    status: 'completed',
    recipient_address: '0x1111111111111111111111111111111111111111',
    chain_id: 137,
    tx_hash: '0x' + 'b'.repeat(64),
    qr_code: null,
    expires_at: null,
    metadata: { resource: 'https://example.com/api/resource' },
    created_at: '2024-01-14T00:00:00Z',
    updated_at: '2024-01-14T00:01:00Z',
  },
};

// Bill fixtures
export const bills = {
  pending: {
    id: 'bill-1',
    user_id: 'user-regular-1',
    project_id: 'project-1',
    category: 'electricity',
    provider: 'PG&E',
    account_number: '123456789',
    amount: 150.00,
    currency: 'USD',
    due_date: '2024-02-01T00:00:00Z',
    status: 'pending',
    tx_hash: null,
    paid_at: null,
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
  },
  paid: {
    id: 'bill-2',
    user_id: 'user-regular-1',
    project_id: 'project-1',
    category: 'internet',
    provider: 'Comcast',
    account_number: '987654321',
    amount: 79.99,
    currency: 'USD',
    due_date: '2024-01-20T00:00:00Z',
    status: 'paid',
    tx_hash: '0x' + 'c'.repeat(64),
    paid_at: '2024-01-18T00:00:00Z',
    metadata: {},
    created_at: '2024-01-10T00:00:00Z',
  },
};

// Strategy fixtures
export const strategies = {
  active: {
    id: 'strategy-1',
    owner_id: 'user-regular-1',
    name: 'BTC Momentum',
    description: 'Momentum-based trading on BTC',
    type: 'momentum',
    risk_level: 'medium',
    min_investment: '1000',
    max_investment: '100000',
    is_active: true,
    is_public: true,
    performance_7d: 5.5,
    performance_30d: 12.3,
    performance_all: 45.8,
    total_aum: '500000',
    config: {
      symbols: ['BTCUSDT'],
      lookbackPeriod: 14,
      threshold: 0.02,
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
};

// Position fixtures
export const positions = {
  active: {
    id: 'position-1',
    user_id: 'user-regular-1',
    strategy_id: 'strategy-1',
    status: 'active',
    initial_amount: '10000',
    current_amount: '10550',
    pnl: '550',
    pnl_percentage: 5.5,
    entry_price: '42000',
    current_price: '44310',
    opened_at: '2024-01-10T00:00:00Z',
    closed_at: null,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  closed: {
    id: 'position-2',
    user_id: 'user-regular-1',
    strategy_id: 'strategy-1',
    status: 'closed',
    initial_amount: '5000',
    current_amount: '5250',
    pnl: '250',
    pnl_percentage: 5.0,
    entry_price: '40000',
    current_price: '42000',
    opened_at: '2024-01-05T00:00:00Z',
    closed_at: '2024-01-12T00:00:00Z',
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-12T00:00:00Z',
  },
};

// Webhook fixtures
export const webhooks = {
  active: {
    id: 'webhook-1',
    project_id: 'project-1',
    url: 'https://example.com/webhook',
    events: ['payment.paid', 'transaction.confirmed'],
    secret: 'whsec_test1234567890',
    is_active: true,
    metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  inactive: {
    id: 'webhook-2',
    project_id: 'project-1',
    url: 'https://example.com/webhook-old',
    events: ['user.created'],
    secret: 'whsec_test0987654321',
    is_active: false,
    metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  },
};
