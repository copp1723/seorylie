/**
 * Simplified ADF Email Listener Service
 *
 * A lightweight implementation that provides the core email listening functionality
 * without complex database dependencies, suitable for the current implementation phase.
 */

import { EventEmitter } from "events";
import logger from "../utils/logger";

export interface AdfEmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    size: number;
  }>;
  rawContent: string;
}

export interface AdfEmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  markSeen: boolean;
  searchCriteria: string[];
  pollingInterval: number;
}

export class AdfEmailListener extends EventEmitter {
  private isListening: boolean = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private config: AdfEmailConfig | null = null;

  constructor() {
    super();
    logger.info("ADF Email Listener initialized (simplified mode)");
  }

  /**
   * Start listening for ADF emails
   */
  async start(config?: AdfEmailConfig): Promise<void> {
    if (this.isListening) {
      logger.warn("ADF Email Listener is already running");
      return;
    }

    try {
      // Use provided config or default
      this.config = config || this.getDefaultConfig();

      if (!this.config) {
        logger.warn(
          "No email configuration provided, email listening disabled",
        );
        return;
      }

      this.isListening = true;
      logger.info("ADF Email Listener started successfully", {
        host: this.config.host,
        user: this.config.user,
        pollingInterval: this.config.pollingInterval,
      });

      // Start polling (simplified - would connect to actual email server in full implementation)
      this.startPolling();

      this.emit("started");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to start ADF Email Listener", {
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Stop listening for emails
   */
  async stop(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      this.isListening = false;

      if (this.pollingTimer) {
        clearTimeout(this.pollingTimer);
        this.pollingTimer = null;
      }

      logger.info("ADF Email Listener stopped");
      this.emit("stopped");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error stopping ADF Email Listener", { error: err.message });
      throw err;
    }
  }

  /**
   * Get default email configuration from environment variables
   */
  private getDefaultConfig(): AdfEmailConfig | null {
    const host = process.env.ADF_EMAIL_HOST;
    const user = process.env.ADF_EMAIL_USER;
    const password = process.env.ADF_EMAIL_PASSWORD;

    if (!host || !user || !password) {
      logger.info("ADF email environment variables not configured", {
        hasHost: !!host,
        hasUser: !!user,
        hasPassword: !!password,
      });
      return null;
    }

    return {
      host,
      port: parseInt(process.env.ADF_EMAIL_PORT || "993"),
      user,
      password,
      tls: process.env.ADF_EMAIL_TLS !== "false",
      markSeen: process.env.ADF_EMAIL_MARK_SEEN !== "false",
      searchCriteria: ["UNSEEN"],
      pollingInterval: parseInt(
        process.env.ADF_EMAIL_POLLING_INTERVAL || "300000",
      ), // 5 minutes
    };
  }

  /**
   * Start polling for new emails (simplified implementation)
   */
  private startPolling(): void {
    if (!this.isListening || !this.config) {
      return;
    }

    this.pollingTimer = setTimeout(() => {
      this.checkForNewEmails()
        .then(() => {
          // Schedule next poll
          if (this.isListening) {
            this.startPolling();
          }
        })
        .catch((error) => {
          logger.error("Error during email polling", {
            error: error instanceof Error ? error.message : String(error),
          });

          // Continue polling even if there was an error
          if (this.isListening) {
            this.startPolling();
          }
        });
    }, this.config.pollingInterval);
  }

  /**
   * Check for new emails (simplified - logs activity but doesn't actually connect to email)
   */
  private async checkForNewEmails(): Promise<void> {
    if (!this.config) {
      return;
    }

    // In a full implementation, this would:
    // 1. Connect to the email server
    // 2. Search for unseen emails
    // 3. Parse emails and check for XML attachments
    // 4. Emit 'email' events for ADF emails found

    logger.debug("Checking for new ADF emails", {
      host: this.config.host,
      user: this.config.user,
    });

    // Simulate finding emails occasionally for testing
    if (Math.random() < 0.1) {
      // 10% chance
      const simulatedEmail: AdfEmailData = {
        id: `simulated_${Date.now()}`,
        subject: "Test ADF Lead",
        from: "test@example.com",
        to: this.config.user,
        date: new Date(),
        attachments: [
          {
            filename: "test-lead.xml",
            content: Buffer.from("<adf><prospect></prospect></adf>"),
            contentType: "application/xml",
            size: 35,
          },
        ],
        rawContent: "This is a simulated ADF email for testing purposes.",
      };

      logger.info("Simulated ADF email found", {
        subject: simulatedEmail.subject,
        from: simulatedEmail.from,
      });

      this.emit("email", simulatedEmail);
    }
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      isListening: this.isListening,
      hasConfig: !!this.config,
      configHost: this.config?.host || "not configured",
      mode: "simplified",
    };
  }

  /**
   * Check if the service is running
   */
  isRunning(): boolean {
    return this.isListening;
  }
}

// Export singleton instance
export const adfEmailListener = new AdfEmailListener();
export default adfEmailListener;
