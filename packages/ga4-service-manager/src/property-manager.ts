/**
 * @file GA4 Property Manager
 * @description Manages GA4 property onboarding, validation, and synchronization
 */

import { GA4ServiceAccountManager } from './service-account-manager';
import { GA4PropertyInfo, PropertyOnboardingFlow, OnboardingStep } from './types';
import { isValidGA4PropertyId, isValidUrl } from './utils';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export interface PropertyOnboardingResult {
  success: boolean;
  propertyInfo?: GA4PropertyInfo;
  onboardingFlow?: PropertyOnboardingFlow;
  error?: string;
  nextSteps?: string[];
}

export interface PropertySyncStatus {
  propertyId: string;
  tenantId: string;
  status: 'pending' | 'active' | 'error' | 'revoked';
  lastSyncAt?: Date;
  lastError?: string;
  dataAvailability: {
    hasRecentData: boolean;
    oldestDate?: string;
    newestDate?: string;
    totalSessions?: number;
  };
}

export interface PropertyValidationResult {
  isValid: boolean;
  hasAccess: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    propertyName?: string;
    websiteUrl?: string;
    timeZone?: string;
    currencyCode?: string;
    accountId?: string;
  };
}

/**
 * GA4 Property Manager for handling property lifecycle
 */
export class GA4PropertyManager {
  constructor(private serviceAccountManager: GA4ServiceAccountManager) {
    logger.info('GA4PropertyManager initialized');
  }

