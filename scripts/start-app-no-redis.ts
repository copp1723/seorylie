/**
 * Modified server startup script that disables Redis dependencies
 * This provides a more reliable startup for testing the prompt interface
 */
import express, { type Request, Response, NextFunction } from "express";
import { setupRoutes } from "../server/routes";
import { setupVite, serveStatic, log } from "../server/vite";
import { standardLimiter } from '../server/middleware/rate-limit';
import logger from "../server/utils/logger";
import cookieParser from "cookie-parser";

// Set environment variables
process.env.SKIP_REDIS = "true";
process.env.NODE_ENV = "development";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.SESSION_SECRET || 'rylie-secure-secret'));

// Apply minimal rate limiting
app.use('/api', standardLimiter);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Basic request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info(`API request: ${req.method} ${path}`, {
        method: req.method,
        path: path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    }
  });
  next();
});

(async () => {
  logger.info("Starting server in simplified mode (Redis disabled)");
  
  setupRoutes(app);

  // Handle errors
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error(`Error handling request: ${message}`, { error: err, stack: err.stack });

    res.status(status).json({ 
      message: message,
      success: false
    });
  });

  // Create HTTP server
  const { createServer } = require('http');
  const server = createServer(app);

  // Setup Vite for development
  try {
    await setupVite(app, server);
  } catch (error) {
    logger.warn("Vite setup failed, serving static files", { error });
    // Fallback to serving static files if Vite fails
    serveStatic(app);
  }
  
  // Start server
  const port = 3000;
  server.listen(port, "0.0.0.0", () => {
    logger.info(`✅ Server running on http://localhost:${port}`);
    logger.info("🎯 Ready for admin dashboard access!");
  });
})();