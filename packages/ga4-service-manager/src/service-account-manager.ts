/**
 * @file GA4 Service Account Manager
 * @description Centralized service account management for GA4 API access across all tenants
 */

import { GoogleAuth, JWT } from 'google-auth-library';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import crypto from 'crypto';
import pino from 'pino';
import { z } from 'zod';

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Validation schemas
const ServiceAccountConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  serviceAccountEmail: z.string().email(),
  projectId: z.string().min(1),
  privateKey: z.string().min(1),
  keyId: z.string().min(1),
});

const PropertyAccessTestSchema = z.object({
  propertyId: z.string().min(1),
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }).optional(),
});

export interface ServiceAccountConfig {
  environment: 'development' | 'staging' | 'production';
  serviceAccountEmail: string;
  projectId: string;
  privateKey: string;
  keyId: string;
}

export interface PropertyAccessResult {
  hasAccess: boolean;
  error?: string;
  metadata?: {
    propertyName?: string;
    websiteUrl?: string;
    timeZone?: string;
    currencyCode?: string;
  };
}

export interface QuotaUsage {
  dailyUsage: number;
  dailyLimit: number;
  hourlyUsage: number;
  hourlyLimit: number;
  remainingDaily: number;
  remainingHourly: number;
}

/**
 * Centralized GA4 Service Account Manager
 * Handles authentication, property access validation, and quota management
 */
export class GA4ServiceAccountManager {
  private jwtClient!: JWT;
  private analyticsDataClient!: BetaAnalyticsDataClient;
  private analyticsAdmin: any;
  private encryptionKey: string;
  private quotaTracker: Map<string, QuotaUsage> = new Map();

  constructor(private config: ServiceAccountConfig) {
    // Validate configuration
    const validationResult = ServiceAccountConfigSchema.safeParse(config);
    if (!validationResult.success) {
      throw new Error(`Invalid service account configuration: ${validationResult.error.message}`);
    }

    this.encryptionKey = process.env.GA4_ENCRYPTION_KEY!;
    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      throw new Error('GA4_ENCRYPTION_KEY must be at least 32 characters long');
    }

