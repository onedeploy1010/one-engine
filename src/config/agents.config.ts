/**
 * AI Agent Configuration
 * Unified configuration for all 7 AI trading agents
 */

export interface AgentTier {
  tier: number;
  amount: number;
  label: string;
  label_zh: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  category: 'conservative' | 'balanced' | 'aggressive' | 'hedge' | 'grid' | 'trend';
  risk_level: number;
  icon: string;
  color: string;

  // Amount tiers
  tiers: AgentTier[];

  // Cycle configuration
  supported_cycles: number[];
  default_cycle: number;

  // Trading parameters
  exposure_factor: number;
  lot_unit: number;
  min_lots: number;
  max_lots: number;

  // ROI parameters (monthly, for estimation only)
  base_roi_monthly: number;
  roi_volatility: number;
  lot_stability_factor: number;

  // Risk control
  max_drawdown_pct: number;
  daily_loss_limit_pct: number;
  position_reduce_threshold: number;

  // Trading pairs and chains
  supported_pairs: string[];
  supported_chains: string[];

  // Strategy-specific prompts for AI
  strategy_prompt: string;

  is_active: boolean;
}

export const SHARE_RATES_BY_CYCLE: Record<number, number> = {
  7: 0.25,   // 25% platform share
  14: 0.22,  // 22% platform share
  30: 0.18,  // 18% platform share
  60: 0.15,  // 15% platform share
  90: 0.12,  // 12% platform share
};

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'agent-1',
    name: 'Stable Growth',
    name_zh: '稳健增长',
    description: 'Low-risk DCA strategy with consistent returns',
    description_zh: '低风险定投策略，追求稳定收益',
    category: 'conservative',
    risk_level: 1,
    icon: '🛡️',
    color: '#10B981',

    tiers: [
      { tier: 1, amount: 100, label: 'Starter', label_zh: '入门版' },
      { tier: 2, amount: 300, label: 'Standard', label_zh: '标准版' },
      { tier: 3, amount: 500, label: 'Advanced', label_zh: '进阶版' },
    ],

    supported_cycles: [7, 14, 30],
    default_cycle: 14,

    exposure_factor: 0.35,
    lot_unit: 50,
    min_lots: 1,
    max_lots: 5,

    base_roi_monthly: 0.05,
    roi_volatility: 0.03,
    lot_stability_factor: 0.008,

    max_drawdown_pct: 0.08,
    daily_loss_limit_pct: 0.02,
    position_reduce_threshold: 0.05,

    supported_pairs: ['BTC/USDT', 'ETH/USDT'],
    supported_chains: ['ethereum', 'arbitrum'],

    strategy_prompt: `You are a conservative DCA (Dollar Cost Averaging) trading bot.
Your strategy focuses on:
- Regular small purchases regardless of price
- Long-term accumulation of major assets (BTC, ETH)
- Very low leverage (1x only)
- Wide stop-losses to avoid premature exits
- Only take positions with >85% confidence
Risk tolerance: Very Low`,

    is_active: true,
  },

  {
    id: 'agent-2',
    name: 'Smart Balance',
    name_zh: '智能平衡',
    description: 'Balanced risk-reward with trend following',
    description_zh: '均衡风险收益，趋势跟踪策略',
    category: 'balanced',
    risk_level: 2,
    icon: '⚖️',
    color: '#3B82F6',

    tiers: [
      { tier: 1, amount: 700, label: 'Basic', label_zh: '基础版' },
      { tier: 2, amount: 1000, label: 'Standard', label_zh: '标准版' },
      { tier: 3, amount: 1200, label: 'Professional', label_zh: '专业版' },
    ],

    supported_cycles: [14, 30, 60],
    default_cycle: 30,

    exposure_factor: 0.45,
    lot_unit: 80,
    min_lots: 2,
    max_lots: 8,

    base_roi_monthly: 0.08,
    roi_volatility: 0.05,
    lot_stability_factor: 0.01,

    max_drawdown_pct: 0.12,
    daily_loss_limit_pct: 0.03,
    position_reduce_threshold: 0.08,

    supported_pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    supported_chains: ['ethereum', 'arbitrum', 'bsc'],

    strategy_prompt: `You are a balanced trend-following trading bot.
Your strategy focuses on:
- Identifying medium-term trends using moving averages
- Position sizing based on volatility
- 2x-3x leverage on high-confidence trades
- Trailing stop-losses to lock in profits
- Diversification across top 3 assets
Risk tolerance: Medium-Low`,

    is_active: true,
  },

  {
    id: 'agent-3',
    name: 'Alpha Hunter',
    name_zh: '阿尔法猎手',
    description: 'Aggressive momentum strategy for alpha generation',
    description_zh: '主动进取，动量突破策略',
    category: 'aggressive',
    risk_level: 3,
    icon: '🎯',
    color: '#F59E0B',

    tiers: [
      { tier: 1, amount: 1500, label: 'Hunter', label_zh: '猎手版' },
      { tier: 2, amount: 1800, label: 'Elite', label_zh: '精英版' },
      { tier: 3, amount: 2500, label: 'Master', label_zh: '大师版' },
    ],

    supported_cycles: [14, 30, 60, 90],
    default_cycle: 30,

    exposure_factor: 0.55,
    lot_unit: 100,
    min_lots: 3,
    max_lots: 15,

    base_roi_monthly: 0.12,
    roi_volatility: 0.08,
    lot_stability_factor: 0.012,

    max_drawdown_pct: 0.18,
    daily_loss_limit_pct: 0.05,
    position_reduce_threshold: 0.12,

    supported_pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
    supported_chains: ['ethereum', 'arbitrum', 'bsc'],

    strategy_prompt: `You are an aggressive momentum trading bot seeking alpha.
Your strategy focuses on:
- Breakout detection and momentum signals
- RSI, MACD, and volume confirmation
- 3x-5x leverage on breakout trades
- Quick profit-taking on momentum exhaustion
- Multiple simultaneous positions
Risk tolerance: Medium-High`,

    is_active: true,
  },

  {
    id: 'agent-4',
    name: 'Quantum Edge',
    name_zh: '量子优势',
    description: 'High-frequency statistical arbitrage',
    description_zh: '高频统计套利，专业级策略',
    category: 'aggressive',
    risk_level: 4,
    icon: '⚡',
    color: '#8B5CF6',

    tiers: [
      { tier: 1, amount: 4000, label: 'Quantum', label_zh: '量子版' },
      { tier: 2, amount: 7000, label: 'Flagship', label_zh: '旗舰版' },
      { tier: 3, amount: 10000, label: 'Ultimate', label_zh: '至尊版' },
    ],

    supported_cycles: [30, 60, 90],
    default_cycle: 60,

    exposure_factor: 0.60,
    lot_unit: 150,
    min_lots: 5,
    max_lots: 40,

    base_roi_monthly: 0.15,
    roi_volatility: 0.10,
    lot_stability_factor: 0.015,

    max_drawdown_pct: 0.22,
    daily_loss_limit_pct: 0.06,
    position_reduce_threshold: 0.15,

    supported_pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'],
    supported_chains: ['ethereum', 'arbitrum'],

    strategy_prompt: `You are a quantitative high-frequency trading bot.
Your strategy focuses on:
- Statistical arbitrage between correlated pairs
- Mean reversion on short timeframes
- 5x-10x leverage with strict risk limits
- Multiple small trades with high win rate
- Algorithmic execution timing
Risk tolerance: High`,

    is_active: true,
  },

  {
    id: 'agent-5',
    name: 'Hedge Master',
    name_zh: '对冲大师',
    description: 'Delta-neutral hedging strategy',
    description_zh: '多空对冲保护，降低波动风险',
    category: 'hedge',
    risk_level: 2,
    icon: '🔒',
    color: '#06B6D4',

    tiers: [
      { tier: 1, amount: 2000, label: 'Shield', label_zh: '防护版' },
      { tier: 2, amount: 3500, label: 'Balance', label_zh: '平衡版' },
      { tier: 3, amount: 5000, label: 'Complete', label_zh: '全能版' },
    ],

    supported_cycles: [14, 30, 60],
    default_cycle: 30,

    exposure_factor: 0.40,
    lot_unit: 100,
    min_lots: 4,
    max_lots: 25,

    base_roi_monthly: 0.06,
    roi_volatility: 0.02,
    lot_stability_factor: 0.015,

    max_drawdown_pct: 0.08,
    daily_loss_limit_pct: 0.02,
    position_reduce_threshold: 0.05,

    supported_pairs: ['BTC/USDT', 'ETH/USDT'],
    supported_chains: ['ethereum', 'arbitrum'],

    strategy_prompt: `You are a delta-neutral hedging trading bot.
Your strategy focuses on:
- Maintaining near-zero net market exposure
- Long/short pair trades on correlated assets
- Profiting from spread movements, not direction
- Very low volatility returns
- Capital preservation priority
Risk tolerance: Very Low`,

    is_active: true,
  },

  {
    id: 'agent-6',
    name: 'Grid Warrior',
    name_zh: '网格战士',
    description: 'Smart grid trading for sideways markets',
    description_zh: '智能网格策略，适合震荡行情',
    category: 'grid',
    risk_level: 3,
    icon: '📊',
    color: '#EC4899',

    tiers: [
      { tier: 1, amount: 800, label: 'Grid', label_zh: '网格版' },
      { tier: 2, amount: 1500, label: 'Dense', label_zh: '密集版' },
      { tier: 3, amount: 2200, label: 'Matrix', label_zh: '矩阵版' },
    ],

    supported_cycles: [7, 14, 30],
    default_cycle: 14,

    exposure_factor: 0.50,
    lot_unit: 60,
    min_lots: 3,
    max_lots: 20,

    base_roi_monthly: 0.10,
    roi_volatility: 0.06,
    lot_stability_factor: 0.012,

    max_drawdown_pct: 0.15,
    daily_loss_limit_pct: 0.04,
    position_reduce_threshold: 0.10,

    supported_pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    supported_chains: ['ethereum', 'arbitrum', 'bsc'],

    strategy_prompt: `You are a grid trading bot optimized for ranging markets.
Your strategy focuses on:
- Setting buy/sell orders at fixed intervals
- Profiting from price oscillations within a range
- Dynamic grid adjustment based on volatility
- No directional bias
- Consistent small profits accumulation
Risk tolerance: Medium`,

    is_active: true,
  },

  {
    id: 'agent-7',
    name: 'Trend Rider',
    name_zh: '趋势骑士',
    description: 'Macro trend following for big moves',
    description_zh: '宏观趋势跟踪，长线波段策略',
    category: 'trend',
    risk_level: 4,
    icon: '🚀',
    color: '#EF4444',

    tiers: [
      { tier: 1, amount: 3000, label: 'Trend', label_zh: '趋势版' },
      { tier: 2, amount: 5000, label: 'Swing', label_zh: '波段版' },
      { tier: 3, amount: 8000, label: 'Position', label_zh: '长线版' },
    ],

    supported_cycles: [30, 60, 90],
    default_cycle: 60,

    exposure_factor: 0.55,
    lot_unit: 120,
    min_lots: 5,
    max_lots: 35,

    base_roi_monthly: 0.18,
    roi_volatility: 0.12,
    lot_stability_factor: 0.018,

    max_drawdown_pct: 0.25,
    daily_loss_limit_pct: 0.07,
    position_reduce_threshold: 0.18,

    supported_pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
    supported_chains: ['ethereum', 'arbitrum'],

    strategy_prompt: `You are a macro trend following trading bot.
Your strategy focuses on:
- Identifying major market trends (weeks to months)
- Large position sizes on confirmed trends
- 5x-10x leverage on high-conviction trades
- Wide stop-losses to ride trends
- Pyramiding into winning positions
Risk tolerance: Very High`,

    is_active: true,
  },
];

