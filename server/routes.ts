import { type Express } from "express";

export function setupRoutes(app: Express) {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API routes placeholder
  app.get("/api", (req, res) => {
    res.json({ message: "Cleanrylie API" });
  });
}
