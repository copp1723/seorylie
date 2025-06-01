/**
 * External API Integration Guards
 * 
 * Feature flags for all external API integrations to enable safe rollout,
 * testing, and emergency disabling of external services.
 * 
 * @file server/services/external-api-flags.ts
 */

import { featureFlags, isFeatureEnabled } from './feature-flags';
import logger from '../utils/logger';

/**
 * Enum of all external API integration feature flags
 */
export enum ExternalAPIFlags {
  GoogleAdsETL = 'google-ads-etl',
  TwilioSMS = 'twilio-sms',
  SendGridEmail = 'sendgrid-email',
  OpenAIChat = 'openai-chat',
  ADFIntegration = 'adf-integration'
}

/**
 * Initialize external API feature flags
 */
export function initializeExternalAPIFlags(): void {
  // Add all external API flags to the feature flag system
  Object.values(ExternalAPIFlags).forEach(flagName => {
    if (!featureFlags.getConfiguration().flags[flagName]) {
      featureFlags.addFlag({
        name: flagName,
        enabled: true, // Default to enabled
        description: `External API integration: ${flagName}`,
        environments: ['production', 'staging', 'development']
      });
    }
  });
  
  logger.info('External API feature flags initialized', {
    flagCount: Object.keys(ExternalAPIFlags).length
  });
}

/**
 * Check if an external API integration is enabled
 * @param flagName The external API flag to check
 * @param dealershipId Optional dealership ID for dealership-specific flags
 * @returns boolean indicating if the integration is enabled
 */
export function isExternalAPIEnabled(
  flagName: ExternalAPIFlags,
  dealershipId?: number
): boolean {
  // Check if the flag exists and is enabled
  const isEnabled = isFeatureEnabled(flagName, dealershipId?.toString());
  
  // Log access attempts for monitoring
  logger.debug('External API flag check', {
    flag: flagName,
    enabled: isEnabled,
    dealershipId
  });
  
  return isEnabled;
}

/**
 * Disable an external API integration (for emergency use)
 * @param flagName The external API flag to disable
 * @param reason Reason for disabling
 * @returns boolean indicating success
 */
export function disableExternalAPI(
  flagName: ExternalAPIFlags,
  reason: string
): boolean {
  const result = featureFlags.toggleFlag(flagName, false);
  
  if (result) {
    logger.warn(`External API ${flagName} disabled`, { reason });
  } else {
    logger.error(`Failed to disable external API ${flagName}`, { reason });
  }
  
  return result;
}

/**
 * Enable an external API integration
 * @param flagName The external API flag to enable
 * @returns boolean indicating success
 */
export function enableExternalAPI(flagName: ExternalAPIFlags): boolean {
  const result = featureFlags.toggleFlag(flagName, true);
  
  if (result) {
    logger.info(`External API ${flagName} enabled`);
  } else {
    logger.error(`Failed to enable external API ${flagName}`);
  }
  
  return result;
}

/**
 * Get status of all external API integrations
 * @returns Record of all external API flags and their enabled status
 */
export function getExternalAPIStatus(): Record<ExternalAPIFlags, boolean> {
  const status: Partial<Record<ExternalAPIFlags, boolean>> = {};
  
  Object.values(ExternalAPIFlags).forEach(flagName => {
    status[flagName] = isFeatureEnabled(flagName);
  });
  
  return status as Record<ExternalAPIFlags, boolean>;
}

// Initialize external API flags when this module is imported
initializeExternalAPIFlags();