    this.initializeClients();
    logger.info(`GA4ServiceAccountManager initialized for ${config.environment} environment`);
  }

  /**
   * Initialize Google Analytics clients with service account credentials
   */
  private initializeClients(): void {
    try {
      this.jwtClient = new JWT({
        email: this.config.serviceAccountEmail,
        key: this.config.privateKey,
        scopes: [
          'https://www.googleapis.com/auth/analytics.readonly',
          'https://www.googleapis.com/auth/analytics.manage.users.readonly',
        ],
      });

      this.analyticsDataClient = new BetaAnalyticsDataClient({
        auth: this.jwtClient as any,
      });

      this.analyticsAdmin = google.analyticsadmin({
        version: 'v1beta',
        auth: this.jwtClient,
      });

      logger.info('Google Analytics clients initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Google Analytics clients');
      throw new Error(`Failed to initialize clients: ${(error as Error).message}`);
    }
  }

  /**
   * Test access to a specific GA4 property and retrieve metadata
   */
  async testPropertyAccess(propertyId: string): Promise<PropertyAccessResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validation = PropertyAccessTestSchema.safeParse({ propertyId });
      if (!validation.success) {
        return {
          hasAccess: false,
          error: `Invalid property ID: ${validation.error.message}`,
        };
      }

      // Test basic access with a minimal report request
      const [reportResponse] = await this.analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [{ name: 'sessions' }],
        limit: 1,
      });

      // Get property metadata
      let metadata = {};
      try {
        const [propertyResponse] = await this.analyticsAdmin.properties.get({
          name: `properties/${propertyId}`,
        });

        metadata = {
          propertyName: propertyResponse.data.displayName,
          websiteUrl: propertyResponse.data.websiteUrl,
          timeZone: propertyResponse.data.timeZone,
          currencyCode: propertyResponse.data.currencyCode,
        };
      } catch (metadataError) {
        logger.warn({ propertyId, error: metadataError }, 'Failed to fetch property metadata');
      }

      // Track API usage
      await this.trackApiUsage(propertyId, 'runReport', Date.now() - startTime, true);

      logger.info({ propertyId, responseTime: Date.now() - startTime }, 'Property access test successful');

      return {
        hasAccess: true,
        metadata,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Track failed API usage
      await this.trackApiUsage(propertyId, 'runReport', Date.now() - startTime, false, errorMessage);

      logger.error({ propertyId, error, responseTime: Date.now() - startTime }, 'Property access test failed');

      // Categorize the error
      if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('NOT_FOUND')) {
        return {
          hasAccess: false,
          error: 'No access to this property. Please ensure the service account has been added as a Viewer.',
        };
      } else if (errorMessage.includes('QUOTA_EXCEEDED')) {
        return {
          hasAccess: false,
          error: 'API quota exceeded. Please try again later.',
        };
      } else {
        return {
          hasAccess: false,
          error: `Connection test failed: ${errorMessage}`,
        };
      }
    }
  }

  /**
   * Batch test access to multiple properties
   */
  async testMultiplePropertiesAccess(propertyIds: string[]): Promise<Record<string, PropertyAccessResult>> {
    const results: Record<string, PropertyAccessResult> = {};
    
    // Test properties in parallel with concurrency limit
    const concurrencyLimit = 5;
    const batches = [];
    
    for (let i = 0; i < propertyIds.length; i += concurrencyLimit) {
      batches.push(propertyIds.slice(i, i + concurrencyLimit));
    }

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(async (propertyId) => ({
          propertyId,
          result: await this.testPropertyAccess(propertyId),
        }))
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results[result.value.propertyId] = result.value.result;
        } else {
          results[batch[batchResults.indexOf(result)]] = {
            hasAccess: false,
            error: `Batch test failed: ${result.reason}`,
          };
        }
      });

      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }


  /**
   * Get onboarding instructions for clients
   */
  getOnboardingInstructions(): {
    serviceAccountEmail: string;
    steps: string[];
    helpUrl: string;
  } {
    return {
      serviceAccountEmail: this.config.serviceAccountEmail,
      steps: [
        'Log into your Google Analytics account at analytics.google.com',
        'Navigate to Admin (gear icon in the bottom left)',
        'In the Property column, click \"Property Access Management\"',
        `Click the \"+\" button and select \"Add users\"`,
        `Add this email as a Viewer: ${this.config.serviceAccountEmail}`,
        'Set the role to \"Viewer\" (read-only access)',
        'Click \"Add\" to save the changes',
        'Return to this page and click \"Test Connection\" to verify access',
      ],
      helpUrl: 'https://support.google.com/analytics/answer/1009702',
    };
  }

  /**
   * Encrypt sensitive data before storing in database
   */
  encrypt(text: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, authTag, and encrypted data
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error({ error }, 'Encryption failed');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data from database
   */
  decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const algorithm = 'aes-256-gcm';
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error({ error }, 'Decryption failed');
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Track API usage for quota monitoring
   */
  private async trackApiUsage(
    propertyId: string,
    endpoint: string,
    responseTime: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      const now = new Date();
      const hour = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const day = now.toISOString().slice(0, 10); // YYYY-MM-DD

      // This would typically be saved to the database
      // For now, we'll track in memory and log
      const usageKey = `${propertyId}-${day}`;
      const currentUsage = this.quotaTracker.get(usageKey) || {
        dailyUsage: 0,
        dailyLimit: parseInt(process.env.GA4_DAILY_QUOTA_LIMIT || '100000'),
        hourlyUsage: 0,
        hourlyLimit: parseInt(process.env.GA4_HOURLY_QUOTA_LIMIT || '10000'),
        remainingDaily: 0,
        remainingHourly: 0,
      };

      currentUsage.dailyUsage += 1;
      currentUsage.remainingDaily = currentUsage.dailyLimit - currentUsage.dailyUsage;
      currentUsage.remainingHourly = currentUsage.hourlyLimit - currentUsage.hourlyUsage;

      this.quotaTracker.set(usageKey, currentUsage);

      logger.debug({
        propertyId,
        endpoint,
        responseTime,
        success,
        errorMessage,
        quotaUsage: currentUsage,
      }, 'API usage tracked');

      // Warn if approaching quota limits
      if (currentUsage.remainingDaily < 1000) {
        logger.warn({ propertyId, remainingDaily: currentUsage.remainingDaily }, 'Approaching daily quota limit');
      }
      
      if (currentUsage.remainingHourly < 100) {
        logger.warn({ propertyId, remainingHourly: currentUsage.remainingHourly }, 'Approaching hourly quota limit');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to track API usage');
    }
  }

  /**
   * Get current quota usage for a property
   */
  getQuotaUsage(propertyId: string): QuotaUsage | null {
    const today = new Date().toISOString().slice(0, 10);
    const usageKey = `${propertyId}-${today}`;
    return this.quotaTracker.get(usageKey) || null;
  }

  /**
   * Check if we can make an API call without exceeding quotas
   */
  canMakeApiCall(propertyId: string): boolean {
    const usage = this.getQuotaUsage(propertyId);
    if (!usage) return true;

    return usage.remainingDaily > 0 && usage.remainingHourly > 0;
  }

  /**
   * Get authentication client for direct use in GA4Reporter
   */
  getAuthClient(): JWT {
    return this.jwtClient;
  }

  /**
   * Get Analytics Data client for direct use
   */
  getAnalyticsDataClient(): BetaAnalyticsDataClient {
    return this.analyticsDataClient;
  }

  /**
   * Get service account email
   */
  getServiceAccountEmail(): string {
    return this.config.serviceAccountEmail;
  }

  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.config.projectId;
  }

  /**
   * Get private key
   */
  getPrivateKey(): string {
    return this.config.privateKey;
  }

  /**
   * Validate service account health
   */
  async validateServiceAccountHealth(): Promise<{
    isHealthy: boolean;
    errors: string[];
    metadata: {
      email: string;
      projectId: string;
      environment: string;
      lastChecked: Date;
    };
  }> {
    const errors: string[] = [];
    const startTime = Date.now();

    try {
      // Test basic authentication
      await this.jwtClient.authorize();
      
      // Test Analytics Admin API access
      try {
        await this.analyticsAdmin.accounts.list({ pageSize: 1 });
      } catch (error) {
        errors.push(`Analytics Admin API access failed: ${(error as Error).message}`);
      }

      // Test Analytics Data API access (will fail without a property, but should not auth fail)
      try {
        await this.analyticsDataClient.runReport({
          property: 'properties/test',
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'sessions' }],
          limit: 1,
        });
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (!errorMessage.includes('NOT_FOUND') && !errorMessage.includes('PERMISSION_DENIED')) {
          errors.push(`Analytics Data API access failed: ${errorMessage}`);
        }
      }

      logger.info({ 
        responseTime: Date.now() - startTime,
        errorsCount: errors.length 
      }, 'Service account health check completed');

      return {
        isHealthy: errors.length === 0,
        errors,
        metadata: {
          email: this.config.serviceAccountEmail,
          projectId: this.config.projectId,
          environment: this.config.environment,
          lastChecked: new Date(),
        },
      };
    } catch (error) {
      const errorMessage = `Service account health check failed: ${(error as Error).message}`;
      errors.push(errorMessage);
      
      logger.error({ error, responseTime: Date.now() - startTime }, 'Service account health check failed');

      return {
        isHealthy: false,
        errors,
        metadata: {
          email: this.config.serviceAccountEmail,
          projectId: this.config.projectId,
          environment: this.config.environment,
          lastChecked: new Date(),
        },
      };
    }
  }
}

/**
 * Create a new GA4ServiceAccountManager instance
 */
export function createGA4ServiceAccountManager(config: ServiceAccountConfig): GA4ServiceAccountManager {
  return new GA4ServiceAccountManager(config);
}

/**
 * Utility function to generate a service account config from environment variables
 */
export function createServiceAccountConfigFromEnv(environment?: string): ServiceAccountConfig {
  const env = environment || process.env.NODE_ENV || 'development';
  
  return {
    environment: env as 'development' | 'staging' | 'production',
    serviceAccountEmail: process.env.GA4_SERVICE_ACCOUNT_EMAIL!,
    projectId: process.env.GA4_PROJECT_ID!,
    privateKey: process.env.GA4_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    keyId: process.env.GA4_KEY_ID!,
  };
}

export default {
  GA4ServiceAccountManager,
  createGA4ServiceAccountManager,
  createServiceAccountConfigFromEnv,
};