/**
 * Provider Hub
 * 统一管理所有第三方服务提供商
 */

import {
  ProviderConfig,
  ProviderHealthCheck,
  ProviderMetrics,
  ProviderStatus,
  ProviderType,
  ProviderUsage,
  COST_UNITS,
} from './types';
import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker';
import { getSupabaseAdmin } from '../supabase';

interface RegisteredProvider {
  config: ProviderConfig;
  healthCheck: ProviderHealthCheck;
  metrics: ProviderMetrics;
  circuitBreaker: CircuitBreaker;
  healthCheckFn: () => Promise<boolean>;
}

class ProviderHubClass {
  private providers: Map<string, RegisteredProvider> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsBuffer: ProviderUsage[] = [];
  private flushInterval?: NodeJS.Timeout;

  constructor() {
    // Start health check loop
    this.startHealthChecks();
    // Start metrics flush loop
    this.startMetricsFlush();
  }

  /**
   * Register a new provider
   */
  register(
    id: string,
    config: ProviderConfig,
    healthCheckFn: () => Promise<boolean>
  ): void {
    const circuitBreaker = new CircuitBreaker(id, {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
    });

    this.providers.set(id, {
      config,
      healthCheck: {
        status: 'unknown',
        latency: 0,
        lastChecked: new Date(),
        successRate: 100,
      },
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
      },
      circuitBreaker,
      healthCheckFn,
    });

    console.info(`[ProviderHub] Registered provider: ${id} (${config.type})`);
  }

  /**
   * Execute an operation through a provider
   */
  async execute<T>(
    providerId: string,
    operation: string,
    projectId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    if (!provider.config.enabled) {
      throw new Error(`Provider disabled: ${providerId}`);
    }

    const startTime = Date.now();
    let success = false;
    let errorCode: string | undefined;

    try {
      const result = await provider.circuitBreaker.execute(async () => {
        // Apply timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Provider timeout')),
            provider.config.timeout
          );
        });

        return Promise.race([fn(), timeoutPromise]);
      });

      success = true;
      provider.metrics.successfulRequests++;
      return result;
    } catch (error) {
      provider.metrics.failedRequests++;
      errorCode = error instanceof CircuitBreakerOpenError
        ? 'CIRCUIT_OPEN'
        : (error as Error).message?.substring(0, 50);

      provider.metrics.lastError = {
        message: (error as Error).message,
        timestamp: new Date(),
        code: errorCode,
      };

      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      provider.metrics.totalRequests++;

      // Update average latency (exponential moving average)
      provider.metrics.avgLatency =
        provider.metrics.avgLatency * 0.9 + latencyMs * 0.1;

      // Record usage for billing
      const costKey = `${provider.config.type}.${operation}` as keyof typeof COST_UNITS;
      const costUnits = COST_UNITS[costKey] || COST_UNITS.default;

      this.recordUsage({
        providerId,
        projectId,
        endpoint: operation,
        method: 'CALL',
        requestSize: 0,
        responseSize: 0,
        latencyMs,
        success,
        errorCode,
        costUnits,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get provider status
   */
  getStatus(providerId: string): ProviderHealthCheck | null {
    return this.providers.get(providerId)?.healthCheck || null;
  }

  /**
   * Get all providers status
   */
  getAllStatus(): Record<string, {
    config: ProviderConfig;
    health: ProviderHealthCheck;
    metrics: ProviderMetrics;
    circuitBreaker: ReturnType<CircuitBreaker['getState']>;
  }> {
    const result: Record<string, any> = {};

    this.providers.forEach((provider, id) => {
      result[id] = {
        config: provider.config,
        health: provider.healthCheck,
        metrics: provider.metrics,
        circuitBreaker: provider.circuitBreaker.getState(),
      };
    });

    return result;
  }

  /**
   * Get providers by type
   */
  getProvidersByType(type: ProviderType): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, p]) => p.config.type === type && p.config.enabled)
      .sort((a, b) => a[1].config.priority - b[1].config.priority)
      .map(([id]) => id);
  }

  /**
   * Get best available provider of a type
   */
  getBestProvider(type: ProviderType): string | null {
    const providers = this.getProvidersByType(type);

    for (const id of providers) {
      const provider = this.providers.get(id);
      if (
        provider &&
        provider.healthCheck.status !== 'unhealthy' &&
        provider.circuitBreaker.getState().state !== 'open'
      ) {
        return id;
      }
    }

    return providers[0] || null; // Fallback to first available even if unhealthy
  }

  /**
   * Record usage for billing
   */
  private recordUsage(usage: ProviderUsage): void {
    this.metricsBuffer.push(usage);

    // Flush if buffer is large
    if (this.metricsBuffer.length >= 100) {
      this.flushMetrics();
    }
  }

  /**
   * Flush metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const batch = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Cast to any since provider_usage table is new and not in generated types
      await (getSupabaseAdmin() as any).from('provider_usage').insert(
        batch.map((u) => ({
          provider_id: u.providerId,
          project_id: u.projectId,
          endpoint: u.endpoint,
          method: u.method,
          request_size: u.requestSize,
          response_size: u.responseSize,
          latency_ms: u.latencyMs,
          success: u.success,
          error_code: u.errorCode,
          cost_units: u.costUnits,
          created_at: u.timestamp.toISOString(),
        }))
      );
    } catch (error) {
      console.error('[ProviderHub] Failed to flush metrics:', error);
      // Re-add to buffer on failure
      this.metricsBuffer.unshift(...batch);
    }
  }

  /**
   * Run health checks for all providers
   */
  private async runHealthChecks(): Promise<void> {
    const entries = Array.from(this.providers.entries());

    for (let i = 0; i < entries.length; i++) {
      const [id, provider] = entries[i];
      if (!provider.config.enabled) continue;

      const startTime = Date.now();
      let status: ProviderStatus = 'unknown';
      let errorMessage: string | undefined;

      try {
        const healthy = await Promise.race([
          provider.healthCheckFn(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          ),
        ]);

        status = healthy ? 'healthy' : 'degraded';
      } catch (error) {
        status = 'unhealthy';
        errorMessage = (error as Error).message;
      }

      const latency = Date.now() - startTime;

      // Calculate success rate
      const total = provider.metrics.totalRequests || 1;
      const successRate = (provider.metrics.successfulRequests / total) * 100;

      provider.healthCheck = {
        status,
        latency,
        lastChecked: new Date(),
        errorMessage,
        successRate: Math.round(successRate * 100) / 100,
      };
    }
  }

  /**
   * Start health check loop
   */
  private startHealthChecks(): void {
    // Run immediately
    this.runHealthChecks();

    // Then run every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.runHealthChecks();
    }, 30000);
  }

  /**
   * Start metrics flush loop
   */
  private startMetricsFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 10000); // Flush every 10 seconds
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushMetrics(); // Final flush
    }
  }
}

// Singleton instance
export const ProviderHub = new ProviderHubClass();
