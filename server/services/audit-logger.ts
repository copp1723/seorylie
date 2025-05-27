/**
 * Enterprise-grade audit logging service for security compliance
 * This service provides comprehensive audit trail capabilities for security compliance requirements
 * Enhanced with risk assessment, real-time notifications, and rich event context capture
 */

import db from "../db";
import { auditLogs, users as usersTable, dealerships, insertAuditLogSchema } from '../../shared/schema';
import { eq, sql, and, desc, gte, lte } from 'drizzle-orm';
import logger from '../utils/logger';

// Categorize event types by risk level for security analysis
const RISK_LEVELS = {
  HIGH: [
    'admin_login_failed',
    'api_key_revoked',
    'user_permission_changed',
    'security_alert',
    'security_policy_changed', 
    'suspicious_activity_detected',
    'rate_limit_exceeded',
    'user_locked'
  ],
  MEDIUM: [
    'api_key_created',
    'api_key_rotated',
    'password_changed',
    'password_reset_requested',
    'mfa_disabled',
    'user_created',
    'user_deleted',
    'dealership_deleted',
    'data_export'
  ],
  LOW: [
    'admin_login',
    'admin_logout',
    'prompt_modified',
    'prompt_tested',
    'settings_changed',
    'user_updated',
    'dealership_updated',
    'handover_processed',
    'data_import',
    'report_generated'
  ]
};

interface AuditLogParams {
  eventType: string;
  userId?: number;
  dealershipId?: number;
  resourceId?: string;
  resourceType?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  severity?: 'info' | 'warning' | 'critical'; // Optional severity override
}

/**
 * Determines the risk level of an event type
 * @param eventType The type of event
 * @returns 'high', 'medium', or 'low' risk level
 */
function determineRiskLevel(eventType: string): 'high' | 'medium' | 'low' {
  if (RISK_LEVELS.HIGH.includes(eventType)) {
    return 'high';
  } else if (RISK_LEVELS.MEDIUM.includes(eventType)) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Adds contextual information to audit log details
 * @param params Original audit parameters
 * @returns Enhanced audit parameters with context
 */
function enrichAuditContext(params: AuditLogParams): Record<string, any> {
  const riskLevel = determineRiskLevel(params.eventType);
  const enrichedDetails = {
    ...params.details,
    meta: {
      ...(params.details.meta || {}),
      timestamp: new Date().toISOString(),
      riskLevel,
      sessionId: params.details.sessionId || null,
      eventCategory: getEventCategory(params.eventType),
      // Add OS and browser info from user agent if available
      ...(params.userAgent ? parseUserAgent(params.userAgent) : {})
    }
  };
  
  return enrichedDetails;
}

/**
 * Extracts event category from event type
 */
function getEventCategory(eventType: string): string {
  if (eventType.includes('api_key')) return 'api_security';
  if (eventType.includes('login') || eventType.includes('password') || eventType.includes('mfa')) return 'authentication';
  if (eventType.includes('user')) return 'user_management';
  if (eventType.includes('dealership')) return 'organization';
  if (eventType.includes('prompt') || eventType.includes('persona')) return 'content';
  if (eventType.includes('security') || eventType.includes('suspicious')) return 'security';
  if (eventType.includes('data')) return 'data_management';
  return 'general';
}

/**
 * Basic user agent parser to extract device/browser info for security analysis
 */
function parseUserAgent(userAgent: string): Record<string, any> {
  const info: Record<string, any> = {};
  
  if (userAgent.includes('Windows')) {
    info.os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    info.os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    info.os = 'Linux';
  } else if (userAgent.includes('Android')) {
    info.os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    info.os = 'iOS';
  }
  
  if (userAgent.includes('Chrome')) {
    info.browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    info.browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    info.browser = 'Safari';
  } else if (userAgent.includes('Edge')) {
    info.browser = 'Edge';
  }
  
  return info;
}

/**
 * Function to log audit events for security and compliance tracking
 * Enhanced with risk assessment and contextual metadata
 * @param params Audit log parameters
 */
export async function logAuditEvent(params: AuditLogParams) {
  try {
    // Determine risk level for this event type
    const riskLevel = determineRiskLevel(params.eventType);
    
    // Enrich with contextual metadata
    const enrichedDetails = enrichAuditContext(params);
    
    const auditLogData = {
      eventType: params.eventType as any, // type casting due to string vs enum constraint
      userId: params.userId,
      dealershipId: params.dealershipId,
      resourceId: params.resourceId?.toString(),
      resourceType: params.resourceType,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: enrichedDetails,
    };

    // Validate data with the schema
    const validatedData = insertAuditLogSchema.parse(auditLogData);

    // Insert into database
    await db.insert(auditLogs).values(validatedData);

    // Log with appropriate severity based on risk level
    const logMethod = riskLevel === 'high' ? 'warn' : 'info';
    logger[logMethod](`Audit log recorded: ${params.eventType}`, { 
      event: params.eventType,
      resourceType: params.resourceType,
      riskLevel,
      userId: params.userId,
      dealershipId: params.dealershipId
    });
    
    // For high-risk events, trigger additional notification or processing
    if (riskLevel === 'high') {
      // This would be implemented to send real-time alerts
      await notifySecurityEvent(params, riskLevel);
    }
  } catch (error) {
    logger.error('Failed to record audit log', { error, params });
  }
}

/**
 * Sends notifications for high-risk security events
 * In a production environment, this would connect to a notification service
 */
async function notifySecurityEvent(params: AuditLogParams, riskLevel: string) {
  // This would be implemented to connect to notification services
  // such as email, Slack, or a dedicated security monitoring system
  logger.warn('Security event notification', {
    eventType: params.eventType,
    riskLevel,
    dealershipId: params.dealershipId,
    userId: params.userId,
    timestamp: new Date().toISOString()
  });
  
  // For now, just log the notification - in production this would send alerts
}

/**
 * Query audit logs by various criteria
 * @param criteria Search criteria
 * @param limit Number of records to return
 * @param offset Pagination offset
 */
export async function searchAuditLogs(
  criteria: {
    eventType?: string;
    userId?: number;
    dealershipId?: number;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
  },
  limit = 100,
  offset = 0
) {
  try {
    let query = db.select().from(auditLogs);

    // Apply filters based on provided criteria
    if (criteria.eventType) {
      query = query.where(eq(auditLogs.eventType, criteria.eventType as any));
    }

    if (criteria.userId) {
      query = query.where(eq(auditLogs.userId, criteria.userId));
    }

    if (criteria.dealershipId) {
      query = query.where(eq(auditLogs.dealershipId, criteria.dealershipId));
    }

    if (criteria.resourceType) {
      query = query.where(eq(auditLogs.resourceType, criteria.resourceType));
    }

    if (criteria.resourceId) {
      query = query.where(eq(auditLogs.resourceId, criteria.resourceId));
    }

    // Add date range filtering if provided
    if (criteria.startDate && criteria.endDate) {
      query = query.where(
        sql`${auditLogs.createdAt} BETWEEN ${criteria.startDate} AND ${criteria.endDate}`
      );
    } else if (criteria.startDate) {
      query = query.where(sql`${auditLogs.createdAt} >= ${criteria.startDate}`);
    } else if (criteria.endDate) {
      query = query.where(sql`${auditLogs.createdAt} <= ${criteria.endDate}`);
    }

    // Order and paginate
    query = query
      .orderBy(auditLogs.createdAt)
      .limit(limit)
      .offset(offset);

    return await query;
  } catch (error) {
    logger.error('Failed to search audit logs', { error, criteria });
    return [];
  }
}

/**
 * Get recent audit logs for a specific entity
 * @param entityType Type of entity (user, dealership, apiKey, etc.)
 * @param entityId ID of the entity
 * @param limit Number of records to return
 */
export async function getRecentAuditLogs(
  entityType: string,
  entityId: string | number,
  limit = 10
) {
  try {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.resourceType, entityType))
      .where(eq(auditLogs.resourceId, entityId.toString()))
      .orderBy(auditLogs.createdAt)
      .limit(limit);
  } catch (error) {
    logger.error('Failed to get recent audit logs', { error, entityType, entityId });
    return [];
  }
}

