/**
 * Validation Utilities for ONE Engine
 */

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate transaction hash
 */
export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate chain ID
 */
export function isValidChainId(chainId: number): boolean {
  return Number.isInteger(chainId) && chainId > 0;
}

/**
 * Validate amount string (decimal number)
 */
export function isValidAmount(amount: string): boolean {
  return /^\d+(\.\d+)?$/.test(amount) && parseFloat(amount) >= 0;
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Validate non-negative number
 */
export function isNonNegativeNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

/**
 * Validate percentage (0-100)
 */
export function isValidPercentage(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 100;
}

/**
 * Validate slippage (0-50)
 */
export function isValidSlippage(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 50;
}

/**
 * Validate OTP code
 */
export function isValidOtp(otp: string, length: number = 6): boolean {
  const regex = new RegExp(`^\\d{${length}}$`);
  return regex.test(otp);
}

/**
 * Validate API key format
 */
export function isValidApiKey(key: string): boolean {
  return /^one_[a-f0-9]{32}$/.test(key);
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate ISO date string
 */
export function isValidIsoDate(date: string): boolean {
  const parsed = Date.parse(date);
  return !isNaN(parsed);
}

/**
 * Validate token symbol (2-10 uppercase chars)
 */
export function isValidTokenSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{2,10}$/.test(symbol);
}

/**
 * Validate fiat currency code (3 uppercase letters)
 */
export function isValidFiatCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}

/**
 * Validate contract ABI
 */
export function isValidAbi(abi: unknown): boolean {
  if (!Array.isArray(abi)) return false;
  return abi.every((item) => {
    return (
      typeof item === 'object' &&
      item !== null &&
      typeof item.type === 'string'
    );
  });
}

/**
 * Validate bytecode
 */
export function isValidBytecode(bytecode: string): boolean {
  return /^0x[a-fA-F0-9]+$/.test(bytecode) && bytecode.length > 2;
}

/**
 * Validate private key (32 bytes hex)
 */
export function isValidPrivateKey(key: string): boolean {
  return /^(0x)?[a-fA-F0-9]{64}$/.test(key);
}

/**
 * Sanitize and validate input
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Remove potential HTML
}

/**
 * Assert condition (throws if false)
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Assert value is defined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Type guard for non-null value
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
