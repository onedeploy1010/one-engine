/**
 * Redis Cache Layer for ONE Engine
 * Provides fast caching for hot data like prices, configs, and sessions
 */

import Redis from 'ioredis';
import { env } from '@/config/env';
import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'RedisCache' });

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  PRICES: 10,           // Market prices - 10 seconds
  BALANCES: 30,         // Wallet balances - 30 seconds
  CONFIG: 300,          // App configs - 5 minutes
  USER_SESSION: 3600,   // User sessions - 1 hour
  MARKET_DATA: 60,      // Market data - 1 minute
  TOKEN_LIST: 3600,     // Token lists - 1 hour
  PORTFOLIO: 60,        // Portfolio data - 1 minute
  DASHBOARD: 30,        // Dashboard aggregation - 30 seconds
} as const;

// Cache key prefixes
export const CACHE_PREFIX = {
  PRICE: 'price:',
  BALANCE: 'balance:',
  PORTFOLIO: 'portfolio:',
  DASHBOARD: 'dashboard:',
  USER: 'user:',
  SESSION: 'session:',
  CONFIG: 'config:',
  MARKET: 'market:',
  TOKENS: 'tokens:',
} as const;

class RedisCache {
  private client: Redis | null = null;
  private isConnected = false;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();

  constructor() {
    this.connect();
  }

  private connect(): void {
    try {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        log.info('Redis connected');
      });

      this.client.on('error', (err) => {
        log.warn('Redis error, falling back to memory cache', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      // Attempt connection
      this.client.connect().catch(() => {
        log.info('Redis not available, using memory cache');
      });
    } catch (error) {
      log.info('Redis initialization failed, using memory cache');
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isConnected && this.client) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      }

      // Fallback to memory cache
      const cached = this.memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.value;
      }
      this.memoryCache.delete(key);
      return null;
    } catch (error) {
      log.error('Cache get error', error as Error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    try {
      const serialized = JSON.stringify(value);

      if (this.isConnected && this.client) {
        await this.client.setex(key, ttlSeconds, serialized);
      }

      // Always store in memory cache as backup
      this.memoryCache.set(key, {
        value,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    } catch (error) {
      log.error('Cache set error', error as Error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
      }
      this.memoryCache.delete(key);
    } catch (error) {
      log.error('Cache delete error', error as Error);
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      }

      // Clear matching memory cache entries
      const keys = Array.from(this.memoryCache.keys());
      for (const key of keys) {
        if (key.includes(pattern.replace('*', ''))) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      log.error('Cache delete pattern error', error as Error);
    }
  }

  /**
   * Get or set with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Singleton instance
export const cache = new RedisCache();

// Helper functions for common cache operations
export const cacheHelpers = {
  // Price caching
  async getPrice(symbol: string): Promise<number | null> {
    return cache.get<number>(`${CACHE_PREFIX.PRICE}${symbol}`);
  },

  async setPrice(symbol: string, price: number): Promise<void> {
    await cache.set(`${CACHE_PREFIX.PRICE}${symbol}`, price, CACHE_TTL.PRICES);
  },

  // Balance caching
  async getBalance(address: string, chainId: number): Promise<any | null> {
    return cache.get(`${CACHE_PREFIX.BALANCE}${chainId}:${address}`);
  },

  async setBalance(address: string, chainId: number, balance: any): Promise<void> {
    await cache.set(`${CACHE_PREFIX.BALANCE}${chainId}:${address}`, balance, CACHE_TTL.BALANCES);
  },

  // Portfolio caching
  async getPortfolio(userId: string): Promise<any | null> {
    return cache.get(`${CACHE_PREFIX.PORTFOLIO}${userId}`);
  },

  async setPortfolio(userId: string, portfolio: any): Promise<void> {
    await cache.set(`${CACHE_PREFIX.PORTFOLIO}${userId}`, portfolio, CACHE_TTL.PORTFOLIO);
  },

  // Dashboard caching
  async getDashboard(userId: string): Promise<any | null> {
    return cache.get(`${CACHE_PREFIX.DASHBOARD}${userId}`);
  },

  async setDashboard(userId: string, dashboard: any): Promise<void> {
    await cache.set(`${CACHE_PREFIX.DASHBOARD}${userId}`, dashboard, CACHE_TTL.DASHBOARD);
  },

  // Invalidate user cache
  async invalidateUserCache(userId: string): Promise<void> {
    await cache.delPattern(`*${userId}*`);
  },
};
