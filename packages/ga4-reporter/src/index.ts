/**
 * @file Main export file for the ga4-reporter package
 * @description Exports all GA4 client components and utilities for analytics reporting
 */

// Import GA4 client components
import {
  GA4Client,
  createGA4Client,
  GA4ClientOptions,
  GA4ReportType,
  GA4MetricType,
  GA4DimensionType,
  GA4ReportResult
} from './ga4-client';

// Export all components
export {
  // GA4 Client
  GA4Client,
  createGA4Client,
  GA4ClientOptions,
  GA4ReportType,
  GA4MetricType,
  GA4DimensionType,
  GA4ReportResult
};

// Re-export types from schema
import type { GA4Report } from '@rylie-seo/seo-schema';
export type { GA4Report };

/**
 * Generate a weekly GA4 report for a sandbox
 * @param sandboxId Sandbox ID
 * @param propertyId GA4 property ID
 * @param options Report options
 * @returns Promise with GA4Report object
 */
export async function generateWeeklyGA4Report(
  sandboxId: string,
  propertyId: string,
  options: {
    dateRange?: 'last7days' | 'last30days' | 'last90days' | 'custom';
    customStartDate?: string;
    customEndDate?: string;
    reportTypes?: GA4ReportType[];
    credentials?: {
      client_email: string;
      private_key: string;
      project_id: string;
    };
    keyFilePath?: string;
  } = {}
): Promise<GA4Report> {
  // Create GA4 client
  const ga4Client = createGA4Client({
    propertyId,
    credentials: options.credentials,
    keyFilePath: options.keyFilePath,
    whiteLabelName: 'Rylie SEO',
    whiteLabelColorPrimary: '#4A90E2',
    whiteLabelColorSecondary: '#50E3C2'
  });
  
  // Generate weekly report
  return await ga4Client.generateWeeklyReport(sandboxId, {
    dateRange: options.dateRange || 'last7days',
    customStartDate: options.customStartDate,
    customEndDate: options.customEndDate,
    reportTypes: options.reportTypes || [GA4ReportType.OVERVIEW, GA4ReportType.TRAFFIC, GA4ReportType.PAGES]
  });
}

// Default export
export default {
  GA4Client,
  createGA4Client,
  GA4ReportType,
  GA4MetricType,
  GA4DimensionType,
  generateWeeklyGA4Report
};
