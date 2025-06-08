import logger from "../../utils/logger";
import {
  CommunicationChannel,
  DeliveryStatus,
  ChannelMessage,
} from "../channel-routing-service";

export interface ChannelDeliveryResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export interface ChannelConfiguration {
  dealershipId: number;
  channel: CommunicationChannel;
  credentials?: Record<string, string>;
  settings?: Record<string, any>;
}

/**
 * Abstract base class for all channel handlers
 */
export abstract class BaseChannelHandler {
  protected channel: CommunicationChannel;
  protected configuration: ChannelConfiguration;

  constructor(
    channel: CommunicationChannel,
    configuration: ChannelConfiguration,
  ) {
    this.channel = channel;
    this.configuration = configuration;
  }

  /**
   * Send message through this channel
   */
  abstract sendMessage(message: ChannelMessage): Promise<ChannelDeliveryResult>;

  /**
   * Check if channel is available for sending
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Validate message format for this channel
   */
  abstract validateMessage(message: ChannelMessage): boolean;

  /**
   * Get channel-specific delivery status from external ID
   */
  abstract getDeliveryStatus(
    externalMessageId: string,
  ): Promise<DeliveryStatus>;

  /**
   * Handle incoming messages/responses (webhooks)
   */
  abstract handleIncomingMessage(data: any): Promise<void>;

  /**
   * Get channel capabilities and limitations
   */
  abstract getChannelInfo(): {
    maxMessageLength: number;
    supportsRichContent: boolean;
    supportsAttachments: boolean;
    requiresPhoneNumber: boolean;
    requiresEmailAddress: boolean;
  };

  /**
   * Update configuration
   */
  updateConfiguration(configuration: ChannelConfiguration): void {
    this.configuration = configuration;
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfiguration(): Omit<ChannelConfiguration, "credentials"> {
    const { credentials, ...safeConfig } = this.configuration;
    return safeConfig;
  }

  /**
   * Common logging helper
   */
  protected log(
    level: "info" | "warn" | "error",
    message: string,
    context?: any,
  ): void {
    const logContext = {
      channel: this.channel,
      dealership: this.configuration.dealershipId,
      ...context,
    };

    switch (level) {
      case "info":
        logger.info(`[${this.channel.toUpperCase()}] ${message}`, logContext);
        break;
      case "warn":
        logger.warn(`[${this.channel.toUpperCase()}] ${message}`, logContext);
        break;
      case "error":
        logger.error(
          `[${this.channel.toUpperCase()}] ${message}`,
          undefined,
          logContext,
        );
        break;
    }
  }

  /**
   * Common error handling
   */
  protected handleError(error: unknown, context?: any): ChannelDeliveryResult {
    const err = error instanceof Error ? error : new Error(String(error));

    this.log("error", `Failed to send message: ${err.message}`, {
      ...context,
      stack: err.stack,
    });

    return {
      success: false,
      error: err.message,
      errorCode: "CHANNEL_ERROR",
    };
  }

  /**
   * Validate common message requirements
   */
  protected validateCommonMessage(message: ChannelMessage): {
    valid: boolean;
    error?: string;
  } {
    if (!message.content || message.content.trim().length === 0) {
      return { valid: false, error: "Message content is required" };
    }

    if (!message.customerId) {
      return { valid: false, error: "Customer ID is required" };
    }

    if (!message.dealershipId) {
      return { valid: false, error: "Dealership ID is required" };
    }

    return { valid: true };
  }

  /**
   * Sanitize message content for the channel
   */
  protected sanitizeContent(content: string, maxLength?: number): string {
    let sanitized = content.trim();

    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + "...";
    }

    return sanitized;
  }

  /**
   * Format message metadata
   */
  protected formatMetadata(message: ChannelMessage): Record<string, any> {
    return {
      messageId: message.id,
      conversationId: message.conversationId,
      customerId: message.customerId,
      dealershipId: message.dealershipId,
      urgencyLevel: message.urgencyLevel,
      leadSource: message.leadSource,
      timestamp: new Date().toISOString(),
      ...message.metadata,
    };
  }
}
