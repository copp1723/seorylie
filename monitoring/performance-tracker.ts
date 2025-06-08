import { Request, Response, NextFunction, RequestHandler } from "express";
import { prometheusMetrics } from "../server/services/prometheus-metrics";
import logger from "../server/utils/logger";

/**
 * Performance tracking types
 */
type SyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;
type ExpressHandler = SyncRequestHandler | AsyncRequestHandler;

/**
 * Options for performance tracking
 */
interface TrackPerformanceOptions {
  /** Custom route name for metrics (defaults to req.route.path) */
  routeName?: string;
  /** Whether to log performance metrics (defaults to true) */
  enableLogging?: boolean;
  /** Log level to use (defaults to 'info') */
  logLevel?: "debug" | "info" | "warn" | "error";
  /** Custom labels to add to metrics */
  labels?: Record<string, string>;
}

/**
 * Default tracking options
 */
const defaultOptions: TrackPerformanceOptions = {
  enableLogging: true,
  logLevel: "info",
};

/**
 * Track performance of an Express request handler
 *
 * This utility wraps an Express handler function and measures its execution time,
 * recording the metrics to Prometheus and optionally logging the results.
 *
 * @param handler - The Express request handler to track
 * @param options - Optional configuration for tracking
 * @returns A wrapped handler with performance tracking
 *
 * @example
 * // Basic usage
 * router.get('/health', trackPerformance((req, res) => {
 *   res.json({ status: 'healthy' });
 * }));
 *
 * @example
 * // With custom route name
 * router.get('/users/:id', trackPerformance(getUserById, {
 *   routeName: '/users/:id'
 * }));
 *
 * @example
 * // With async handler
 * router.post('/data', trackPerformance(async (req, res) => {
 *   const result = await processData(req.body);
 *   res.json(result);
 * }));
 */
export function trackPerformance(
  handler: ExpressHandler,
  options?: TrackPerformanceOptions,
): RequestHandler {
  const mergedOptions = { ...defaultOptions, ...options };

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const startTime = Date.now();
    let statusCode = 200;

    // Store the original res.json, res.send, and res.end methods
    const originalJson = res.json;
    const originalSend = res.send;
    const originalEnd = res.end;

    // Override res.json to capture status code and measure time
    res.json = function (body?: any): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;

      recordMetrics(req, res, duration, mergedOptions);
      return originalJson.call(this, body);
    };

    // Override res.send to capture status code and measure time
    res.send = function (body?: any): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;

      recordMetrics(req, res, duration, mergedOptions);
      return originalSend.call(this, body);
    };

    // Override res.end to capture status code and measure time
    res.end = function (chunk?: any, encoding?: string): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;

      recordMetrics(req, res, duration, mergedOptions);
      return originalEnd.call(this, chunk, encoding);
    };

    try {
      // Call the original handler
      const result = handler(req, res, next);

      // If it's a promise, handle it
      if (result instanceof Promise) {
        await result.catch((error) => {
          statusCode = 500;
          logger.error("Error in tracked async handler", {
            error: error instanceof Error ? error.message : String(error),
            path: req.path,
            method: req.method,
            stack: error instanceof Error ? error.stack : undefined,
          });

          // If response hasn't been sent yet, send an error response
          if (!res.headersSent) {
            res.status(500).json({
              error: "server_error",
              message: "An unexpected error occurred",
            });
          }
        });
      }
    } catch (error) {
      // Handle synchronous errors
      statusCode = 500;
      logger.error("Error in tracked sync handler", {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // If response hasn't been sent yet, send an error response
      if (!res.headersSent) {
        res.status(500).json({
          error: "server_error",
          message: "An unexpected error occurred",
        });
      }

      // Record metrics for the error case
      const endTime = Date.now();
      const duration = endTime - startTime;
      recordMetrics(req, res, duration, mergedOptions);
    }
  };
}

/**
 * Record performance metrics to Prometheus and optionally log them
 */
function recordMetrics(
  req: Request,
  res: Response,
  durationMs: number,
  options: TrackPerformanceOptions,
): void {
  try {
    const method = req.method;
    const statusCode = res.statusCode;

    // Determine route name, with fallbacks for different route patterns
    let route = options.routeName || "";

    if (!route) {
      if (req.route && req.route.path) {
        route = req.route.path;
      } else if (req.baseUrl && req.path) {
        route = `${req.baseUrl}${req.path}`;
      } else {
        route = req.path || req.originalUrl.split("?")[0] || "/unknown";
      }
    }

    // Record metrics to Prometheus
    // This increments httpRequestsTotal counter (api_response_time_count equivalent)
    // and records duration in httpRequestDuration histogram
    prometheusMetrics.recordHttpRequest(method, route, statusCode, durationMs);

    // Log performance metrics if enabled
    if (options.enableLogging) {
      const logData = {
        method,
        route,
        statusCode,
        durationMs,
        ...(options.labels || {}),
      };

      switch (options.logLevel) {
        case "debug":
          logger.debug("API performance tracked", logData);
          break;
        case "warn":
          logger.warn("API performance tracked", logData);
          break;
        case "error":
          logger.error("API performance tracked", logData);
          break;
        case "info":
        default:
          logger.info("API performance tracked", logData);
          break;
      }
    }
  } catch (error) {
    logger.error("Error recording performance metrics", {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
    });
  }
}

/**
 * Track performance of an entire router or middleware stack
 *
 * @param routePrefix - Optional prefix to add to all routes for more specific metrics
 * @param options - Optional configuration for tracking
 * @returns Express middleware that tracks performance of all subsequent handlers
 *
 * @example
 * // Track all routes in a router
 * router.use(trackPerformanceMiddleware('/api/v1'));
 */
export function trackPerformanceMiddleware(
  routePrefix?: string,
  options?: TrackPerformanceOptions,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Store the original res.end method
    const originalEnd = res.end;

    // Override res.end to measure time
    res.end = function (chunk?: any, encoding?: string): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const mergedOptions = {
        ...defaultOptions,
        ...options,
        routeName: routePrefix ? `${routePrefix}${req.path}` : undefined,
      };

      recordMetrics(req, res, duration, mergedOptions);
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

export default {
  trackPerformance,
  trackPerformanceMiddleware,
};
