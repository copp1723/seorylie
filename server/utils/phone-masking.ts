/**
 * Phone number masking utilities for privacy compliance
 * Ensures phone numbers are masked in all log outputs
 */

export interface PhoneMaskingOptions {
  preserveLength?: boolean;
  maskCharacter?: string;
  visibleDigits?: number;
  showCountryCode?: boolean;
}

/**
 * Mask a phone number for logging purposes
 */
export function maskPhoneNumber(
  phoneNumber: string,
  options: PhoneMaskingOptions = {}
): string {
  const {
    preserveLength = true,
    maskCharacter = '*',
    visibleDigits = 4,
    showCountryCode = false
  } = options;

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return maskCharacter.repeat(10); // Default masked phone length
  }

  // Remove all non-digit characters for processing
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  if (digitsOnly.length < visibleDigits) {
    return maskCharacter.repeat(preserveLength ? digitsOnly.length : 10);
  }

  let maskedNumber = '';

  if (showCountryCode && digitsOnly.length >= 11) {
    // Show country code (e.g., +1 for US)
    const countryCode = digitsOnly.substring(0, digitsOnly.length - 10);
    maskedNumber = `+${countryCode} `;

    // Mask the main number except last digits
    const mainNumber = digitsOnly.substring(countryCode.length);
    const visiblePart = mainNumber.slice(-visibleDigits);
    const maskedLength = mainNumber.length - visibleDigits;
    maskedNumber += maskCharacter.repeat(maskedLength) + visiblePart;
  } else {
    // Standard masking
    const visiblePart = digitsOnly.slice(-visibleDigits);
    const maskedLength = preserveLength ? digitsOnly.length - visibleDigits : 6;
    maskedNumber = maskCharacter.repeat(maskedLength) + visiblePart;
  }

  return maskedNumber;
}

/**
 * Mask multiple phone numbers in a text string
 */
export function maskPhoneNumbersInText(
  text: string,
  options: PhoneMaskingOptions = {}
): string {
  // Common phone number patterns
  const phonePatterns = [
    /\+1\s?\(?([0-9]{3})\)?\s?-?([0-9]{3})-?([0-9]{4})/g, // +1 (555) 123-4567
    /\(?([0-9]{3})\)?\s?-?([0-9]{3})-?([0-9]{4})/g,       // (555) 123-4567
    /\+?([0-9]{10,15})/g                                   // International formats
  ];

  let maskedText = text;

  phonePatterns.forEach(pattern => {
    maskedText = maskedText.replace(pattern, (match) => {
      return maskPhoneNumber(match, options);
    });
  });

  return maskedText;
}

/**
 * Check if a string contains phone numbers
 */
export function containsPhoneNumber(text: string): boolean {
  const phonePattern = /(\+?1?\s?)?\(?([0-9]{3})\)?\s?-?([0-9]{3})-?([0-9]{4})/;
  return phonePattern.test(text);
}

/**
 * Sanitize an object by masking phone numbers in all string values
 */
export function sanitizeObjectForLogging(
  obj: unknown,
  options: PhoneMaskingOptions = {}
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return containsPhoneNumber(obj) ? maskPhoneNumbersInText(obj, options) : obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => sanitizeObjectForLogging(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};

    // Special handling for known phone number fields
    const phoneFields = ['phone', 'phoneNumber', 'to', 'from', 'toPhone', 'fromPhone', 'mobile'];

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      if (phoneFields.some((field: string) => lowerKey.includes(field))) {
        // This is likely a phone number field
        sanitized[key] = typeof value === 'string' ? maskPhoneNumber(value, options) : value;
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeObjectForLogging(value, options);
      }
    }

    return sanitized;
  }

  return obj;
}

/**
 * Create a sanitized copy of request data for logging
 */
export function sanitizeRequestForLogging(req: any): any {
  const sanitized = {
    method: req.method,
    url: req.url,
    path: req.path,
    query: sanitizeObjectForLogging(req.query),
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? '[REDACTED]' : undefined,
      cookie: req.headers.cookie ? '[REDACTED]' : undefined
    },
    body: sanitizeObjectForLogging(req.body),
    ip: req.ip
  };

  return sanitized;
}

/**
 * Format phone number for display (without masking)
 * Use only when displaying to authorized users
 */
export function formatPhoneNumberForDisplay(phoneNumber: string): string {
  if (!phoneNumber) return '';

  const digitsOnly = phoneNumber.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    const main = digitsOnly.slice(1);
    return `+1 (${main.slice(0, 3)}) ${main.slice(3, 6)}-${main.slice(6)}`;
  }

  return phoneNumber; // Return as-is if can't format
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }

  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // US numbers: 10 digits or 11 digits starting with 1
  if (digitsOnly.length === 10) {
    return true;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return true;
  }

  // International numbers: 7-15 digits
  if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    return true;
  }

  return false;
}

/**
 * Extract phone numbers from text
 */
export function extractPhoneNumbers(text: string): string[] {
  const phonePattern = /(\+?1?\s?)?\(?([0-9]{3})\)?\s?-?([0-9]{3})-?([0-9]{4})/g;
  const matches = text.match(phonePattern) || [];

  return matches
    .map(match => match.replace(/\D/g, ''))
    .filter(phone => isValidPhoneNumber(phone))
    .map(phone => {
      // Normalize to E.164 format for US numbers
      if (phone.length === 10) {
        return `+1${phone}`;
      } else if (phone.length === 11 && phone.startsWith('1')) {
        return `+${phone}`;
      }
      return phone;
    });
}