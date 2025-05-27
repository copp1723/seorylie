import { BaseChannelHandler, ChannelDeliveryResult, ChannelConfiguration } from './base-channel-handler';
import { ChannelMessage, DeliveryStatus } from '../channel-routing-service';
import { twilioSMSService, SMSMessage } from '../twilio-sms-service';

export class SMSChannelHandler extends BaseChannelHandler {
  constructor(configuration: ChannelConfiguration) {
    super('sms', configuration);
  }

  async sendMessage(message: ChannelMessage): Promise<ChannelDeliveryResult> {
    try {
      const validation = this.validateMessage(message);
      if (!validation) {
        return {
          success: false,
          error: 'Invalid message format for SMS channel'
        };
      }

      // Get customer phone number from message metadata or fetch from database
      const customerPhone = message.metadata?.customerPhone || await this.getCustomerPhone(message.customerId);
      
      if (!customerPhone) {
        throw new Error('Customer phone number not found');
      }

      // Prepare SMS message
      const smsMessage: SMSMessage = {
        dealershipId: message.dealershipId,
        toPhone: customerPhone,
        message: this.formatSMSContent(message),
        metadata: this.formatMetadata(message)
      };

      // Send via Twilio SMS service
      const result = await twilioSMSService.sendSMS(smsMessage);

      if (result.success) {
        this.log('info', 'SMS sent successfully', {
          messageSid: result.messageSid,
          customerPhone: twilioSMSService.maskPhoneNumber(customerPhone)
        });

        return {
          success: true,
          externalMessageId: result.messageSid,
          metadata: {
            toPhone: twilioSMSService.maskPhoneNumber(customerPhone),
            messageLength: smsMessage.message.length
          }
        };
      } else {
        throw new Error(result.error || 'Failed to send SMS');
      }

    } catch (error) {
      return this.handleError(error, {
        customerPhone: message.metadata?.customerPhone ? 
          twilioSMSService.maskPhoneNumber(message.metadata.customerPhone) : 'unknown'
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Twilio credentials are configured for this dealership
      const credentials = this.configuration.credentials;
      if (!credentials?.accountSid || !credentials?.authToken) {
        this.log('warn', 'SMS credentials not configured');
        return false;
      }

      // Could add additional checks like account balance, service status, etc.
      return true;

    } catch (error) {
      this.log('warn', 'SMS channel is not available', { error });
      return false;
    }
  }

  validateMessage(message: ChannelMessage): boolean {
    const commonValidation = this.validateCommonMessage(message);
    if (!commonValidation.valid) {
      this.log('warn', `SMS validation failed: ${commonValidation.error}`);
      return false;
    }

    // SMS-specific validations
    const maxLength = this.getChannelInfo().maxMessageLength;
    if (message.content.length > maxLength) {
      this.log('warn', `SMS content exceeds maximum length: ${message.content.length}/${maxLength}`);
      return false;
    }

    // Check for valid phone number
    if (message.metadata?.customerPhone && !this.isValidPhoneNumber(message.metadata.customerPhone)) {
      this.log('warn', 'Invalid phone number format');
      return false;
    }

    return true;
  }

  async getDeliveryStatus(externalMessageId: string): Promise<DeliveryStatus> {
    try {
      // This would integrate with Twilio's API to get message status
      // For now, we rely on webhooks to update status
      
      this.log('info', 'Checking SMS delivery status', { externalMessageId });
      return 'sent'; // Would be determined by Twilio API call

    } catch (error) {
      this.log('error', 'Failed to get SMS delivery status', { 
        externalMessageId,
        error 
      });
      return 'failed';
    }
  }

  async handleIncomingMessage(data: any): Promise<void> {
    try {
      // Handle Twilio webhooks (delivery status, inbound messages)
      const { MessageSid, MessageStatus, From, Body, To } = data;

      this.log('info', 'Processing SMS webhook', {
        messageSid: MessageSid,
        status: MessageStatus,
        from: twilioSMSService.maskPhoneNumber(From),
        to: To
      });

      // Handle delivery status updates
      if (MessageStatus) {
        // This would update the delivery status in the database
        // Integration with channel routing service
      }

      // Handle inbound replies
      if (Body && From) {
        await this.handleInboundReply(From, Body, To);
      }

    } catch (error) {
      this.log('error', 'Failed to process SMS webhook', { data, error });
    }
  }

  getChannelInfo() {
    return {
      maxMessageLength: 1600, // Support for long SMS (concatenated)
      supportsRichContent: false,
      supportsAttachments: false,
      requiresPhoneNumber: true,
      requiresEmailAddress: false
    };
  }

  // Private helper methods
  private formatSMSContent(message: ChannelMessage): string {
    const dealershipName = this.configuration.settings?.dealershipName || 'Your Dealership';
    let content = message.content;

    // Add urgency indicators
    if (message.urgencyLevel === 'urgent') {
      content = `🚨 URGENT: ${content}`;
    } else if (message.urgencyLevel === 'high') {
      content = `⚡ HIGH PRIORITY: ${content}`;
    }

    // Ensure content fits within SMS limits
    const maxLength = this.getChannelInfo().maxMessageLength;
    const signature = `\n\n- ${dealershipName}`;
    const availableLength = maxLength - signature.length;

    if (content.length > availableLength) {
      content = content.substring(0, availableLength - 3) + '...';
    }

    return content + signature;
  }

  private async getCustomerPhone(customerId: number): Promise<string | null> {
    try {
      // This would query the customers table for phone number
      // For now, return a placeholder
      return null; // Would be implemented with actual database query
    } catch (error) {
      this.log('error', 'Failed to get customer phone', { customerId, error });
      return null;
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  private async handleInboundReply(from: string, message: string, to: string): Promise<void> {
    try {
      this.log('info', 'Processing inbound SMS reply', {
        from: twilioSMSService.maskPhoneNumber(from),
        to: to,
        messagePreview: message.substring(0, 50) + '...'
      });

      // Check for opt-out keywords
      const lowerMessage = message.toLowerCase().trim();
      const optOutKeywords = ['stop', 'unsubscribe', 'quit', 'cancel', 'end', 'opt-out'];
      
      if (optOutKeywords.some(keyword => lowerMessage.includes(keyword))) {
        await twilioSMSService.handleOptOut(this.configuration.dealershipId, from, 'user_request');
        this.log('info', 'Customer opted out via SMS', {
          phone: twilioSMSService.maskPhoneNumber(from)
        });
        return;
      }

      // Handle opt-in keywords
      if (lowerMessage.includes('start') || lowerMessage.includes('subscribe')) {
        // Handle opt-in logic
        this.log('info', 'Customer opted in via SMS', {
          phone: twilioSMSService.maskPhoneNumber(from)
        });
        return;
      }

      // Forward message to conversation system
      await this.forwardToConversationSystem(from, message, to);

    } catch (error) {
      this.log('error', 'Failed to handle inbound SMS reply', { error });
    }
  }

  private async forwardToConversationSystem(from: string, message: string, to: string): Promise<void> {
    try {
      // This would:
      // 1. Find or create a conversation for this phone number
      // 2. Add the message to the conversation
      // 3. Potentially trigger escalation to human agents
      // 4. Send automated responses if appropriate

      this.log('info', 'Forwarding SMS to conversation system', {
        from: twilioSMSService.maskPhoneNumber(from),
        to: to
      });

      // Implementation would depend on conversation management system

    } catch (error) {
      this.log('error', 'Failed to forward SMS to conversation system', { error });
    }
  }
}