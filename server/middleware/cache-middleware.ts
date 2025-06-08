import { Request, Response, NextFunction } from "express";
import {
  cacheService,
  createCacheKey,
} from "../services/unified-cache-service";
import logger from "../utils/logger";

interface CacheMiddlewareOptions {
  ttl?: number; // Time to live in seconds (default: 300 seconds / 5 minutes)
  prefix?: string; // Prefix for cache keys (default: 'api:')
  keyFn?: (req: Request) => string; // Custom function to generate cache keys
}

/**
 * Create a cache key based on the request
 */
function defaultKeyGenerator(req: Request): string {
  const { originalUrl, method, query } = req;

  // Only cache GET requests by default
  if (method !== "GET") {
    return "";
  }

  // Create parts for the cache key
  const parts = [
    method,
    originalUrl,
    // Include sorted query params
    Object.keys(query).length > 0
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(query).sort(([a], [b]) => a.localeCompare(b)),
          ),
        )
      : "",
  ];

  // Generate the key
  return createCacheKey(...parts);
}

/**
 * Middleware to cache API responses
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 300, // Default: 5 minutes
    prefix = "api:",
    keyFn = defaultKeyGenerator,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests unless keyFn explicitly handles them
    if (req.method !== "GET" && keyFn === defaultKeyGenerator) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyFn(req);

      // If key generation returns empty string, skip caching
      if (!cacheKey) {
        return next();
      }

      // Create full cache key with prefix
      const fullCacheKey = `${prefix}${cacheKey}`;

      // Attempt to get from cache
      const cachedResponse = await cacheService.get<{
        statusCode: number;
        headers: Record<string, string>;
        data: any;
      }>(fullCacheKey);

      if (cachedResponse) {
        // Cache hit - return cached response
        logger.debug("Cache hit", {
          key: cacheKey,
          method: req.method,
          path: req.path,
        });

        // Set headers from cached response (except those we don't want to copy)
        const skipHeaders = new Set([
          "content-length",
          "connection",
          "keep-alive",
        ]);

        for (const [key, value] of Object.entries(cachedResponse.headers)) {
          if (!skipHeaders.has(key.toLowerCase())) {
            res.setHeader(key, value);
          }
        }

        // Add cache indicator header
        res.setHeader("X-Cache", "HIT");

        // Send cached data with original status
        return res.status(cachedResponse.statusCode).json(cachedResponse.data);
      }

      // Cache miss - store response
      logger.debug("Cache miss", {
        key: cacheKey,
        method: req.method,
        path: req.path,
      });

      // Store original methods
      const originalJson = res.json;
      const originalSend = res.send;

      // Override response method to intercept and cache
      res.json = function (body: any): Response {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const responseToCache = {
            statusCode: res.statusCode,
            headers: res.getHeaders() as Record<string, string>,
            data: body,
          };

          // Store in cache asynchronously
          cacheService
            .set(fullCacheKey, responseToCache, {
              ttl,
            })
            .catch((err) => {
              logger.error("Failed to cache response", {
                error: err.message,
                key: cacheKey,
              });
            });
        }

        // Add cache indicator header
        res.setHeader("X-Cache", "MISS");

        // Call original method
        return originalJson.call(this, body);
      };

      // Also override send to cache for non-JSON responses
      res.send = function (body: any): Response {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const responseToCache = {
            statusCode: res.statusCode,
            headers: res.getHeaders() as Record<string, string>,
            data: body,
          };

          cacheService
            .set(fullCacheKey, responseToCache, {
              ttl,
            })
            .catch((err) => {
              logger.error("Failed to cache response", {
                error: err.message,
                key: cacheKey,
              });
            });
        }

        res.setHeader("X-Cache", "MISS");
        return originalSend.call(this, body);
      };

      // Also override end for empty responses
      const originalResEnd = res.end;
      res.end = function (...args: any[]): Response {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const chunk = args[0] || "";
          const responseToCache = {
            statusCode: res.statusCode,
            headers: res.getHeaders() as Record<string, string>,
            data: chunk,
          };

          cacheService
            .set(fullCacheKey, responseToCache, {
              ttl,
            })
            .catch((err) => {
              logger.error("Failed to cache response", {
                error: err.message,
                key: cacheKey,
              });
            });
        }

        res.setHeader("X-Cache", "MISS");
        return originalResEnd.apply(this, args as any);
      };

      next();
    } catch (error) {
      // Don't let cache errors affect the API response
      logger.error("Cache middleware error", {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
      });
      next();
    }
  };
}

/**
 * Middleware to clear cache for specific patterns
 */
export function clearCacheMiddleware(pattern: string) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await cacheService.invalidatePattern(pattern);
      logger.info(`Cache invalidated for pattern: ${pattern}`);
    } catch (error) {
      logger.error("Failed to invalidate cache", {
        error: error instanceof Error ? error.message : String(error),
        pattern,
      });
    }
    next();
  };
}

export default cacheMiddleware;
