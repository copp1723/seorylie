import logger from '../utils/logger';
import db from '../db';
import { sql } from 'drizzle-orm';

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  webhookUrl?: string;
}

export interface CredentialConfig {
  dealershipId: number;
  provider: 'twilio' | 'sendgrid' | 'other';
  credentials: Record<string, string>;
  isActive: boolean;
}

/**
 * Secure credentials management service
 * In production, this should integrate with a proper secrets management service
 * like AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault
 */
export class CredentialsService {
  private static instance: CredentialsService;
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || 'default-key-change-in-production';
    
    if (this.encryptionKey === 'default-key-change-in-production' && process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: Using default encryption key in production. Set CREDENTIALS_ENCRYPTION_KEY environment variable.');
      throw new Error('Invalid encryption key configuration');
    }
  }

  static getInstance(): CredentialsService {
    if (!CredentialsService.instance) {
      CredentialsService.instance = new CredentialsService();
    }
    return CredentialsService.instance;
  }

  /**
   * Store encrypted credentials for a dealership
   */
  async storeCredentials(config: CredentialConfig): Promise<void> {
    try {
      const encryptedCredentials = this.encrypt(JSON.stringify(config.credentials));
      
      await db.execute(sql`
        INSERT INTO dealership_credentials (
          dealership_id, provider, encrypted_credentials, is_active, created_at, updated_at
        )
        VALUES (
          ${config.dealershipId},
          ${config.provider},
          ${encryptedCredentials},
          ${config.isActive},
          NOW(),
          NOW()
        )
        ON CONFLICT (dealership_id, provider)
        DO UPDATE SET
          encrypted_credentials = ${encryptedCredentials},
          is_active = ${config.isActive},
          updated_at = NOW()
      `);

      logger.info('Credentials stored successfully', {
        dealership: config.dealershipId,
        provider: config.provider
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to store credentials', { 
        error: err.message,
        dealership: config.dealershipId,
        provider: config.provider
      });
      throw err;
    }
  }

  /**
   * Retrieve and decrypt credentials for a dealership
   */
  async getCredentials(dealershipId: number, provider: string): Promise<Record<string, string> | null> {
    try {
      const result = await db.execute(sql`
        SELECT encrypted_credentials 
        FROM dealership_credentials 
        WHERE dealership_id = ${dealershipId} 
        AND provider = ${provider}
        AND is_active = true
      `);

      if (!result.rows[0]?.encrypted_credentials) {
        return null;
      }

      const decrypted = this.decrypt(result.rows[0].encrypted_credentials);
      return JSON.parse(decrypted);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to retrieve credentials', { 
        error: err.message,
        dealership: dealershipId,
        provider: provider
      });
      return null;
    }
  }

  /**
   * Get Twilio credentials for a specific dealership
   */
  async getTwilioCredentials(dealershipId: number): Promise<TwilioCredentials | null> {
    try {
      const credentials = await this.getCredentials(dealershipId, 'twilio');
      
      if (!credentials) {
        // Fall back to environment variables for default configuration
        const envCredentials = {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          fromNumber: process.env.TWILIO_FROM_NUMBER || '',
          webhookUrl: process.env.TWILIO_WEBHOOK_URL || ''
        };

        if (!envCredentials.accountSid || !envCredentials.authToken) {
          logger.warn('No Twilio credentials found', { dealership: dealershipId });
          return null;
        }

        return envCredentials;
      }

      return {
        accountSid: credentials.accountSid || '',
        authToken: credentials.authToken || '',
        fromNumber: credentials.fromNumber || '',
        webhookUrl: credentials.webhookUrl || ''
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get Twilio credentials', { 
        error: err.message,
        dealership: dealershipId
      });
      return null;
    }
  }

  /**
   * Validate Twilio credentials by making a test API call
   */
  async validateTwilioCredentials(credentials: TwilioCredentials): Promise<boolean> {
    try {
      const { Twilio } = await import('twilio');
      const client = new Twilio(credentials.accountSid, credentials.authToken);
      
      // Test the credentials by fetching account info
      await client.api.accounts(credentials.accountSid).fetch();
      
      logger.info('Twilio credentials validation successful');
      return true;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Twilio credentials validation failed', { error: err.message });
      return false;
    }
  }

  /**
   * Rotate credentials and update all affected services
   */
  async rotateCredentials(dealershipId: number, provider: string, newCredentials: Record<string, string>): Promise<void> {
    try {
      // Validate new credentials first
      if (provider === 'twilio') {
        const twilioCredentials: TwilioCredentials = {
          accountSid: newCredentials.accountSid,
          authToken: newCredentials.authToken,
          fromNumber: newCredentials.fromNumber,
          webhookUrl: newCredentials.webhookUrl
        };

        const isValid = await this.validateTwilioCredentials(twilioCredentials);
        if (!isValid) {
          throw new Error('New Twilio credentials are invalid');
        }
      }

      // Store new credentials
      await this.storeCredentials({
        dealershipId,
        provider: provider as any,
        credentials: newCredentials,
        isActive: true
      });

      // Log credential rotation
      await this.logCredentialActivity(dealershipId, provider, 'rotated');

      logger.info('Credentials rotated successfully', {
        dealership: dealershipId,
        provider: provider
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to rotate credentials', { 
        error: err.message,
        dealership: dealershipId,
        provider: provider
      });
      throw err;
    }
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedText: string): string {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Log credential-related activities for audit trail
   */
  private async logCredentialActivity(dealershipId: number, provider: string, action: string): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO credential_activity_log (
          dealership_id, provider, action, timestamp, ip_address, user_id
        )
        VALUES (
          ${dealershipId},
          ${provider},
          ${action},
          NOW(),
          ${process.env.SERVER_IP || 'unknown'},
          NULL -- Would be populated with actual user ID in real implementation
        )
      `);
    } catch (error) {
      logger.error('Failed to log credential activity', { error });
    }
  }
}

// Export singleton instance
export const credentialsService = CredentialsService.getInstance();