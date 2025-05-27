import nodemailer from 'nodemailer';
import { BaseChannelHandler, ChannelDeliveryResult, ChannelConfiguration } from './base-channel-handler';
import { ChannelMessage, DeliveryStatus } from '../channel-routing-service';

export class EmailChannelHandler extends BaseChannelHandler {
  private transporter: nodemailer.Transporter | null = null;

  constructor(configuration: ChannelConfiguration) {
    super('email', configuration);
    this.initializeTransporter();
  }

  async sendMessage(message: ChannelMessage): Promise<ChannelDeliveryResult> {
    try {
      const validation = this.validateMessage(message);
      if (!validation) {
        return {
          success: false,
          error: 'Invalid message format for email channel'
        };
      }

      if (!this.transporter) {
        await this.initializeTransporter();
      }

      if (!this.transporter) {
        throw new Error('Email transporter not configured');
      }

      // Get customer email from message metadata or fetch from database
      const customerEmail = message.metadata?.customerEmail || await this.getCustomerEmail(message.customerId);
      
      if (!customerEmail) {
        throw new Error('Customer email address not found');
      }

      const emailOptions = {
        from: this.getFromAddress(),
        to: customerEmail,
        subject: message.subject || this.generateSubject(message),
        html: this.formatEmailContent(message),
        text: this.sanitizeContent(message.content),
        messageId: message.id,
        headers: {
          'X-Dealership-ID': message.dealershipId.toString(),
          'X-Customer-ID': message.customerId.toString(),
          'X-Conversation-ID': message.conversationId?.toString() || '',
          'X-Lead-Source': message.leadSource || '',
        }
      };

      const result = await this.transporter.sendMail(emailOptions);

      this.log('info', 'Email sent successfully', {
        messageId: result.messageId,
        customerEmail: this.maskEmail(customerEmail),
        response: result.response
      });

      return {
        success: true,
        externalMessageId: result.messageId,
        metadata: {
          response: result.response,
          envelope: result.envelope
        }
      };

    } catch (error) {
      return this.handleError(error, {
        customerEmail: message.metadata?.customerEmail ? 
          this.maskEmail(message.metadata.customerEmail) : 'unknown'
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }
      
      if (!this.transporter) {
        return false;
      }

      // Verify transporter connection
      await this.transporter.verify();
      return true;

    } catch (error) {
      this.log('warn', 'Email channel is not available', { error });
      return false;
    }
  }

  validateMessage(message: ChannelMessage): boolean {
    const commonValidation = this.validateCommonMessage(message);
    if (!commonValidation.valid) {
      this.log('warn', `Email validation failed: ${commonValidation.error}`);
      return false;
    }

    // Email-specific validations
    if (message.content.length > 100000) { // 100KB limit for email
      this.log('warn', 'Email content exceeds maximum length');
      return false;
    }

    return true;
  }

  async getDeliveryStatus(externalMessageId: string): Promise<DeliveryStatus> {
    try {
      // This would integrate with email service provider's API
      // For now, return a default status
      // In production, integrate with SendGrid, SES, etc. webhooks
      
      this.log('info', 'Checking email delivery status', { externalMessageId });
      return 'sent'; // Would be determined by actual service

    } catch (error) {
      this.log('error', 'Failed to get email delivery status', { 
        externalMessageId,
        error 
      });
      return 'failed';
    }
  }

  async handleIncomingMessage(data: any): Promise<void> {
    try {
      // Handle email webhooks (delivery status, opens, clicks, replies)
      const { event, messageId, email, timestamp } = data;

      this.log('info', 'Processing email webhook', {
        event,
        messageId,
        email: this.maskEmail(email),
        timestamp
      });

      // Update delivery status based on webhook event
      // This would integrate with the channel routing service

    } catch (error) {
      this.log('error', 'Failed to process email webhook', { data, error });
    }
  }

  getChannelInfo() {
    return {
      maxMessageLength: 100000,
      supportsRichContent: true,
      supportsAttachments: true,
      requiresPhoneNumber: false,
      requiresEmailAddress: true
    };
  }

  // Private helper methods
  private async initializeTransporter(): Promise<void> {
    try {
      const credentials = this.configuration.credentials;
      if (!credentials) {
        throw new Error('Email credentials not configured');
      }

      // Support multiple email providers
      if (credentials.provider === 'sendgrid') {
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: credentials.apiKey
          }
        });
      } else if (credentials.provider === 'ses') {
        this.transporter = nodemailer.createTransporter({
          SES: {
            aws: {
              accessKeyId: credentials.accessKeyId,
              secretAccessKey: credentials.secretAccessKey,
              region: credentials.region || 'us-east-1'
            }
          }
        });
      } else if (credentials.provider === 'smtp') {
        this.transporter = nodemailer.createTransporter({
          host: credentials.host,
          port: parseInt(credentials.port || '587'),
          secure: credentials.secure === 'true',
          auth: {
            user: credentials.username,
            pass: credentials.password
          }
        });
      } else {
        throw new Error(`Unsupported email provider: ${credentials.provider}`);
      }

