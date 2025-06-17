/**
 * SEO Agent - Handles conversational intake of SEO requests
 *
 * This agent processes natural language requests for SEO services,
 * extracts structured data using OpenAI, and maintains white-label branding.
 *
 * It handles all four types of SEO requests:
 * - Custom pages
 * - Blog posts
 * - Google Business Profile updates
 * - Maintenance tasks
 *
 * It also provides an install/onboarding form skill for new dealerships.
 */

import { v4 as uuidv4 } from "uuid";
import { OpenAI } from "openai";
import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
import pino from "pino";
import { zodToJsonSchema } from "zod-to-json-schema";

// Import schemas and prompts from seo-schema package
import {
  SeoRequestSchema,
  PageRequestSchema,
  BlogRequestSchema,
  GBPRequestSchema,
  MaintenanceRequestSchema,
  InstallProfileSchema,
  SeoRequest,
  PageRequest,
  BlogRequest,
  GBPRequest,
  MaintenanceRequest,
  InstallProfile,
  SeoPrompts,
  determineRequestType,
} from "@rylie-seo/seo-schema";

// Logger configuration
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: ["openai.apiKey", "body.api_key", "*.password", "*.token"],
});

// Redis connection
const createRedisClient = () => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  });
};

/**
 * SEO Agent class for handling SEO requests
 */
export class SEOAgent {
  private openai: OpenAI;
  private redis: Redis;
  private seoTaskQueue: Queue;
  private queueEvents: QueueEvents;
  private sandboxId: string;
  private dealershipName: string;

  /**
   * Constructor for SEOAgent
   *
   * @param openaiApiKey - OpenAI API key
   * @param sandboxId - Sandbox ID for tenant isolation
   * @param dealershipName - Dealership name for personalization
   * @param redisClient - Optional Redis client (will create one if not provided)
   */
  constructor(
    openaiApiKey: string,
    sandboxId: string,
    dealershipName: string,
    redisClient?: Redis,
  ) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    this.redis = redisClient || createRedisClient();
    this.sandboxId = sandboxId;
    this.dealershipName = dealershipName;

