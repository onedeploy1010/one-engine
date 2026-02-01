/**
 * ONE Engine Environment Configuration
 * All environment variables are validated at startup
 */

const getEnvVar = (key: string, required = true): string => {
  const value = process.env[key];
  if (!value && required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
};

const getEnvVarOptional = (key: string, defaultValue = ''): string => {
  return process.env[key] || defaultValue;
};

export const env = {
  // Application
  NODE_ENV: getEnvVarOptional('NODE_ENV', 'development'),
  PORT: parseInt(getEnvVarOptional('PORT', '4000'), 10),

  // Supabase
  SUPABASE_URL: getEnvVar('SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),

  // Thirdweb (optional when Circle wallets enabled)
  THIRDWEB_CLIENT_ID: getEnvVarOptional('THIRDWEB_CLIENT_ID'),
  THIRDWEB_SECRET_KEY: getEnvVarOptional('THIRDWEB_SECRET_KEY'),

  // JWT
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvVarOptional('JWT_EXPIRES_IN', '7d'),

  // OpenAI
  OPENAI_API_KEY: getEnvVarOptional('OPENAI_API_KEY'),
  OPENAI_MODEL: getEnvVarOptional('OPENAI_MODEL', 'gpt-4o'),

  // Trading APIs
  BYBIT_API_KEY: getEnvVarOptional('BYBIT_API_KEY'),
  BYBIT_API_SECRET: getEnvVarOptional('BYBIT_API_SECRET'),
  BYBIT_TESTNET: getEnvVarOptional('BYBIT_TESTNET', 'false') === 'true',

  BINANCE_API_KEY: getEnvVarOptional('BINANCE_API_KEY'),
  BINANCE_API_SECRET: getEnvVarOptional('BINANCE_API_SECRET'),

  // Onramper
  ONRAMPER_API_KEY: getEnvVarOptional('ONRAMPER_API_KEY'),
  ONRAMPER_WEBHOOK_SECRET: getEnvVarOptional('ONRAMPER_WEBHOOK_SECRET'),

  // Redis (optional, for caching and job queues)
  REDIS_URL: getEnvVarOptional('REDIS_URL', 'redis://localhost:6379'),

  // Circle Programmable Wallets - Testnet
  CIRCLE_TESTNET_API_KEY: getEnvVarOptional('CIRCLE_TESTNET_API_KEY'),
  CIRCLE_TESTNET_ENTITY_SECRET: getEnvVarOptional('CIRCLE_TESTNET_ENTITY_SECRET'),
  CIRCLE_TESTNET_WALLET_SET_ID: getEnvVarOptional('CIRCLE_TESTNET_WALLET_SET_ID'),

  // Circle Programmable Wallets - Mainnet
  CIRCLE_MAINNET_API_KEY: getEnvVarOptional('CIRCLE_MAINNET_API_KEY'),
  CIRCLE_MAINNET_ENTITY_SECRET: getEnvVarOptional('CIRCLE_MAINNET_ENTITY_SECRET'),
  CIRCLE_MAINNET_WALLET_SET_ID: getEnvVarOptional('CIRCLE_MAINNET_WALLET_SET_ID'),

  // Circle Network Mode (testnet | mainnet)
  CIRCLE_NETWORK_MODE: getEnvVarOptional('CIRCLE_NETWORK_MODE', 'testnet') as 'testnet' | 'mainnet',

  // Legacy (backward compatibility)
  CIRCLE_API_KEY: getEnvVarOptional('CIRCLE_API_KEY'),
  CIRCLE_ENTITY_SECRET: getEnvVarOptional('CIRCLE_ENTITY_SECRET'),
  CIRCLE_WALLET_SET_ID: getEnvVarOptional('CIRCLE_WALLET_SET_ID'),

  // Feature Flags
  ENABLE_CIRCLE_WALLETS: getEnvVarOptional('ENABLE_CIRCLE_WALLETS', 'false') === 'true',
  ENABLE_AI_QUANT: getEnvVarOptional('ENABLE_AI_QUANT', 'true') === 'true',
  ENABLE_TRADING: getEnvVarOptional('ENABLE_TRADING', 'true') === 'true',
  ENABLE_FIAT: getEnvVarOptional('ENABLE_FIAT', 'true') === 'true',
} as const;

export type Env = typeof env;
