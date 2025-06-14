import twilio from "twilio";
import logger from "../utils/logger";
import db from "../db";
import { sql } from "drizzle-orm";
import { credentialsService, TwilioCredentials } from "./credentials-service";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface SMSMessage {
  id?: string;
  dealershipId: number;
  toPhone: string;
  message: string;
  fromPhone?: string;
  templateId?: string;
  campaignId?: string;
  metadata?: Record<string, any>;
}

export interface SMSDeliveryEvent {
  messageSid: string;
  status: "queued" | "sent" | "delivered" | "failed" | "undelivered";
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

export interface PhoneNumberMaskingOptions {
  preserveLength?: boolean;
  maskCharacter?: string;
  visibleDigits?: number;
}

export class TwilioSMSService {
  private clientCache: Map<number, Twilio> = new Map();
  private credentialsCache: Map<number, TwilioCredentials> = new Map();

  constructor() {
    // No longer initialize client in constructor - get credentials per dealership
  }

  /**
   * Get Twilio client for specific dealership
   */
  private async getTwilioClient(dealershipId: number): Promise<Twilio> {
    try {
      // Check cache first
      if (this.clientCache.has(dealershipId)) {
        return this.clientCache.get(dealershipId)!;
      }

      // Get credentials for this dealership
      const credentials =
        await credentialsService.getTwilioCredentials(dealershipId);
      if (!credentials || !credentials.accountSid || !credentials.authToken) {
        throw new Error(
          `No valid Twilio credentials found for dealership ${dealershipId}`,
        );
      }

      // Create and cache client with timeout configuration
      const client = twilio(credentials.accountSid, credentials.authToken, {
        timeout: 20000, // 20 second timeout
        autoRetry: true,
        maxRetries: 2,
      });
      this.clientCache.set(dealershipId, client);
      this.credentialsCache.set(dealershipId, credentials);

      return client;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get Twilio client", {
        error: err.message,
        dealership: dealershipId,
      });
      throw err;
    }
  }

  /**
   * Get Twilio credentials for specific dealership
   */
  private async getTwilioCredentials(
    dealershipId: number,
  ): Promise<TwilioCredentials> {
    if (this.credentialsCache.has(dealershipId)) {
      return this.credentialsCache.get(dealershipId)!;
    }

    const credentials =
      await credentialsService.getTwilioCredentials(dealershipId);
    if (!credentials) {
      throw new Error(
        `No Twilio credentials found for dealership ${dealershipId}`,
      );
    }

    this.credentialsCache.set(dealershipId, credentials);
    return credentials;
  }

  /**
   * Send SMS message via Twilio with full tracking
   */
  async sendSMS(
    message: SMSMessage,
  ): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    try {
      // Check opt-out status before sending
      const isOptedOut = await this.checkOptOutStatus(
        message.dealershipId,
        message.toPhone,
      );
      if (isOptedOut) {
        logger.sms("Message not sent - recipient has opted out", {
          dealership: message.dealershipId,
          toPhone: message.toPhone,
        });
        return {
          success: false,
          error: "Recipient has opted out of SMS communications",
        };
      }

      // Validate phone number format
      const normalizedPhone = this.normalizePhoneNumber(message.toPhone);
      if (!normalizedPhone) {
        throw new Error("Invalid phone number format");
      }

      // Get Twilio client and credentials for this dealership
      const client = await this.getTwilioClient(message.dealershipId);
      const credentials = await this.getTwilioCredentials(message.dealershipId);

      // Send via Twilio
      const twilioMessage = await client.messages.create({
        body: message.message,
        from: message.fromPhone || credentials.fromNumber,
        to: normalizedPhone,
        statusCallback: `${process.env.BASE_URL}/api/webhooks/twilio/status`,
      });

      // Store message in database
      const messageId = await this.storeMessage(
        {
          ...message,
          toPhone: normalizedPhone,
        },
        twilioMessage.sid,
      );

      // Log delivery event
      await this.logDeliveryEvent({
        messageSid: twilioMessage.sid,
        status: twilioMessage.status as any,
        timestamp: new Date(),
      });

      logger.sms("SMS sent successfully", {
        messageSid: twilioMessage.sid,
        dealership: message.dealershipId,
        toPhone: normalizedPhone,
        status: twilioMessage.status,
      });

      return { success: true, messageSid: twilioMessage.sid };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Store failed message in database for retry logic
      await this.storeMessage(message, null, err.message);

      logger.error("Failed to send SMS", {
        error: err.message,
        dealership: message.dealershipId,
        toPhone: this.maskPhoneNumber(message.toPhone),
      });

      return { success: false, error: err.message };
    }
  }

  /**
   * Process Twilio webhook delivery status updates
   */
  async processWebhook(webhookData: any): Promise<void> {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } =
        webhookData;

      if (!MessageSid || !MessageStatus) {
        throw new Error(
          "Invalid webhook data: missing MessageSid or MessageStatus",
        );
      }

      await this.logDeliveryEvent({
        messageSid: MessageSid,
        status: MessageStatus,
        errorCode: ErrorCode,
        errorMessage: ErrorMessage,
        timestamp: new Date(),
      });

      // Update message status
      await db.execute(sql`
        UPDATE sms_messages
        SET status = ${MessageStatus},
            error_message = ${ErrorMessage || null},
            updated_at = NOW()
        WHERE twilio_sid = ${MessageSid}
      `);

      logger.info("Webhook processed successfully", {
        messageSid: MessageSid,
        status: MessageStatus,
        errorCode: ErrorCode,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to process webhook", {
        error: err.message,
        webhookData,
      });
      throw err;
    }
  }

  /**
   * Retry failed messages with exponential backoff
   */
  async retryFailedMessages(): Promise<void> {
    try {
      const failedMessages = await db.execute(sql`
        SELECT id, dealership_id, to_phone_masked, message_body, from_phone,
               retry_count, template_id, campaign_id, metadata, created_at
        FROM sms_messages
        WHERE status = 'failed'
        AND retry_count < 3
        AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at ASC
        LIMIT 50
      `);

      for (const msg of failedMessages) {
        // Exponential backoff: wait 2^retry_count minutes
        const backoffMinutes = Math.pow(2, msg.retry_count);
        const nextRetry = new Date(
          msg.created_at.getTime() + backoffMinutes * 60 * 1000,
        );

        if (new Date() < nextRetry) {
          continue; // Not time for retry yet
        }

        const originalPhone = await this.unmaskPhoneNumber(
          msg.to_phone_masked,
          msg.id,
        );
        if (!originalPhone) {
          logger.error("Cannot retry message - unable to unmask phone number", {
            messageId: msg.id,
          });
          continue;
        }

        const retryMessage: SMSMessage = {
          dealershipId: msg.dealership_id,
          toPhone: originalPhone,
          message: msg.message_body,
          fromPhone: msg.from_phone,
          templateId: msg.template_id,
          campaignId: msg.campaign_id,
          metadata: msg.metadata,
        };

        const result = await this.sendSMS(retryMessage);

        if (result.success) {
          // Mark original as retried successfully
          await db.execute(sql`
            UPDATE sms_messages
            SET status = 'retried_success', updated_at = NOW()
            WHERE id = ${msg.id}
          `);
        } else {
          // Increment retry count
          await db.execute(sql`
            UPDATE sms_messages
            SET retry_count = retry_count + 1, updated_at = NOW()
            WHERE id = ${msg.id}
          `);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to retry messages", { error: err.message });
    }
  }

  /**
   * Handle opt-out requests (STOP, UNSUBSCRIBE, etc.)
   */
  async handleOptOut(
    dealershipId: number,
    phoneNumber: string,
    reason: string = "user_request",
  ): Promise<void> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        throw new Error("Invalid phone number format");
      }

      await db.execute(sql`
        INSERT INTO sms_opt_outs (dealership_id, phone_number_hash, phone_number_masked, reason, opted_out_at)
        VALUES (
          ${dealershipId},
          ${this.hashPhoneNumber(normalizedPhone)},
          ${this.maskPhoneNumber(normalizedPhone)},
          ${reason}::sms_opt_out_reason,
          NOW()
        )
        ON CONFLICT (dealership_id, phone_number_hash)
        DO UPDATE SET
          reason = ${reason}::sms_opt_out_reason,
          opted_out_at = NOW(),
          opted_back_in_at = NULL
      `);

      logger.info("Phone number opted out successfully", {
        dealership: dealershipId,
        phoneNumber: this.maskPhoneNumber(normalizedPhone),
        reason,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to handle opt-out", { error: err.message });
      throw err;
    }
  }

  /**
   * Check if phone number has opted out
   */
  async checkOptOutStatus(
    dealershipId: number,
    phoneNumber: string,
  ): Promise<boolean> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        return true; // Invalid phone numbers are considered opted out
      }

      const result = await db.execute(sql`
        SELECT id FROM sms_opt_outs
        WHERE dealership_id = ${dealershipId}
        AND phone_number_hash = ${this.hashPhoneNumber(normalizedPhone)}
        AND opted_back_in_at IS NULL
      `);

      return result.length > 0;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to check opt-out status", { error: err.message });
      return true; // Fail safe - assume opted out if we can't check
    }
  }

  /**
   * Mask phone number for logging (privacy compliance)
   */
  maskPhoneNumber(
    phoneNumber: string,
    options: PhoneNumberMaskingOptions = {},
  ): string {
    const {
      preserveLength = true,
      maskCharacter = "*",
      visibleDigits = 4,
    } = options;

    if (!phoneNumber || phoneNumber.length < visibleDigits) {
      return maskCharacter.repeat(10); // Default masked phone length
    }

    const cleanNumber = phoneNumber.replace(/\D/g, "");
    const visiblePart = cleanNumber.slice(-visibleDigits);
    const maskedLength = preserveLength
      ? cleanNumber.length - visibleDigits
      : 6;
    const maskedPart = maskCharacter.repeat(maskedLength);

    return maskedPart + visiblePart;
  }

  /**
   * Store message in database with masked phone number
   */
  private async storeMessage(
    message: SMSMessage,
    twilioSid: string | null,
    errorMessage?: string,
  ): Promise<string> {
    const messageId = await db.execute(sql`
      INSERT INTO sms_messages (
        dealership_id, twilio_sid, to_phone_masked, message_body, from_phone,
        status, template_id, campaign_id, metadata, error_message, created_at
      )
      VALUES (
        ${message.dealershipId},
        ${twilioSid},
        ${this.maskPhoneNumber(message.toPhone)},
        ${message.message},
        ${message.fromPhone || (await this.getTwilioCredentials(message.dealershipId)).fromNumber},
        ${twilioSid ? "queued" : "failed"},
        ${message.templateId || null},
        ${message.campaignId || null},
        ${JSON.stringify(message.metadata || {})},
        ${errorMessage || null},
        NOW()
      )
      RETURNING id
    `);

    const id = messageId[0]?.id;

    // Store unmasked phone number securely for potential retry
    if (id) {
      await this.storePhoneNumberSecurely(id, message.toPhone);
    }

    return id;
  }

  /**
   * Log delivery event in database
   */
  private async logDeliveryEvent(event: SMSDeliveryEvent): Promise<void> {
    await db.execute(sql`
      INSERT INTO sms_delivery_events (
        message_id, status, error_code, error_message, event_timestamp
      )
      SELECT m.id, ${event.status}::sms_delivery_status, ${event.errorCode || null},
             ${event.errorMessage || null}, ${event.timestamp}
      FROM sms_messages m
      WHERE m.twilio_sid = ${event.messageSid}
    `);
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string | null {
    try {
      // Remove all non-digit characters
      const cleaned = phone.replace(/\D/g, "");

      // Handle US numbers
      if (cleaned.length === 10) {
        return `+1${cleaned}`;
      } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
        return `+${cleaned}`;
      } else if (cleaned.startsWith("+")) {
        return phone; // Already in international format
      }

      return null; // Invalid format
    } catch {
      return null;
    }
  }

  /**
   * Hash phone number for opt-out storage
   */
  private hashPhoneNumber(phoneNumber: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(phoneNumber).digest("hex");
  }

  /**
   * Store phone number securely for retry purposes
   */
  private async storePhoneNumberSecurely(
    messageId: string,
    phoneNumber: string,
  ): Promise<void> {
    const crypto = require("crypto");
    
    // Ensure we have a proper encryption key
    const encryptionKey = process.env.PHONE_ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error("PHONE_ENCRYPTION_KEY must be set and at least 32 characters long");
    }
    
    // Use the key to derive a proper 32-byte key and 16-byte IV
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    // Use createCipheriv instead of deprecated createCipher
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(phoneNumber, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Store IV with the encrypted data for decryption
    const encryptedWithIv = iv.toString('hex') + ':' + encrypted;

    await db.execute(sql`
      UPDATE sms_messages
      SET encrypted_phone = ${encryptedWithIv}
      WHERE id = ${messageId}
    `);
  }

  /**
   * Retrieve and decrypt phone number for retry
   */
  private async unmaskPhoneNumber(
    maskedPhone: string,
    messageId: string,
  ): Promise<string | null> {
    try {
      const result = await db.execute(sql`
        SELECT encrypted_phone FROM sms_messages WHERE id = ${messageId}
      `);

      if (!result[0]?.encrypted_phone) {
        return null;
      }

      const crypto = require("crypto");
      
      // Ensure we have a proper encryption key
      const encryptionKey = process.env.PHONE_ENCRYPTION_KEY;
      if (!encryptionKey || encryptionKey.length < 32) {
        logger.error("PHONE_ENCRYPTION_KEY not properly configured");
        return null;
      }
      
      // Extract IV and encrypted data
      const parts = result[0].encrypted_phone.split(':');
      if (parts.length !== 2) {
        logger.error("Invalid encrypted phone format");
        return null;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];
      
      // Use the same key derivation as encryption
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      
      // Use createDecipheriv instead of deprecated createDecipher
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      logger.error("Failed to decrypt phone number", { error, messageId });
      return null;
    }
  }
}

// Export singleton instance
export const twilioSMSService = new TwilioSMSService();