/**
 * Get agent config by ID
 */
export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return AGENT_CONFIGS.find(a => a.id === agentId);
}

/**
 * Get all active agents
 */
export function getActiveAgents(): AgentConfig[] {
  return AGENT_CONFIGS.filter(a => a.is_active);
}

/**
 * Get all agents (active and inactive)
 */
export function getAllAgents(): AgentConfig[] {
  return AGENT_CONFIGS;
}

/**
 * Calculate subscription parameters
 */
export function calculateSubscriptionParams(
  agentConfig: AgentConfig,
  tierAmount: number,
  cycleDays: number
) {
  // Calculate effective capital and lots
  const effectiveCapital = tierAmount * agentConfig.exposure_factor;
  const rawLots = Math.floor(effectiveCapital / agentConfig.lot_unit);
  const dailyLots = Math.max(
    agentConfig.min_lots,
    Math.min(rawLots, agentConfig.max_lots)
  );

  // Calculate stability score (1-100)
  const stabilityScore = Math.min(
    100,
    50 + dailyLots * 5 + (cycleDays / 10)
  );

  // Calculate ROI range (monthly)
  const baseRoi = agentConfig.base_roi_monthly;
  const stabilityBonus = agentConfig.lot_stability_factor * Math.log(dailyLots + 1);
  const rangeWidth = agentConfig.roi_volatility / Math.sqrt(dailyLots + 1);

  const roiMin = Math.max(0, baseRoi - rangeWidth);
  const roiMax = baseRoi + rangeWidth + stabilityBonus;

  // Calculate share rate
  const shareRate = SHARE_RATES_BY_CYCLE[cycleDays] || 0.20;

  // Calculate user net ROI
  const userRoiMin = roiMin * (1 - shareRate);
  const userRoiMax = roiMax * (1 - shareRate);

  // Calculate estimated monthly profit
  const monthlyProfitMin = tierAmount * userRoiMin;
  const monthlyProfitMax = tierAmount * userRoiMax;

  // Calculate cycle total profit estimate
  const cycleMonths = cycleDays / 30;
  const cycleProfitMin = monthlyProfitMin * cycleMonths;
  const cycleProfitMax = monthlyProfitMax * cycleMonths;

  return {
    dailyLots,
    effectiveCapital,
    stabilityScore: Math.round(stabilityScore),
    roiRange: {
      min: Math.round(roiMin * 10000) / 100,  // Convert to percentage
      max: Math.round(roiMax * 10000) / 100,
      userMin: Math.round(userRoiMin * 10000) / 100,
      userMax: Math.round(userRoiMax * 10000) / 100,
    },
    shareRate: Math.round(shareRate * 100),
    profitEstimate: {
      monthlyMin: Math.round(monthlyProfitMin * 100) / 100,
      monthlyMax: Math.round(monthlyProfitMax * 100) / 100,
      cycleMin: Math.round(cycleProfitMin * 100) / 100,
      cycleMax: Math.round(cycleProfitMax * 100) / 100,
    },
  };
}

