/**
 * Register all providers with the Provider Hub
 */

import { ProviderHub } from './provider-hub';
import { ProviderConfig } from './types';
import { getThirdwebClient } from '../thirdweb';
import { env } from '@/config/env';

// Provider configurations
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  thirdweb: {
    name: 'Thirdweb',
    type: 'blockchain',
    enabled: true,
    priority: 1,
    timeout: 30000,
    rateLimit: {
      requestsPerSecond: 50,
      requestsPerMinute: 1000,
    },
    retryConfig: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    },
  },
  onramper: {
    name: 'Onramper',
    type: 'fiat',
    enabled: !!env.ONRAMPER_API_KEY,
    priority: 1,
    timeout: 60000,
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerMinute: 100,
    },
    retryConfig: {
      maxRetries: 2,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    },
  },
  bybit: {
    name: 'Bybit',
    type: 'exchange',
    enabled: !!env.BYBIT_API_KEY,
    priority: 1,
    timeout: 10000,
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerMinute: 600,
    },
    retryConfig: {
      maxRetries: 2,
      baseDelayMs: 500,
      maxDelayMs: 5000,
    },
  },
  binance: {
    name: 'Binance',
    type: 'exchange',
    enabled: !!env.BINANCE_API_KEY,
    priority: 2, // Fallback for Bybit
    timeout: 10000,
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerMinute: 1200,
    },
    retryConfig: {
      maxRetries: 2,
      baseDelayMs: 500,
      maxDelayMs: 5000,
    },
  },
  openai: {
    name: 'OpenAI',
    type: 'ai',
    enabled: !!env.OPENAI_API_KEY,
    priority: 1,
    timeout: 120000, // AI can take longer
    rateLimit: {
      requestsPerSecond: 3,
      requestsPerMinute: 60,
    },
    retryConfig: {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    },
  },
};

// Health check functions
const healthChecks: Record<string, () => Promise<boolean>> = {
  thirdweb: async () => {
    try {
      // Simple check - verify client is initialized
      return !!getThirdwebClient();
    } catch {
      return false;
    }
  },
  onramper: async () => {
    try {
      const response = await fetch('https://api.onramper.com/supported', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${env.ONRAMPER_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
  bybit: async () => {
    try {
      const baseUrl = env.BYBIT_TESTNET
        ? 'https://api-testnet.bybit.com'
        : 'https://api.bybit.com';

      const response = await fetch(`${baseUrl}/v5/market/time`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
  binance: async () => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ping', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
  openai: async () => {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};

/**
 * Initialize all providers
 */
export function initializeProviders(): void {
  console.info('[ProviderHub] Initializing providers...');

  for (const [id, config] of Object.entries(PROVIDER_CONFIGS)) {
    const healthCheck = healthChecks[id];
    if (healthCheck) {
      ProviderHub.register(id, config, healthCheck);
    }
  }

  console.info('[ProviderHub] All providers registered');
}

/**
 * Get provider status summary
 */
export function getProviderSummary() {
  const status = ProviderHub.getAllStatus();
  const summary: Record<string, {
    name: string;
    enabled: boolean;
    status: string;
    latency: number;
    successRate: number;
    totalRequests: number;
  }> = {};

  for (const [id, provider] of Object.entries(status)) {
    summary[id] = {
      name: provider.config.name,
      enabled: provider.config.enabled,
      status: provider.health.status,
      latency: Math.round(provider.health.latency),
      successRate: provider.health.successRate,
      totalRequests: provider.metrics.totalRequests,
    };
  }

  return summary;
}
