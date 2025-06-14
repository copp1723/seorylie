/**
 * SendGrid Service
 * Handles SendGrid API integration for email sending and webhook processing
 */

import sgMail from "@sendgrid/mail";
import logger from "../utils/logger";

export interface SendGridEmailOptions {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }>;
  customArgs?: Record<string, string>;
  categories?: string[];
}

export interface SendGridResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SendGridService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey || apiKey === "optional-for-now") {
      logger.warn("SendGrid API key not configured");
      return;
    }

    sgMail.setApiKey(apiKey);
    
    // Configure timeout and other client settings
    sgMail.setClient({
      apiKey: apiKey,
      timeout: 20000, // 20 second timeout
      retry: {
        maximumRetries: 2,
        maximumRetryDelay: 2000,
      }
    });
    
    this.initialized = true;
    logger.info("SendGrid service initialized with timeout configuration");
  }

  /**
   * Send email via SendGrid API
   */
  async sendEmail(options: SendGridEmailOptions): Promise<SendGridResponse> {
    if (!this.initialized) {
      return {
        success: false,
        error: "SendGrid not initialized - API key missing",
      };
    }

    try {
      const msg = {
        to: options.to,
        from: options.from,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        customArgs: options.customArgs,
        categories: options.categories,
      };

      const [response] = await sgMail.send(msg);

      logger.info("Email sent via SendGrid", {
        to: options.to,
        subject: options.subject,
        messageId: response.headers["x-message-id"],
      });

      return {
        success: true,
        messageId: response.headers["x-message-id"],
      };
    } catch (error) {
      logger.error("SendGrid email send error", {
        error: error.message,
        to: options.to,
        subject: options.subject,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send ADF notification email
   */
  async sendAdfNotification(options: {
    dealershipEmail: string;
    leadData: any;
    subject?: string;
  }): Promise<SendGridResponse> {
    const { dealershipEmail, leadData, subject } = options;

    const emailOptions: SendGridEmailOptions = {
      to: dealershipEmail,
      from: process.env.EMAIL_FROM || "noreply@yourdomain.com",
      subject:
        subject || `New Lead: ${leadData.customer?.name || "Unknown Customer"}`,
      html: this.generateAdfEmailTemplate(leadData),
      text: this.generateAdfEmailText(leadData),
      customArgs: {
        type: "adf_notification",
        leadId: leadData.id || "unknown",
        dealership: leadData.dealership || "unknown",
      },
      categories: ["adf", "lead_notification"],
    };

    return this.sendEmail(emailOptions);
  }

  /**
   * Generate HTML template for ADF notification
   */
  private generateAdfEmailTemplate(leadData: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
          🚗 New Lead Received
        </h2>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${leadData.customer?.name || "Not provided"}</p>
          <p><strong>Email:</strong> ${leadData.customer?.email || "Not provided"}</p>
          <p><strong>Phone:</strong> ${leadData.customer?.phone || "Not provided"}</p>
        </div>

        ${
          leadData.vehicle
            ? `
        <div style="background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Vehicle Interest</h3>
          <p><strong>Year:</strong> ${leadData.vehicle.year || "Any"}</p>
          <p><strong>Make:</strong> ${leadData.vehicle.make || "Any"}</p>
          <p><strong>Model:</strong> ${leadData.vehicle.model || "Any"}</p>
        </div>
        `
            : ""
        }

        <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Message</h3>
          <p>${leadData.message || "No message provided"}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            Lead received: ${new Date().toLocaleString()}<br>
            Source: ${leadData.source || "ADF Email"}
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate plain text version for ADF notification
   */
  private generateAdfEmailText(leadData: any): string {
    return `
New Lead Received

Customer Information:
- Name: ${leadData.customer?.name || "Not provided"}
- Email: ${leadData.customer?.email || "Not provided"}
- Phone: ${leadData.customer?.phone || "Not provided"}

${
  leadData.vehicle
    ? `
Vehicle Interest:
- Year: ${leadData.vehicle.year || "Any"}
- Make: ${leadData.vehicle.make || "Any"}
- Model: ${leadData.vehicle.model || "Any"}
`
    : ""
}

Message:
${leadData.message || "No message provided"}

Lead received: ${new Date().toLocaleString()}
Source: ${leadData.source || "ADF Email"}
    `.trim();
  }

  /**
   * Check if SendGrid is properly configured
   */
  isConfigured(): boolean {
    return this.initialized;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      apiKeyConfigured:
        !!process.env.SENDGRID_API_KEY &&
        process.env.SENDGRID_API_KEY !== "optional-for-now",
      webhookEnabled: process.env.SENDGRID_WEBHOOK_ENABLED === "true",
    };
  }
}

// Export singleton instance
export const sendGridService = new SendGridService();
export default sendGridService;
