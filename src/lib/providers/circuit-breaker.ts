/**
 * Circuit Breaker Pattern
 * 防止故障级联，自动隔离不健康的服务
 */

import { CircuitBreakerState } from './types';

interface CircuitBreakerConfig {
  failureThreshold: number;      // 触发断开的失败次数
  successThreshold: number;      // 半开状态下恢复需要的成功次数
  timeout: number;               // 断开后等待重试的时间 (ms)
  monitoringPeriod: number;      // 监控周期 (ms)
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,        // 30 seconds
  monitoringPeriod: 60000, // 1 minute
};

export class CircuitBreaker {
  private state: CircuitBreakerState['state'] = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailure?: Date;
  private nextRetry?: Date;
  private config: CircuitBreakerConfig;

  constructor(
    private readonly name: string,
    config?: Partial<CircuitBreakerConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailure,
      nextRetry: this.nextRetry,
    };
  }

  canExecute(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (this.nextRetry && new Date() >= this.nextRetry) {
        this.state = 'half-open';
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // half-open state - allow limited requests
    return true;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success during normal operation
      this.failureCount = 0;
    }
  }

  recordFailure(error?: Error): void {
    this.failureCount++;
    this.lastFailure = new Date();

    if (this.state === 'half-open') {
      // Any failure in half-open goes back to open
      this.trip();
    } else if (this.state === 'closed') {
      if (this.failureCount >= this.config.failureThreshold) {
        this.trip();
      }
    }
  }

  private trip(): void {
    this.state = 'open';
    this.nextRetry = new Date(Date.now() + this.config.timeout);
    console.warn(`[CircuitBreaker] ${this.name} tripped - will retry at ${this.nextRetry.toISOString()}`);
  }

  private reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextRetry = undefined;
    console.info(`[CircuitBreaker] ${this.name} reset to closed state`);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker ${this.name} is open. Next retry: ${this.nextRetry?.toISOString()}`
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
