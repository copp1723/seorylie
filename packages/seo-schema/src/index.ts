/**
 * @file Main export file for the SEO schema package
 * @description Exports all schemas, types, and prompt functions
 */

// Export all schemas and types
export * from './schemas';

// Export all prompt functions
export * from './prompts';

// Import for default export
import * as Schemas from './schemas';
import * as Prompts from './prompts';

// Default export with all components
export default {
  // Schemas
  SeoRequestSchema: Schemas.SeoRequestSchema,
  PageRequestSchema: Schemas.PageRequestSchema,
  BlogRequestSchema: Schemas.BlogRequestSchema,
  GBPRequestSchema: Schemas.GBPRequestSchema,
  MaintenanceRequestSchema: Schemas.MaintenanceRequestSchema,
  AssetSchema: Schemas.AssetSchema,
  VendorResponseSchema: Schemas.VendorResponseSchema,
  InstallProfileSchema: Schemas.InstallProfileSchema,
  GA4ReportSchema: Schemas.GA4ReportSchema,
  
  // Types
  SeoRequest: {} as Schemas.SeoRequest,
  PageRequest: {} as Schemas.PageRequest,
  BlogRequest: {} as Schemas.BlogRequest,
  GBPRequest: {} as Schemas.GBPRequest,
  MaintenanceRequest: {} as Schemas.MaintenanceRequest,
  Asset: {} as Schemas.Asset,
  VendorResponse: {} as Schemas.VendorResponse,
  InstallProfile: {} as Schemas.InstallProfile,
  GA4Report: {} as Schemas.GA4Report,
  
  // Prompts
  SeoPrompts: Prompts.SeoPrompts,
  SEO_AGENT_BASE_PROMPT: Prompts.SEO_AGENT_BASE_PROMPT,
  generateSeoRequestPrompt: Prompts.generateSeoRequestPrompt,
  determineRequestType: Prompts.determineRequestType,
  generatePageRequestPrompt: Prompts.generatePageRequestPrompt,
  generateBlogRequestPrompt: Prompts.generateBlogRequestPrompt,
  generateGBPRequestPrompt: Prompts.generateGBPRequestPrompt,
  generateMaintenanceRequestPrompt: Prompts.generateMaintenanceRequestPrompt,
  generateGenericSeoRequestPrompt: Prompts.generateGenericSeoRequestPrompt,
  generateInstallFormPrompt: Prompts.generateInstallFormPrompt,
  generateGA4ReportPrompt: Prompts.generateGA4ReportPrompt,
  generatePublishNotificationPrompt: Prompts.generatePublishNotificationPrompt
};
