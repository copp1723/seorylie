/**
 * Log Redaction Middleware
 *
 * Provides comprehensive PII redaction for logging in compliance with GDPR/CCPA.
 * Automatically detects and redacts sensitive information from logs, request bodies,
 * and response payloads.
 *
 * Features:
 * - Regex-based detection of common PII patterns (email, phone, SSN, credit cards)
 * - Configurable field-based redaction for known sensitive fields
 * - Express middleware for request/response logging with PII protection
 * - Integration with the application logger
 * - Error handling to prevent accidental PII exposure
 * - Support for custom redaction patterns
 *
 * Usage:
 * ```
 * // Apply to all routes
 * app.use(logRedactionMiddleware());
 *
 * // Or configure with custom options
 * app.use(logRedactionMiddleware({
 *   additionalFields: ['custom_field', 'secret_key'],
 *   excludePaths: ['/public', '/health']
 * }));
 *
 * // Use in logger directly
 * logger.info('User data', {
 *   data: redactSensitiveInfo({ email: 'user@example.com' })
 * });
 * ```
 */

import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { maskPII } from "../utils/crypto";
import { cloneDeep } from "lodash";

// PII detection patterns
const PII_PATTERNS = {
  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone numbers (various formats)
  PHONE: /\b(\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,

  // Social Security Numbers
  SSN: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,

  // Credit card numbers (major card types)
  CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,

  // IP addresses
  IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,

  // Dates of birth
  DOB: /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g,

  // Passport numbers (basic pattern)
  PASSPORT: /\b[A-Z0-9]{6,9}\b/g,

  // Driver's license (basic pattern for US)
  DRIVERS_LICENSE: /\b[A-Z0-9]{7,9}\b/g,

  // ZIP/Postal codes
  ZIP_CODE: /\b\d{5}(-\d{4})?\b/g,
};

// Default sensitive field names to redact
const DEFAULT_SENSITIVE_FIELDS = [
  // Personal identifiers
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "api_secret",
  "apisecret",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "auth_token",
  "authtoken",
  "session_token",
  "sessiontoken",
  "jwt",
  "private_key",
  "privatekey",
  "secret_key",
  "secretkey",

  // Personal information
  "ssn",
  "social_security",
  "socialsecurity",
  "social_security_number",
  "socialsecuritynumber",
  "dob",
  "date_of_birth",
  "dateofbirth",
  "birth_date",
  "birthdate",
  "dl_number",
  "dlnumber",
  "drivers_license",
  "driverslicense",
  "license_number",
  "licensenumber",
  "passport",
  "passport_number",
  "passportnumber",

  // Contact information
  "email",
  "email_address",
  "emailaddress",
  "phone",
  "phone_number",
  "phonenumber",
  "mobile",
  "mobile_number",
  "mobilenumber",
  "cell",
  "cell_number",
  "cellnumber",
  "address",
  "street_address",
  "streetaddress",
  "home_address",
  "homeaddress",
  "zip",
  "zip_code",
  "zipcode",
  "postal_code",
  "postalcode",

  // Financial information
  "cc",
  "cc_number",
  "ccnumber",
  "credit_card",
  "creditcard",
  "card_number",
  "cardnumber",
  "cvv",
  "cvc",
  "security_code",
  "securitycode",
  "card_security",
  "cardsecurity",
  "expiry",
  "expiration",
  "expiry_date",
  "expirydate",
  "expiration_date",
  "expirationdate",
  "bank_account",
  "bankaccount",
  "account_number",
  "accountnumber",
  "routing_number",
  "routingnumber",
  "tax_id",
  "taxid",
  "ein",
  "employer_id",
  "employerid",

  // Health information
  "medical_record",
  "medicalrecord",
  "health_id",
  "healthid",
  "insurance_id",
  "insuranceid",
  "patient_id",
  "patientid",
  "diagnosis",
  "treatment",
  "medication",
];

// Middleware options interface
interface LogRedactionOptions {
  // Additional field names to redact
  additionalFields?: string[];

  // Paths to exclude from redaction
  excludePaths?: string[];

  // Custom redaction patterns
  customPatterns?: Record<string, RegExp>;

  // Whether to redact request bodies
  redactRequestBody?: boolean;

  // Whether to redact response bodies
  redactResponseBody?: boolean;

  // Whether to redact URL query parameters
  redactQueryParams?: boolean;

  // Whether to redact URL path parameters
  redactPathParams?: boolean;

  // Whether to redact headers
  redactHeaders?: boolean;

  // Headers to never redact (case-insensitive)
  safeHeaders?: string[];

  // Maximum depth for object traversal
  maxDepth?: number;

  // Replacement string for redacted values
  replacementString?: string;
}

// Default options
const DEFAULT_OPTIONS: LogRedactionOptions = {
  additionalFields: [],
  excludePaths: ["/health", "/metrics", "/favicon.ico"],
  customPatterns: {},
  redactRequestBody: true,
  redactResponseBody: true,
  redactQueryParams: true,
  redactPathParams: false, // Path params often don't contain PII
  redactHeaders: true,
  safeHeaders: [
    "content-type",
    "content-length",
    "host",
    "connection",
    "accept",
    "accept-encoding",
    "accept-language",
    "cache-control",
    "pragma",
    "user-agent",
    "origin",
    "referer",
    "x-requested-with",
  ],
  maxDepth: 10,
  replacementString: "[REDACTED]",
};

/**
 * Redacts sensitive information from a string using regex patterns
 */
export function redactSensitivePatterns(
  input: string,
  options: LogRedactionOptions = DEFAULT_OPTIONS,
): string {
  if (!input || typeof input !== "string") {
    return input;
  }

  let redacted = input;

  // Apply all PII patterns
  Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
    redacted = redacted.replace(pattern, (match) => {
      // Use specialized masking for common types
      if (type === "EMAIL") {
        return maskPII(match, "email");
      } else if (type === "PHONE") {
        return maskPII(match, "phone");
      } else {
        return options.replacementString || "[REDACTED]";
      }
    });
  });

  // Apply custom patterns
  if (options.customPatterns) {
    Object.entries(options.customPatterns).forEach(([_, pattern]) => {
      redacted = redacted.replace(
        pattern,
        options.replacementString || "[REDACTED]",
      );
    });
  }

  return redacted;
}

