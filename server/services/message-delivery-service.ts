import logger from '../utils/logger';
import {
  channelRoutingService,
  ChannelMessage,
  ChannelRoutingResult,
  DeliveryStatus,
  CommunicationChannel
} from './channel-routing-service';
import { channelFactory } from './channel-handlers/channel-factory';
import { BaseChannelHandler } from './channel-handlers/base-channel-handler';

export interface MessageDeliveryRequest {
  conversationId?: number;
  customerId: number;
  dealershipId: number;
  content: string;
  subject?: string;
  urgencyLevel?: 'low' | 'normal' | 'high' | 'urgent';
  leadSource?: string;
  preferredChannel?: CommunicationChannel;
  metadata?: Record<string, any>;
}

export interface MessageDeliveryResponse {
  success: boolean;
  deliveryAttemptId: string;
  selectedChannel: CommunicationChannel;
  externalMessageId?: string;
  fallbackChannels: CommunicationChannel[];
  error?: string;
}

export interface DeliveryStatusUpdate {
  deliveryAttemptId: string;
  status: DeliveryStatus;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Comprehensive message delivery service that handles channel routing,
 * message sending, delivery tracking, and fallback logic
 */
export class MessageDeliveryService {
  private static instance: MessageDeliveryService;

  private constructor() {}

  static getInstance(): MessageDeliveryService {
    if (!MessageDeliveryService.instance) {
      MessageDeliveryService.instance = new MessageDeliveryService();
    }
    return MessageDeliveryService.instance;
  }

  /**
   * Send a message through the optimal channel
   */
  async sendMessage(request: MessageDeliveryRequest): Promise<MessageDeliveryResponse> {
    try {
      logger.info('Processing message delivery request', {
        customerId: request.customerId,
        dealershipId: request.dealershipId,
        urgencyLevel: request.urgencyLevel,
        preferredChannel: request.preferredChannel,
        leadSource: request.leadSource
      });

      // Prepare channel message
      const channelMessage: ChannelMessage = {
        id: crypto.randomUUID(),
        conversationId: request.conversationId,
        customerId: request.customerId,
        dealershipId: request.dealershipId,
        content: request.content,
        subject: request.subject,
        urgencyLevel: request.urgencyLevel || 'normal',
        leadSource: request.leadSource,
        metadata: request.metadata || {}
      };

      // Route message to appropriate channel
      const routingResult = await channelRoutingService.routeMessage(channelMessage);

      // Get channel handler
      const handler = await channelFactory.getChannelHandler(
        request.dealershipId,
        routingResult.selectedChannel
      );

      if (!handler) {
        throw new Error(`No handler available for channel: ${routingResult.selectedChannel}`);
      }

      // Check if channel is available
      const isAvailable = await handler.isAvailable();
      if (!isAvailable) {
        return await this.handleChannelUnavailable(channelMessage, routingResult);
      }

      // Send message through selected channel
      const deliveryResult = await handler.sendMessage(channelMessage);

      if (deliveryResult.success) {
        // Update delivery status
        await channelRoutingService.updateDeliveryStatus(
          routingResult.deliveryAttemptId,
          'sent',
          deliveryResult.metadata
        );

        logger.info('Message sent successfully', {
          deliveryAttemptId: routingResult.deliveryAttemptId,
          channel: routingResult.selectedChannel,
          externalMessageId: deliveryResult.externalMessageId
        });

        return {
          success: true,
          deliveryAttemptId: routingResult.deliveryAttemptId,
          selectedChannel: routingResult.selectedChannel,
          externalMessageId: deliveryResult.externalMessageId,
          fallbackChannels: routingResult.fallbackChannels
        };

      } else {
        // Handle delivery failure
        return await this.handleDeliveryFailure(
          channelMessage,
          routingResult,
          deliveryResult.error || 'Unknown delivery error'
        );
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send message', err, {
        customerId: request.customerId,
        dealershipId: request.dealershipId
      });

      return {
        success: false,
        deliveryAttemptId: '',
        selectedChannel: 'email',
        fallbackChannels: [],
        error: err.message
      };
    }
  }

