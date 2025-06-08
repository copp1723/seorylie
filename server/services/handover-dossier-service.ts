import { eq, and, desc } from "drizzle-orm";
import db from "../db";
import {
  conversations,
  messages,
  handovers,
  leads,
  customers,
  dealershipHandoverSettings,
  type Message,
  type HandoverReason,
} from "../../shared/lead-management-schema";
import { dealerships } from "../../shared/schema";
import logger from "../utils/logger";
import openaiService from "./openai";
import { prometheusMetrics } from "./prometheus-metrics";

// Define the structure of the handover dossier
export interface HandoverDossier {
  customerName: string;
  customerContact: string;
  conversationSummary: string;
  customerInsights: Array<{
    key: string;
    value: string;
    confidence: number;
  }>;
  vehicleInterests: Array<{
    make: string;
    model: string;
    year: number;
    confidence: number;
  }>;
  suggestedApproach: string;
  urgency: "low" | "medium" | "high";
  escalationReason: string;

  // Additional fields added in post-processing
  leadScore?: number;
  slaDeadline?: string;
  dealershipName?: string;
  dealershipContact?: string;
  handoverTimestamp?: string;
  generatedAt?: string;
}

// Define options for dossier generation
export interface DossierGenerationOptions {
  includeFullConversation?: boolean;
  maxMessagesToInclude?: number;
  includeDealershipContext?: boolean;
  timeoutMs?: number;
}

/**
 * HandoverDossierService - Generates rich sales dossiers for lead handovers
 */
