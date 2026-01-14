/**
 * AI Trading Executor Service
 * Orchestrates the complete AI trading cycle:
 * 1. Fetch real market data
 * 2. Get AI analysis with memory context
 * 3. Execute trades
 * 4. Track performance and distribute profits
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { LogService } from '@/lib/logger';
import { aiService, type StrategySignal } from './ai.service';
import { aiMemoryService, type PoolInfo, type OpenPosition, type DecisionLog } from './ai-memory.service';
import { aiRiskManager, type DailyRiskStatus, type TradeRiskAssessment } from './ai-risk-manager.service';
import { aiAbBookService, type BookType } from './ai-ab-book.service';
import { getAgentConfig, type AgentConfig, getAllAgents } from '@/config/agents.config';
import { bybitService } from '@/services/trading/bybit.service';
import { v4 as uuidv4 } from 'uuid';

const log = new LogService({ service: 'AITradingExecutor' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => getSupabaseAdmin();

// ============ Types ============

export interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: string;
}

export interface TradingCycleResult {
  agentId: string;
  strategyId: string;
  batchId: string;
  marketAnalysis: string;
  decisions: DecisionLog[];
  executedTrades: number;
  totalPnl: number;
  poolNavBefore: number;
  poolNavAfter: number;
  timestamp: string;
}

export interface UserProfitAllocation {
  userId: string;
  orderId: string;
  sharesBefore: number;
  sharePercentage: number;
  allocatedPnl: number;
  newValue: number;
  newPnlPct: number;
}

// ============ Service Implementation ============

class AITradingExecutorService {
  /**
   * Execute a full trading cycle for an agent
   */
  async executeTradingCycle(strategyId: string): Promise<TradingCycleResult> {
    const batchId = uuidv4();
    log.info('Starting trading cycle', { strategyId, batchId });

    try {
      // 1. Get strategy and agent config
      const strategy = await this.getStrategy(strategyId);
      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found`);
      }

      const agentConfig = this.findAgentForStrategy(strategy);
      if (!agentConfig) {
        throw new Error(`No agent config found for strategy ${strategyId}`);
      }

      // 2. Get or create pool
      const pool = await aiMemoryService.getOrCreatePool(strategyId);
      const poolNavBefore = pool.currentNav;

      // Check daily risk status before any trading
      const riskStatus = await aiRiskManager.getDailyRiskStatus(pool.id);

      if (!riskStatus.canTrade) {
        log.info('Trading paused by risk manager', {
          strategyId,
          reason: riskStatus.pauseReason,
          dailyPnl: riskStatus.dailyPnl,
          dailyPnlPct: riskStatus.dailyPnlPct
        });
        return {
          agentId: agentConfig.id,
          strategyId,
          batchId,
          marketAnalysis: riskStatus.pauseReason || 'Trading paused by risk manager',
          decisions: [],
          executedTrades: 0,
          totalPnl: 0,
          poolNavBefore,
          poolNavAfter: pool.currentNav,
          timestamp: new Date().toISOString(),
        };
      }

      // Check if we can trade today (trade count limit)
      if (pool.tradesToday >= pool.dailyTradeLimit) {
        log.info('Daily trade limit reached', { strategyId, trades: pool.tradesToday });
        return {
          agentId: agentConfig.id,
          strategyId,
          batchId,
          marketAnalysis: 'Daily trade limit reached - no trading executed',
          decisions: [],
          executedTrades: 0,
          totalPnl: 0,
          poolNavBefore,
          poolNavAfter: pool.currentNav,
          timestamp: new Date().toISOString(),
        };
      }

      // 3. Fetch real market data
      const marketData = await this.fetchMarketData(agentConfig.supported_pairs);

      // 4. Get current positions
      const openPositions = await aiMemoryService.getOpenPositions(pool.id);

      // 5. Update position prices
      await aiMemoryService.updatePositionPrices(
        marketData.map(m => ({ symbol: m.symbol, price: m.price }))
      );

      // 6. Get relevant memories for context
      const relevantMemories = await aiMemoryService.getRelevantMemories({
        agentId: agentConfig.id,
        limit: 10,
      });

      // 7. Get AI analysis and signals
      const aiResult = await aiService.generateAgentSignals({
        agentId: agentConfig.id,
        marketData: marketData.map(m => ({
          symbol: m.symbol,
          price: m.price,
          change24h: m.change24h,
          volume24h: m.volume24h,
        })),
        currentPositions: openPositions.map(p => ({
          symbol: p.symbol,
          quantity: p.quantity,
          entryPrice: p.entryPrice,
          pnl: p.unrealizedPnl,
        })),
        poolCapital: pool.totalCapital,
        effectiveCapital: pool.availableCapital,
        dailyLots: pool.dailyTradeLimit - pool.tradesToday,
      });

      // 8. Log all decisions
      const decisions: DecisionLog[] = [];

      // If no signals, log a hold decision
      if (aiResult.signals.length === 0) {
        const holdDecision = await aiMemoryService.logDecision({
          agentId: agentConfig.id,
          strategyId,
          batchId,
          decisionType: 'hold',
          marketAnalysis: aiResult.analysis,
          reasoning: aiResult.reasoning || 'No actionable signals found',
          confidenceScore: aiResult.confidence,
          marketData: marketData.reduce((acc, m) => {
            acc[m.symbol] = m;
            return acc;
          }, {} as Record<string, MarketSnapshot>),
          currentPositions: openPositions as unknown as Record<string, unknown>[],
          poolCapital: pool.totalCapital,
          wasExecuted: false,
        });
        decisions.push(holdDecision);
      }

      // 9. Execute signals
      let executedTrades = 0;
      let totalPnl = 0;

      for (const signal of aiResult.signals) {
        if (signal.confidence < 70) continue;

        // Log the decision
        const decision = await aiMemoryService.logDecision({
          agentId: agentConfig.id,
          strategyId,
          batchId,
          decisionType: 'trade',
          action: signal.action,
          symbol: signal.symbol,
          suggestedAmount: signal.quantity,
          suggestedPrice: signal.price,
          stopLossPrice: signal.stopLoss,
          takeProfitPrice: signal.takeProfit,
          marketAnalysis: aiResult.analysis,
          reasoning: signal.reason,
          confidenceScore: signal.confidence,
          marketData: marketData.reduce((acc, m) => {
            acc[m.symbol] = m;
            return acc;
          }, {} as Record<string, MarketSnapshot>),
          currentPositions: openPositions as unknown as Record<string, unknown>[],
          poolCapital: pool.totalCapital,
          wasExecuted: false,
        });
        decisions.push(decision);

        // Execute the trade if we have capital
        if (signal.action === 'buy') {
          const marketPrice = marketData.find(m =>
            m.symbol.replace('/', '').toLowerCase() === signal.symbol.replace('/', '').toLowerCase()
          )?.price || signal.price || 0;

          if (marketPrice > 0) {
            try {
              // Calculate optimal position size using risk manager
              const positionCalc = aiRiskManager.calculatePositionSize({
                poolCapital: pool.totalCapital,
                availableCapital: pool.availableCapital,
                currentExposure: riskStatus.totalExposure,
                entryPrice: marketPrice,
                agentId: agentConfig.id,
                symbol: signal.symbol,
                side: 'long',
                confidence: signal.confidence,
              });

              // Skip if position size is too small
              if (positionCalc.recommendedSize < positionCalc.maxAllowedSize * 0.1) {
                log.info('Skipping trade - position size too small', {
                  symbol: signal.symbol,
                  recommendedSize: positionCalc.recommendedSize,
                  maxAllowedSize: positionCalc.maxAllowedSize,
                });
                continue;
              }

              // Assess trade risk before execution
              const riskAssessment = await aiRiskManager.assessTradeRisk({
                poolId: pool.id,
                agentId: agentConfig.id,
                symbol: signal.symbol,
                side: 'long',
                amount: positionCalc.recommendedSize,
                leverage: positionCalc.leverage,
                entryPrice: marketPrice,
                confidence: signal.confidence,
              });

              // Log risk assessment
              if (riskAssessment.warnings.length > 0) {
                log.warn('Trade risk warnings', {
                  symbol: signal.symbol,
                  warnings: riskAssessment.warnings,
                  riskScore: riskAssessment.riskScore,
                });
              }

              // Reject if risk assessment fails
              if (!riskAssessment.approved) {
                log.info('Trade rejected by risk manager', {
                  symbol: signal.symbol,
                  reasons: riskAssessment.rejectionReasons,
                  riskScore: riskAssessment.riskScore,
                });
                continue;
              }

              // Use adjusted values from risk assessment
              const finalSize = riskAssessment.adjustedSize;
              const finalLeverage = riskAssessment.adjustedLeverage;
              const finalQuantity = finalSize / marketPrice;

              // Execute trade via A/B Book service (real or simulated)
              const bookType = aiAbBookService.getBookType({ poolId: pool.id, strategyId });
              const tradeResult = await aiAbBookService.executeTrade({
                poolId: pool.id,
                strategyId,
                symbol: signal.symbol,
                side: 'buy',
                quantity: finalQuantity,
                price: marketPrice,
              });

              // Use the actual fill price from execution
              const actualPrice = tradeResult.avgPrice || marketPrice;

              await aiMemoryService.openPosition({
                poolId: pool.id,
                strategyId,
                decisionId: decision.id,
                symbol: signal.symbol,
                side: 'long',
                entryPrice: actualPrice,
                quantity: tradeResult.filledQty || finalQuantity,
                leverage: finalLeverage,
                stopLoss: positionCalc.stopLoss,
                takeProfit: positionCalc.takeProfit,
                reasoning: `${signal.reason} | Risk: ${riskAssessment.riskScore}/100 | Book: ${bookType}`,
                confidence: signal.confidence,
              });

              executedTrades++;

              // Update decision as executed
              await aiMemoryService.updateDecisionOutcome({
                decisionId: decision.id,
                executionId: tradeResult.orderId,
                executionPrice: actualPrice,
                pnl: 0,
                pnlPct: 0,
              });

              log.info('Trade executed with risk management', {
                symbol: signal.symbol,
                action: signal.action,
                price: actualPrice,
                size: finalSize,
                quantity: tradeResult.filledQty || finalQuantity,
                leverage: finalLeverage,
                riskScore: riskAssessment.riskScore,
                stopLoss: positionCalc.stopLoss,
                takeProfit: positionCalc.takeProfit,
                bookType,
                isSimulated: bookType === 'B',
              });
            } catch (err) {
              log.error('Failed to execute trade', err as Error);
            }
          }
        }

        // Handle sell/close signals
        if (signal.action === 'sell' || signal.action === 'hold') {
          // Find matching position to close
          const matchingPosition = openPositions.find(p =>
            p.symbol.toLowerCase() === signal.symbol.toLowerCase()
          );

          if (matchingPosition) {
            const pnl = matchingPosition.unrealizedPnl;
            totalPnl += pnl;

            // Close position (implement close logic)
            // For now, just track the P&L
          }
        }
      }

      // 10. Update pool NAV
      const updatedPool = await aiMemoryService.getOrCreatePool(strategyId);

      // 11. Distribute profits to users
      if (totalPnl !== 0) {
        await this.distributeProfits(strategyId, totalPnl);
      }

      // 12. Record daily metrics for tracking
      await aiRiskManager.recordDailyMetrics(pool.id);

      // 13. Get final risk status for reporting
      const finalRiskStatus = await aiRiskManager.getDailyRiskStatus(pool.id);

      const result: TradingCycleResult = {
        agentId: agentConfig.id,
        strategyId,
        batchId,
        marketAnalysis: aiResult.analysis,
        decisions,
        executedTrades,
        totalPnl,
        poolNavBefore,
        poolNavAfter: updatedPool.currentNav,
        timestamp: new Date().toISOString(),
      };

      log.info('Trading cycle completed', {
        strategyId,
        batchId,
        executedTrades,
        totalPnl,
        dailyPnl: finalRiskStatus.dailyPnl,
        dailyPnlPct: (finalRiskStatus.dailyPnlPct * 100).toFixed(2) + '%',
        exposure: (finalRiskStatus.exposurePct * 100).toFixed(1) + '%',
        canContinueTrading: finalRiskStatus.canTrade,
      });

      return result;

    } catch (error) {
      log.error('Trading cycle failed', error as Error);
      throw error;
    }
  }

  /**
   * Fetch real market data from Bybit
   */
  async fetchMarketData(pairs: string[]): Promise<MarketSnapshot[]> {
    const snapshots: MarketSnapshot[] = [];

    for (const pair of pairs) {
      try {
        const symbol = pair.replace('/', '');
        const ticker = await bybitService.getTicker(symbol);

        if (ticker) {
          snapshots.push({
            symbol: pair,
            price: parseFloat(ticker.lastPrice) || 0,
            change24h: parseFloat(ticker.price24hPcnt) * parseFloat(ticker.lastPrice) || 0,
            changePercent24h: parseFloat(ticker.price24hPcnt) * 100 || 0,
            volume24h: parseFloat(ticker.volume24h) || 0,
            high24h: parseFloat(ticker.highPrice24h) || 0,
            low24h: parseFloat(ticker.lowPrice24h) || 0,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        log.warn(`Failed to fetch market data for ${pair}`, { error: (err as Error).message });
      }
    }

    return snapshots;
  }

  /**
   * Distribute profits to users based on their share ownership
   */
  async distributeProfits(strategyId: string, totalPnl: number): Promise<UserProfitAllocation[]> {
    const allocations: UserProfitAllocation[] = [];

    // Get pool
    const pool = await aiMemoryService.getOrCreatePool(strategyId);

    // Get all order shares for this pool
    const { data: orderShares, error } = await db()
      .from('ai_order_shares')
      .select('*')
      .eq('pool_id', pool.id);

    if (error || !orderShares?.length) {
      return allocations;
    }

    // Calculate total shares
    const totalShares = orderShares.reduce(
      (sum: number, os: { shares_owned: string }) => sum + parseFloat(os.shares_owned),
      0
    );

    if (totalShares === 0) return allocations;

    // Distribute P&L proportionally
    for (const os of orderShares) {
      const shares = parseFloat(os.shares_owned);
      const sharePercentage = shares / totalShares;
      const allocatedPnl = totalPnl * sharePercentage;

      const newValue = parseFloat(os.current_value || os.total_invested) + allocatedPnl;
      const newPnlPct = ((newValue - parseFloat(os.total_invested)) / parseFloat(os.total_invested)) * 100;

      // Update order share
      await db()
        .from('ai_order_shares')
        .update({
          current_value: newValue,
          unrealized_pnl: newValue - parseFloat(os.total_invested),
          unrealized_pnl_pct: newPnlPct,
          updated_at: new Date().toISOString(),
        })
        .eq('id', os.id);

      // Update corresponding order
      await db()
        .from('ai_orders')
        .update({
          unrealized_profit: newValue - parseFloat(os.total_invested),
          current_nav: pool.currentNav,
          updated_at: new Date().toISOString(),
        })
        .eq('id', os.order_id);

      allocations.push({
        userId: os.user_id,
        orderId: os.order_id,
        sharesBefore: shares,
        sharePercentage: sharePercentage * 100,
        allocatedPnl,
        newValue,
        newPnlPct,
      });
    }

    log.info('Profits distributed', {
      strategyId,
      totalPnl,
      usersCount: allocations.length,
    });

    return allocations;
  }

  /**
   * Get detailed trading status for frontend display
   */
  async getTradingStatus(strategyId: string): Promise<{
    pool: PoolInfo;
    positions: OpenPosition[];
    recentDecisions: DecisionLog[];
    performance: {
      totalPnl: number;
      totalPnlPct: number;
      winRate: number;
      totalTrades: number;
      avgWin: number;
      avgLoss: number;
    };
    riskStatus: DailyRiskStatus;
    lastUpdate: string;
  }> {
    const pool = await aiMemoryService.getOrCreatePool(strategyId);
    const positions = await aiMemoryService.getOpenPositions(pool.id);

    // Get strategy to find agent
    const strategy = await this.getStrategy(strategyId);
    const agent = strategy ? this.findAgentForStrategy(strategy) : null;

    const recentDecisions = agent
      ? await aiMemoryService.getRecentDecisions(agent.id, 10)
      : [];

    // Get risk status
    const riskStatus = await aiRiskManager.getDailyRiskStatus(pool.id);

    return {
      pool,
      positions,
      recentDecisions,
      performance: {
        totalPnl: pool.totalPnl,
        totalPnlPct: pool.totalCapital > 0 ? (pool.totalPnl / pool.totalCapital) * 100 : 0,
        winRate: pool.winRate,
        totalTrades: pool.totalTrades,
        avgWin: 0, // Calculate from closed trades
        avgLoss: 0,
      },
      riskStatus,
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Get daily risk status for a pool
   */
  async getRiskStatus(poolId: string): Promise<DailyRiskStatus> {
    return aiRiskManager.getDailyRiskStatus(poolId);
  }

  /**
   * Get risk status by strategy ID
   */
  async getRiskStatusByStrategy(strategyId: string): Promise<DailyRiskStatus> {
    const pool = await aiMemoryService.getOrCreatePool(strategyId);
    return aiRiskManager.getDailyRiskStatus(pool.id);
  }

  /**
   * Get user's investment status
   */
  async getUserInvestmentStatus(userId: string, orderId: string): Promise<{
    shares: number;
    currentNav: number;
    currentValue: number;
    investedAmount: number;
    pnl: number;
    pnlPct: number;
    sharePercentage: number;
  } | null> {
    const { data, error } = await db()
      .from('ai_order_shares')
      .select('*, ai_strategy_pools(current_nav)')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    const currentNav = data.ai_strategy_pools?.current_nav || 1;
    const currentValue = parseFloat(data.shares_owned) * currentNav;

    return {
      shares: parseFloat(data.shares_owned),
      currentNav,
      currentValue,
      investedAmount: parseFloat(data.total_invested),
      pnl: currentValue - parseFloat(data.total_invested),
      pnlPct: ((currentValue - parseFloat(data.total_invested)) / parseFloat(data.total_invested)) * 100,
      sharePercentage: parseFloat(data.share_percentage),
    };
  }

  // ============ Helper Methods ============

  private async getStrategy(strategyId: string) {
    const { data, error } = await db()
      .from('ai_strategies')
      .select('*')
      .eq('id', strategyId)
      .single();

    if (error) return null;
    return data;
  }

  private findAgentForStrategy(strategy: Record<string, unknown>): AgentConfig | null {
    const agents = getAllAgents();

    // Find agent by category match
    for (const agent of agents) {
      if (agent.category === strategy.category) {
        return agent;
      }
    }

    // Fallback to first agent
    return agents[0] || null;
  }

  /**
   * Run trading cycles for all active strategies
   */
  async runAllStrategies(): Promise<TradingCycleResult[]> {
    const results: TradingCycleResult[] = [];

    const { data: strategies, error } = await db()
      .from('ai_strategies')
      .select('id')
      .eq('is_active', true);

    if (error || !strategies?.length) {
      log.warn('No active strategies found');
      return results;
    }

    for (const strategy of strategies) {
      try {
        const result = await this.executeTradingCycle(strategy.id);
        results.push(result);
      } catch (err) {
        log.error(`Trading cycle failed for strategy ${strategy.id}`, err as Error);
      }
    }

    return results;
  }
}

export const aiTradingExecutor = new AITradingExecutorService();
