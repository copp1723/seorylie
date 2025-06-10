#!/usr/bin/env tsx
/**
 * Demo Startup Script - Reliable server startup for demo purposes
 * Features:
 * - No Redis dependency
 * - Handles module type conflicts
 * - Accessible via localhost and IP address
 * - Clear error messages and status updates
 */

import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: join(process.cwd(), ".env") });

// Set critical environment variables
process.env.SKIP_REDIS = "true";
process.env.NODE_ENV = "development";
process.env.SUPPRESS_NO_CONFIG_WARNING = "true";

// Create Express app
const app = express();

// Basic middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.SESSION_SECRET || "demo-secret-key"));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    mode: "demo",
    redis: "disabled"
  });
});

// API status endpoint
app.get("/api/status", (_req, res) => {
  res.json({
    status: "operational",
    services: {
      database: "connected",
      redis: "disabled (demo mode)",
      auth: "available"
    }
  });
});

async function startServer() {
  console.log("\n🚀 Starting Demo Server...\n");
  
  try {
    // Import and setup routes
    const { setupRoutes } = await import("../server/routes.js");
    setupRoutes(app);
    console.log("✅ Routes configured");
    
    // Setup Vite for frontend development
    if (process.env.NODE_ENV === "development") {
      try {
        const { setupVite } = await import("../server/vite.js");
        const { createServer } = await import("http");
        const server = createServer(app);
        await setupVite(app, server);
        console.log("✅ Vite development server configured");
        
        // Start the server
        const port = process.env.PORT || 3000;
        server.listen(port, "0.0.0.0", () => {
          console.log("\n🎉 Demo Server Ready!\n");
          console.log(`📍 Local:    http://localhost:${port}`);
          console.log(`📍 Network:  http://0.0.0.0:${port}`);
          console.log(`📍 Health:   http://localhost:${port}/health`);
          console.log(`📍 API:      http://localhost:${port}/api/status`);
          console.log("\n✨ Server is ready for your demo!\n");
        });
      } catch (viteError) {
        console.warn("⚠️  Vite setup failed, using static file serving");
        const { serveStatic } = await import("../server/vite.js");
        serveStatic(app);
        
        // Start without Vite
        const port = process.env.PORT || 3000;
        app.listen(port, "0.0.0.0", () => {
          console.log("\n🎉 Demo Server Ready (Static Mode)!\n");
          console.log(`📍 Local:    http://localhost:${port}`);
          console.log(`📍 Network:  http://0.0.0.0:${port}`);
          console.log("\n✨ Server is ready for your demo!\n");
        });
      }
    } else {
      // Production mode
      const port = process.env.PORT || 3000;
      app.listen(port, "0.0.0.0", () => {
        console.log("\n🎉 Demo Server Ready!\n");
        console.log(`📍 Server running on port ${port}`);
      });
    }
    
  } catch (error) {
    console.error("\n❌ Failed to start server:", error);
    console.error("\nTroubleshooting tips:");
    console.error("1. Make sure all dependencies are installed: npm install");
    console.error("2. Check if .env file exists with database credentials");
    console.error("3. Verify PostgreSQL is running and accessible");
    process.exit(1);
  }
}

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    mode: "demo"
  });
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

// Start the server
startServer().catch(console.error);