import { EventEmitter } from "events";
import logger from "../utils/logger";
import db from "../db";
import { eq } from "drizzle-orm";
import { adfLeads } from "@shared/index";
import { openai } from "./openai";
import { sendAdfResponseEmail } from "./email-service";

export interface AdfResponseResult {
  leadId: number;
  responseText: string;
  latencyMs: number;
  metadata: {
    customerName: string;
    vehicleInfo: string;
    dealershipId: number;
    responseType: "initial" | "follow_up";
  };
}

export interface AdfResponseError {
  leadId: number;
  error: string;
  latencyMs: number;
}

export class AdfResponseOrchestrator extends EventEmitter {
  private processingQueue: Map<number, Promise<void>> = new Map();
  private maxConcurrentProcessing: number = 5;

  constructor() {
    super();
    this.setupErrorHandling();
  }

  /**
   * Process a new ADF lead and generate AI response
   */
  async processLead(leadId: number): Promise<void> {
    // Check if already processing this lead
    if (this.processingQueue.has(leadId)) {
      logger.debug("Lead already being processed", { leadId });
      return;
    }

    // Check queue size
    if (this.processingQueue.size >= this.maxConcurrentProcessing) {
      logger.warn("Processing queue full, delaying lead processing", {
        leadId,
        queueSize: this.processingQueue.size,
      });

      // Wait for a slot to open up
      await this.waitForQueueSpace();
    }

    // Add to processing queue
    const processingPromise = this.processLeadInternal(leadId);
    this.processingQueue.set(leadId, processingPromise);

    try {
      await processingPromise;
    } finally {
      this.processingQueue.delete(leadId);
    }
  }

  /**
   * Internal lead processing logic
   */
  private async processLeadInternal(leadId: number): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info("Starting ADF lead processing", { leadId });

