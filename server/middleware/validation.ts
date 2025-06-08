import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import logger from "../utils/logger";

// Enhanced validation error details
interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: string;
}

interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: ValidationErrorDetail[];
}

/**
 * Create validation middleware for request body
 */
export const validateBody = <T extends z.ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = validateData(schema, req.body);

    if (result.success) {
      req.body = result.data;
      next();
    } else {
      logger.warn("Request body validation failed", {
        endpoint: req.path,
        method: req.method,
        errors: result.errors,
        dealershipId: req.dealershipId,
      });

      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: result.errors,
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * Create validation middleware for query parameters
 */
export const validateQuery = <T extends z.ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = validateData(schema, req.query);

    if (result.success) {
      req.query = result.data;
      next();
    } else {
      logger.warn("Query parameter validation failed", {
        endpoint: req.path,
        method: req.method,
        errors: result.errors,
        dealershipId: req.dealershipId,
      });

      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: result.errors,
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * Create validation middleware for URL parameters
 */
export const validateParams = <T extends z.ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = validateData(schema, req.params);

    if (result.success) {
      req.params = result.data;
      next();
    } else {
      logger.warn("URL parameter validation failed", {
        endpoint: req.path,
        method: req.method,
        errors: result.errors,
        dealershipId: req.dealershipId,
      });

      res.status(400).json({
        success: false,
        error: "Invalid URL parameters",
        details: result.errors,
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * Validate data against a Zod schema
 */
function validateData<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): ValidationResult {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join(".") || "root",
        message: err.message,
        code: err.code,
        received: err.received,
        expected: getExpectedType(err),
      }));

      return { success: false, errors };
    }

    // Handle non-Zod errors
    return {
      success: false,
      errors: [
        {
          field: "unknown",
          message:
            error instanceof Error ? error.message : "Unknown validation error",
          code: "unknown_error",
        },
      ],
    };
  }
}

/**
 * Extract expected type information from Zod error
 */
function getExpectedType(error: z.ZodIssue): string {
  switch (error.code) {
    case "invalid_type":
      return error.expected;
    case "invalid_string":
      return error.validation ? `string (${error.validation})` : "string";
    case "too_small":
      return `${error.type} with minimum ${error.minimum}${error.inclusive ? " (inclusive)" : " (exclusive)"}`;
    case "too_big":
      return `${error.type} with maximum ${error.maximum}${error.inclusive ? " (inclusive)" : " (exclusive)"}`;
    case "invalid_enum_value":
      return `one of: ${error.options.join(", ")}`;
    case "invalid_date":
      return "valid date";
    case "custom":
      return error.params?.expected || "custom validation";
    default:
      return "valid value";
  }
}

/**
 * Middleware to validate and sanitize UUID parameters
 */
export const validateUuidParam = (paramName: string) => {
  const uuidSchema = z.object({
    [paramName]: z.string().uuid(`Invalid ${paramName} format`),
  });

  return validateParams(uuidSchema);
};

/**
 * Middleware to validate numeric ID parameters
 */
export const validateNumericParam = (paramName: string) => {
  const numericSchema = z.object({
    [paramName]: z
      .string()
      .regex(/^\d+$/, `${paramName} must be a valid number`)
      .transform((val) => parseInt(val, 10)),
  });

  return validateParams(numericSchema);
};

/**
 * Response validation middleware (for development/testing)
 * This middleware validates outgoing responses to ensure API contract compliance
 */
export const validateResponse = <T extends z.ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "production") {
      // Skip response validation in production for performance
      return next();
    }

    const originalJson = res.json;

    res.json = function (data: any) {
      // Validate response data in development
      const result = validateData(schema, data);

      if (!result.success) {
        logger.error("Response validation failed", {
          endpoint: req.path,
          method: req.method,
          errors: result.errors,
          responseData: data,
        });

        // In development, return validation error
        return originalJson.call(this, {
          success: false,
          error: "Response validation failed",
          details: result.errors,
          originalData: data,
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Content-Type validation middleware
 */
export const validateContentType = (
  expectedTypes: string[] = ["application/json"],
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get("Content-Type");

    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: "Missing Content-Type header",
        expected: expectedTypes,
        timestamp: new Date().toISOString(),
      });
    }

    const isValidType = expectedTypes.some((type) =>
      contentType.toLowerCase().includes(type.toLowerCase()),
    );

    if (!isValidType) {
      return res.status(415).json({
        success: false,
        error: "Unsupported Media Type",
        received: contentType,
        expected: expectedTypes,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * JSON body size validation middleware
 */
export const validateBodySize = (maxSizeBytes: number = 1024 * 1024) => {
  // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get("Content-Length");

    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return res.status(413).json({
        success: false,
        error: "Request body too large",
        maxSize: `${Math.round(maxSizeBytes / 1024)}KB`,
        received: `${Math.round(parseInt(contentLength) / 1024)}KB`,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * Middleware to sanitize input data
 */
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Basic XSS protection - strip HTML tags from string fields
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  next();
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    // Basic HTML tag removal (for XSS protection)
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Comprehensive validation middleware combining multiple validations
 */
export const createValidationMiddleware = <
  TBody extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TParams extends z.ZodTypeAny,
>(options: {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
  contentType?: string[];
  maxBodySize?: number;
  sanitize?: boolean;
}) => {
  const middlewares: Array<
    (req: Request, res: Response, next: NextFunction) => void
  > = [];

  // Content-Type validation
  if (options.contentType) {
    middlewares.push(validateContentType(options.contentType));
  }

  // Body size validation
  if (options.maxBodySize) {
    middlewares.push(validateBodySize(options.maxBodySize));
  }

  // Input sanitization
  if (options.sanitize !== false) {
    middlewares.push(sanitizeInput);
  }

  // Schema validation
  if (options.params) {
    middlewares.push(validateParams(options.params));
  }

  if (options.query) {
    middlewares.push(validateQuery(options.query));
  }

  if (options.body) {
    middlewares.push(validateBody(options.body));
  }

  return middlewares;
};
