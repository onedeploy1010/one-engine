/**
 * Forex / StableFX Types for ONE Engine
 * USDC stablecoin pair custody trading
 */

// ── Currency Pair ──────────────────────────────────────────────────────────

export interface ForexCurrencyPair {
  id: string;
  base: string;
  quote: string;
  symbol: string;
  name: string;
  basePrice: number;
  pipSize: number;
  spreadPips: number;
  isActive: boolean;
}

export const FOREX_PAIRS: ForexCurrencyPair[] = [
  { id: 'USDC_EURC', base: 'USDC', quote: 'EURC', symbol: 'USDC/EURC', name: 'Euro', basePrice: 0.9230, pipSize: 0.0001, spreadPips: 1.2, isActive: true },
  { id: 'USDC_GBPC', base: 'USDC', quote: 'GBPC', symbol: 'USDC/GBPC', name: 'British Pound', basePrice: 0.7890, pipSize: 0.0001, spreadPips: 1.5, isActive: true },
  { id: 'USDC_JPYC', base: 'USDC', quote: 'JPYC', symbol: 'USDC/JPYC', name: 'Japanese Yen', basePrice: 154.50, pipSize: 0.01, spreadPips: 1.0, isActive: true },
  { id: 'USDC_AUDC', base: 'USDC', quote: 'AUDC', symbol: 'USDC/AUDC', name: 'Australian Dollar', basePrice: 1.5380, pipSize: 0.0001, spreadPips: 1.8, isActive: true },
  { id: 'USDC_CADC', base: 'USDC', quote: 'CADC', symbol: 'USDC/CADC', name: 'Canadian Dollar', basePrice: 1.3640, pipSize: 0.0001, spreadPips: 1.5, isActive: true },
  { id: 'USDC_CHFC', base: 'USDC', quote: 'CHFC', symbol: 'USDC/CHFC', name: 'Swiss Franc', basePrice: 0.8750, pipSize: 0.0001, spreadPips: 1.3, isActive: true },
];

// ── Cycle Options ──────────────────────────────────────────────────────────

export interface ForexCycleOption {
  days: number;
  feeRate: number;
  commissionRate: number;
  label: string;
}

export const FOREX_CYCLE_OPTIONS: ForexCycleOption[] = [
  { days: 30, feeRate: 0.10, commissionRate: 0.60, label: '30D' },
  { days: 60, feeRate: 0.08, commissionRate: 0.70, label: '60D' },
  { days: 90, feeRate: 0.07, commissionRate: 0.75, label: '90D' },
  { days: 180, feeRate: 0.05, commissionRate: 0.85, label: '180D' },
  { days: 360, feeRate: 0.03, commissionRate: 0.90, label: '360D' },
];

// ── Pool Types ─────────────────────────────────────────────────────────────

export type ForexPoolType = 'clearing' | 'hedging' | 'insurance';

export interface ForexPool {
  id: string;
  type: ForexPoolType;
  totalSize: number;
  utilization: number;
  allocation: number;
  updatedAt: string;
}

// ── Investment Types ───────────────────────────────────────────────────────

export type ForexInvestmentStatus = 'pending' | 'active' | 'completed' | 'redeemed' | 'cancelled';

export interface ForexInvestment {
  id: string;
  userId: string;
  amount: number;
  currentValue: number;
  profit: number;
  status: ForexInvestmentStatus;
  selectedPairs: string[];
  cycleDays: number;
  feeRate: number;
  commissionRate: number;
  poolAllocations: {
    clearing: number;
    hedging: number;
    insurance: number;
  };
  tradeWeight: number;
  totalLots: number;
  totalPips: number;
  totalTrades: number;
  startDate: string;
  endDate: string;
  redeemedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateForexInvestmentParams {
  userId: string;
  amount: number;
  selectedPairs: string[];
  cycleDays: number;
}

// ── Trade Types ────────────────────────────────────────────────────────────

export type ForexTradeStatus = 'rfq' | 'quoted' | 'matched' | 'settled' | 'failed';

export interface ForexTrade {
  id: string;
  investmentId: string;
  pairId: string;
  side: 'buy' | 'sell';
  lots: number;
  rfqPrice: number;
  quotePrice: number;
  matchPrice: number;
  settlePrice: number;
  pips: number;
  pnl: number;
  status: ForexTradeStatus;
  pvpSettled: boolean;
  counterparty: string;
  gasCost: number;
  createdAt: string;
  settledAt?: string;
}

// ── Stats Types ────────────────────────────────────────────────────────────

export interface ForexModuleStats {
  totalAum: number;
  totalUsers: number;
  totalInvestments: number;
  activeInvestments: number;
  totalTrades: number;
  totalVolume: number;
  avgWinRate: number;
  pools: ForexPool[];
}

export interface ForexPortfolioSummary {
  totalInvested: number;
  totalValue: number;
  totalProfit: number;
  totalProfitPercent: number;
  activeCount: number;
  completedCount: number;
}

// ── Agent Config ───────────────────────────────────────────────────────────

export const FOREX_AGENT_CONFIG = {
  id: 'stablefx-01',
  name: 'StableFX Agent',
  dailyRoiMin: 0.002,
  dailyRoiMax: 0.005,
  winRate: 72.5,
  minInvestment: 100,
  maxInvestment: 1_000_000,
  lotSize: 100_000,
  maxExposure: 0.25,
} as const;
