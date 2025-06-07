/**
 * @file Main export file for the core-agent package
 * @description Exports SEO agent components for Rylie SEO white-label platform
 */

// Export SEOAgent class and factory function
export { SEOAgent, createSEOAgent } from "./seo-agent";

// Re-export types for convenience
import type { OpenAI } from "openai";
import type { Redis } from "ioredis";
import type {
  SeoRequest,
  PageRequest,
  BlogRequest,
  GBPRequest,
  MaintenanceRequest,
  InstallProfile,
  GA4Report,
} from "@rylie-seo/seo-schema";

// Export types
export type {
  OpenAI,
  Redis,
  SeoRequest,
  PageRequest,
  BlogRequest,
  GBPRequest,
  MaintenanceRequest,
  InstallProfile,
  GA4Report,
};

// Default export
import * as SeoAgent from "./seo-agent";
export default SeoAgent;