/**
 * Determines if a field name matches any sensitive field patterns
 */
function isSensitiveField(
  fieldName: string,
  options: LogRedactionOptions,
): boolean {
  // Convert to lowercase for case-insensitive matching
  const lowerField = fieldName.toLowerCase();

  // Check against default and additional sensitive fields
  const allSensitiveFields = [
    ...DEFAULT_SENSITIVE_FIELDS,
    ...(options.additionalFields || []),
  ];

  return allSensitiveFields.some((pattern) => {
    // Exact match
    if (lowerField === pattern.toLowerCase()) {
      return true;
    }

    // Contains pattern
    if (lowerField.includes(pattern.toLowerCase())) {
      return true;
    }

    return false;
  });
}

/**
 * Redacts sensitive information from an object recursively
 */
export function redactSensitiveInfo(
  obj: any,
  options: LogRedactionOptions = DEFAULT_OPTIONS,
  currentDepth: number = 0,
): any {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Prevent infinite recursion
  if (currentDepth > (options.maxDepth || DEFAULT_OPTIONS.maxDepth!)) {
    return typeof obj === "object" ? "[Object]" : obj;
  }

  // Handle different types
  if (typeof obj === "string") {
    return redactSensitivePatterns(obj, options);
  } else if (typeof obj !== "object") {
    return obj; // Return primitives as-is
  } else if (Array.isArray(obj)) {
    // Handle arrays
    return obj.map((item) =>
      redactSensitiveInfo(item, options, currentDepth + 1),
    );
  }

  // Handle objects
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key, options)) {
      // Redact sensitive fields completely
      result[key] = options.replacementString || "[REDACTED]";
    } else if (typeof value === "string") {
      // Redact sensitive patterns in strings
      result[key] = redactSensitivePatterns(value, options);
    } else if (typeof value === "object" && value !== null) {
      // Recursively process nested objects
      result[key] = redactSensitiveInfo(value, options, currentDepth + 1);
    } else {
      // Keep other values as-is
      result[key] = value;
    }
  }

  return result;
}

/**
 * Redacts sensitive information from request headers
 */
