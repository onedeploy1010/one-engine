/**
 * Price Service for ONE Engine
 * Fetches cryptocurrency prices from FREE public APIs
 * No API key required for basic usage
 */

import { LogService } from '@/lib/logger';

const log = new LogService({ service: 'PriceService' });

// ============ Types ============

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap?: number;
  lastUpdated: string;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketOverview {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  marketCapChange24h: number;
  activeCryptocurrencies: number;
}

// ============ API Configurations ============

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const COINCAP_API = 'https://api.coincap.io/v2';
const BINANCE_API = 'https://api.binance.com/api/v3';

// Symbol mappings for different APIs
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  XRP: 'ripple',
  SOL: 'solana',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  SHIB: 'shiba-inu',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  XLM: 'stellar',
  ETC: 'ethereum-classic',
  FIL: 'filecoin',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  INJ: 'injective-protocol',
  SUI: 'sui',
  SEI: 'sei-network',
  TIA: 'celestia',
  JUP: 'jupiter-exchange-solana',
  WIF: 'dogwifcoin',
};

const COINCAP_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binance-coin',
  XRP: 'xrp',
  SOL: 'solana',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'polygon',
  SHIB: 'shiba-inu',
  LTC: 'litecoin',
  AVAX: 'avalanche',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
};

// ============ Service Class ============

export class PriceService {
  private cache: Map<string, { data: PriceData; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  // ============ CoinGecko (Primary - Free, no API key) ============

  /**
   * Get price from CoinGecko (FREE, 10-30 calls/min)
   */
  async getPriceFromCoinGecko(symbol: string): Promise<PriceData | null> {
    const coinId = COINGECKO_IDS[symbol.toUpperCase()];
    if (!coinId) {
      log.warn(`Unknown symbol for CoinGecko: ${symbol}`);
      return null;
    }

    try {
      const response = await fetch(
        `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        symbol: symbol.toUpperCase(),
        price: data.market_data.current_price.usd,
        change24h: data.market_data.price_change_24h,
        changePercent24h: data.market_data.price_change_percentage_24h,
        high24h: data.market_data.high_24h.usd,
        low24h: data.market_data.low_24h.usd,
        volume24h: data.market_data.total_volume.usd,
        marketCap: data.market_data.market_cap.usd,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      log.error('CoinGecko price fetch failed', error as Error, { symbol });
      return null;
    }
  }

  /**
   * Get multiple prices from CoinGecko (FREE)
   */
  async getPricesFromCoinGecko(symbols: string[]): Promise<PriceData[]> {
    const coinIds = symbols
      .map(s => COINGECKO_IDS[s.toUpperCase()])
      .filter(Boolean);

    if (coinIds.length === 0) return [];

    try {
      const response = await fetch(
        `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${coinIds.join(',')}&sparkline=false`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((coin: any) => {
        const symbol = Object.entries(COINGECKO_IDS).find(
          ([_, id]) => id === coin.id
        )?.[0] || coin.symbol.toUpperCase();

        return {
          symbol,
          price: coin.current_price,
          change24h: coin.price_change_24h,
          changePercent24h: coin.price_change_percentage_24h,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          volume24h: coin.total_volume,
          marketCap: coin.market_cap,
          lastUpdated: new Date().toISOString(),
        };
      });
    } catch (error) {
      log.error('CoinGecko batch price fetch failed', error as Error);
      return [];
    }
  }

  // ============ CoinCap (Backup - FREE, unlimited) ============

  /**
   * Get price from CoinCap (FREE, unlimited, no API key)
   */
  async getPriceFromCoinCap(symbol: string): Promise<PriceData | null> {
    const assetId = COINCAP_IDS[symbol.toUpperCase()];
    if (!assetId) {
      log.warn(`Unknown symbol for CoinCap: ${symbol}`);
      return null;
    }

    try {
      const response = await fetch(`${COINCAP_API}/assets/${assetId}`);

      if (!response.ok) {
        throw new Error(`CoinCap API error: ${response.status}`);
      }

      const { data } = await response.json();

      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(data.priceUsd),
        change24h: 0, // CoinCap doesn't provide absolute change
        changePercent24h: parseFloat(data.changePercent24h),
        high24h: 0, // Not available
        low24h: 0, // Not available
        volume24h: parseFloat(data.volumeUsd24Hr),
        marketCap: parseFloat(data.marketCapUsd),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      log.error('CoinCap price fetch failed', error as Error, { symbol });
      return null;
    }
  }

  /**
   * Get multiple prices from CoinCap (FREE, unlimited)
   */
  async getPricesFromCoinCap(symbols: string[]): Promise<PriceData[]> {
    const assetIds = symbols
      .map(s => COINCAP_IDS[s.toUpperCase()])
      .filter(Boolean);

    if (assetIds.length === 0) return [];

    try {
      const response = await fetch(
        `${COINCAP_API}/assets?ids=${assetIds.join(',')}`
      );

      if (!response.ok) {
        throw new Error(`CoinCap API error: ${response.status}`);
      }

      const { data } = await response.json();

      return data.map((asset: any) => {
        const symbol = Object.entries(COINCAP_IDS).find(
          ([_, id]) => id === asset.id
        )?.[0] || asset.symbol;

        return {
          symbol,
          price: parseFloat(asset.priceUsd),
          change24h: 0,
          changePercent24h: parseFloat(asset.changePercent24h),
          high24h: 0,
          low24h: 0,
          volume24h: parseFloat(asset.volumeUsd24Hr),
          marketCap: parseFloat(asset.marketCapUsd),
          lastUpdated: new Date().toISOString(),
        };
      });
    } catch (error) {
      log.error('CoinCap batch price fetch failed', error as Error);
      return [];
    }
  }

  // ============ Binance Public API (FREE, no API key for market data) ============

  /**
   * Get price from Binance (FREE, no API key for public endpoints)
   */
  async getPriceFromBinance(symbol: string): Promise<PriceData | null> {
    const pair = `${symbol.toUpperCase()}USDT`;

    try {
      const response = await fetch(
        `${BINANCE_API}/ticker/24hr?symbol=${pair}`
      );

      if (!response.ok) {
        if (response.status === 400) {
          // Invalid symbol
          return null;
        }
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.priceChange),
        changePercent24h: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24h: parseFloat(data.quoteVolume),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      log.error('Binance price fetch failed', error as Error, { symbol });
      return null;
    }
  }

  /**
   * Get multiple prices from Binance (FREE)
   */
  async getPricesFromBinance(symbols: string[]): Promise<PriceData[]> {
    try {
      const response = await fetch(`${BINANCE_API}/ticker/24hr`);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      const symbolSet = new Set(symbols.map(s => `${s.toUpperCase()}USDT`));

      return data
        .filter((ticker: any) => symbolSet.has(ticker.symbol))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('USDT', ''),
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.priceChange),
          changePercent24h: parseFloat(ticker.priceChangePercent),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          volume24h: parseFloat(ticker.quoteVolume),
          lastUpdated: new Date().toISOString(),
        }));
    } catch (error) {
      log.error('Binance batch price fetch failed', error as Error);
      return [];
    }
  }

  /**
   * Get OHLCV candles from Binance (FREE)
   */
  async getCandlesFromBinance(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit = 100
  ): Promise<OHLCVData[]> {
    const pair = `${symbol.toUpperCase()}USDT`;

    try {
      const response = await fetch(
        `${BINANCE_API}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((candle: any[]) => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
      }));
    } catch (error) {
      log.error('Binance candles fetch failed', error as Error, { symbol });
      return [];
    }
  }

