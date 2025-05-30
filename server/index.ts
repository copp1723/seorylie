import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import csrf from "csurf";
import { setupVite, serveStatic, log } from "./vite";
import { setupRoutes } from "./routes";
import { standardLimiter, authLimiter, strictLimiter, apiKeyLimiter } from './middleware/rate-limit';
import logger from "./utils/logger";
import monitoringRoutes from './routes/monitoring-routes';
import escalationRoutes from './routes/escalation-routes';
import leadManagementRoutes from './routes/lead-management-routes';
import userManagementRoutes from './routes/user-management-routes';
import apiV1Routes from './routes/api-v1';
import customerInsightsRoutes from './routes/customer-insights-routes';
import { initializeFollowUpScheduler } from './services/follow-up-scheduler';
import { monitoring } from './services/monitoring';
import { validateProductionSafety } from './utils/production-safety-checks';

// Load environment variables
dotenv.config();

// Initialize Express app and create HTTP server
const app = express();
const server = createServer(app);

// Basic middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware
// app.use(csrf({ cookie: true })); // Uncomment if CSRF protection is needed

// Add request tracking middleware for monitoring
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    const duration = performance.now() - start;
    monitoring.trackRequest(req.path, duration, res.statusCode);
  });
  next();
});

// Structured logging middleware for API requests
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

// Setup routes
setupRoutes(app);

// Register additional routes
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/metrics', monitoringRoutes);
app.use('/api/escalation', escalationRoutes);
app.use('/api/leads', leadManagementRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/v1', apiV1Routes);
app.use('/api/insights', customerInsightsRoutes);

// Global error handler
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
    logger.error(`[ERROR] ${new Date().toISOString()} - ${err.stack || err}`);
  } else {
    logger.warn(`[WARN] ${new Date().toISOString()} - ${err.message || 'Unknown error'}`);
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

// Initialize services with production safety checks
(async () => {
  try {
    // Run production safety checks before starting any services
    logger.info('Running production safety checks...');
    await validateProductionSafety();
    logger.info('Production safety checks passed successfully');
    
    // Initialize services
    await initializeFollowUpScheduler();
    monitoring.initialize();
    
    // Initialize queue consumers with in-memory fallback
    try {
      const { initializeQueueConsumers } = await import('./services/queue-consumers');
      await initializeQueueConsumers();
      logger.info('Queue consumers successfully initialized');
    } catch (error) {
      logger.warn('Failed to initialize queue consumers, will use in-memory fallback', error);
    }

    // Setup Vite in development or serve static files in production
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      await setupVite(app, server);
    }

    // Configure port and host for proper deployment
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      log(`Server running on port ${PORT}`);
    });

    // Implement graceful shutdown for production scaling
    const handleShutdown = () => {
      logger.info('Shutting down application gracefully...');

      // Import necessary shutdown functions
      Promise.all([
        import('./db').then(({ closeDbConnections }) => closeDbConnections()),
        import('./utils/cache').then(({ shutdownCache }) => shutdownCache())
      ]).then(() => {
        logger.info('All resources released, shutting down cleanly');

        // Close HTTP server with a timeout
        server.close((err) => {
          if (err) {
            logger.error('Error closing HTTP server:', err);
            return;
          }
          logger.info('HTTP server closed successfully');
          process.exit(0);
        });
      }).catch((err) => {
        logger.error('Error during resource cleanup:', err);
        process.exit(1);
      });

      // Force shutdown after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Setup signal handlers for graceful shutdown
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
    
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();

export default server;
