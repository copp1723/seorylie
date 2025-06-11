/**
 * @file Utility functions for GA4 Service Manager
 */

import crypto from 'crypto';
import { format, subDays, subWeeks, subMonths } from 'date-fns';

/**
 * Generate a cache key for GA4 reports
 */
export function generateCacheKey(
  propertyId: string,
  reportType: string,
  dateRange: { startDate: string; endDate: string },
  additionalParams?: Record<string, any>
): string {
  const baseKey = `ga4:${propertyId}:${reportType}:${dateRange.startDate}:${dateRange.endDate}`;
  
  if (additionalParams && Object.keys(additionalParams).length > 0) {
    const paramHash = crypto
      .createHash('md5')
      .update(JSON.stringify(additionalParams))
      .digest('hex')
      .slice(0, 8);
    return `${baseKey}:${paramHash}`;
  }
  
  return baseKey;
}

/**
 * Calculate cache TTL based on date range
 */
export function calculateCacheTTL(dateRange: { startDate: string; endDate: string }): number {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  const now = new Date();
  
  // If the end date is today, cache for 1 hour (data might still be updating)
  if (format(end, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) {
    return 3600; // 1 hour
  }
  
  // If the end date is yesterday, cache for 6 hours
  if (format(end, 'yyyy-MM-dd') === format(subDays(now, 1), 'yyyy-MM-dd')) {
    return 21600; // 6 hours
  }
  
  // For older data, cache for 24 hours
  return 86400; // 24 hours
}

/**
 * Validate GA4 property ID format
 */
export function isValidGA4PropertyId(propertyId: string): boolean {
  // GA4 property IDs are numeric strings, typically 9-12 digits
  return /^\d{9,12}$/.test(propertyId);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse date range strings into Date objects
 */
export function parseDateRange(
  dateRange: string | { startDate: string; endDate: string }
): { startDate: Date; endDate: Date } {
  if (typeof dateRange === 'object') {
    return {
      startDate: new Date(dateRange.startDate),
      endDate: new Date(dateRange.endDate),
    };
  }
  
  const now = new Date();
  
  switch (dateRange) {
    case 'last7days':
      return {
        startDate: subDays(now, 7),
        endDate: now,
      };
    case 'last30days':
      return {
        startDate: subDays(now, 30),
        endDate: now,
      };
    case 'last90days':
      return {
        startDate: subDays(now, 90),
        endDate: now,
      };
    case 'lastWeek':
      return {
        startDate: subWeeks(now, 1),
        endDate: now,
      };
    case 'lastMonth':
      return {
        startDate: subMonths(now, 1),
        endDate: now,
      };
    default:
      throw new Error(`Unsupported date range: ${dateRange}`);
  }
}

/**
 * Format date for GA4 API (YYYY-MM-DD)
 */
export function formatDateForGA4(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Get readable date range description
 */
export function getDateRangeDescription(dateRange: { startDate: string; endDate: string }): string {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  
  const startFormatted = format(start, 'MMM d, yyyy');
  const endFormatted = format(end, 'MMM d, yyyy');
  
  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Sanitize tenant branding data
 */
export function sanitizeBranding(branding: any): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  if (branding?.companyName) {
    sanitized.companyName = String(branding.companyName).slice(0, 100);
  }
  
  if (branding?.logoUrl && isValidUrl(branding.logoUrl)) {
    sanitized.logoUrl = branding.logoUrl;
  }
  
  if (branding?.primaryColor && isValidHexColor(branding.primaryColor)) {
    sanitized.primaryColor = branding.primaryColor;
  }
  
  if (branding?.secondaryColor && isValidHexColor(branding.secondaryColor)) {
    sanitized.secondaryColor = branding.secondaryColor;
  }
  
  if (branding?.fontFamily) {
    sanitized.fontFamily = String(branding.fontFamily).slice(0, 50);
  }
  
  if (branding?.websiteUrl && isValidUrl(branding.websiteUrl)) {
    sanitized.websiteUrl = branding.websiteUrl;
  }
  
  return sanitized;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    
    // Calculate wait time
    const waitTime = (1 - this.tokens) / this.refillRate * 1000;
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on authentication or permission errors
      if (
        lastError.message.includes('PERMISSION_DENIED') ||
        lastError.message.includes('UNAUTHENTICATED') ||
        lastError.message.includes('NOT_FOUND')
      ) {
        throw lastError;
      }
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Deep merge objects
 */
export function deepMerge(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}