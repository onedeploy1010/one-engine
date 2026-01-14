/**
 * Price Aggregator Service
 * Fetches real-time prices from free APIs (CoinGecko, Binance)
 * with caching and fallback support
 */

import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'PriceAggregator' });

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: Date;
  source: 'coingecko' | 'binance' | 'cache';
}

interface CacheEntry {
  data: PriceData;
  timestamp: number;
}

// Symbol to CoinGecko ID mapping
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink',
  'AVAX': 'avalanche-2',
  'UNI': 'uniswap',
  'ATOM': 'cosmos',
  'LTC': 'litecoin',
  'NEAR': 'near',
  'ARB': 'arbitrum',
  'OP': 'optimism',
};

const COINGECKO_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_COINGECKO).map(([k, v]) => [v, k])
);

class PriceAggregatorService {
  private cache: Map<string, CacheEntry> = new Map();
  private CACHE_TTL = 60 * 1000; // 1 minute cache
  private lastCoinGeckoCall = 0;
  private COINGECKO_RATE_LIMIT = 2000; // 2 seconds between calls (free tier limit)

  /**
   * Get prices for multiple symbols with caching and fallback
   */
  async getPrices(symbols: string[]): Promise<PriceData[]> {
    const results: PriceData[] = [];
    const uncachedSymbols: string[] = [];

    // Check cache first
    for (const symbol of symbols) {
      const cached = this.cache.get(symbol.toUpperCase());
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        results.push({ ...cached.data, source: 'cache' });
      } else {
        uncachedSymbols.push(symbol.toUpperCase());
      }
    }

    if (uncachedSymbols.length === 0) {
      return results;
    }

    // Try CoinGecko first (better data)
    try {
      const freshData = await this.fetchFromCoinGecko(uncachedSymbols);
      results.push(...freshData);

      // Update cache
      for (const data of freshData) {
        this.cache.set(data.symbol, { data, timestamp: Date.now() });
      }

      // Check if any symbols were not found
      const foundSymbols = freshData.map(d => d.symbol);
      const missingSymbols = uncachedSymbols.filter(s => !foundSymbols.includes(s));

      if (missingSymbols.length > 0) {
        // Try Binance for missing symbols
        const binanceData = await this.fetchFromBinance(missingSymbols);
        results.push(...binanceData);

        for (const data of binanceData) {
          this.cache.set(data.symbol, { data, timestamp: Date.now() });
        }
      }
    } catch (error) {
      log.warn('CoinGecko failed, trying Binance...', { error: (error as Error).message });

      try {
        const fallbackData = await this.fetchFromBinance(uncachedSymbols);
        results.push(...fallbackData);

        for (const data of fallbackData) {
          this.cache.set(data.symbol, { data, timestamp: Date.now() });
        }
      } catch (fallbackError) {
        log.error('All price sources failed', fallbackError as Error);

        // Return stale cache as last resort
        for (const symbol of uncachedSymbols) {
          const staleCache = this.cache.get(symbol);
          if (staleCache) {
            results.push({ ...staleCache.data, source: 'cache' });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get single price
   */
  async getPrice(symbol: string): Promise<PriceData | null> {
    const prices = await this.getPrices([symbol]);
    return prices[0] || null;
  }

  /**
   * Fetch from CoinGecko API (free tier: 10-30 calls/min)
   */
  private async fetchFromCoinGecko(symbols: string[]): Promise<PriceData[]> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCoinGeckoCall;
    if (timeSinceLastCall < this.COINGECKO_RATE_LIMIT) {
      await this.sleep(this.COINGECKO_RATE_LIMIT - timeSinceLastCall);
    }
    this.lastCoinGeckoCall = Date.now();

    // Convert symbols to CoinGecko IDs
    const coinIds = symbols
      .map(s => SYMBOL_TO_COINGECKO[s])
      .filter(Boolean)
      .join(',');

    if (!coinIds) {
      return [];
    }

    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return data.map((coin: any) => ({
      symbol: COINGECKO_TO_SYMBOL[coin.id] || coin.symbol.toUpperCase(),
      price: coin.current_price || 0,
      change24h: coin.price_change_24h || 0,
      changePercent24h: coin.price_change_percentage_24h || 0,
      high24h: coin.high_24h || 0,
      low24h: coin.low_24h || 0,
      volume24h: coin.total_volume || 0,
      marketCap: coin.market_cap || 0,
      lastUpdated: new Date(coin.last_updated || Date.now()),
      source: 'coingecko' as const,
    }));
  }

  /**
   * Fetch from Binance Public API (no rate limit for public endpoints)
   */
  private async fetchFromBinance(symbols: string[]): Promise<PriceData[]> {
    const results: PriceData[] = [];

    // Fetch all at once using 24hr ticker
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const allTickers = await response.json();

      for (const symbol of symbols) {
        const binanceSymbol = `${symbol}USDT`;
        const ticker = allTickers.find((t: any) => t.symbol === binanceSymbol);

        if (ticker) {
          results.push({
            symbol,
            price: parseFloat(ticker.lastPrice) || 0,
            change24h: parseFloat(ticker.priceChange) || 0,
            changePercent24h: parseFloat(ticker.priceChangePercent) || 0,
            high24h: parseFloat(ticker.highPrice) || 0,
            low24h: parseFloat(ticker.lowPrice) || 0,
            volume24h: parseFloat(ticker.quoteVolume) || 0,
            marketCap: 0, // Binance doesn't provide market cap
            lastUpdated: new Date(),
            source: 'binance' as const,
          });
        }
      }
    } catch (error) {
      log.warn('Binance batch fetch failed, trying individual', { error: (error as Error).message });

      // Fallback to individual fetches
      for (const symbol of symbols) {
        try {
          const data = await this.fetchSingleFromBinance(symbol);
          if (data) results.push(data);
        } catch (e) {
          log.warn(`Failed to fetch ${symbol} from Binance`, { error: (e as Error).message });
        }
      }
    }

    return results;
  }

  /**
   * Fetch single symbol from Binance
   */
  private async fetchSingleFromBinance(symbol: string): Promise<PriceData | null> {
    const binanceSymbol = `${symbol}USDT`;

    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      return null;
    }

    const ticker = await response.json();

    return {
      symbol,
      price: parseFloat(ticker.lastPrice) || 0,
      change24h: parseFloat(ticker.priceChange) || 0,
      changePercent24h: parseFloat(ticker.priceChangePercent) || 0,
      high24h: parseFloat(ticker.highPrice) || 0,
      low24h: parseFloat(ticker.lowPrice) || 0,
      volume24h: parseFloat(ticker.quoteVolume) || 0,
      marketCap: 0,
      lastUpdated: new Date(),
      source: 'binance' as const,
    };
  }

  /**
   * Get OHLCV data (for charts)
   */
  async getOHLCV(
    symbol: string,
    interval: '1h' | '4h' | '1d' = '1d',
    limit: number = 30
  ): Promise<Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>> {
    const binanceSymbol = `${symbol}USDT`;
    const binanceInterval = interval === '1h' ? '1h' : interval === '4h' ? '4h' : '1d';

    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        throw new Error(`Binance klines error: ${response.status}`);
      }

      const klines = await response.json();

      return klines.map((k: any[]) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch (error) {
      log.error('Failed to fetch OHLCV', error as Error);
      return [];
    }
  }

  /**
   * Get market overview (top coins)
   */
  async getMarketOverview(limit: number = 10): Promise<PriceData[]> {
    const topSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'LINK'];
    return this.getPrices(topSymbols.slice(0, limit));
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const priceAggregator = new PriceAggregatorService();