  // ============ Unified Interface with Fallback ============

  /**
   * Get price with automatic fallback (CoinGecko -> Binance -> CoinCap)
   */
  async getPrice(symbol: string, useCache = true): Promise<PriceData | null> {
    const cacheKey = symbol.toUpperCase();

    // Check cache
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    // Try Binance first (fastest, most accurate for trading pairs)
    let price = await this.getPriceFromBinance(symbol);

    // Fallback to CoinGecko
    if (!price) {
      price = await this.getPriceFromCoinGecko(symbol);
    }

    // Fallback to CoinCap
    if (!price) {
      price = await this.getPriceFromCoinCap(symbol);
    }

    // Cache result
    if (price) {
      this.cache.set(cacheKey, { data: price, timestamp: Date.now() });
    }

    return price;
  }

  /**
   * Get multiple prices with automatic fallback
   */
  async getPrices(symbols: string[], useCache = true): Promise<PriceData[]> {
    const results: PriceData[] = [];
    const uncachedSymbols: string[] = [];

    // Check cache first
    if (useCache) {
      for (const symbol of symbols) {
        const cached = this.cache.get(symbol.toUpperCase());
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
          results.push(cached.data);
        } else {
          uncachedSymbols.push(symbol);
        }
      }
    } else {
      uncachedSymbols.push(...symbols);
    }

    if (uncachedSymbols.length === 0) {
      return results;
    }

    // Try Binance first
    let prices = await this.getPricesFromBinance(uncachedSymbols);

    // Find missing symbols
    const fetchedSymbols = new Set(prices.map(p => p.symbol));
    const missingSymbols = uncachedSymbols.filter(
      s => !fetchedSymbols.has(s.toUpperCase())
    );

    // Fallback to CoinGecko for missing
    if (missingSymbols.length > 0) {
      const geckoProducts = await this.getPricesFromCoinGecko(missingSymbols);
      prices = [...prices, ...geckoProducts];
    }

    // Cache all results
    for (const price of prices) {
      this.cache.set(price.symbol, { data: price, timestamp: Date.now() });
    }

    return [...results, ...prices];
  }

  /**
   * Get market overview from CoinGecko (FREE)
   */
  async getMarketOverview(): Promise<MarketOverview | null> {
    try {
      const response = await fetch(`${COINGECKO_API}/global`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const { data } = await response.json();

      return {
        totalMarketCap: data.total_market_cap.usd,
        totalVolume24h: data.total_volume.usd,
        btcDominance: data.market_cap_percentage.btc,
        marketCapChange24h: data.market_cap_change_percentage_24h_usd,
        activeCryptocurrencies: data.active_cryptocurrencies,
      };
    } catch (error) {
      log.error('Market overview fetch failed', error as Error);
      return null;
    }
  }

  /**
   * Get top coins by market cap from CoinGecko (FREE)
   */
  async getTopCoins(limit = 20): Promise<PriceData[]> {
    try {
      const response = await fetch(
        `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((coin: any) => ({
        symbol: coin.symbol.toUpperCase(),
        price: coin.current_price,
        change24h: coin.price_change_24h,
        changePercent24h: coin.price_change_percentage_24h,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        volume24h: coin.total_volume,
        marketCap: coin.market_cap,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      log.error('Top coins fetch failed', error as Error);
      return [];
    }
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const priceService = new PriceService();
