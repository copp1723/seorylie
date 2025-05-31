import { type Express } from "express";
import adfRoutes from "./routes/adf-routes";
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
          let status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

          switch (eventType) {
            case 'delivered':
              status = 'delivered';
              break;
            case 'open':
              status = 'opened';
              break;
            case 'click':
              status = 'clicked';
              break;
            case 'bounce':
            case 'blocked':
            case 'dropped':
              status = 'bounced';
              break;
            case 'spamreport':
            case 'unsubscribe':
              status = 'failed';
              break;
            default:
              status = 'sent';
          }

          updateDeliveryStatus(sg_message_id, status, {
            sendgridEvent: eventType,
            email,
            timestamp,
            reason: event.reason,
            url: event.url // For click events
          });
        }
      });

      logger.info('Processed SendGrid webhook events', {
        eventCount: events.length
      });

      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      logger.error('SendGrid webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ADF routes
  app.use("/api/adf", adfRoutes);
}
