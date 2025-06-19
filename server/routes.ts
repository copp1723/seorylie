import { type Express } from "express";
import adfRoutes from "./routes/adf-routes";
import seoworks from "./routes/seoworks";
import { updateDeliveryStatus } from "./services/email-service";
import logger from "./utils/logger";

export function setupRoutes(app: Express) {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API routes placeholder
  app.get("/api", (req, res) => {
    res.json({ message: "Cleanrylie API" });
  });

  // Auth routes for web console
  app.post("/api/auth/login", (req, res) => {
    // Mock login for now
    res.json({
      user: { id: 1, email: "user@example.com", name: "Demo User" },
      token: "mock-jwt-token"
    });
  });

  app.get("/api/auth/me", (req, res) => {
    // Mock current user
    res.json({ id: 1, email: "user@example.com", name: "Demo User" });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // User routes
  app.get("/api/user", (req, res) => {
    res.json({ id: 1, email: "user@example.com", name: "Demo User" });
  });

  // Dashboard/Reports routes
  app.get("/api/reports/metrics", (req, res) => {
    res.json({
      totalRequests: 24,
      completedRequests: 18,
      pendingRequests: 6,
      avgCompletionTime: "2.3 days"
    });
  });

  // Requests routes
  app.get("/api/requests", (req, res) => {
    res.json([
      { id: 1, title: "Blog Post", status: "completed", createdAt: "2025-01-15" },
      { id: 2, title: "Page Creation", status: "in-progress", createdAt: "2025-01-16" },
      { id: 3, title: "Technical SEO", status: "pending", createdAt: "2025-01-17" }
    ]);
  });

  app.post("/api/requests", (req, res) => {
    res.json({ id: Date.now(), ...req.body, status: "pending", createdAt: new Date().toISOString() });
  });

  // Auth routes for web console
  app.post("/api/auth/login", (req, res) => {
    // Mock login for now
    res.json({
      user: { id: 1, email: "user@example.com", name: "Demo User" },
      token: "mock-jwt-token"
    });
  });

  app.get("/api/auth/me", (req, res) => {
    // Mock current user
    res.json({ id: 1, email: "user@example.com", name: "Demo User" });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // User routes
  app.get("/api/user", (req, res) => {
    res.json({ id: 1, email: "user@example.com", name: "Demo User" });
  });

  // SendGrid webhook endpoint for email delivery tracking
  app.post("/api/webhooks/sendgrid", (req, res) => {
    try {
      const events = req.body;

      if (!Array.isArray(events)) {
        return res.status(400).json({ error: "Invalid webhook payload" });
      }

      events.forEach((event: any) => {
        const { sg_message_id, event: eventType, email, timestamp } = event;

        if (sg_message_id && eventType) {
          // Map SendGrid events to our status types
          let status:
            | "sent"
            | "delivered"
            | "opened"
            | "clicked"
            | "bounced"
            | "failed";

          switch (eventType) {
            case "delivered":
              status = "delivered";
              break;
            case "open":
              status = "opened";
              break;
            case "click":
              status = "clicked";
              break;
            case "bounce":
            case "blocked":
            case "dropped":
              status = "bounced";
              break;
            case "spamreport":
            case "unsubscribe":
              status = "failed";
              break;
            default:
              status = "sent";
          }

          updateDeliveryStatus(sg_message_id, status, {
            sendgridEvent: eventType,
            email,
            timestamp,
            reason: event.reason,
            url: event.url, // For click events
          });
        }
      });

      logger.info("Processed SendGrid webhook events", {
        eventCount: events.length,
      });

      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      logger.error("SendGrid webhook processing failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ADF routes
  app.use("/api/adf", adfRoutes);

  // SEOworks routes
  app.use("/api", seoworks);
}