/**
 * Validate subscription parameters
 */
export function validateSubscription(
  agentId: string,
  amount: number,
  cycleDays: number,
  pairs: string[],
  chain: string
): { valid: boolean; errors: string[]; tier?: AgentTier } {
  const agent = getAgentConfig(agentId);
  const errors: string[] = [];

  if (!agent) {
    errors.push(`Agent ${agentId} not found`);
    return { valid: false, errors };
  }

  // Amount must match one of three tiers
  const validTier = agent.tiers.find(t => t.amount === amount);
  if (!validTier) {
    errors.push(`Amount must be one of: ${agent.tiers.map(t => t.amount).join('/')}`);
  }

  // Cycle must be supported
  if (!agent.supported_cycles.includes(cycleDays)) {
    errors.push(`Cycle must be one of: ${agent.supported_cycles.join('/')} days`);
  }

  // Pairs must be supported
  const unsupportedPairs = pairs.filter(p => !agent.supported_pairs.includes(p));
  if (unsupportedPairs.length > 0) {
    errors.push(`Unsupported pairs: ${unsupportedPairs.join(', ')}`);
  }

  // Chain must be supported
  if (!agent.supported_chains.includes(chain)) {
    errors.push(`Unsupported chain: ${chain}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    tier: validTier,
  };
}