    // Initialize BullMQ queue for SEO tasks
    this.seoTaskQueue = new Queue("seo.tasks", {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    this.queueEvents = new QueueEvents("seo.tasks", {
      connection: this.redis,
    });

    // Set up queue event listeners
    this.setupQueueEvents();

    logger.info({
      msg: "SEOAgent initialized",
      sandboxId,
      dealershipName,
    });
  }

  /**
   * Set up queue event listeners
   */
  private setupQueueEvents() {
    this.queueEvents.on("completed", ({ jobId, returnvalue }) => {
      logger.info({
        msg: "SEO task completed",
        jobId,
        result: returnvalue,
      });
    });

    this.queueEvents.on("failed", ({ jobId, failedReason }) => {
      logger.error({
        msg: "SEO task failed",
        jobId,
        error: failedReason,
      });
    });
  }

  /**
   * Process a natural language SEO request
   *
   * @param userMessage - Natural language request from user
   * @returns Structured SEO request and agent response
   */
  async processSEORequest(userMessage: string): Promise<{
    seoRequest: SeoRequest | null;
    response: string;
    success: boolean;
  }> {
    try {
      // Determine request type to use the appropriate prompt
      const requestType = determineRequestType(userMessage);
      logger.info({
        msg: "Determined SEO request type",
        requestType,
        sandboxId: this.sandboxId,
      });

      // Generate appropriate prompt based on request type
      const prompt = SeoPrompts.generate(userMessage);

      // Add dealership context to system message
      const systemMessage = `${prompt.systemMessage}\n\nYou are assisting ${this.dealershipName}. Remember to personalize your responses accordingly.`;

      // Convert function definitions to proper format
      const functions = prompt.functionDefinitions.map((fn: any) => ({
        name: fn.name,
        description: fn.description,
        parameters: zodToJsonSchema(fn.parameters),
      }));

      // Call OpenAI with function calling
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt.userMessage },
        ],
        functions,
        function_call: "auto",
        temperature: 0.7,
      });

      // Extract function call if available
      const functionCall = response.choices[0]?.message?.function_call;
      const assistantMessage = response.choices[0]?.message?.content || "";

      // If function was called, parse the arguments
      if (functionCall && functionCall.name && functionCall.arguments) {
        const args = JSON.parse(functionCall.arguments);

        // Validate with Zod schema based on request type
        let validatedRequest: SeoRequest | null = null;

        switch (requestType) {
          case "page":
            validatedRequest = PageRequestSchema.parse(args);
            break;
          case "blog":
            validatedRequest = BlogRequestSchema.parse(args);
            break;
          case "gbp":
            validatedRequest = GBPRequestSchema.parse(args);
            break;
          case "maintenance":
            validatedRequest = MaintenanceRequestSchema.parse(args);
            break;
          default:
            // Try to parse with the general schema
            validatedRequest = SeoRequestSchema.safeParse(args).success
              ? SeoRequestSchema.parse(args)
              : null;
        }

        if (validatedRequest) {
          // Add request ID and sandbox ID if not present
          const requestId = uuidv4();
          const enrichedRequest = {
            ...validatedRequest,
            id: requestId,
            sandbox_id: this.sandboxId,
          };

          // Queue the task for processing
          await this.queueSEOTask(enrichedRequest);

          logger.info({
            msg: "SEO request processed successfully",
            requestType,
            requestId,
            sandboxId: this.sandboxId,
          });

          return {
            seoRequest: enrichedRequest,
            response:
              assistantMessage ||
              `Your ${requestType} request has been submitted successfully. We'll start working on it right away!`,
            success: true,
          };
        }
      }

      // If we couldn't extract a structured request, return the assistant's message
      return {
        seoRequest: null,
        response:
          assistantMessage ||
          "I'm having trouble understanding your request. Could you provide more details about what SEO service you need?",
        success: false,
      };
    } catch (error) {
      logger.error({
        msg: "Error processing SEO request",
        error,
        sandboxId: this.sandboxId,
      });

      return {
        seoRequest: null,
        response:
          "I apologize, but I encountered an error processing your request. Please try again or provide more specific details about your SEO needs.",
        success: false,
      };
    }
  }

  /**
   * Queue a SEO task for processing
   *
   * @param seoRequest - Validated SEO request
   * @returns Job ID
   */
  private async queueSEOTask(
    seoRequest: SeoRequest & { id: string; sandbox_id: string },
  ): Promise<string> {
    const jobId = `seo-task-${seoRequest.id}`;

    await this.seoTaskQueue.add(
      "process-seo-request",
      {
        request: seoRequest,
        dealershipName: this.dealershipName,
        timestamp: new Date().toISOString(),
      },
      {
        jobId,
        removeOnComplete: true,
      },
    );

    return jobId;
  }

  /**
   * Process an installation/onboarding form request
   *
   * @param userMessage - Natural language request or empty for initial prompt
   * @returns Structured install profile and agent response
   */
  async processInstallForm(userMessage: string = ""): Promise<{
    installProfile: InstallProfile | null;
    response: string;
    success: boolean;
    completed: boolean;
  }> {
    try {
      // Generate install form prompt
      const prompt = SeoPrompts.install(userMessage);

      // Add dealership context to system message
      const systemMessage = `${prompt.systemMessage}\n\nYou are setting up SEO services for ${this.dealershipName}. Remember to personalize your responses accordingly.`;

      // Call OpenAI with function calling
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt.userMessage },
        ],
        functions: [
          {
            name: "collectInstallProfile",
            description:
              "Collect installation and onboarding information for SEO setup",
            parameters: InstallProfileSchema.shape,
          },
        ],
        function_call: "auto",
        temperature: 0.7,
      });

      // Extract function call if available
      const functionCall = response.choices[0]?.message?.function_call;
      const assistantMessage = response.choices[0]?.message?.content || "";

      // If function was called, parse the arguments
      if (
        functionCall &&
        functionCall.name === "collectInstallProfile" &&
        functionCall.arguments
      ) {
        const args = JSON.parse(functionCall.arguments);

        // Check if we have all required fields
        const profileResult = InstallProfileSchema.safeParse({
          ...args,
          sandbox_id: this.sandboxId,
        });

        if (profileResult.success) {
          // All required fields are present - form is complete
          const installProfile = profileResult.data;

          // Queue the install profile for processing
          await this.queueInstallProfile(installProfile);

          logger.info({
            msg: "Install profile completed successfully",
            sandboxId: this.sandboxId,
          });

          return {
            installProfile,
            response:
              assistantMessage ||
              "Thank you for completing the SEO onboarding form! We'll start setting up your SEO services right away.",
            success: true,
            completed: true,
          };
        } else {
          // Form is incomplete - return partial profile and continue conversation
          return {
            installProfile: null,
            response:
              assistantMessage ||
              "Let's continue setting up your SEO services. I need a few more details to complete your profile.",
            success: true,
            completed: false,
          };
        }
      }

      // If we couldn't extract a structured profile, return the assistant's message
      return {
        installProfile: null,
        response:
          assistantMessage ||
          "Let's get started with setting up your SEO services. I'll guide you through the process step by step.",
        success: true,
        completed: false,
      };
    } catch (error) {
      logger.error({
        msg: "Error processing install form",
        error,
        sandboxId: this.sandboxId,
      });

      return {
        installProfile: null,
        response:
          "I apologize, but I encountered an error processing your onboarding information. Let's try again with the basic details.",
        success: false,
        completed: false,
      };
    }
  }

  /**
   * Queue an install profile for processing
   *
   * @param installProfile - Validated install profile
   * @returns Job ID
   */
  private async queueInstallProfile(
    installProfile: InstallProfile,
  ): Promise<string> {
    const jobId = `install-profile-${this.sandboxId}-${new Date().getTime()}`;

    await this.seoTaskQueue.add(
      "process-install-profile",
      {
        profile: installProfile,
        dealershipName: this.dealershipName,
        timestamp: new Date().toISOString(),
      },
      {
        jobId,
        removeOnComplete: true,
      },
    );

    return jobId;
  }

  /**
   * Process a GA4 report for the dealership
   *
   * @param reportData - GA4 report data
   * @returns Agent response with insights
   */
  async processGA4Report(reportData: any): Promise<{
    response: string;
    success: boolean;
  }> {
    try {
      // Generate GA4 report prompt
      const prompt = SeoPrompts.ga4Report(reportData);

      // Add dealership context to system message
      const systemMessage = `${prompt.systemMessage}\n\nYou are analyzing GA4 data for ${this.dealershipName}. Remember to personalize your insights accordingly.`;

      // Call OpenAI
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt.userMessage },
        ],
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0]?.message?.content || "";

      logger.info({
        msg: "GA4 report processed successfully",
        sandboxId: this.sandboxId,
      });

      return {
        response:
          assistantMessage ||
          "I've analyzed your GA4 data and found some interesting insights. Would you like me to focus on any specific aspect of your website performance?",
        success: true,
      };
    } catch (error) {
      logger.error({
        msg: "Error processing GA4 report",
        error,
        sandboxId: this.sandboxId,
      });

      return {
        response:
          "I apologize, but I encountered an error analyzing your GA4 data. Please try again later or provide a different date range.",
        success: false,
      };
    }
  }

  /**
   * Process a publish notification
   *
   * @param publishData - Publish notification data
   * @returns Agent response
   */
  async processPublishNotification(publishData: any): Promise<{
    response: string;
    success: boolean;
  }> {
    try {
      // Generate publish notification prompt
      const prompt = SeoPrompts.publishNotification(publishData);

      // Add dealership context to system message
      const systemMessage = `${prompt.systemMessage}\n\nYou are notifying ${this.dealershipName} about published content. Remember to personalize your notification accordingly.`;

      // Call OpenAI
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt.userMessage },
        ],
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0]?.message?.content || "";

      logger.info({
        msg: "Publish notification processed successfully",
        publishType: publishData.publish_type,
        sandboxId: this.sandboxId,
      });

      return {
        response:
          assistantMessage ||
          `Great news! Your ${publishData.publish_type} has been published and is now live at ${publishData.published_url}.`,
        success: true,
      };
    } catch (error) {
      logger.error({
        msg: "Error processing publish notification",
        error,
        sandboxId: this.sandboxId,
      });

      return {
        response:
          "I'm pleased to inform you that your content has been published successfully!",
        success: false,
      };
    }
  }

  /**
   * Clean up resources when done
   */
  async cleanup(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info({
        msg: "SEOAgent resources cleaned up",
        sandboxId: this.sandboxId,
      });
    } catch (error) {
      logger.error({
        msg: "Error cleaning up SEOAgent resources",
        error,
        sandboxId: this.sandboxId,
      });
    }
  }
}

/**
 * Factory function to create a SEOAgent instance
 *
 * @param openaiApiKey - OpenAI API key
 * @param sandboxId - Sandbox ID for tenant isolation
 * @param dealershipName - Dealership name for personalization
 * @param redisClient - Optional Redis client
 * @returns SEOAgent instance
 */
export function createSEOAgent(
  openaiApiKey: string,
  sandboxId: string,
  dealershipName: string,
  redisClient?: Redis,
): SEOAgent {
  return new SEOAgent(openaiApiKey, sandboxId, dealershipName, redisClient);
}

export default SEOAgent;