function redactHeaders(
  headers: Record<string, any>,
  options: LogRedactionOptions,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(headers)) {
    // Skip safe headers
    if (
      options.safeHeaders?.some((h) => h.toLowerCase() === key.toLowerCase())
    ) {
      result[key] = value;
      continue;
    }

    // Check if header name contains sensitive information
    if (isSensitiveField(key, options)) {
      result[key] = options.replacementString || "[REDACTED]";
    } else if (typeof value === "string") {
      // Redact sensitive patterns in header values
      result[key] = redactSensitivePatterns(value, options);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Redacts sensitive information from URL query parameters
 */
function redactQueryParams(
  query: Record<string, any>,
  options: LogRedactionOptions,
): Record<string, any> {
  return redactSensitiveInfo(query, options);
}

/**
 * Creates a redacted copy of the request object suitable for logging
 */
function createRedactedRequest(
  req: Request,
  options: LogRedactionOptions,
): Record<string, any> {
  const redacted: Record<string, any> = {
    method: req.method,
    url: req.url,
    path: req.path,
  };

  // Redact query parameters if enabled
  if (options.redactQueryParams && Object.keys(req.query).length > 0) {
    redacted.query = redactQueryParams(req.query, options);
  }

  // Redact headers if enabled
  if (options.redactHeaders && req.headers) {
    redacted.headers = redactHeaders(
      req.headers as Record<string, any>,
      options,
    );
  }

  // Redact request body if enabled and exists
  if (options.redactRequestBody && req.body) {
    try {
      redacted.body = redactSensitiveInfo(cloneDeep(req.body), options);
    } catch (error) {
      redacted.body = "[Error: Unable to redact request body]";
      logger.error("Error redacting request body", {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
      });
    }
  }

  // Redact path parameters if enabled
  if (
    options.redactPathParams &&
    req.params &&
    Object.keys(req.params).length > 0
  ) {
    redacted.params = redactSensitiveInfo(req.params, options);
  }

  return redacted;
}

/**
 * Creates a redacted copy of the response object suitable for logging
 */
function createRedactedResponse(
  res: Response,
  options: LogRedactionOptions,
): Record<string, any> {
  const redacted: Record<string, any> = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
  };

  // Redact headers if enabled
  if (options.redactHeaders && res.getHeaders) {
    redacted.headers = redactHeaders(
      res.getHeaders() as Record<string, any>,
      options,
    );
  }

  // Response body is typically not available in the response object
  // It would need to be captured separately

  return redacted;
}

/**
 * Express middleware for redacting sensitive information in logs
 */
export function logRedactionMiddleware(
  customOptions: Partial<LogRedactionOptions> = {},
): (req: Request, res: Response, next: NextFunction) => void {
  // Merge custom options with defaults
  const options: LogRedactionOptions = {
    ...DEFAULT_OPTIONS,
    ...customOptions,
    // Merge nested objects
    customPatterns: {
      ...DEFAULT_OPTIONS.customPatterns,
      ...customOptions.customPatterns,
    },
    safeHeaders: [
      ...(DEFAULT_OPTIONS.safeHeaders || []),
      ...(customOptions.safeHeaders || []),
    ],
    additionalFields: [
      ...(DEFAULT_OPTIONS.additionalFields || []),
      ...(customOptions.additionalFields || []),
    ],
    excludePaths: [
      ...(DEFAULT_OPTIONS.excludePaths || []),
      ...(customOptions.excludePaths || []),
    ],
  };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (options.excludePaths?.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Store original request start time
    const startTime = Date.now();

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    // Create redacted request for logging
    const redactedReq = createRedactedRequest(req, options);

    // Log incoming request
    logger.info("Request received", { req: redactedReq });

    // Override response methods to capture and log response
    if (options.redactResponseBody) {
      // Override res.send
      res.send = function (body?: any): Response {
        try {
          // Log redacted response
          const redactedRes = createRedactedResponse(res, options);
          let redactedBody;

          if (body) {
            if (typeof body === "string") {
              try {
                // Try to parse JSON string
                const parsed = JSON.parse(body);
                redactedBody = redactSensitiveInfo(parsed, options);
              } catch {
                // Not JSON, redact as string
                redactedBody = redactSensitivePatterns(body, options);
              }
            } else {
              redactedBody = redactSensitiveInfo(body, options);
            }

            redactedRes.body = redactedBody;
          }

          const duration = Date.now() - startTime;
          logger.info("Response sent", {
            res: redactedRes,
            durationMs: duration,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
          });
        } catch (error) {
          logger.error("Error logging response", {
            error: error instanceof Error ? error.message : String(error),
            path: req.path,
          });
        }

        // Call original method
        return originalSend.apply(res, [body]);
      };

      // Override res.json
      res.json = function (body?: any): Response {
        try {
          // Log redacted response
          const redactedRes = createRedactedResponse(res, options);

          if (body) {
            redactedRes.body = redactSensitiveInfo(body, options);
          }

          const duration = Date.now() - startTime;
          logger.info("Response sent", {
            res: redactedRes,
            durationMs: duration,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
          });
        } catch (error) {
          logger.error("Error logging response", {
            error: error instanceof Error ? error.message : String(error),
            path: req.path,
          });
        }

        // Call original method
        return originalJson.apply(res, [body]);
      };

      // Override res.end to catch responses without body
      res.end = function (
        chunk?: any,
        encoding?: BufferEncoding,
        callback?: () => void,
      ): Response {
        try {
          // Only log if not already logged by send/json
          if (!res.headersSent) {
            const redactedRes = createRedactedResponse(res, options);
            const duration = Date.now() - startTime;

            logger.info("Response sent", {
              res: redactedRes,
              durationMs: duration,
              path: req.path,
              method: req.method,
              statusCode: res.statusCode,
            });
          }
        } catch (error) {
          logger.error("Error logging response", {
            error: error instanceof Error ? error.message : String(error),
            path: req.path,
          });
        }

        // Call original method
        return originalEnd.apply(res, [chunk, encoding, callback]);
      };
    }

    // Error handling
    const errorHandler = (err: Error) => {
      try {
        // Create redacted error object
        const redactedError = {
          message: redactSensitivePatterns(err.message, options),
          stack:
            process.env.NODE_ENV === "production"
              ? undefined
              : redactSensitivePatterns(err.stack || "", options),
          name: err.name,
        };

        logger.error("Request error", {
          error: redactedError,
          req: redactedReq,
          path: req.path,
          method: req.method,
        });
      } catch (logError) {
        // Fallback if error during redaction
        logger.error("Error during error redaction", {
          error:
            logError instanceof Error ? logError.message : String(logError),
          originalError: err.name,
          path: req.path,
        });
      }
    };

    // Add error handler
    res.on("error", errorHandler);

    next();
  };
}

/**
 * Adds redaction capability to the logger
 */
export function setupLoggerRedaction(
  customOptions: Partial<LogRedactionOptions> = {},
): void {
  const options: LogRedactionOptions = {
    ...DEFAULT_OPTIONS,
    ...customOptions,
  };

  // Add redaction to logger
  logger.addRedaction = (fields: string[]) => {
    options.additionalFields = [...(options.additionalFields || []), ...fields];
  };

  // Patch logger methods to automatically redact
  const originalInfo = logger.info;
  const originalError = logger.error;
  const originalWarn = logger.warn;
  const originalDebug = logger.debug;

  // Override logger methods
  logger.info = (msg: string, obj?: any) => {
    const redactedObj = obj ? redactSensitiveInfo(obj, options) : undefined;
    return originalInfo(msg, redactedObj);
  };

  logger.error = (msg: string, obj?: any) => {
    const redactedObj = obj ? redactSensitiveInfo(obj, options) : undefined;
    return originalError(msg, redactedObj);
  };

  logger.warn = (msg: string, obj?: any) => {
    const redactedObj = obj ? redactSensitiveInfo(obj, options) : undefined;
    return originalWarn(msg, redactedObj);
  };

  logger.debug = (msg: string, obj?: any) => {
    const redactedObj = obj ? redactSensitiveInfo(obj, options) : undefined;
    return originalDebug(msg, redactedObj);
  };

  logger.info("Logger redaction configured", {
    sensitiveFieldsCount:
      DEFAULT_SENSITIVE_FIELDS.length + (options.additionalFields?.length || 0),
    patternsCount:
      Object.keys(PII_PATTERNS).length +
      Object.keys(options.customPatterns || {}).length,
  });
}

// Export utility functions and middleware
export default {
  middleware: logRedactionMiddleware,
  redactSensitiveInfo,
  redactSensitivePatterns,
  setupLoggerRedaction,
};
