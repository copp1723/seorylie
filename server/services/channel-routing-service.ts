import logger from '../utils/logger';
import db from '../db';
import { sql } from 'drizzle-orm';

export type CommunicationChannel = 'email' | 'sms' | 'web_chat' | 'phone';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked';
export type RoutingReason = 'user_preference' | 'channel_unavailable' | 'fallback' | 'business_hours' | 'urgency_level';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent';

export interface ChannelMessage {
  id?: string;
  conversationId?: number;
  customerId: number;
  dealershipId: number;
  content: string;
  subject?: string;
  metadata?: Record<string, any>;
  urgencyLevel?: UrgencyLevel;
  leadSource?: string;
}

export interface ChannelRoutingResult {
  selectedChannel: CommunicationChannel;
  reason: RoutingReason;
  fallbackChannels: CommunicationChannel[];
  deliveryAttemptId: string;
}

export interface CustomerChannelPreference {
  customerId: number;
  dealership: number;
  channel: CommunicationChannel;
  preferenceType: 'preferred' | 'allowed' | 'blocked';
  priority: number;
  activeHoursStart?: string;
  activeHoursEnd?: string;
  timezone?: string;
}

export interface ChannelRule {
  dealershipId: number;
  leadSource?: string;
  urgencyLevel: UrgencyLevel;
  channel: CommunicationChannel;
  priority: number;
  maxAttempts: number;
  retryDelayMinutes: number;
  businessHoursOnly: boolean;
}

// Strategy pattern for channel selection
abstract class ChannelSelectionStrategy {
  abstract selectChannel(
    message: ChannelMessage,
    availableChannels: CommunicationChannel[],
    customerPreferences: CustomerChannelPreference[],
    dealershipRules: ChannelRule[]
  ): Promise<CommunicationChannel | null>;
}

// Priority-based selection (default strategy)
class PriorityChannelStrategy extends ChannelSelectionStrategy {
  async selectChannel(
    message: ChannelMessage,
    availableChannels: CommunicationChannel[],
    customerPreferences: CustomerChannelPreference[],
    dealershipRules: ChannelRule[]
  ): Promise<CommunicationChannel | null> {

    // Filter customer preferences for allowed/preferred channels
    const allowedPreferences = customerPreferences.filter(
      pref => pref.preferenceType !== 'blocked' && availableChannels.includes(pref.channel)
    );

    // If customer has preferred channels, use those first
    const preferredChannels = allowedPreferences
      .filter(pref => pref.preferenceType === 'preferred')
      .sort((a, b) => a.priority - b.priority);

    if (preferredChannels.length > 0) {
      return preferredChannels[0].channel;
    }

    // Otherwise, use dealership rules based on lead source and urgency
    const applicableRules = dealershipRules.filter(rule =>
      availableChannels.includes(rule.channel) &&
      (!rule.leadSource || rule.leadSource === message.leadSource) &&
      rule.urgencyLevel === (message.urgencyLevel || 'normal')
    ).sort((a, b) => a.priority - b.priority);

    if (applicableRules.length > 0) {
      return applicableRules[0].channel;
    }

    // Fallback to first available channel
    return availableChannels[0] || null;
  }
}

// Urgency-based selection strategy
class UrgencyChannelStrategy extends ChannelSelectionStrategy {
  async selectChannel(
    message: ChannelMessage,
    availableChannels: CommunicationChannel[],
    customerPreferences: CustomerChannelPreference[],
    dealershipRules: ChannelRule[]
  ): Promise<CommunicationChannel | null> {

    const urgency = message.urgencyLevel || 'normal';

    // For urgent messages, prefer real-time channels
    if (urgency === 'urgent') {
      const realtimeChannels: CommunicationChannel[] = ['sms', 'web_chat', 'phone'];
      const urgentChannel = availableChannels.find(ch => realtimeChannels.includes(ch));
      if (urgentChannel) return urgentChannel;
    }

    // For high priority, prefer SMS or phone
    if (urgency === 'high') {
      const highPriorityChannels: CommunicationChannel[] = ['sms', 'phone'];
      const highChannel = availableChannels.find(ch => highPriorityChannels.includes(ch));
      if (highChannel) return highChannel;
    }

    // For normal/low priority, email is fine
    return availableChannels.find(ch => ch === 'email') || availableChannels[0] || null;
  }
}

