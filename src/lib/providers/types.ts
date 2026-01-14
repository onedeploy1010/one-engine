/**
 * Provider Hub Types
 * 统一管理所有第三方服务提供商
 */

export type ProviderStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ProviderHealthCheck {
  status: ProviderStatus;
  latency: number; // ms
  lastChecked: Date;
  errorMessage?: string;
  successRate: number; // 0-100
}

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  enabled: boolean;
  priority: number; // Lower = higher priority for failover
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  timeout: number; // ms
  retryConfig: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
}

export type ProviderType =
  | 'blockchain'      // Thirdweb
  | 'fiat'           // Onramper
  | 'exchange'       // Bybit, Binance
  | 'data'           // Price feeds
  | 'ai';            // OpenAI

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  lastError?: {
    message: string;
    timestamp: Date;
    code?: string;
  };
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailure?: Date;
  nextRetry?: Date;
}

export interface ProviderUsage {
  providerId: string;
  projectId: string;
  endpoint: string;
  method: string;
  requestSize: number;
  responseSize: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  costUnits: number; // 用于计费
  timestamp: Date;
}

// Cost units per operation (for billing)
export const COST_UNITS = {
  // Blockchain operations
  'blockchain.read': 1,
  'blockchain.write': 5,
  'blockchain.deploy': 50,
  'blockchain.transfer': 10,

  // Fiat operations
  'fiat.quote': 1,
  'fiat.onramp': 20,
  'fiat.offramp': 20,

  // Exchange operations
  'exchange.quote': 1,
  'exchange.order': 10,
  'exchange.cancel': 2,

  // AI operations
  'ai.completion': 10,
  'ai.analysis': 20,

  // Default
  'default': 1,
} as const;
