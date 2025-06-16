/**
 * @file Common types for GA4 Service Manager
 */

export interface TenantBranding {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  websiteUrl?: string;
}

export interface GA4PropertyInfo {
  id: string;
  tenantId: string;
  propertyId: string;
  propertyName: string;
  websiteUrl?: string;
  isActive: boolean;
  syncStatus: 'pending' | 'active' | 'error' | 'revoked';
  lastSyncAt?: Date;
  accessGrantedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ReportGenerationOptions {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  reportType: 'overview' | 'traffic' | 'engagement' | 'conversion' | 'pages' | 'keywords' | 'devices';
  format: 'json' | 'pdf' | 'csv';
  includeCharts: boolean;
  branding?: TenantBranding;
  cacheKey?: string;
  cacheTtl?: number; // seconds
}

export interface GA4ApiQuota {
  dailyLimit: number;
  hourlyLimit: number;
  concurrentRequests: number;
  requestsPerSecond: number;
}

export interface ApiUsageMetrics {
  propertyId: string;
  tenantId?: string;
  endpoint: string;
  requestCount: number;
  quotaConsumed: number;
  responseTime: number;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
  hour: string; // YYYY-MM-DD-HH
  day: string; // YYYY-MM-DD
}

export interface ServiceAccountHealth {
  isHealthy: boolean;
  lastChecked: Date;
  errors: string[];
  warnings: string[];
  metadata: {
    email: string;
    projectId: string;
    environment: string;
    totalProperties: number;
    activeProperties: number;
    quotaUsage: {
      daily: number;
      hourly: number;
    };
  };
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  optional: boolean;
  helpUrl?: string;
}

export interface PropertyOnboardingFlow {
  tenantId: string;
  propertyId: string;
  currentStep: number;
  totalSteps: number;
  steps: OnboardingStep[];
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  lastUpdated: Date;
}