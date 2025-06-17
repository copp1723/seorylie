import { generateSecureToken } from './crypto.js';

/**
 * Generate a secure API key for dealership authentication
 * Format: cleanrylie_[64-character-hex-string]
 */
export function generateApiKey(): string {
  // Generate a 32-byte (256-bit) secure random token
  const token = generateSecureToken(32);
  // Prefix it to identify as a cleanrylie API key
  return `cleanrylie_${token}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return /^cleanrylie_[a-f0-9]{64}$/.test(apiKey);
}