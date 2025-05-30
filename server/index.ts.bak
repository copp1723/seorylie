import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { standardLimiter, authLimiter, strictLimiter, apiKeyLimiter } from './middleware/rate-limit';
import logger from "./utils/logger";
import csrf from "csurf";
import cookieParser from "cookie-parser";
import monitoringRoutes from './routes/monitoring-routes';
import { monitoring } from './services/monitoring';
import escalationRoutes from './routes/escalation-routes';
import leadManagementRoutes from './routes/lead-management-routes';
import userManagementRoutes from './routes/user-management-routes';
import customerInsightsRoutes from './routes/customer-insights-routes';
import { initializeFollowUpScheduler } from './services/follow-up-scheduler';

// Enable Redis fallback when Redis connection details aren't provided
if (!process.env.REDIS_HOST) {
  process.env.SKIP_REDIS = 'true';
  logger.info('No Redis host configured, using in-memory fallback');
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.SESSION_SECRET || 'rylie-secure-secret'));

// Apply rate limiting to API routes
app.use('/api', standardLimiter);

// Apply stricter rate limits for auth-related endpoints
app.use('/api/auth', authLimiter);

// Apply stricter rate limits for sensitive endpoints
app.use('/api/handover', strictLimiter);

// API endpoints that require API key get a different limiter
app.use('/api/inbound', apiKeyLimiter);
app.use('/api/reply', apiKeyLimiter);

// Security headers
app.use((req, res, next) => {
  // Security headers for enterprise-level protection
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Only apply HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:;");

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Use our structured logger instead of basic logging
      const context = {
        method: req.method,
        path: path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
      };

      // Add response data to logs for non-success status codes or in development
      if (res.statusCode >= 400 || process.env.NODE_ENV !== 'production') {
        if (capturedJsonResponse) {
          context['response'] = capturedJsonResponse;
        }
      }

      // Log with appropriate level based on status code
      if (res.statusCode >= 500) {
        logger.error(`API error: ${req.method} ${path}`, null, context);
      } else if (res.statusCode >= 400) {
        logger.warn(`API warning: ${req.method} ${path}`, context);
      } else {
        logger.info(`API request: ${req.method} ${path}`, context);
      }
    }
  });

  next();
});

// Add monitoring routes before other routes
app.use('/api/metrics', monitoringRoutes);

// Add new feature routes
app.use('/api', escalationRoutes);
app.use('/api', leadManagementRoutes);
app.use('/api', userManagementRoutes);
app.use('/api', customerInsightsRoutes);

// Track all requests
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    const duration = performance.now() - start;
    monitoring.trackRequest(req.path, duration, res.statusCode);
  });
  next();
});

(async () => {
  // Initialize queue consumers with in-memory fallback
  try {
    const { initializeQueueConsumers } = await import('./services/queue-consumers');
    await initializeQueueConsumers();
    logger.info('Queue consumers successfully initialized');
  } catch (error) {
    logger.warn('Failed to initialize queue consumers, will use in-memory fallback', error);
  }
  
  // Initialize the follow-up scheduler
  try {
    const { initializeFollowUpScheduler } = await import('./services/follow-up-scheduler');
    await initializeFollowUpScheduler();
    logger.info('Follow-up scheduler successfully initialized');
  } catch (error) {
    logger.warn('Failed to initialize follow-up scheduler', error);
  }
  
  // Initialize the follow-up scheduler
  try {
    await initializeFollowUpScheduler();
    logger.info('Follow-up scheduler successfully initialized');
  } catch (error) {
    logger.warn('Failed to initialize follow-up scheduler', error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // In production, don't expose detailed error messages
    const isProduction = process.env.NODE_ENV === 'production';
    const responseMessage = isProduction && status === 500
      ? 'An unexpected error occurred. Our team has been notified.'
      : message;

    // Log the full error details for debugging
    if (status >= 500) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${err.stack || err}`);
    } else {
      console.warn(`[WARN] ${new Date().toISOString()} - ${err.message || 'Unknown error'}`);
    }

    res.status(status).json({
      message: responseMessage,
      success: false,
      code: isProduction ? undefined : err.code
    });

    // Only re-throw in development for better debugging
    if (!isProduction) {
      throw err;
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Configure port and host for proper deployment
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

  // Implement graceful shutdown for production scaling
  const handleShutdown = () => {
    console.log('Shutting down application gracefully...');

    // Import necessary shutdown functions
    Promise.all([
      import('./db').then(({ closeDbConnections }) => closeDbConnections()),
      import('./utils/cache').then(({ shutdownCache }) => shutdownCache())
    ]).then(() => {
      console.log('All resources released, shutting down cleanly');

      // Close HTTP server with a timeout
      server.close((err) => {
        if (err) {
          console.error('Error closing HTTP server:', err);
          return;
        }
        console.log('HTTP server closed successfully');
        process.exit(0);
      });
    }).catch((err) => {
      console.error('Error during resource cleanup:', err);
      process.exit(1);
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Setup signal handlers for graceful shutdown
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);

  // Add cache statistics to health endpoint
  app.get('/api/health/cache', async (req, res) => {
    const { getCacheStats } = await import('./utils/cache');
    res.json(getCacheStats());
  });
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();