#!/usr/bin/env tsx

import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { createServer } from "http";
import seoworks from "./routes/seoworks";

// In production Docker, the bundled server is at /app/dist/minimal-production-server.js
// So __dirname should be /app/dist, and static files are at /app/dist/public
const __dirname = path.dirname(process.argv[1]);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

console.log("🚀 Starting minimal production server...");
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Port: ${PORT}`);
console.log(`Host: ${HOST}`);

// Security middleware - simplified for React/Vite apps
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        fontSrc: ["'self'", "fonts.gstatic.com", "fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "ws:", "wss:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  }),
);

// CORS - simplified
app.use(
  cors({
    origin: true, // Allow all origins for now
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - CRITICAL PATH RESOLUTION
// In production Docker: __dirname = /app/dist, so public files are at ./public
// In development: __dirname = /app/server, so public files are at ../dist/public
const publicPath =
  process.env.NODE_ENV === "production"
    ? path.join(__dirname, "public")
    : path.join(__dirname, "../dist/public");

console.log(`📁 Static files serving from: ${publicPath}`);
console.log(`📁 __dirname: ${__dirname}`);

// Enhanced static file logging
app.use((req, res, next) => {
  if (
    req.path.startsWith("/assets/") ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css")
  ) {
    console.log(`📄 Static file request: ${req.path}`);

    // Override res.end to log response status
    const originalEnd = res.end;
    res.end = function (...args) {
      console.log(
        `📄 Static file response: ${req.path} - Status: ${res.statusCode}`,
      );
      return originalEnd.apply(this, args);
    };
  }
  next();
});

app.use(express.static(publicPath));

// Essential API routes only
app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.get("/api/user", (req, res) => {
  res.json({
    id: 1,
    email: "demo@example.com",
    name: "Demo User",
    role: "admin",
    dealership_id: 1,
    isAuthenticated: true,
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    staticPath: publicPath,
  });
});

// SEOworks routes
app.use("/api", seoworks);

// Debug endpoint for static files
app.get("/api/debug/static", (req, res) => {
  const fs = require("fs");

  try {
    const files = fs.readdirSync(publicPath, { recursive: true });
    const assetsDir = path.join(publicPath, "assets");
    const assetsExist = fs.existsSync(assetsDir);
    const assetsFiles = assetsExist ? fs.readdirSync(assetsDir) : [];

    res.json({
      publicPath,
      publicPathExists: fs.existsSync(publicPath),
      assetsDir,
      assetsExist,
      totalFiles: files.length,
      assetsFiles,
      sampleFiles: files.slice(0, 10),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to read static files",
      publicPath,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// SPA fallback - CRITICAL for React routing
app.get("*", (req, res) => {
  // Don't serve SPA for API routes
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "API endpoint not found" });
    return;
  }

  const indexPath = path.join(publicPath, "index.html");

  console.log(`📄 Serving SPA for: ${req.path} from ${indexPath}`);
  res.sendFile(indexPath);
});

// Create HTTP server
const server = createServer(app);

// Graceful shutdown handling - CRITICAL for SIGTERM
function gracefulShutdown(signal: string) {
  console.log(`🛑 Received ${signal}, starting graceful shutdown...`);

  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.log("⚠️ Forcing exit after timeout");
    process.exit(1);
  }, 10000);
}

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled rejection:", reason);
  process.exit(1);
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🚀 Minimal server running on http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🔧 Static debug: http://${HOST}:${PORT}/api/debug/static`);
});

export { app, server };
