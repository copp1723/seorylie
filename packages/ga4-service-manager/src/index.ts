/**
 * @file GA4 Service Manager Package Entry Point
 * @description Exports all service account management functionality
 */

export {
  GA4ServiceAccountManager,
  createGA4ServiceAccountManager,
  createServiceAccountConfigFromEnv,
  type ServiceAccountConfig,
  type PropertyAccessResult,
  type QuotaUsage,
} from './service-account-manager';

export {
  CentralizedGA4Client,
  createCentralizedGA4Client,
  type CentralizedClientOptions,
} from './centralized-client';

export {
  GA4PropertyManager,
  createGA4PropertyManager,
  type PropertyOnboardingResult,
  type PropertySyncStatus,
} from './property-manager';

// Re-export common types and utilities
export * from './types';
export * from './utils';