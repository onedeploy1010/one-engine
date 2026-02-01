/**
 * Core type definitions for ONE Engine
 */

// ============ User & Auth Types ============

export interface User {
  id: string;
  email: string;
  walletAddress: string;
  smartAccountAddress?: string;
  role: UserRole;
  kycStatus: KycStatus;
  membershipTier: MembershipTier;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'user' | 'agent' | 'admin' | 'superadmin';
export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type MembershipTier = 'free' | 'basic' | 'premium' | 'vip';

export interface AuthTokenPayload {
  sub: string; // User ID
  email: string;
  walletAddress: string;
  projectId?: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthContext {
  userId: string;
  email: string;
  walletAddress: string;
  projectId?: string;
  role: UserRole;
  accessToken: string;
}

// ============ Project Types ============

export interface Project {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  apiKey: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  allowedDomains: string[];
  rateLimit: number;
  features: {
    wallet: boolean;
    swap: boolean;
    contracts: boolean;
    fiat: boolean;
    payments: boolean;
    quant: boolean;
    ai: boolean;        // AI Agent Trading
    x402: boolean;      // X402 Payment Protocol
  };
}

// ============ Wallet Types ============

export interface Wallet {
  id: string;
  userId: string;
  address: string;
  smartAccountAddress: string;
  type: WalletType;
  chainId: number;
  isDefault: boolean;
  encryptedKey?: string;
  createdAt: string;
}

export type WalletType = 'smart' | 'eoa' | 'multisig';

export interface WalletBalance {
  chainId: number;
  address: string;
  native: {
    symbol: string;
    balance: string;
    balanceFormatted: string;
    valueUsd: number;
  };
  tokens: TokenBalance[];
  totalValueUsd: number;
}

export interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
  logoUri?: string;
}

// ============ Transaction Types ============

export interface Transaction {
  id: string;
  hash: string;
  chainId: number;
  from: string;
  to: string;
  value: string;
  data?: string;
  status: TransactionStatus;
  type: TransactionType;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  timestamp: string;
}

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';
export type TransactionType = 'transfer' | 'swap' | 'contract_call' | 'deploy' | 'approval';

// ============ Swap Types ============

export interface SwapQuote {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  exchangeRate: number;
  priceImpact: number;
  estimatedGas: string;
  route: SwapRoute[];
  expiresAt: string;
}

export interface SwapRoute {
  protocol: string;
  percent: number;
  path: string[];
}

export interface TokenInfo {
  address: string;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
}

export interface SwapRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number;
  recipient?: string;
}

// ============ Contract Types ============

export interface ContractRegistry {
  id: string;
  projectId: string;
  address: string;
  chainId: number;
  name: string;
  type: ContractType;
  abi: any[];
  verified: boolean;
  deployTxHash?: string;
  createdAt: string;
}

export type ContractType = 'token' | 'nft' | 'marketplace' | 'staking' | 'dao' | 'custom';

export interface DeployContractRequest {
  chainId: number;
  contractType: ContractType;
  name: string;
  symbol?: string;
  params?: Record<string, unknown>;
  bytecode?: string;
  abi?: any[];
}

export interface ContractCallRequest {
  contractAddress: string;
  chainId: number;
  method: string;
  args?: unknown[];
  value?: string;
  abi?: any[];
}

// ============ Fiat Types ============

export interface FiatTransaction {
  id: string;
  userId: string;
  type: 'onramp' | 'offramp';
  fiatCurrency: string;
  fiatAmount: number;
  cryptoCurrency: string;
  cryptoAmount: string;
  status: FiatStatus;
  provider: string;
  externalId?: string;
  walletAddress: string;
  createdAt: string;
  completedAt?: string;
}

export type FiatStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

// ============ Payment Types ============

export interface Payment {
  id: string;
  projectId: string;
  merchantId?: string;
  userId: string;
  recipientId?: string;
  type: PaymentType;
  status: PaymentStatus;
  amount: string;
  currency: string;
  chainId: number;
  tokenAddress?: string;
  fromAddress?: string;
  toAddress: string;
  txHash?: string;
  description?: string;
  resource?: string; // For X402 payments
  qrCode?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  paidAt?: string;
  settledAt?: string;
}

