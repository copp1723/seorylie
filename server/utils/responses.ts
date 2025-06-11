/**
 * @file Common Response Utilities
 * @description Standardized response helpers to eliminate duplication
 */

import { Response } from 'express';
import { createLogger } from './logger';

const logger = createLogger('response-utils');

interface User {
  id: string;
  role: string;
  tenantId?: string;
  agencyId?: string;
}

interface TenantBranding {
  companyName: string;
  logo?: string;
  primaryColor?: string;
}

interface ErrorContext {
  error: unknown;
  userId?: string;
  action?: string;
  details?: Record<string, any>;
}

interface SuccessResponse {
  success: true;
  data?: any;
  message?: string;
  total?: number;
  branding?: TenantBranding;
  [key: string]: any;
}

interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
  branding?: TenantBranding;
}

/**
 * Send standardized success response
 */
export const sendSuccess = (
  res: Response,
  data?: any,
  message?: string,
  extra?: Record<string, any>
): void => {
  const response: SuccessResponse = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...extra
  };
  
  res.json(response);
};

/**
 * Send standardized error response with logging
 */
export const sendError = (
  res: Response,
  statusCode: number,
  errorMessage: string,
  context?: ErrorContext,
  extra?: Record<string, any>
): void => {
  if (context) {
    logger.error(context.action || 'API Error', {
      error: context.error instanceof Error ? context.error.message : 'Unknown error',
      userId: context.userId,
      statusCode,
      ...context.details
    });
  }

  const response: ErrorResponse = {
    success: false,
    error: errorMessage,
    ...extra
  };

  res.status(statusCode).json(response);
};

/**
 * Generate unique ID
 */
export const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate required fields
 */
export const validateRequiredFields = (
  data: Record<string, any>,
  requiredFields: string[]
): string[] => {
  return requiredFields.filter(field => !data[field]);
};

/**
 * Log user action
 */
export const logUserAction = (
  action: string,
  user: User,
  details?: Record<string, any>
): void => {
  logger.info(action, {
    userId: user.id,
    userRole: user.role,
    tenantId: user.tenantId,
    agencyId: user.agencyId,
    ...details
  });
};