/**
 * Generate a compliance report for a specific dealership
 * This is useful for generating security audit reports for enterprise customers
 * @param dealershipId The dealership ID
 * @param startDate Report start date
 * @param endDate Report end date
 */
export async function generateComplianceReport(
  dealershipId: number,
  startDate: Date,
  endDate: Date
) {
  try {
    // Get dealership info
    const dealership = await db
      .select()
      .from(dealerships)
      .where(eq(dealerships.id, dealershipId))
      .limit(1);

    if (dealership.length === 0) {
      throw new Error(`Dealership with ID ${dealershipId} not found`);
    }

    // Get all audit logs for this dealership in the date range
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.dealershipId, dealershipId))
      .where(sql`${auditLogs.createdAt} BETWEEN ${startDate} AND ${endDate}`)
      .orderBy(auditLogs.createdAt);

    // Get distinct users who took actions
    const userIds = [...new Set(logs.map(log => log.userId).filter(Boolean))];
    
    const usersList = userIds.length > 0 
      ? await db
          .select()
          .from(usersTable)
          .where(sql`${usersTable.id} IN (${userIds.join(',')})`)
      : [];

    // Compile the report
    return {
      dealership: dealership[0],
      reportPeriod: {
        startDate,
        endDate,
      },
      summary: {
        totalEvents: logs.length,
        userCount: userIds.length,
        eventTypes: countEventTypes(logs),
        resourceTypes: countResourceTypes(logs),
      },
      users: usersList,
      logs,
    };
  } catch (error) {
    logger.error('Failed to generate compliance report', { error, dealershipId });
    throw new Error(`Failed to generate compliance report: ${error.message}`);
  }
}

// Helper function to count event types
function countEventTypes(logs: any[]) {
  return logs.reduce((acc: Record<string, number>, log) => {
    acc[log.eventType] = (acc[log.eventType] || 0) + 1;
    return acc;
  }, {});
}

// Helper function to count resource types
function countResourceTypes(logs: any[]) {
  return logs.reduce((acc: Record<string, number>, log) => {
    if (log.resourceType) {
      acc[log.resourceType] = (acc[log.resourceType] || 0) + 1;
    }
    return acc;
  }, {});
}

