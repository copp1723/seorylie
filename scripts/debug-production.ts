#!/usr/bin/env tsx

import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3001;

// Simulate production environment
process.env.NODE_ENV = "production";

// Basic middleware
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Check if build exists
const distPath = path.join(process.cwd(), "dist");
const publicPath = path.join(distPath, "public");
const indexPath = path.join(publicPath, "index.html");

console.log("🔍 Checking build files...");
console.log(
  `Dist path: ${distPath} - ${fs.existsSync(distPath) ? "✅" : "❌"}`,
);
console.log(
  `Public path: ${publicPath} - ${fs.existsSync(publicPath) ? "✅" : "❌"}`,
);
console.log(
  `Index path: ${indexPath} - ${fs.existsSync(indexPath) ? "✅" : "❌"}`,
);

if (fs.existsSync(publicPath)) {
  const files = fs.readdirSync(publicPath, { recursive: true });
  console.log("📁 Built files:");
  files.forEach((file) => console.log(`  - ${file}`));
}

// API routes for testing
app.get("/api/test", (req, res) => {
  res.json({
    message: "API working",
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

// Static files
if (fs.existsSync(publicPath)) {
  console.log(`📂 Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));
} else {
  console.log("❌ Public directory not found!");
}

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "API endpoint not found" });
    return;
  }

  if (fs.existsSync(indexPath)) {
    console.log(`📄 Serving index.html for: ${req.path}`);
    res.sendFile(indexPath);
  } else {
    res.status(500).json({
      error: "Frontend not built",
      message: "Run npm run build first",
      indexPath,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Debug server running on http://localhost:${PORT}`);
  console.log(`📊 Test API: http://localhost:${PORT}/api/test`);
  console.log(`👤 User API: http://localhost:${PORT}/api/user`);
  console.log(`🏠 Frontend: http://localhost:${PORT}`);
});