  /**
   * Start the onboarding process for a new GA4 property
   */
  async startPropertyOnboarding(
    tenantId: string,
    propertyId: string,
    propertyName: string,
    websiteUrl?: string
  ): Promise<PropertyOnboardingResult> {
    try {
      // Validate inputs
      if (!isValidGA4PropertyId(propertyId)) {
        return {
          success: false,
          error: 'Invalid GA4 Property ID format. Property IDs should be 9-12 digit numbers.',
        };
      }

      if (websiteUrl && !isValidUrl(websiteUrl)) {
        return {
          success: false,
          error: 'Invalid website URL format.',
        };
      }

      // Create onboarding flow
      const onboardingFlow: PropertyOnboardingFlow = {
        tenantId,
        propertyId,
        currentStep: 0,
        totalSteps: 4,
        steps: this.createOnboardingSteps(),
        status: 'in_progress',
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      // Create property info record
      const propertyInfo: GA4PropertyInfo = {
        id: `${tenantId}-${propertyId}`,
        tenantId,
        propertyId,
        propertyName,
        websiteUrl,
        isActive: false,
        syncStatus: 'pending',
        metadata: {
          onboardingStarted: new Date().toISOString(),
        },
      };

      logger.info({ tenantId, propertyId, propertyName }, 'Property onboarding started');

      return {
        success: true,
        propertyInfo,
        onboardingFlow,
        nextSteps: [
          'Follow the step-by-step instructions to add the service account to your GA4 property',
          'Test the connection once access has been granted',
          'Complete the onboarding process',
        ],
      };
    } catch (error) {
      logger.error({ tenantId, propertyId, error }, 'Property onboarding failed to start');
      
      return {
        success: false,
        error: `Failed to start onboarding: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Validate and test access to a GA4 property
   */
  async validateProperty(
    propertyId: string,
    tenantId?: string
  ): Promise<PropertyValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic format validation
      if (!isValidGA4PropertyId(propertyId)) {
        errors.push('Invalid GA4 Property ID format. Property IDs should be 9-12 digit numbers.');
      }

      if (errors.length > 0) {
        return {
          isValid: false,
          hasAccess: false,
          errors,
          warnings,
        };
      }

      // Test access to the property
      const accessResult = await this.serviceAccountManager.testPropertyAccess(propertyId);

      if (!accessResult.hasAccess) {
        errors.push(accessResult.error || 'Unable to access property');
        
        return {
          isValid: true, // Format is valid, but no access
          hasAccess: false,
          errors,
          warnings,
        };
      }

      // Additional validation checks
      const metadata = accessResult.metadata;
      
      // Check if property has recent data
      try {
        const hasRecentData = await this.checkForRecentData(propertyId);
        if (!hasRecentData) {
          warnings.push('Property has no data in the last 30 days. Reports may be empty.');
        }
      } catch (dataError) {
        warnings.push('Unable to check for recent data. Property may be new or have limited access.');
      }

      // Validate property configuration
      if (metadata?.websiteUrl && !isValidUrl(metadata.websiteUrl)) {
        warnings.push('Property website URL appears to be invalid.');
      }

      if (!metadata?.propertyName || metadata.propertyName.trim().length === 0) {
        warnings.push('Property name is not set or empty.');
      }

      logger.info({ 
        propertyId, 
        tenantId, 
        hasAccess: true, 
        warningsCount: warnings.length 
      }, 'Property validation completed');

      return {
        isValid: true,
        hasAccess: true,
        errors,
        warnings,
        metadata,
      };
    } catch (error) {
      logger.error({ propertyId, tenantId, error }, 'Property validation failed');
      
      errors.push(`Validation failed: ${(error as Error).message}`);
      
      return {
        isValid: false,
        hasAccess: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Complete the onboarding process after successful validation
   */
  async completePropertyOnboarding(
    tenantId: string,
    propertyId: string
  ): Promise<PropertyOnboardingResult> {
    try {
      // Validate property access one more time
      const validation = await this.validateProperty(propertyId, tenantId);
      
      if (!validation.hasAccess) {
        return {
          success: false,
          error: 'Property validation failed. Please ensure the service account has access.',
        };
      }

      // Update property status
      const propertyInfo: GA4PropertyInfo = {
        id: `${tenantId}-${propertyId}`,
        tenantId,
        propertyId,
        propertyName: validation.metadata?.propertyName || `Property ${propertyId}`,
        websiteUrl: validation.metadata?.websiteUrl,
        isActive: true,
        syncStatus: 'active',
        accessGrantedAt: new Date(),
        lastSyncAt: new Date(),
        metadata: {
          ...validation.metadata,
          onboardingCompleted: new Date().toISOString(),
          warnings: validation.warnings,
        },
      };

      // Create completed onboarding flow
      const onboardingFlow: PropertyOnboardingFlow = {
        tenantId,
        propertyId,
        currentStep: 4,
        totalSteps: 4,
        steps: this.createOnboardingSteps().map(step => ({ ...step, completed: true })),
        status: 'completed',
        startedAt: new Date(), // This would come from database in real implementation
        completedAt: new Date(),
        lastUpdated: new Date(),
      };

      logger.info({ tenantId, propertyId }, 'Property onboarding completed successfully');

      return {
        success: true,
        propertyInfo,
        onboardingFlow,
        nextSteps: [
          'Property is now active and ready for reporting',
          'Automated reports will be generated according to your schedule',
          'You can now request custom reports through the chat interface',
        ],
      };
    } catch (error) {
      logger.error({ tenantId, propertyId, error }, 'Property onboarding completion failed');
      
      return {
        success: false,
        error: `Failed to complete onboarding: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get the current synchronization status of a property
   */
  async getPropertySyncStatus(
    propertyId: string,
    tenantId: string
  ): Promise<PropertySyncStatus> {
    try {
      // Test current access
      const accessResult = await this.serviceAccountManager.testPropertyAccess(propertyId);
      
      let status: PropertySyncStatus['status'] = 'error';
      let lastError: string | undefined;

      if (accessResult.hasAccess) {
        status = 'active';
      } else {
        lastError = accessResult.error;
        
        if (lastError?.includes('PERMISSION_DENIED') || lastError?.includes('NOT_FOUND')) {
          status = 'revoked';
        }
      }

      // Check data availability
      const dataAvailability = await this.checkDataAvailability(propertyId);

      const syncStatus: PropertySyncStatus = {
        propertyId,
        tenantId,
        status,
        lastSyncAt: new Date(),
        lastError,
        dataAvailability,
      };

      logger.debug({ propertyId, tenantId, status }, 'Property sync status checked');

      return syncStatus;
    } catch (error) {
      logger.error({ propertyId, tenantId, error }, 'Failed to get property sync status');
      
      return {
        propertyId,
        tenantId,
        status: 'error',
        lastError: (error as Error).message,
        dataAvailability: {
          hasRecentData: false,
        },
      };
    }
  }

  /**
   * Bulk sync status check for multiple properties
   */
  async bulkSyncStatusCheck(
    properties: Array<{ propertyId: string; tenantId: string }>
  ): Promise<PropertySyncStatus[]> {
    const results: PropertySyncStatus[] = [];
    
    // Process in batches to respect rate limits
    const batchSize = 5;
    
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(({ propertyId, tenantId }) => 
          this.getPropertySyncStatus(propertyId, tenantId)
        )
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const { propertyId, tenantId } = batch[index];
          results.push({
            propertyId,
            tenantId,
            status: 'error',
            lastError: `Batch check failed: ${result.reason}`,
            dataAvailability: { hasRecentData: false },
          });
        }
      });

      // Small delay between batches
      if (i + batchSize < properties.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info({ totalProperties: properties.length, results: results.length }, 'Bulk sync status check completed');

    return results;
  }

  /**
   * Get onboarding instructions for a specific service account
   */
  getOnboardingInstructions(): {
    serviceAccountEmail: string;
    steps: OnboardingStep[];
    helpResources: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  } {
    const instructions = this.serviceAccountManager.getOnboardingInstructions();
    
    return {
      serviceAccountEmail: instructions.serviceAccountEmail,
      steps: this.createOnboardingSteps(),
      helpResources: [
        {
          title: 'Google Analytics Property Access Management',
          url: 'https://support.google.com/analytics/answer/1009702',
          description: 'Official Google guide on managing property access',
        },
        {
          title: 'Understanding GA4 Property IDs',
          url: 'https://support.google.com/analytics/answer/9539598',
          description: 'How to find your GA4 Property ID',
        },
        {
          title: 'GA4 Account Structure',
          url: 'https://support.google.com/analytics/answer/9304153',
          description: 'Understanding accounts, properties, and data streams',
        },
      ],
    };
  }

  /**
   * Create standardized onboarding steps
   */
  private createOnboardingSteps(): OnboardingStep[] {
    const serviceAccountEmail = this.serviceAccountManager.getServiceAccountEmail();
    
    return [
      {
        id: 'access-ga4',
        title: 'Access Google Analytics',
        description: 'Log into your Google Analytics account at analytics.google.com',
        completed: false,
        optional: false,
        helpUrl: 'https://analytics.google.com',
      },
      {
        id: 'navigate-admin',
        title: 'Navigate to Admin Settings',
        description: 'Click the Admin (gear icon) in the bottom left, then select "Property Access Management" in the Property column',
        completed: false,
        optional: false,
        helpUrl: 'https://support.google.com/analytics/answer/1009702#property',
      },
      {
        id: 'add-service-account',
        title: 'Add Service Account',
        description: `Click the "+" button and add this email as a Viewer: ${serviceAccountEmail}`,
        completed: false,
        optional: false,
      },
      {
        id: 'test-connection',
        title: 'Test Connection',
        description: 'Return to this page and click "Test Connection" to verify access has been granted',
        completed: false,
        optional: false,
      },
    ];
  }

  /**
   * Check if property has recent data (last 30 days)
   */
  private async checkForRecentData(propertyId: string): Promise<boolean> {
    try {
      const client = this.serviceAccountManager.getAnalyticsDataClient();
      
      const [response] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [{ name: 'sessions' }],
        limit: 1,
      });

      const totalSessions = response.totals?.[0]?.metricValues?.[0]?.value;
      return totalSessions ? parseInt(totalSessions) > 0 : false;
    } catch (error) {
      logger.warn({ propertyId, error }, 'Failed to check for recent data');
      return false;
    }
  }

