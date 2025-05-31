#!/usr/bin/env tsx

import express, { type Request, Response, NextFunction } from "express";
import { setupRoutes } from "./server/routes";
import logger from "./server/utils/logger";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

// Set environment variables
process.env.SKIP_REDIS = "true";
process.env.NODE_ENV = "development";

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.SESSION_SECRET || 'rylie-secure-secret'));

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

// Setup API routes
setupRoutes(app);

// Serve static frontend files (if available)
const staticPath = path.join(__dirname, "client/dist");
app.use(express.static(staticPath, { fallthrough: true }));

// Catch-all handler for frontend routes
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ 
        message: 'Frontend not built. API endpoints available at /api/*',
        apiHealth: '/api/health',
        adminRoutes: '/api/admin/*'
      });
    }
  });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error(`Error handling request: ${message}`, { error: err, stack: err.stack });

  res.status(status).json({ 
    message: message,
    success: false
  });
});

// Start server
const port = 3000;
const server = app.listen(port, "0.0.0.0", () => {
  logger.info(`✅ Simple server running on http://localhost:${port}`);
  logger.info(`🔍 API Health: http://localhost:${port}/api/health`);
  logger.info(`⚙️  Admin API: http://localhost:${port}/api/admin`);
  logger.info("🎯 Ready for admin dashboard access!");
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});