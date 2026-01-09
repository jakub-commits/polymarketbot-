// Validation utilities

/**
 * Validates an Ethereum wallet address
 */
export function isValidWalletAddress(address: string): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates a percentage value (0-100)
 */
export function isValidPercentage(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 100;
}

/**
 * Validates a positive number
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && value > 0 && isFinite(value);
}

/**
 * Validates a non-negative number
 */
export function isNonNegativeNumber(value: number): boolean {
  return typeof value === 'number' && value >= 0 && isFinite(value);
}

/**
 * Validates a price (0-1 for Polymarket)
 */
export function isValidPrice(price: number): boolean {
  return typeof price === 'number' && price >= 0 && price <= 1;
}

/**
 * Validates a UUID
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Validates a CUID
 */
export function isValidCUID(cuid: string): boolean {
  if (!cuid) return false;
  return /^c[a-z0-9]{24}$/.test(cuid);
}

/**
 * Validates a token ID (hex string)
 */
export function isValidTokenId(tokenId: string): boolean {
  if (!tokenId) return false;
  return /^[0-9]+$/.test(tokenId) || /^0x[a-fA-F0-9]+$/.test(tokenId);
}

/**
 * Validates a condition ID (hex string)
 */
export function isValidConditionId(conditionId: string): boolean {
  if (!conditionId) return false;
  return /^0x[a-fA-F0-9]{64}$/.test(conditionId);
}

/**
 * Validates trader settings
 */
export interface TraderSettingsValidation {
  valid: boolean;
  errors: string[];
}

export function validateTraderSettings(settings: {
  allocationPercent?: number;
  maxPositionSize?: number;
  minTradeAmount?: number;
  slippageTolerance?: number;
  maxDrawdownPercent?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}): TraderSettingsValidation {
  const errors: string[] = [];

  if (settings.allocationPercent !== undefined) {
    if (!isValidPercentage(settings.allocationPercent)) {
      errors.push('allocationPercent must be between 0 and 100');
    }
  }

  if (settings.maxPositionSize !== undefined) {
    if (!isPositiveNumber(settings.maxPositionSize)) {
      errors.push('maxPositionSize must be a positive number');
    }
  }

  if (settings.minTradeAmount !== undefined) {
    if (!isPositiveNumber(settings.minTradeAmount)) {
      errors.push('minTradeAmount must be a positive number');
    }
  }

  if (settings.slippageTolerance !== undefined) {
    if (!isValidPercentage(settings.slippageTolerance)) {
      errors.push('slippageTolerance must be between 0 and 100');
    }
  }

  if (settings.maxDrawdownPercent !== undefined) {
    if (!isValidPercentage(settings.maxDrawdownPercent)) {
      errors.push('maxDrawdownPercent must be between 0 and 100');
    }
  }

  if (settings.stopLossPercent !== undefined) {
    if (!isValidPercentage(settings.stopLossPercent)) {
      errors.push('stopLossPercent must be between 0 and 100');
    }
  }

  if (settings.takeProfitPercent !== undefined) {
    if (!isValidPercentage(settings.takeProfitPercent)) {
      errors.push('takeProfitPercent must be between 0 and 100');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