  /**
   * Check comprehensive data availability for a property
   */
  private async checkDataAvailability(propertyId: string): Promise<{
    hasRecentData: boolean;
    oldestDate?: string;
    newestDate?: string;
    totalSessions?: number;
  }> {
    try {
      const client = this.serviceAccountManager.getAnalyticsDataClient();
      
      // Check last 90 days of data
      const [response] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
        metrics: [{ name: 'sessions' }],
        dimensions: [{ name: 'date' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      });

      if (!response.rows || response.rows.length === 0) {
        return { hasRecentData: false };
      }

      const totalSessions = response.totals?.[0]?.metricValues?.[0]?.value;
      const firstRow = response.rows[0];
      const lastRow = response.rows[response.rows.length - 1];
      
      const oldestDate = firstRow.dimensionValues?.[0]?.value;
      const newestDate = lastRow.dimensionValues?.[0]?.value;

      // Check if there's data in the last 30 days
      const recentCutoff = new Date();
      recentCutoff.setDate(recentCutoff.getDate() - 30);
      const newestDataDate = newestDate ? new Date(newestDate) : new Date(0);
      
      return {
        hasRecentData: newestDataDate >= recentCutoff,
        oldestDate: oldestDate || undefined,
        newestDate: newestDate || undefined,
        totalSessions: totalSessions ? parseInt(totalSessions) : 0,
      };
    } catch (error) {
      logger.warn({ propertyId, error }, 'Failed to check data availability');
      return { hasRecentData: false };
    }
  }
}

/**
 * Create a new GA4PropertyManager instance
 */
export function createGA4PropertyManager(
  serviceAccountManager: GA4ServiceAccountManager
): GA4PropertyManager {
  return new GA4PropertyManager(serviceAccountManager);
}

export default {
  GA4PropertyManager,
  createGA4PropertyManager,
};