export type PaymentType = 'qr' | 'x402' | 'invoice' | 'subscription';
export type PaymentStatus = 'pending' | 'paid' | 'confirmed' | 'settled' | 'failed' | 'refunded';

// ============ Quant/Trading Types ============

export interface QuantStrategy {
  id: string;
  name: string;
  description: string;
  type: StrategyType;
  riskLevel: RiskLevel;
  minInvestment: number;
  maxInvestment: number;
  expectedApy: number;
  isActive: boolean;
  parameters: Record<string, unknown>;
  createdAt: string;
}

export type StrategyType = 'grid' | 'dca' | 'arbitrage' | 'momentum' | 'ai_driven';
export type RiskLevel = 'low' | 'medium' | 'high' | 'aggressive';

export interface QuantPosition {
  id: string;
  userId: string;
  strategyId: string;
  status: PositionStatus;
  investedAmount: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  entryDate: string;
  lastUpdate: string;
}

export type PositionStatus = 'active' | 'paused' | 'closed' | 'liquidated';

export interface TradeOrder {
  id: string;
  positionId: string;
  exchange: 'bybit' | 'binance';
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price?: number;
  status: OrderStatus;
  externalId?: string;
  filledQty?: number;
  avgPrice?: number;
  createdAt: string;
  filledAt?: string;
}

export type OrderStatus = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';

// ============ API Request Types ============

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

// ============ Ecosystem Types ============

export interface EcosystemApp {
  id: string;
  name: string;
  slug: string;
  description?: string;
  supabaseUrl?: string;
  supabaseProjectId?: string;
  apiEndpoint?: string;
  isActive: boolean;
  syncConfig: EcosystemSyncConfig;
  createdAt: string;
  updatedAt: string;
}

export interface EcosystemSyncConfig {
  syncUsers: boolean;
  syncWallets: boolean;
  syncTransactions: boolean;
  syncIntervalSeconds: number;
}

export interface UserAppMapping {
  id: string;
  userId: string;
  appId: string;
  externalUserId: string;
  appSpecificData: Record<string, unknown>;
  syncedAt: string;
  createdAt: string;
}

export interface SyncLog {
  id: string;
  appId: string;
  syncType: 'full' | 'incremental' | 'user' | 'wallet';
  status: 'started' | 'completed' | 'failed' | 'completed_with_errors';
  recordsSynced: number;
  recordsFailed: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
}

export interface SyncResult {
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

// ============ Dashboard Aggregation Types ============

export interface DashboardData {
  user: {
    id: string;
    email: string;
    membershipTier: string;
    kycStatus: string;
  };
  portfolio: PortfolioSummary;
  recentTransactions: TransactionSummary[];
  activePositions: PositionSummary[];
  notifications: Notification[];
  marketHighlights: MarketHighlight[];
}

export interface PortfolioSummary {
  totalValueUsd: number;
  change24h: number;
  change24hPercent: number;
  chains: ChainBalance[];
}

export interface ChainBalance {
  chainId: number;
  name: string;
  valueUsd: number;
  tokens: number;
}

export interface TransactionSummary {
  id: string;
  type: string;
  amount: string;
  status: string;
  timestamp: string;
}

export interface PositionSummary {
  id: string;
  strategyName: string;
  investedAmount: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface MarketHighlight {
  symbol: string;
  price: number;
  change24h: number;
}

// ============ Admin Statistics Types ============

export interface EcosystemStats {
  users: UserStats;
  apps: AppStats;
  transactions: TransactionStats;
  trading: TradingStats;
  growth: GrowthStats;
}

export interface UserStats {
  total: number;
  active30d: number;
  newToday: number;
  byTier: Record<string, number>;
  byKycStatus: Record<string, number>;
}

export interface AppStats {
  total: number;
  active: number;
}

export interface TransactionStats {
  total: number;
  today: number;
  volumeUsd: number;
}

export interface TradingStats {
  totalPositions: number;
  activePositions: number;
  totalAum: number;
}

export interface GrowthStats {
  usersLast7Days: number[];
  transactionsLast7Days: number[];
}
