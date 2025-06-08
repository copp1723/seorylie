/**
 * Email Router Service
 * Routes emails between SendGrid webhook and legacy IMAP systems
 * Allows gradual migration with feature flags and per-dealership routing
 */

import logger from "../utils/logger";
import { sendGridService } from "./sendgrid-service";

export type EmailProcessor = "sendgrid" | "legacy" | "both";

export interface EmailRoutingConfig {
  globalProcessor: EmailProcessor;
  dealershipRouting: Record<string, EmailProcessor>;
  enableLogging: boolean;
  enableComparison: boolean; // Compare results between systems during migration
}

export interface ProcessedEmail {
  id: string;
  processor: EmailProcessor;
  success: boolean;
  processingTime: number;
  error?: string;
  metadata?: any;
}

export class EmailRouterService {
  private config: EmailRoutingConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): EmailRoutingConfig {
    return {
      globalProcessor:
        (process.env.EMAIL_PROCESSOR as EmailProcessor) || "legacy",
      dealershipRouting: this.parseDealershipRouting(),
      enableLogging: process.env.EMAIL_ROUTING_LOGGING === "true",
      enableComparison: process.env.EMAIL_COMPARISON_MODE === "true",
    };
  }

  private parseDealershipRouting(): Record<string, EmailProcessor> {
    const routing = process.env.DEALERSHIP_EMAIL_ROUTING;
    if (!routing) return {};

    try {
      return JSON.parse(routing);
    } catch (error) {
      logger.warn(
        "Invalid DEALERSHIP_EMAIL_ROUTING format, using empty routing",
      );
      return {};
    }
  }

  /**
   * Determine which processor should handle an email
   */
  getProcessorForEmail(emailTo: string, dealershipId?: string): EmailProcessor {
    // Per-dealership routing takes precedence
    if (dealershipId && this.config.dealershipRouting[dealershipId]) {
      return this.config.dealershipRouting[dealershipId];
    }

    // Check if email address has specific routing
    const emailProcessor = this.getProcessorByEmail(emailTo);
    if (emailProcessor) {
      return emailProcessor;
    }

    // Fall back to global processor
    return this.config.globalProcessor;
  }

  private getProcessorByEmail(emailTo: string): EmailProcessor | null {
    // Extract dealership identifier from email
    // e.g., crm_kunes-rv-fox-valley@localwerksmail.com -> kunes-rv-fox-valley
    const match = emailTo.match(/crm_([^@]+)@/);
    if (match) {
      const dealershipSlug = match[1];
      return this.config.dealershipRouting[dealershipSlug] || null;
    }
    return null;
  }

  /**
   * Process email through appropriate system(s)
   */
  async processEmail(emailData: {
    to: string;
    from: string;
    subject: string;
    content: any;
    attachments?: any[];
    dealershipId?: string;
  }): Promise<ProcessedEmail[]> {
    const processor = this.getProcessorForEmail(
      emailData.to,
      emailData.dealershipId,
    );
    const results: ProcessedEmail[] = [];

    if (this.config.enableLogging) {
      logger.info("Email routing decision", {
        to: emailData.to,
        from: emailData.from,
        processor,
        dealershipId: emailData.dealershipId,
      });
    }

    // Process with determined processor
    if (processor === "sendgrid") {
      const result = await this.processThroughSendGrid(emailData);
      results.push(result);
    } else if (processor === "legacy") {
      const result = await this.processThroughLegacy(emailData);
      results.push(result);
    } else if (processor === "both") {
      // Process through both systems for comparison
      const [sendgridResult, legacyResult] = await Promise.allSettled([
        this.processThroughSendGrid(emailData),
        this.processThroughLegacy(emailData),
      ]);

      if (sendgridResult.status === "fulfilled") {
        results.push(sendgridResult.value);
      } else {
        results.push({
          id: `sendgrid-${Date.now()}`,
          processor: "sendgrid",
          success: false,
          processingTime: 0,
          error: sendgridResult.reason?.message,
        });
      }

      if (legacyResult.status === "fulfilled") {
        results.push(legacyResult.value);
      } else {
        results.push({
          id: `legacy-${Date.now()}`,
          processor: "legacy",
          success: false,
          processingTime: 0,
          error: legacyResult.reason?.message,
        });
      }

      // Compare results if both succeeded
      if (this.config.enableComparison && results.length === 2) {
        this.compareResults(results[0], results[1], emailData);
      }
    }

    return results;
  }

  private async processThroughSendGrid(
    emailData: any,
  ): Promise<ProcessedEmail> {
    const startTime = Date.now();

    try {
      // This would integrate with your existing ADF processing
      // For now, just simulate the processing

      if (!sendGridService.isConfigured()) {
        throw new Error("SendGrid not configured");
      }

      // Process email through SendGrid webhook logic
      // This is where you'd call your ADF processing service

      const processingTime = Date.now() - startTime;

      return {
        id: `sendgrid-${Date.now()}`,
        processor: "sendgrid",
        success: true,
        processingTime,
        metadata: {
          source: "sendgrid_webhook",
        },
      };
    } catch (error) {
      return {
        id: `sendgrid-${Date.now()}`,
        processor: "sendgrid",
        success: false,
        processingTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async processThroughLegacy(emailData: any): Promise<ProcessedEmail> {
    const startTime = Date.now();

    try {
      // This would integrate with your existing IMAP/email processing
      // For now, just simulate the processing

      const processingTime = Date.now() - startTime;

      return {
        id: `legacy-${Date.now()}`,
        processor: "legacy",
        success: true,
        processingTime,
        metadata: {
          source: "legacy_imap",
        },
      };
    } catch (error) {
      return {
        id: `legacy-${Date.now()}`,
        processor: "legacy",
        success: false,
        processingTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private compareResults(
    sendgridResult: ProcessedEmail,
    legacyResult: ProcessedEmail,
    emailData: any,
  ) {
    logger.info("Email processing comparison", {
      email: emailData.to,
      sendgrid: {
        success: sendgridResult.success,
        time: sendgridResult.processingTime,
      },
      legacy: {
        success: legacyResult.success,
        time: legacyResult.processingTime,
      },
      timeDifference:
        sendgridResult.processingTime - legacyResult.processingTime,
    });

    // Log if there are discrepancies
    if (sendgridResult.success !== legacyResult.success) {
      logger.warn("Email processing result mismatch", {
        email: emailData.to,
        sendgridSuccess: sendgridResult.success,
        legacySuccess: legacyResult.success,
        sendgridError: sendgridResult.error,
        legacyError: legacyResult.error,
      });
    }
  }

  /**
   * Update routing configuration
   */
  updateDealershipRouting(dealershipId: string, processor: EmailProcessor) {
    this.config.dealershipRouting[dealershipId] = processor;

    logger.info("Updated dealership email routing", {
      dealershipId,
      processor,
    });
  }

  /**
   * Get current routing status
   */
  getRoutingStatus() {
    return {
      globalProcessor: this.config.globalProcessor,
      dealershipRouting: this.config.dealershipRouting,
      sendgridConfigured: sendGridService.isConfigured(),
      comparison_mode: this.config.enableComparison,
    };
  }
}

// Export singleton instance
export const emailRouter = new EmailRouterService();
export default emailRouter;
