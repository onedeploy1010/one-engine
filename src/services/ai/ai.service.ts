/**
 * AI Service for ONE Engine
 * OpenAI integration for strategy generation and market analysis
 */

import OpenAI from 'openai';
import { env } from '@/config/env';
import { LogService } from '@/lib/logger';
import { getAgentConfig, AgentConfig } from '@/config/agents.config';

const log = new LogService({ service: 'AIService' });

export interface MarketAnalysis {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  analysis: string;
  signals: Array<{
    type: 'buy' | 'sell' | 'hold';
    asset: string;
    strength: number;
    reason: string;
  }>;
  risks: string[];
  recommendations: string[];
}

export interface StrategySignal {
  action: 'buy' | 'sell' | 'hold';
  symbol: string;
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  confidence: number;
}

export class AIService {
  private openai: OpenAI;
  private model = env.OPENAI_MODEL;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze market conditions
   */
  async analyzeMarket(data: {
    prices: Array<{ symbol: string; price: number; change24h: number }>;
    volumes: Array<{ symbol: string; volume: number }>;
    news?: string[];
    indicators?: Record<string, number>;
  }): Promise<MarketAnalysis> {
    log.info('Analyzing market', { symbols: data.prices.map(p => p.symbol) });

    const prompt = `You are a quantitative trading analyst. Analyze the following market data and provide trading insights.

Market Data:
${JSON.stringify(data.prices, null, 2)}

Volume Data:
${JSON.stringify(data.volumes, null, 2)}

${data.indicators ? `Technical Indicators: ${JSON.stringify(data.indicators)}` : ''}
${data.news ? `Recent News: ${data.news.join('\n')}` : ''}

Provide analysis in the following JSON format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "analysis": "Brief market analysis",
  "signals": [
    {
      "type": "buy" | "sell" | "hold",
      "asset": "symbol",
      "strength": 0-100,
      "reason": "explanation"
    }
  ],
  "risks": ["risk1", "risk2"],
  "recommendations": ["recommendation1", "recommendation2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional quantitative trading analyst. Provide analysis in valid JSON format only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      return JSON.parse(content) as MarketAnalysis;
    } catch (error) {
      log.error('Market analysis failed', error as Error);
      throw new Error(`AI analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate trading signals for a strategy
   */
  async generateSignals(params: {
    strategyType: string;
    riskLevel: string;
    positions: Array<{ symbol: string; quantity: number; entryPrice: number }>;
    marketData: Array<{ symbol: string; price: number; rsi?: number; macd?: number }>;
    availableCapital: number;
    maxPositionSize: number;
  }): Promise<StrategySignal[]> {
    log.info('Generating signals', { strategyType: params.strategyType });

    const prompt = `You are an AI trading strategy engine. Generate trading signals based on the following parameters.

Strategy Type: ${params.strategyType}
Risk Level: ${params.riskLevel}
Available Capital: $${params.availableCapital}
Max Position Size: $${params.maxPositionSize}

Current Positions:
${JSON.stringify(params.positions, null, 2)}

Market Data:
${JSON.stringify(params.marketData, null, 2)}

Generate trading signals in the following JSON format:
{
  "signals": [
    {
      "action": "buy" | "sell" | "hold",
      "symbol": "BTCUSDT",
      "quantity": 0.01,
      "price": 45000,
      "stopLoss": 44000,
      "takeProfit": 47000,
      "reason": "explanation",
      "confidence": 85
    }
  ]
}

Only generate signals with confidence > 70%. Consider risk management and position sizing.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional algorithmic trading system. Generate precise trading signals in valid JSON format.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const result = JSON.parse(content);
      return result.signals || [];
    } catch (error) {
      log.error('Signal generation failed', error as Error);
      throw new Error(`Signal generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get risk assessment for a trade
   */
  async assessRisk(params: {
    symbol: string;
    action: 'buy' | 'sell';
    quantity: number;
    currentPrice: number;
    portfolioValue: number;
    existingPositions: Array<{ symbol: string; value: number }>;
  }): Promise<{
    riskScore: number;
    maxDrawdown: number;
    positionSizeOk: boolean;
    warnings: string[];
    recommendation: string;
  }> {
    const positionValue = params.quantity * params.currentPrice;
    const positionPercent = (positionValue / params.portfolioValue) * 100;

    const prompt = `Assess the risk of the following trade:

Trade: ${params.action} ${params.quantity} ${params.symbol} at $${params.currentPrice}
Position Value: $${positionValue} (${positionPercent.toFixed(2)}% of portfolio)
Portfolio Value: $${params.portfolioValue}

Existing Positions:
${JSON.stringify(params.existingPositions, null, 2)}

Provide risk assessment in JSON format:
{
  "riskScore": 0-100,
  "maxDrawdown": 0-100,
  "positionSizeOk": true/false,
  "warnings": ["warning1"],
  "recommendation": "brief recommendation"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a risk management expert. Provide concise risk assessment in valid JSON format.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      return JSON.parse(content);
    } catch (error) {
      log.error('Risk assessment failed', error as Error);
      // Return conservative defaults on error
      return {
        riskScore: 100,
        maxDrawdown: 50,
        positionSizeOk: false,
        warnings: ['AI risk assessment unavailable'],
        recommendation: 'Proceed with caution',
      };
    }
  }

  /**
   * Generate trading signals for a specific agent
   */
  async generateAgentSignals(params: {
    agentId: string;
    marketData: Array<{ symbol: string; price: number; change24h: number; volume24h: number }>;
    currentPositions: Array<{ symbol: string; quantity: number; entryPrice: number; pnl: number }>;
    poolCapital: number;
    effectiveCapital: number;
    dailyLots: number;
  }): Promise<{
    signals: StrategySignal[];
    analysis: string;
    confidence: number;
    reasoning: string;
  }> {
    const agent = getAgentConfig(params.agentId);
    if (!agent) {
      throw new Error(`Agent ${params.agentId} not found`);
    }

    log.info('Generating agent signals', {
      agentId: params.agentId,
      agentName: agent.name,
      dailyLots: params.dailyLots
    });

    const prompt = `${agent.strategy_prompt}

Current Market Data:
${JSON.stringify(params.marketData, null, 2)}

Current Positions:
${JSON.stringify(params.currentPositions, null, 2)}

Pool Capital: $${params.poolCapital}
Effective Capital: $${params.effectiveCapital}
Daily Trade Slots: ${params.dailyLots}
Max Position Size: $${params.effectiveCapital * 0.3}
Risk Parameters:
- Max Drawdown: ${agent.max_drawdown_pct * 100}%
- Daily Loss Limit: ${agent.daily_loss_limit_pct * 100}%
- Supported Pairs: ${agent.supported_pairs.join(', ')}

Generate trading signals based on your strategy. Return JSON:
{
  "signals": [
    {
      "action": "buy" | "sell" | "hold",
      "symbol": "BTC/USDT",
      "quantity": 0.01,
      "price": 45000,
      "stopLoss": 44000,
      "takeProfit": 47000,
      "reason": "Brief explanation",
      "confidence": 85
    }
  ],
  "analysis": "Overall market analysis",
  "confidence": 0-100,
  "reasoning": "Strategy reasoning"
}

Rules:
1. Only signal supported pairs
2. Never exceed daily trade slots
3. Only signal actions with confidence > ${agent.risk_level <= 2 ? 80 : 70}%
4. Consider current positions before new entries
5. Include stop-loss and take-profit for every trade`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are ${agent.name}, a ${agent.category} trading AI with risk level ${agent.risk_level}/5. ${agent.description}`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: agent.risk_level <= 2 ? 0.2 : 0.4,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const result = JSON.parse(content);

      // Filter signals to only include supported pairs
      const validSignals = (result.signals || []).filter((s: StrategySignal) =>
        agent.supported_pairs.some(pair =>
          pair.replace('/', '').toLowerCase() === s.symbol.replace('/', '').toLowerCase() ||
          pair.toLowerCase() === s.symbol.toLowerCase()
        )
      );

      // Limit to daily lots
      const limitedSignals = validSignals.slice(0, params.dailyLots);

      log.info('Agent signals generated', {
        agentId: params.agentId,
        signalCount: limitedSignals.length,
        confidence: result.confidence
      });

      return {
        signals: limitedSignals,
        analysis: result.analysis || '',
        confidence: result.confidence || 0,
        reasoning: result.reasoning || '',
      };
    } catch (error) {
      log.error('Agent signal generation failed', error as Error);
      throw new Error(`Agent signal generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get AI console messages for an agent (for display)
   */
  async generateConsoleOutput(params: {
    agentId: string;
    lastSignals: StrategySignal[];
    currentPnl: number;
    marketTrend: 'bullish' | 'bearish' | 'neutral';
  }): Promise<Array<{
    timestamp: string;
    type: 'INFO' | 'SIGNAL' | 'TRADE' | 'STATUS' | 'WARNING';
    message: string;
  }>> {
    const agent = getAgentConfig(params.agentId);
    if (!agent) {
      return [];
    }

    const messages: Array<{
      timestamp: string;
      type: 'INFO' | 'SIGNAL' | 'TRADE' | 'STATUS' | 'WARNING';
      message: string;
    }> = [];

    const now = new Date();
    const formatTime = (offset: number) =>
      new Date(now.getTime() - offset).toISOString();

    // Status message
    messages.push({
      timestamp: formatTime(0),
      type: 'STATUS',
      message: `[${agent.name}] Strategy active - Market: ${params.marketTrend.toUpperCase()}`,
    });

    // Signal messages
    for (const signal of params.lastSignals) {
      messages.push({
        timestamp: formatTime(1000),
        type: 'SIGNAL',
        message: `[SIGNAL] ${signal.action.toUpperCase()} ${signal.symbol} @ $${signal.price?.toFixed(2) || 'MARKET'} | Confidence: ${signal.confidence}%`,
      });

      if (signal.stopLoss) {
        messages.push({
          timestamp: formatTime(2000),
          type: 'INFO',
          message: `  └─ Stop Loss: $${signal.stopLoss.toFixed(2)} | Take Profit: $${signal.takeProfit?.toFixed(2) || 'N/A'}`,
        });
      }

      messages.push({
        timestamp: formatTime(3000),
        type: 'INFO',
        message: `  └─ Reason: ${signal.reason}`,
      });
    }

    // PnL status
    const pnlType = params.currentPnl >= 0 ? 'STATUS' : 'WARNING';
    messages.push({
      timestamp: formatTime(5000),
      type: pnlType,
      message: `[PNL] Current: ${params.currentPnl >= 0 ? '+' : ''}$${params.currentPnl.toFixed(2)}`,
    });

    return messages;
  }
}

export const aiService = new AIService();