export class ChannelRoutingService {
  private strategy: ChannelSelectionStrategy;

  constructor(strategy?: ChannelSelectionStrategy) {
    this.strategy = strategy || new PriorityChannelStrategy();
  }

  /**
   * Route a message to the appropriate channel
   */
  async routeMessage(message: ChannelMessage): Promise<ChannelRoutingResult> {
    try {
      // Get customer preferences
      const customerPreferences = await this.getCustomerChannelPreferences(
        message.customerId,
        message.dealershipId
      );

      // Get dealership routing rules
      const dealershipRules = await this.getDealershipChannelRules(
        message.dealershipId,
        message.leadSource,
        message.urgencyLevel
      );

      // Get available channels (based on business hours, maintenance, etc.)
      const availableChannels = await this.getAvailableChannels(message.dealershipId);

      // Use strategy to select primary channel
      const selectedChannel = await this.strategy.selectChannel(
        message,
        availableChannels,
        customerPreferences,
        dealershipRules
      );

      if (!selectedChannel) {
        throw new Error('No available channels for message delivery');
      }

      // Determine routing reason
      const reason = this.determineRoutingReason(
        selectedChannel,
        customerPreferences,
        dealershipRules,
        availableChannels
      );

      // Get fallback channels
      const fallbackChannels = await this.getFallbackChannels(
        message.dealershipId,
        selectedChannel,
        availableChannels
      );

      // Create delivery attempt record
      const deliveryAttemptId = await this.createDeliveryAttempt({
        messageId: message.id || crypto.randomUUID(),
        conversationId: message.conversationId,
        customerId: message.customerId,
        dealershipId: message.dealershipId,
        channel: selectedChannel,
        routingReason: reason,
        content: message.content
      });

      logger.info('Message routed successfully', {
        deliveryAttemptId,
        selectedChannel,
        reason,
        customerId: message.customerId,
        dealershipId: message.dealershipId
      });

      return {
        selectedChannel,
        reason,
        fallbackChannels,
        deliveryAttemptId
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to route message', err, {
        customerId: message.customerId,
        dealershipId: message.dealershipId
      });
      throw err;
    }
  }

  /**
   * Update delivery status for a message
   */
  async updateDeliveryStatus(
    deliveryAttemptId: string,
    status: DeliveryStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date()
      };

      if (status === 'delivered') {
        updateData.delivery_timestamp = new Date();
      } else if (status === 'opened') {
        updateData.opened_timestamp = new Date();
      } else if (status === 'clicked') {
        updateData.clicked_timestamp = new Date();
      }

      if (metadata) {
        updateData.metadata = JSON.stringify(metadata);
      }

      await db.execute(sql`
        UPDATE message_delivery_attempts
        SET status = ${status},
            delivery_timestamp = ${updateData.delivery_timestamp || null},
            opened_timestamp = ${updateData.opened_timestamp || null},
            clicked_timestamp = ${updateData.clicked_timestamp || null},
            metadata = COALESCE(${updateData.metadata}, metadata)
        WHERE id = ${deliveryAttemptId}
      `);

      logger.info('Delivery status updated', {
        deliveryAttemptId,
        status,
        metadata
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update delivery status', err, {
        deliveryAttemptId,
        status
      });
      throw err;
    }
  }

  /**
   * Handle delivery failure and trigger fallback
   */
  async handleDeliveryFailure(
    deliveryAttemptId: string,
    error: string,
    errorCode?: string
  ): Promise<ChannelRoutingResult | null> {
    try {
      // Update the failed attempt
      await db.execute(sql`
        UPDATE message_delivery_attempts
        SET status = 'failed',
            error_message = ${error},
            error_code = ${errorCode || null}
        WHERE id = ${deliveryAttemptId}
      `);

      // Get the original message details
      const attemptResult = await db.execute(sql`
        SELECT * FROM message_delivery_attempts
        WHERE id = ${deliveryAttemptId}
      `);

      if (!attemptResult.rows || attemptResult.rows.length === 0) {
        throw new Error('Delivery attempt not found');
      }

      const attempt = attemptResult.rows[0] as any;

      // Check if we should try fallback
      const fallbackChannels = await this.getFallbackChannels(
        attempt.dealership_id,
        attempt.channel,
        await this.getAvailableChannels(attempt.dealership_id)
      );

      if (fallbackChannels.length > 0 && attempt.attempt_number < 3) {
        // Try next fallback channel
        const fallbackChannel = fallbackChannels[0];

        const fallbackAttemptId = await this.createDeliveryAttempt({
          messageId: attempt.message_id,
          conversationId: attempt.conversation_id,
          customerId: attempt.customer_id,
          dealershipId: attempt.dealership_id,
          channel: fallbackChannel,
          routingReason: 'fallback',
          content: '', // Content would be retrieved from original message
          attemptNumber: attempt.attempt_number + 1
        });

        logger.info('Fallback channel triggered', {
          originalAttempt: deliveryAttemptId,
          fallbackAttempt: fallbackAttemptId,
          fallbackChannel
        });

        return {
          selectedChannel: fallbackChannel,
          reason: 'fallback',
          fallbackChannels: fallbackChannels.slice(1),
          deliveryAttemptId: fallbackAttemptId
        };
      }

      logger.warn('No fallback channels available', {
        deliveryAttemptId,
        error,
        errorCode
      });

      return null;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle delivery failure', err, {
        deliveryAttemptId
      });
      throw err;
    }
  }

  /**
   * Get channel performance metrics
   */
  async getChannelPerformanceMetrics(
    dealershipId: number,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT
          channel,
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
          COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened_count,
          COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
          AVG(
            CASE WHEN delivery_timestamp IS NOT NULL
            THEN EXTRACT(EPOCH FROM (delivery_timestamp - created_at))/60
            END
          ) as avg_delivery_minutes,
          AVG(
            CASE WHEN response_timestamp IS NOT NULL
            THEN EXTRACT(EPOCH FROM (response_timestamp - created_at))/60
            END
          ) as avg_response_minutes
        FROM message_delivery_attempts
        WHERE dealership_id = ${dealershipId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        GROUP BY channel
        ORDER BY total_attempts DESC
      `);

      return result.rows || [];

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get channel performance metrics', err, {
        dealershipId,
        startDate,
        endDate
      });
      throw err;
    }
  }

  /**
   * Set strategy for channel selection
   */
  setStrategy(strategy: ChannelSelectionStrategy): void {
    this.strategy = strategy;
  }

  // Private helper methods
  private async getCustomerChannelPreferences(
    customerId: number,
    dealershipId: number
  ): Promise<CustomerChannelPreference[]> {
    const result = await db.execute(sql`
      SELECT * FROM customer_channel_preferences
      WHERE customer_id = ${customerId}
      AND dealership_id = ${dealershipId}
      ORDER BY priority ASC
    `);

    return (result.rows || []).map((row: any) => ({
      customerId: row.customer_id,
      dealership: row.dealership_id,
      channel: row.channel,
      preferenceType: row.preference_type,
      priority: row.priority,
      activeHoursStart: row.active_hours_start,
      activeHoursEnd: row.active_hours_end,
      timezone: row.timezone
    }));
  }

  private async getDealershipChannelRules(
    dealershipId: number,
    leadSource?: string,
    urgencyLevel?: UrgencyLevel
  ): Promise<ChannelRule[]> {
    const result = await db.execute(sql`
      SELECT * FROM dealership_channel_rules
      WHERE dealership_id = ${dealershipId}
      AND active = true
      AND (lead_source IS NULL OR lead_source = ${leadSource || null})
      AND urgency_level = ${urgencyLevel || 'normal'}
      ORDER BY priority ASC
    `);

    return (result || []).map((row: any) => ({
      dealershipId: row.dealership_id,
      leadSource: row.lead_source,
      urgencyLevel: row.urgency_level,
      channel: row.channel,
      priority: row.priority,
      maxAttempts: row.max_attempts,
      retryDelayMinutes: row.retry_delay_minutes,
      businessHoursOnly: row.business_hours_only
    }));
  }

  private async getAvailableChannels(dealershipId: number): Promise<CommunicationChannel[]> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 8);

    const result = await db.execute(sql`
      SELECT DISTINCT channel
      FROM channel_availability
      WHERE dealership_id = ${dealershipId}
      AND active = true
      AND day_of_week = ${dayOfWeek}
      AND start_time <= ${currentTime}::TIME
      AND end_time >= ${currentTime}::TIME
    `);

    return (result.rows || []).map((row: any) => row.channel as CommunicationChannel);
  }

  private async getFallbackChannels(
    dealershipId: number,
    primaryChannel: CommunicationChannel,
    availableChannels: CommunicationChannel[]
  ): Promise<CommunicationChannel[]> {
    const result = await db.execute(sql`
      SELECT fallback_channel
      FROM channel_fallback_chains
      WHERE dealership_id = ${dealershipId}
      AND primary_channel = ${primaryChannel}
      AND active = true
      ORDER BY fallback_delay_minutes ASC
    `);

    const fallbacks = (result.rows || [])
      .map((row: any) => row.fallback_channel as CommunicationChannel)
      .filter(channel => availableChannels.includes(channel));

    return fallbacks;
  }

  private determineRoutingReason(
    selectedChannel: CommunicationChannel,
    customerPreferences: CustomerChannelPreference[],
    dealershipRules: ChannelRule[],
    availableChannels: CommunicationChannel[]
  ): RoutingReason {

    // Check if it's a user preference
    const preferredChannels = customerPreferences.filter(
      pref => pref.preferenceType === 'preferred'
    );

    if (preferredChannels.some(pref => pref.channel === selectedChannel)) {
      return 'user_preference';
    }

    // Check if it's based on business hours
    if (availableChannels.length < 3) { // Assuming we normally have 3+ channels
      return 'business_hours';
    }

    // Check if it's based on dealership rules
    if (dealershipRules.some(rule => rule.channel === selectedChannel)) {
      return 'urgency_level';
    }

    return 'channel_unavailable';
  }

  private async createDeliveryAttempt(params: {
    messageId: string;
    conversationId?: number;
    customerId: number;
    dealershipId: number;
    channel: CommunicationChannel;
    routingReason: RoutingReason;
    content: string;
    attemptNumber?: number;
  }): Promise<string> {

    const contentHash = require('crypto')
      .createHash('sha256')
      .update(params.content)
      .digest('hex');

    const result = await db.execute(sql`
      INSERT INTO message_delivery_attempts (
        message_id, conversation_id, customer_id, dealership_id,
        channel, routing_reason, attempt_number, content_hash, status
      )
      VALUES (
        ${params.messageId},
        ${params.conversationId || null},
        ${params.customerId},
        ${params.dealershipId},
        ${params.channel},
        ${params.routingReason},
        ${params.attemptNumber || 1},
        ${contentHash},
        'pending'
      )
      RETURNING id
    `);

    return result[0]?.id;
  }
}

// Export strategy classes for testing and custom implementations
export { ChannelSelectionStrategy, PriorityChannelStrategy, UrgencyChannelStrategy };

// Export singleton instance
export const channelRoutingService = new ChannelRoutingService();