  /**
   * Send message to multiple channels simultaneously (for urgent messages)
   */
  async sendMultiChannelMessage(request: MessageDeliveryRequest): Promise<MessageDeliveryResponse[]> {
    try {
      const channels: CommunicationChannel[] = ['email', 'sms', 'web_chat'];
      const promises = channels.map(async (channel) => {
        const channelRequest = { ...request, preferredChannel: channel };
        return await this.sendMessage(channelRequest);
      });

      const results = await Promise.allSettled(promises);

      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            success: false,
            deliveryAttemptId: '',
            selectedChannel: channels[index],
            fallbackChannels: [],
            error: result.reason?.message || 'Failed to send'
          };
        }
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send multi-channel message', err);
      throw err;
    }
  }

  /**
   * Update delivery status for a message
   */
  async updateDeliveryStatus(update: DeliveryStatusUpdate): Promise<void> {
    try {
      await channelRoutingService.updateDeliveryStatus(
        update.deliveryAttemptId,
        update.status,
        update.metadata
      );

      logger.info('Delivery status updated', {
        deliveryAttemptId: update.deliveryAttemptId,
        status: update.status,
        timestamp: update.timestamp
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update delivery status', err, {
        deliveryAttemptId: update.deliveryAttemptId,
        status: update.status
      });
      throw err;
    }
  }

  /**
   * Get delivery status for a message
   */
  async getDeliveryStatus(deliveryAttemptId: string): Promise<DeliveryStatus | null> {
    try {
      // This would query the database for the current status
      // For now, return a placeholder
      return 'delivered'; // Would be implemented with actual database query

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get delivery status', err, {
        deliveryAttemptId
      });
      return null;
    }
  }

  /**
   * Retry failed message delivery
   */
  async retryDelivery(deliveryAttemptId: string): Promise<MessageDeliveryResponse> {
    try {
      // Get original message details from database
      // This would reconstruct the original request and retry

      logger.info('Retrying message delivery', { deliveryAttemptId });

      // For now, return a placeholder response
      throw new Error('Retry functionality not yet implemented');

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to retry delivery', err, { deliveryAttemptId });
      throw err;
    }
  }

  /**
   * Get channel performance metrics
   */
  async getChannelMetrics(
    dealershipId: number,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      return await channelRoutingService.getChannelPerformanceMetrics(
        dealershipId,
        startDate,
        endDate
      );

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get channel metrics', err, {
        dealershipId,
        startDate,
        endDate
      });
      throw err;
    }
  }

  /**
   * Bulk send messages (for campaigns, notifications, etc.)
   */
  async sendBulkMessages(
    requests: MessageDeliveryRequest[],
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      failureThreshold?: number;
    } = {}
  ): Promise<{
    successful: MessageDeliveryResponse[];
    failed: Array<{ request: MessageDeliveryRequest; error: string }>;
    totalProcessed: number;
  }> {

    const {
      batchSize = 10,
      delayBetweenBatches = 1000, // 1 second
      failureThreshold = 0.5 // Stop if 50% failure rate
    } = options;

    const successful: MessageDeliveryResponse[] = [];
    const failed: Array<{ request: MessageDeliveryRequest; error: string }> = [];

    logger.info('Starting bulk message delivery', {
      totalMessages: requests.length,
      batchSize,
      delayBetweenBatches
    });

    // Process in batches
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      // Check failure threshold
      const totalProcessed = successful.length + failed.length;
      if (totalProcessed > 0) {
        const failureRate = failed.length / totalProcessed;
        if (failureRate > failureThreshold) {
          logger.error('Bulk send stopped due to high failure rate', {
            failureRate,
            failureThreshold,
            totalProcessed
          });
          break;
        }
      }

      // Process batch
      const batchPromises = batch.map(async (request) => {
        try {
          const result = await this.sendMessage(request);
          if (result.success) {
            successful.push(result);
          } else {
            failed.push({ request, error: result.error || 'Unknown error' });
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          failed.push({ request, error: err.message });
        }
      });

      await Promise.allSettled(batchPromises);

      // Delay between batches (except for last batch)
      if (i + batchSize < requests.length) {
        await new Promise<void>((resolve: () => void) => setTimeout(resolve, delayBetweenBatches));
      }

      logger.info('Batch processed', {
        batchNumber: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        successfulInBatch: successful.length - (i === 0 ? 0 : successful.length),
        failedInBatch: failed.length - (i === 0 ? 0 : failed.length)
      });
    }

    const result = {
      successful,
      failed,
      totalProcessed: successful.length + failed.length
    };

    logger.info('Bulk message delivery completed', {
      totalRequested: requests.length,
      totalProcessed: result.totalProcessed,
      successful: successful.length,
      failed: failed.length,
      successRate: successful.length / result.totalProcessed
    });

    return result;
  }

  // Private helper methods
  private async handleChannelUnavailable(
    message: ChannelMessage,
    routingResult: ChannelRoutingResult
  ): Promise<MessageDeliveryResponse> {

    logger.warn('Primary channel unavailable, attempting fallback', {
      primaryChannel: routingResult.selectedChannel,
      fallbackChannels: routingResult.fallbackChannels
    });

    if (routingResult.fallbackChannels.length === 0) {
      return {
        success: false,
        deliveryAttemptId: routingResult.deliveryAttemptId,
        selectedChannel: routingResult.selectedChannel,
        fallbackChannels: [],
        error: 'No fallback channels available'
      };
    }

    // Try first fallback channel
    const fallbackChannel = routingResult.fallbackChannels[0];
    const fallbackHandler = await channelFactory.getChannelHandler(
      message.dealershipId,
      fallbackChannel
    );

    if (!fallbackHandler) {
      return {
        success: false,
        deliveryAttemptId: routingResult.deliveryAttemptId,
        selectedChannel: routingResult.selectedChannel,
        fallbackChannels: routingResult.fallbackChannels,
        error: `Fallback channel ${fallbackChannel} not available`
      };
    }

    const isAvailable = await fallbackHandler.isAvailable();
    if (!isAvailable) {
      // Try next fallback or fail
      const remainingFallbacks = routingResult.fallbackChannels.slice(1);
      if (remainingFallbacks.length > 0) {
        // Recursively try next fallback
        const updatedRouting = { ...routingResult, fallbackChannels: remainingFallbacks };
        return await this.handleChannelUnavailable(message, updatedRouting);
      } else {
        return {
          success: false,
          deliveryAttemptId: routingResult.deliveryAttemptId,
          selectedChannel: routingResult.selectedChannel,
          fallbackChannels: [],
          error: 'All fallback channels unavailable'
        };
      }
    }

    // Send via fallback channel
    const deliveryResult = await fallbackHandler.sendMessage(message);

    if (deliveryResult.success) {
      await channelRoutingService.updateDeliveryStatus(
        routingResult.deliveryAttemptId,
        'sent',
        { ...deliveryResult.metadata, fallbackChannel }
      );

      return {
        success: true,
        deliveryAttemptId: routingResult.deliveryAttemptId,
        selectedChannel: fallbackChannel,
        externalMessageId: deliveryResult.externalMessageId,
        fallbackChannels: routingResult.fallbackChannels.slice(1)
      };
    } else {
      return await this.handleDeliveryFailure(
        message,
        { ...routingResult, selectedChannel: fallbackChannel },
        deliveryResult.error || 'Fallback delivery failed'
      );
    }
  }

  private async handleDeliveryFailure(
    message: ChannelMessage,
    routingResult: ChannelRoutingResult,
    error: string
  ): Promise<MessageDeliveryResponse> {

    logger.error('Message delivery failed', undefined, {
      deliveryAttemptId: routingResult.deliveryAttemptId,
      channel: routingResult.selectedChannel,
      error
    });

    // Try fallback through routing service
    const fallbackResult = await channelRoutingService.handleDeliveryFailure(
      routingResult.deliveryAttemptId,
      error
    );

    if (fallbackResult) {
      // Recursive call to try fallback
      const fallbackHandler = await channelFactory.getChannelHandler(
        message.dealershipId,
        fallbackResult.selectedChannel
      );

      if (fallbackHandler) {
        const deliveryResult = await fallbackHandler.sendMessage(message);

        if (deliveryResult.success) {
          return {
            success: true,
            deliveryAttemptId: fallbackResult.deliveryAttemptId,
            selectedChannel: fallbackResult.selectedChannel,
            externalMessageId: deliveryResult.externalMessageId,
            fallbackChannels: fallbackResult.fallbackChannels
          };
        }
      }
    }

    return {
      success: false,
      deliveryAttemptId: routingResult.deliveryAttemptId,
      selectedChannel: routingResult.selectedChannel,
      fallbackChannels: routingResult.fallbackChannels,
      error
    };
  }
}

// Export singleton instance
export const messageDeliveryService = MessageDeliveryService.getInstance();