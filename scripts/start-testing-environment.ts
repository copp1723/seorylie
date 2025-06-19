/**
 * Complete testing environment for prompt testing
 * This script starts a full environment with proper database connections
 */
import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "../server/vite";
import logger from "../server/utils/logger";
import cookieParser from "cookie-parser";
import { db } from "../server/db";
import promptTestRoutes from "../server/routes/prompt-test";
import promptVariantsRoutes from "../server/routes/prompt-variants";
import promptExperimentsRoutes from "../server/routes/prompt-experiments";

// Set environment variables for development
process.env.NODE_ENV = "development";
process.env.SKIP_REDIS = "true";

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.SESSION_SECRET || "rylie-secure-secret"));

// Add basic logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      logger.info(`API request: ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    }
  });
  next();
});

// Import our new route
import promptDefaultTestRoutes from "../server/routes/prompt-default-test";

// Setup prompt testing routes
app.use("/api/prompt-test", promptTestRoutes);
app.use("/api/prompt-variants", promptVariantsRoutes);
app.use("/api/prompt-experiments", promptExperimentsRoutes);
app.use("/api/prompt-default-test", promptDefaultTestRoutes);

// Add a simple health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    // Verify database connection
    await db.query.dealerships.findMany({
      limit: 1,
    });

    res.json({
      status: "healthy",
      database: "connected",
      redis: "fallback-memory",
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    logger.error("Health check failed", error);
    res.status(500).json({
      status: "unhealthy",
      error: "Database connection failed",
    });
  }
});

// Add CORS headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Initialize the server
(async () => {
  logger.info("Starting prompt testing environment");

  try {
    // Create server
    const server = app.listen({
      port: 5000,
      host: "0.0.0.0",
    });

    // Setup Vite middleware
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      logger.error(`Error processing request: ${err.message}`, {
        error: err,
        stack: err.stack,
      });

      res.status(err.status || 500).json({
        message: err.message || "An unexpected error occurred",
        success: false,
      });
    });

    logger.info("Prompt testing environment started on port 5000");

    // Handle server startup errors
    server.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        logger.error(
          `Port 5000 is already in use. Please close the other application or use a different port.`,
        );
        process.exit(1);
      } else {
        logger.error(`Server error: ${error.message}`, error);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error(
      `Failed to start testing environment: ${error.message}`,
      error,
    );
    process.exit(1);
  }
})();