export class HandoverDossierService {
  /**
   * Generate a handover dossier for a conversation
   */
  async generateDossier(
    conversationId: string,
    leadId: string,
    reason: HandoverReason,
    options: DossierGenerationOptions = {},
  ): Promise<HandoverDossier> {
    const startTime = Date.now();
    let dealershipId: number | null = null;

    try {
      logger.info("Generating handover dossier", {
        conversationId,
        leadId,
        reason,
      });

      // Set default options
      const {
        includeFullConversation = false,
        maxMessagesToInclude = 20,
        includeDealershipContext = true,
        timeoutMs = 10000, // 10 seconds timeout
      } = options;

      // Fetch conversation and lead data
      const conversationData = await this.fetchConversationData(conversationId);
      if (!conversationData) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      dealershipId = conversationData.dealershipId;

      // Fetch lead data
      const leadData = await this.fetchLeadData(leadId);
      if (!leadData) {
        throw new Error(`Lead not found: ${leadId}`);
      }

      // Fetch conversation messages
      const conversationMessages = await this.fetchConversationMessages(
        conversationId,
        includeFullConversation ? undefined : maxMessagesToInclude,
      );

      if (conversationMessages.length === 0) {
        throw new Error(
          `No messages found for conversation: ${conversationId}`,
        );
      }

      // Prepare conversation history text
      const conversationHistory =
        this.formatConversationHistory(conversationMessages);

      // Prepare customer scenario text
      const customerScenario = this.prepareCustomerScenario(
        conversationData,
        leadData,
      );

      // Call OpenAI to generate the dossier with timeout
      const dossierPromise = openaiService.generateHandoverDossier(
        conversationHistory,
        customerScenario,
      );

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Dossier generation timed out")),
          timeoutMs,
        );
      });

      // Race between dossier generation and timeout
      const dossierResult = (await Promise.race([
        dossierPromise,
        timeoutPromise,
      ])) as HandoverDossier;

      // Post-process the dossier
      const enrichedDossier = await this.postProcessDossier(
        dossierResult,
        dealershipId,
        leadData,
        reason,
      );

      // Validate dossier structure
      this.validateDossier(enrichedDossier);

      // Record metrics
      const generationTime = Date.now() - startTime;
      prometheusMetrics.recordDossierGenerationTime(generationTime, {
        dealership_id: dealershipId.toString(),
        status: "success",
      });

      logger.info("Handover dossier generated successfully", {
        conversationId,
        leadId,
        generationTime,
      });

      return enrichedDossier;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Handover dossier generation failed", {
        error: err.message,
        conversationId,
        leadId,
      });

      // Record failure metrics
      const generationTime = Date.now() - startTime;
      if (dealershipId) {
        prometheusMetrics.recordDossierGenerationTime(generationTime, {
          dealership_id: dealershipId.toString(),
          status: "failed",
        });
      }

      // Generate fallback dossier
      return this.generateFallbackDossier(conversationId, leadId, reason, err);
    }
  }

  /**
   * Fetch conversation data from the database
   */
  private async fetchConversationData(conversationId: string) {
    try {
      const results = await db
        .select({
          conversation: conversations,
          customer: customers,
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      return {
        ...results[0].conversation,
        customer: results[0].customer,
      };
    } catch (error) {
      logger.error("Error fetching conversation data", {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
      });
      return null;
    }
  }

  /**
   * Fetch lead data from the database
   */
  private async fetchLeadData(leadId: string) {
    try {
      const results = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error("Error fetching lead data", {
        error: error instanceof Error ? error.message : String(error),
        leadId,
      });
      return null;
    }
  }

  /**
   * Fetch conversation messages from the database
   */
  private async fetchConversationMessages(
    conversationId: string,
    limit?: number,
  ): Promise<Message[]> {
    try {
      let query = db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt));

      if (limit) {
        query = query.limit(limit);
      }

      const results = await query;

      // Return in chronological order (oldest first)
      return results.reverse();
    } catch (error) {
      logger.error("Error fetching conversation messages", {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
      });
      return [];
    }
  }

  /**
   * Format conversation history into a text format for the AI
   */
  private formatConversationHistory(messages: Message[]): string {
    // Check if we need to summarize (more than 200 messages is too large for prompt)
    if (messages.length > 200) {
      // Take first 50 and last 150 messages
      const firstMessages = messages.slice(0, 50);
      const lastMessages = messages.slice(-150);
      messages = [...firstMessages, ...lastMessages];
    }

    // Format messages into a conversation transcript
    const formattedMessages = messages.map((message) => {
      const sender = this.getSenderName(message);
      return `${sender}: ${message.content}`;
    });

    return formattedMessages.join("\n\n");
  }

  /**
   * Get a human-readable sender name for a message
   */
  private getSenderName(message: Message): string {
    if (message.senderName) {
      return message.senderName;
    }

    switch (message.sender) {
      case "customer":
        return "Customer";
      case "ai":
        return "AI Assistant";
      case "agent":
        return "Sales Agent";
      case "system":
        return "System";
      default:
        return "Unknown";
    }
  }

  /**
   * Prepare customer scenario text for the AI
   */
  private prepareCustomerScenario(
    conversationData: any,
    leadData: any,
  ): string {
    const customerName =
      conversationData.customer?.fullName || "Unknown Customer";
    const leadStatus = leadData?.status || "unknown";
    const leadSource = leadData?.source || "unknown";

    let scenario = `Customer: ${customerName}\n`;
    scenario += `Lead Status: ${leadStatus}\n`;
    scenario += `Source: ${leadSource}\n`;

    if (leadData?.description) {
      scenario += `Initial Inquiry: ${leadData.description}\n`;
    }

    if (leadData?.requestType) {
      scenario += `Request Type: ${leadData.requestType}\n`;
    }

    if (leadData?.timeframe) {
      scenario += `Timeframe: ${leadData.timeframe}\n`;
    }

    return scenario;
  }

  /**
   * Post-process the dossier to add additional information
   */
  private async postProcessDossier(
    dossier: HandoverDossier,
    dealershipId: number,
    leadData: any,
    reason: HandoverReason,
  ): Promise<HandoverDossier> {
    // Clone the dossier to avoid modifying the original
    const enrichedDossier = { ...dossier };

    // Add lead score
    enrichedDossier.leadScore = leadData?.leadScore || 0;

    // Add handover timestamp
    enrichedDossier.handoverTimestamp = new Date().toISOString();
    enrichedDossier.generatedAt = new Date().toLocaleString();

    // Fetch dealership settings
    const dealershipSettings = await this.fetchDealershipSettings(dealershipId);

    // Add dealership information
    if (dealershipSettings) {
      // Calculate SLA deadline based on dealership settings
      const slaHours = dealershipSettings.slaHours || 24;
      const slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + slaHours);

      enrichedDossier.slaDeadline = slaDeadline.toLocaleString();

      // Fetch dealership information
      const dealershipInfo = await this.fetchDealershipInfo(dealershipId);
      if (dealershipInfo) {
        enrichedDossier.dealershipName = dealershipInfo.name;
        enrichedDossier.dealershipContact =
          dealershipInfo.contactEmail || dealershipInfo.contactPhone || "";
      }
    }

    // Ensure escalation reason is set
    if (!enrichedDossier.escalationReason) {
      enrichedDossier.escalationReason = this.formatHandoverReason(reason);
    }

    return enrichedDossier;
  }

  /**
   * Fetch dealership handover settings
   */
  private async fetchDealershipSettings(dealershipId: number) {
    try {
      const results = await db
        .select()
        .from(dealershipHandoverSettings)
        .where(eq(dealershipHandoverSettings.dealershipId, dealershipId))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error("Error fetching dealership handover settings", {
        error: error instanceof Error ? error.message : String(error),
        dealershipId,
      });
      return null;
    }
  }

  /**
   * Fetch dealership information
   */
  private async fetchDealershipInfo(dealershipId: number) {
    try {
      const results = await db
        .select()
        .from(dealerships)
        .where(eq(dealerships.id, dealershipId))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error("Error fetching dealership information", {
        error: error instanceof Error ? error.message : String(error),
        dealershipId,
      });
      return null;
    }
  }

  /**
   * Format handover reason for human readability
   */
  private formatHandoverReason(reason: HandoverReason): string {
    const reasonMap: Record<HandoverReason, string> = {
      complex_inquiry: "Complex Customer Inquiry",
      technical_issue: "Technical Issue",
      pricing_negotiation: "Pricing Negotiation",
      customer_request: "Customer Requested Agent",
      ai_limitation: "AI Limitation",
      policy_escalation: "Policy Escalation",
      other: "Other Reason",
    };

    return reasonMap[reason] || String(reason);
  }

  /**
   * Validate the structure of a dossier
   */
  private validateDossier(dossier: HandoverDossier): void {
    const requiredFields = [
      "customerName",
      "conversationSummary",
      "customerInsights",
      "vehicleInterests",
      "suggestedApproach",
      "urgency",
    ];

    const missingFields = requiredFields.filter(
      (field) => !dossier[field as keyof HandoverDossier],
    );

    if (missingFields.length > 0) {
      logger.warn("Dossier is missing required fields", { missingFields });
    }

    // Validate insights have required structure
    if (dossier.customerInsights && Array.isArray(dossier.customerInsights)) {
      for (const insight of dossier.customerInsights) {
        if (
          !insight.key ||
          !insight.value ||
          typeof insight.confidence !== "number"
        ) {
          logger.warn("Invalid customer insight structure", { insight });
        }
      }
    }

    // Validate vehicle interests have required structure
    if (dossier.vehicleInterests && Array.isArray(dossier.vehicleInterests)) {
      for (const vehicle of dossier.vehicleInterests) {
        if (
          !vehicle.make ||
          !vehicle.model ||
          typeof vehicle.confidence !== "number"
        ) {
          logger.warn("Invalid vehicle interest structure", { vehicle });
        }
      }
    }
  }

  /**
   * Generate a fallback dossier when the AI generation fails
   */
  private async generateFallbackDossier(
    conversationId: string,
    leadId: string,
    reason: HandoverReason,
    error: Error,
  ): Promise<HandoverDossier> {
    logger.info("Generating fallback dossier", {
      conversationId,
      leadId,
      error: error.message,
    });

    try {
      // Fetch basic conversation and lead data
      const conversationData = await this.fetchConversationData(conversationId);
      const leadData = await this.fetchLeadData(leadId);
      const dealershipId = conversationData?.dealershipId;

      // Create minimal dossier with available information
      const fallbackDossier: HandoverDossier = {
        customerName:
          conversationData?.customer?.fullName || "Unknown Customer",
        customerContact:
          conversationData?.customer?.email ||
          conversationData?.customer?.phone ||
          "Not provided",
        conversationSummary:
          "Unable to generate detailed summary due to technical issues. Please review the conversation history.",
        customerInsights: [
          {
            key: "Error",
            value: `Dossier generation failed: ${error.message}`,
            confidence: 0,
          },
        ],
        vehicleInterests: [],
        suggestedApproach:
          "Review conversation history and contact the customer to understand their needs.",
        urgency: "medium",
        escalationReason: this.formatHandoverReason(reason),
        generatedAt: new Date().toLocaleString(),
        handoverTimestamp: new Date().toISOString(),
      };

      // Add lead score if available
      if (leadData) {
        fallbackDossier.leadScore = leadData.leadScore || 0;

        // Add basic vehicle interest if available in lead data
        if (leadData.vehicleInterestId) {
          fallbackDossier.vehicleInterests.push({
            make: "Unknown",
            model: "Unknown",
            year: new Date().getFullYear(),
            confidence: 0.5,
          });
        }
      }

      // Add dealership info if available
      if (dealershipId) {
        const dealershipSettings =
          await this.fetchDealershipSettings(dealershipId);
        const dealershipInfo = await this.fetchDealershipInfo(dealershipId);

        if (dealershipSettings) {
          const slaHours = dealershipSettings.slaHours || 24;
          const slaDeadline = new Date();
          slaDeadline.setHours(slaDeadline.getHours() + slaHours);
          fallbackDossier.slaDeadline = slaDeadline.toLocaleString();
        }

        if (dealershipInfo) {
          fallbackDossier.dealershipName = dealershipInfo.name;
          fallbackDossier.dealershipContact =
            dealershipInfo.contactEmail || dealershipInfo.contactPhone || "";
        }
      }

      return fallbackDossier;
    } catch (fallbackError) {
      // If even the fallback fails, return an absolute minimal dossier
      logger.error("Fallback dossier generation failed", {
        error:
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
        conversationId,
        leadId,
      });

      return {
        customerName: "Unknown Customer",
        customerContact: "Not available",
        conversationSummary:
          "Dossier generation failed. Please review the conversation manually.",
        customerInsights: [
          {
            key: "Error",
            value: "Complete dossier generation failure",
            confidence: 0,
          },
        ],
        vehicleInterests: [],
        suggestedApproach: "Contact customer to understand their needs.",
        urgency: "medium",
        escalationReason: this.formatHandoverReason(reason),
        generatedAt: new Date().toLocaleString(),
        handoverTimestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
export const handoverDossierService = new HandoverDossierService();
export default handoverDossierService;
