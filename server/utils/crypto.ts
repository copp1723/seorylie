/**
 * Cryptographic Utilities for PII Encryption
 *
 * Provides secure encryption and decryption functions for personally identifiable
 * information (PII) in compliance with GDPR/CCPA requirements.
 *
 * Features:
 * - AES-256-GCM encryption/decryption with authentication
 * - Secure key derivation from environment variables
 * - Random IV generation for each encryption
 * - Field-level encryption helpers for database operations
 * - Error handling for corrupt or tampered data
 * - Performance optimizations with caching
 *
 * Usage:
 * ```
 * import { encrypt, decrypt, encryptField, decryptField } from '../utils/crypto';
 *
 * // Simple string encryption
 * const encrypted = await encrypt('sensitive data');
 * const decrypted = await decrypt(encrypted);
 *
 * // Field-level database encryption
 * const encryptedEmail = await encryptField('john.doe@example.com');
 * const decryptedEmail = await decryptField(encryptedEmail);
 * ```
 */

import crypto from "crypto";
import logger from "./logger";

// Configuration
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const KEY_DERIVATION_ITERATIONS = 100000; // High iteration count for security
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;

// Cache for derived keys to improve performance
const keyCache: Map<string, Buffer> = new Map();

/**
 * Initialize the encryption system
 * Validates that required environment variables are set
 */
function initializeEncryption(): void {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for PII encryption",
    );
  }

  // Pre-derive the key for performance
  deriveKey(encryptionKey);

  logger.info("Encryption system initialized successfully");
}

/**
 * Derive a cryptographic key from a password/secret
 * Uses PBKDF2 with a high iteration count for security
 */
function deriveKey(
  secret: string,
  salt?: Buffer,
): { key: Buffer; salt: Buffer } {
  // Use provided salt or generate a new one
  const useSalt = salt || crypto.randomBytes(SALT_LENGTH);

  // Check if we have this key cached
  const cacheKey = `${secret}:${useSalt.toString("hex")}`;

  if (keyCache.has(cacheKey)) {
    return {
      key: keyCache.get(cacheKey) as Buffer,
      salt: useSalt,
    };
  }

  // Derive key using PBKDF2
  const key = crypto.pbkdf2Sync(
    secret,
    useSalt,
    KEY_DERIVATION_ITERATIONS,
    KEY_LENGTH,
    "sha256",
  );

  // Cache the derived key for performance
  keyCache.set(cacheKey, key);

  return { key, salt: useSalt };
}

/**
 * Get the encryption key from environment or derive it
 */
function getEncryptionKey(salt?: Buffer): { key: Buffer; salt: Buffer } {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for PII encryption",
    );
  }

  return deriveKey(encryptionKey, salt);
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns a buffer containing: salt + iv + authTag + encryptedData
 */
export async function encrypt(text: string): Promise<Buffer> {
  try {
    // Generate a random IV for each encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive the encryption key
    const { key, salt } = getEncryptionKey();

    // Create cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(text, "utf8")),
      cipher.final(),
    ]);

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    // Combine all components: salt + iv + authTag + encryptedData
    return Buffer.concat([salt, iv, authTag, encrypted]);
  } catch (error) {
    logger.error("Encryption error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt a buffer created by the encrypt function
 * Expects format: salt + iv + authTag + encryptedData
 */
export async function decrypt(encryptedBuffer: Buffer): Promise<string> {
  try {
    // Extract components from the encrypted buffer
    const salt = encryptedBuffer.subarray(0, SALT_LENGTH);
    const iv = encryptedBuffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = encryptedBuffer.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );
    const encryptedData = encryptedBuffer.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );

    // Derive the key using the extracted salt
    const { key } = getEncryptionKey(salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

    // Set the authentication tag
    decipher.setAuthTag(authTag);

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unsupported state or unable to authenticate data")
    ) {
      logger.error(
        "Data integrity error during decryption - possible tampering",
        {
          error: error.message,
        },
      );
      throw new Error("Data integrity error - unable to decrypt");
    }

    logger.error("Decryption error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Encrypt a field for database storage
 * Handles null/undefined values safely
 */
export async function encryptField(
  value: string | null | undefined,
): Promise<Buffer | null> {
  if (value === null || value === undefined) {
    return null;
  }

  return encrypt(value);
}

/**
 * Decrypt a field from database storage
 * Handles null values safely
 */
export async function decryptField(
  value: Buffer | null | undefined,
): Promise<string | null> {
  if (value === null || value === undefined) {
    return null;
  }

  return decrypt(value);
}

/**
 * Create a transform function for Drizzle ORM to encrypt fields on insert/update
 */
export function encryptTransform() {
  return {
    from: async (value: string | null | undefined) => {
      if (value === null || value === undefined) {
        return null;
      }
      return encrypt(value);
    },
    to: async (value: Buffer | null | undefined) => {
      if (value === null || value === undefined) {
        return null;
      }
      return decrypt(value);
    },
  };
}

/**
 * Mask a PII string for logging (e.g., "j***@e***.com")
 */
export function maskPII(
  value: string | null | undefined,
  type: "email" | "phone" | "name" = "email",
): string {
  if (value === null || value === undefined || value.length === 0) {
    return "[empty]";
  }

  switch (type) {
    case "email":
      // Format: "j***@e***.com"
      const [localPart, domain] = value.split("@");
      if (!domain) return "***@***";

      const [domainName, ...tld] = domain.split(".");
      const maskedLocal = localPart.charAt(0) + "***";
      const maskedDomain = domainName.charAt(0) + "***";

      return `${maskedLocal}@${maskedDomain}.${tld.join(".")}`;

    case "phone":
      // Format: "***-***-1234"
      const digits = value.replace(/\D/g, "");
      const last4 = digits.slice(-4);
      return `***-***-${last4}`;

    case "name":
      // Format: "J*** D***"
      return value
        .split(" ")
        .map((part) => part.charAt(0) + "***")
        .join(" ");

    default:
      return "********";
  }
}

/**
 * Generate a secure random token (e.g., for CSRF protection)
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Perform a timing-safe comparison of two strings
 * Helps prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(a, "utf8"),
      Buffer.from(b, "utf8"),
    );
  } catch (error) {
    // Length mismatch or other error
    return false;
  }
}

/**
 * Clear the key cache (e.g., during application shutdown)
 */
export function clearKeyCache(): void {
  keyCache.clear();
  logger.info("Encryption key cache cleared");
}

// Initialize encryption on module load
try {
  initializeEncryption();
} catch (error) {
  logger.warn("Encryption initialization failed", {
    error: error instanceof Error ? error.message : String(error),
    note: "PII encryption will not be available",
  });
}

export default {
  encrypt,
  decrypt,
  encryptField,
  decryptField,
  encryptTransform,
  maskPII,
  generateSecureToken,
  secureCompare,
  clearKeyCache,
};