      // Get lead data
      const lead = await this.getLeadData(leadId);
      if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
      }

      // Generate AI response
      const responseText = await this.generateAiResponse(lead);

      const latencyMs = Date.now() - startTime;

      // Create response result
      const result: AdfResponseResult = {
        leadId,
        responseText,
        latencyMs,
        metadata: {
          customerName: lead.customerFullName,
          vehicleInfo: this.formatVehicleInfo(lead),
          dealershipId: lead.dealershipId || 1,
          responseType: "initial",
        },
      };

      logger.info("AI response generated successfully", {
        leadId,
        latencyMs,
        responseLength: responseText.length,
      });

      this.emit("aiResponseGenerated", result);
      this.emit("lead.response.ready", result);

      // Send email response if customer email is available
      if (lead.customerEmail) {
        try {
          const emailSent = await sendAdfResponseEmail(
            lead.customerEmail,
            lead.customerFirstName || lead.customerFullName || "there",
            responseText,
            this.formatVehicleInfo(lead),
          );

          if (emailSent) {
            logger.info("ADF response email sent successfully", {
              leadId,
              customerEmail: lead.customerEmail,
            });
            this.emit("emailResponseSent", {
              leadId,
              email: lead.customerEmail,
            });
          } else {
            logger.warn("Failed to send ADF response email", {
              leadId,
              customerEmail: lead.customerEmail,
            });
          }
        } catch (emailError) {
          logger.error("Error sending ADF response email", {
            leadId,
            customerEmail: lead.customerEmail,
            error:
              emailError instanceof Error
                ? emailError.message
                : String(emailError),
          });
        }
      } else {
        logger.info("No customer email available for ADF response", { leadId });
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to process ADF lead", {
        leadId,
        error: errorMessage,
        latencyMs,
      });

      const errorResult: AdfResponseError = {
        leadId,
        error: errorMessage,
        latencyMs,
      };

      this.emit("aiResponseFailed", errorResult);
    }
  }

  /**
   * Get lead data from database
   */
  private async getLeadData(leadId: number): Promise<any | null> {
    try {
      const lead = await db.query.adfLeads.findFirst({
        where: eq(adfLeads.id, leadId),
      });

      return lead || null;
    } catch (error) {
      logger.error("Failed to get lead data", {
        leadId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Generate AI response for the lead
   */
  private async generateAiResponse(lead: any): Promise<string> {
    try {
      const prompt = this.buildResponsePrompt(lead);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional automotive sales assistant responding to a new lead inquiry. 
            Your goal is to be helpful, professional, and encourage the customer to visit or call the dealership.
            Keep responses concise but warm and personalized. Always include next steps.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("No response generated from OpenAI");
      }

      return responseText.trim();
    } catch (error) {
      logger.error("Failed to generate AI response", {
        leadId: lead.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to template response
      return this.getFallbackResponse(lead);
    }
  }

  /**
   * Build prompt for AI response generation
   */
  private buildResponsePrompt(lead: any): string {
    const vehicleInfo = this.formatVehicleInfo(lead);
    const customerName =
      lead.customerFirstName || lead.customerFullName || "there";

    let prompt = `Generate a professional response to a new automotive lead inquiry.

Customer Information:
- Name: ${lead.customerFullName}
- Email: ${lead.customerEmail || "Not provided"}
- Phone: ${lead.customerPhone || "Not provided"}`;

    if (vehicleInfo) {
      prompt += `\n- Vehicle Interest: ${vehicleInfo}`;
    }

    if (lead.comments) {
      prompt += `\n- Comments: ${lead.comments}`;
    }

    if (lead.vendorName) {
      prompt += `\n- Lead Source: ${lead.vendorName}`;
    }

    prompt += `\n\nGenerate a personalized response that:
1. Thanks ${customerName} for their interest
2. Acknowledges their specific vehicle interest (if provided)
3. Offers to help with their automotive needs
4. Provides clear next steps (call or visit)
5. Maintains a professional but friendly tone

Keep the response under 200 words and include a call-to-action.`;

    return prompt;
  }

  /**
   * Format vehicle information for display
   */
  private formatVehicleInfo(lead: any): string {
    const parts = [];

    if (lead.vehicleYear) parts.push(lead.vehicleYear);
    if (lead.vehicleMake) parts.push(lead.vehicleMake);
    if (lead.vehicleModel) parts.push(lead.vehicleModel);
    if (lead.vehicleTrim) parts.push(lead.vehicleTrim);

    return parts.join(" ") || "Vehicle inquiry";
  }

  /**
   * Get fallback response when AI generation fails
   */
  private getFallbackResponse(lead: any): string {
    const customerName = lead.customerFirstName || "there";
    const vehicleInfo = this.formatVehicleInfo(lead);

    return `Hi ${customerName},

Thank you for your interest in ${vehicleInfo}! We appreciate you reaching out to us.

Our team is excited to help you find the perfect vehicle that meets your needs. We have a great selection and competitive pricing that I'd love to discuss with you.

Would you like to schedule a time to visit our showroom or speak with one of our sales specialists? You can reach us directly at your convenience.

We look forward to hearing from you soon!

Best regards,
Sales Team`;
  }

  /**
   * Wait for queue space to become available
   */
  private async waitForQueueSpace(): Promise<void> {
    return new Promise((resolve) => {
      const checkQueue = () => {
        if (this.processingQueue.size < this.maxConcurrentProcessing) {
          resolve();
        } else {
          setTimeout(checkQueue, 1000); // Check every second
        }
      };
      checkQueue();
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.on("error", (error) => {
      logger.error("ADF Response Orchestrator error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    queueSize: number;
    maxConcurrentProcessing: number;
    isProcessing: boolean;
  } {
    return {
      queueSize: this.processingQueue.size,
      maxConcurrentProcessing: this.maxConcurrentProcessing,
      isProcessing: this.processingQueue.size > 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: { maxConcurrentProcessing?: number }): void {
    if (config.maxConcurrentProcessing !== undefined) {
      this.maxConcurrentProcessing = Math.max(
        1,
        config.maxConcurrentProcessing,
      );
      logger.info("Updated max concurrent processing", {
        maxConcurrentProcessing: this.maxConcurrentProcessing,
      });
    }
  }
}

// Export singleton instance
export const adfResponseOrchestrator = new AdfResponseOrchestrator();