      this.log('info', 'Email transporter initialized', {
        provider: credentials.provider
      });

    } catch (error) {
      this.log('error', 'Failed to initialize email transporter', { error });
      this.transporter = null;
    }
  }

  private getFromAddress(): string {
    const settings = this.configuration.settings;
    const defaultFrom = process.env.DEFAULT_FROM_EMAIL || 'noreply@rylie.ai';
    
    if (settings?.fromEmail) {
      const fromName = settings.fromName || settings.dealershipName || 'Rylie AI';
      return `${fromName} <${settings.fromEmail}>`;
    }

    return defaultFrom;
  }

  private generateSubject(message: ChannelMessage): string {
    const urgencyPrefix = message.urgencyLevel === 'urgent' ? '[URGENT] ' :
                         message.urgencyLevel === 'high' ? '[HIGH PRIORITY] ' : '';
    
    const baseSubject = message.leadSource ? 
      `Follow-up on your ${message.leadSource} inquiry` :
      'Important message from your dealership';

    return urgencyPrefix + baseSubject;
  }

  private formatEmailContent(message: ChannelMessage): string {
    const dealershipName = this.configuration.settings?.dealershipName || 'Your Dealership';
    const customerName = message.metadata?.customerName || 'Valued Customer';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${message.subject || 'Message from ' + dealershipName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d; }
          .urgency-high { border-left: 4px solid #dc3545; padding-left: 15px; }
          .urgency-urgent { border-left: 4px solid #dc3545; background-color: #fff5f5; padding: 15px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0; color: #495057;">${dealershipName}</h2>
          </div>
          
          <div class="content ${message.urgencyLevel === 'high' ? 'urgency-high' : message.urgencyLevel === 'urgent' ? 'urgency-urgent' : ''}">
            <p>Dear ${customerName},</p>
            
            ${this.formatMessageContent(message.content)}
            
            <p>Best regards,<br>${dealershipName} Team</p>
          </div>
          
          <div class="footer">
            <p>
              This message was sent by ${dealershipName} via Rylie AI.<br>
              If you no longer wish to receive these messages, please reply with "UNSUBSCRIBE".
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private formatMessageContent(content: string): string {
    // Convert line breaks to HTML paragraphs
    return content
      .split('\n\n')
      .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  private async getCustomerEmail(customerId: number): Promise<string | null> {
    try {
      // This would query the customers table
      // For now, return a placeholder
      return null; // Would be implemented with actual database query
    } catch (error) {
      this.log('error', 'Failed to get customer email', { customerId, error });
      return null;
    }
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return 'invalid@email.com';
    
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.length > 2 ? 
      localPart.slice(0, 2) + '*'.repeat(localPart.length - 2) : 
      '*'.repeat(localPart.length);
    
    return `${maskedLocal}@${domain}`;
  }
}