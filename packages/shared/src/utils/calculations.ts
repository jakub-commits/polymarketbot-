// Calculation utilities

/**
 * Calculates P&L for a position
 */
export function calculatePnL(
  shares: number,
  entryPrice: number,
  currentPrice: number,
  side: 'BUY' | 'SELL'
): number {
  if (side === 'BUY') {
    // Long position: profit when price goes up
    return shares * (currentPrice - entryPrice);
  } else {
    // Short position: profit when price goes down
    return shares * (entryPrice - currentPrice);
  }
}

/**
 * Calculates P&L percentage
 */
export function calculatePnLPercent(
  entryPrice: number,
  currentPrice: number,
  side: 'BUY' | 'SELL'
): number {
  if (entryPrice === 0) return 0;

  if (side === 'BUY') {
    return (currentPrice - entryPrice) / entryPrice;
  } else {
    return (entryPrice - currentPrice) / entryPrice;
  }
}

/**
 * Calculates position value
 */
export function calculatePositionValue(shares: number, price: number): number {
  return shares * price;
}

/**
 * Calculates the number of shares for a given amount
 */
export function calculateShares(amount: number, price: number): number {
  if (price === 0) return 0;
  return amount / price;
}

/**
 * Calculates slippage percentage
 */
export function calculateSlippage(expectedPrice: number, actualPrice: number): number {
  if (expectedPrice === 0) return 0;
  return Math.abs(actualPrice - expectedPrice) / expectedPrice;
}

/**
 * Calculates win rate
 */
export function calculateWinRate(profitableTrades: number, totalTrades: number): number {
  if (totalTrades === 0) return 0;
  return profitableTrades / totalTrades;
}

/**
 * Calculates average entry price for multiple trades
 */
export function calculateAverageEntryPrice(
  trades: Array<{ shares: number; price: number }>
): number {
  const totalShares = trades.reduce((sum, t) => sum + t.shares, 0);
  if (totalShares === 0) return 0;

  const weightedSum = trades.reduce((sum, t) => sum + t.shares * t.price, 0);
  return weightedSum / totalShares;
}

/**
 * Calculates maximum drawdown from a series of values
 */
export function calculateMaxDrawdown(values: number[]): number {
  if (values.length < 2) return 0;

  let maxDrawdown = 0;
  let peak = values[0];

  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Calculates Sharpe ratio (simplified)
 * Assumes daily returns
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate = 0.02 / 365 // ~2% annual risk-free rate
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const excessReturn = avgReturn - riskFreeRate;

  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return (excessReturn / stdDev) * Math.sqrt(365); // Annualized
}

/**
 * Calculates position size based on allocation percentage
 */
export function calculatePositionSize(
  availableCapital: number,
  allocationPercent: number,
  maxPositionSize?: number
): number {
  const allocatedAmount = availableCapital * (allocationPercent / 100);

  if (maxPositionSize !== undefined) {
    return Math.min(allocatedAmount, maxPositionSize);
  }

  return allocatedAmount;
}

/**
 * Calculates copy trade size
 */
export function calculateCopySize(
  sourceTradeSize: number,
  copyPercentage: number,
  maxSize?: number
): number {
  const copyAmount = sourceTradeSize * (copyPercentage / 100);

  if (maxSize !== undefined) {
    return Math.min(copyAmount, maxSize);
  }

  return copyAmount;
}

/**
 * Calculates total fees
 */
export function calculateFees(amount: number, feeRate = 0.001): number {
  // Default 0.1% fee rate
  return amount * feeRate;
}

/**
 * Rounds a number to specified decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
