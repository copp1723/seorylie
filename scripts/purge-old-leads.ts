#!/usr/bin/env ts-node
/**
 * Data Retention & Purging Script - GDPR/CCPA Compliance
 * 
 * This script handles automated data retention policies in compliance with
 * GDPR/CCPA regulations. It performs the following operations:
 * 
 * 1. Anonymizes records that have passed their retention date
 * 2. Permanently deletes very old records (beyond legal requirements)
 * 3. Verifies consent and updates retention dates accordingly
 * 4. Logs all operations for audit purposes
 * 5. Reports metrics to monitoring system
 * 
 * Usage:
 *   npm run purge-old-leads
 * 
 * Environment variables:
 *   GDPR_DATA_RETENTION_DAYS - Default retention period (default: 730 days)
 *   DRY_RUN - Set to "true" to simulate without making changes
 *   BATCH_SIZE - Number of records to process in each batch (default: 1000)
 *   LOG_LEVEL - Logging verbosity (default: info)
 *   NOTIFY_EMAIL - Email to notify on completion/errors
 * 
 * This script is designed to be run as a nightly cron job.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import logger from '../server/utils/logger';
import { prometheusMetrics } from '../server/services/prometheus-metrics';
import nodemailer from 'nodemailer';
import { maskPII } from '../server/utils/crypto';

// Load environment variables
dotenv.config();

// Configuration
const config = {
  // Database connection (from env or default)
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cleanrylie',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  },
  
  // Data retention settings
  retention: {
    defaultDays: parseInt(process.env.GDPR_DATA_RETENTION_DAYS || '730', 10),
    extendedConsentDays: parseInt(process.env.GDPR_EXTENDED_CONSENT_DAYS || '1095', 10), // ~3 years
    veryOldRecordsDays: parseInt(process.env.GDPR_VERY_OLD_RECORDS_DAYS || '1825', 10), // ~5 years
    batchSize: parseInt(process.env.BATCH_SIZE || '1000', 10)
  },
  
  // Execution settings
  execution: {
    dryRun: process.env.DRY_RUN === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
    notifyEmail: process.env.NOTIFY_EMAIL,
    auditLogPath: process.env.AUDIT_LOG_PATH || path.join(process.cwd(), 'logs', 'data-retention')
  }
};

// Statistics for reporting
interface PurgeStats {
  startTime: Date;
  endTime?: Date;
  recordsScanned: number;
  recordsAnonymized: number;
  recordsDeleted: number;
  consentVerified: number;
  retentionExtended: number;
  errors: number;
  dryRun: boolean;
}

// Initialize statistics
const stats: PurgeStats = {
  startTime: new Date(),
  recordsScanned: 0,
  recordsAnonymized: 0,
  recordsDeleted: 0,
  consentVerified: 0,
  retentionExtended: 0,
  errors: 0,
  dryRun: config.execution.dryRun
};

// Database connection
let pool: Pool;

/**
 * Main execution function
 */
async function main() {
  logger.info('Starting data retention and purging process', {
    dryRun: config.execution.dryRun,
    retentionDays: config.retention.defaultDays
  });
  
  try {
    // Initialize database connection
    pool = new Pool(config.database);
    
    // Ensure audit log directory exists
    await ensureAuditLogDirectory();
    
    // Verify database connection and encryption key
    await verifyDatabaseSetup();
    
    // Step 1: Anonymize expired records
    await anonymizeExpiredRecords();
    
    // Step 2: Delete very old records
    await deleteVeryOldRecords();
    
    // Step 3: Verify consent and update retention dates
    await verifyConsentAndUpdateRetention();
    
    // Step 4: Generate audit report
    const reportPath = await generateAuditReport();
    
    // Complete the process
    stats.endTime = new Date();
    const durationMs = stats.endTime.getTime() - stats.startTime.getTime();
    
    logger.info('Data retention process completed successfully', {
      ...stats,
      durationMs,
      reportPath
    });
    
    // Send notification if configured
    if (config.execution.notifyEmail) {
      await sendCompletionNotification(reportPath);
    }
    
    // Record metrics
    recordMetrics();
    
  } catch (error) {
    stats.errors++;
    logger.error('Error in data retention process', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Send error notification if configured
    if (config.execution.notifyEmail) {
      await sendErrorNotification(error);
    }
    
    // Record error metrics
    prometheusMetrics.incrementLeadsProcessed({
      dealership_id: '0',
      source_provider: 'data-retention',
      lead_type: 'purge',
      status: 'error'
    });
    
    process.exit(1);
  } finally {
    // Close database connection
    if (pool) {
      await pool.end();
    }
  }
  
  process.exit(0);
}

/**
 * Ensure the audit log directory exists
 */
async function ensureAuditLogDirectory(): Promise<void> {
  try {
    await fs.promises.mkdir(config.execution.auditLogPath, { recursive: true });
    logger.debug('Audit log directory ensured', { path: config.execution.auditLogPath });
  } catch (error) {
    logger.error('Error creating audit log directory', {
      error: error instanceof Error ? error.message : String(error),
      path: config.execution.auditLogPath
    });
    throw error;
  }
}

/**
 * Verify database connection and encryption key
 */
async function verifyDatabaseSetup(): Promise<void> {
  try {
    // Test database connection
    const client = await pool.connect();
    
    try {
      // Check if encryption key is set
      const encryptionKeyResult = await client.query(`
        SELECT current_setting('app.encryption_key', true) AS encryption_key
      `);
      
      if (!encryptionKeyResult.rows[0].encryption_key) {
        throw new Error('Database encryption key (app.encryption_key) is not set');
      }
      
      // Test encryption/decryption
      const testResult = await client.query(`
        SELECT encrypt_pii('test') AS encrypted, 
               decrypt_pii(encrypt_pii('test')) AS decrypted
      `);
      
      if (testResult.rows[0].decrypted !== 'test') {
        throw new Error('Encryption/decryption test failed');
      }
      
      logger.info('Database connection and encryption verified successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Database verification failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Anonymize records that have passed their retention date
 */
async function anonymizeExpiredRecords(): Promise<void> {
  logger.info('Starting anonymization of expired records');
  
  try {
    if (config.execution.dryRun) {
      // In dry run mode, just count the records that would be anonymized
      const countResult = await pool.query(`
        SELECT COUNT(*) AS count
        FROM adf_leads
        WHERE data_retention_date < CURRENT_DATE
          AND NOT anonymized
      `);
      
      stats.recordsAnonymized = parseInt(countResult.rows[0].count, 10);
      logger.info('Dry run: would anonymize records', { count: stats.recordsAnonymized });
    } else {
      // Call the database function to anonymize expired records
      const result = await pool.query(`
        SELECT anonymize_expired_leads() AS anonymized_count
      `);
      
      stats.recordsAnonymized = parseInt(result.rows[0].anonymized_count, 10);
      logger.info('Anonymized expired records', { count: stats.recordsAnonymized });
      
      // Record metrics
      prometheusMetrics.incrementLeadsProcessed({
        dealership_id: '0',
        source_provider: 'data-retention',
        lead_type: 'anonymize',
        status: 'success'
      });
    }
  } catch (error) {
    stats.errors++;
    logger.error('Error anonymizing expired records', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Record error metrics
    prometheusMetrics.incrementLeadsProcessed({
      dealership_id: '0',
      source_provider: 'data-retention',
      lead_type: 'anonymize',
      status: 'error'
    });
    
    throw error;
  }
}

/**
 * Delete very old records (beyond legal requirements)
 */
async function deleteVeryOldRecords(): Promise<void> {
  logger.info('Starting deletion of very old records');
  
  try {
    if (config.execution.dryRun) {
      // In dry run mode, just count the records that would be deleted
      const countResult = await pool.query(`
        SELECT COUNT(*) AS count
        FROM adf_leads
        WHERE data_retention_date < (CURRENT_DATE - interval '3 years')
          AND anonymized = true
      `);
      
      stats.recordsDeleted = parseInt(countResult.rows[0].count, 10);
      logger.info('Dry run: would delete very old records', { count: stats.recordsDeleted });
    } else {
      // Call the database function to delete very old records
      const result = await pool.query(`
        SELECT delete_very_old_leads() AS deleted_count
      `);
      
      stats.recordsDeleted = parseInt(result.rows[0].deleted_count, 10);
      logger.info('Deleted very old records', { count: stats.recordsDeleted });
      
      // Record metrics
      prometheusMetrics.incrementLeadsProcessed({
        dealership_id: '0',
        source_provider: 'data-retention',
        lead_type: 'delete',
        status: 'success'
      });
    }
  } catch (error) {
    stats.errors++;
    logger.error('Error deleting very old records', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Record error metrics
    prometheusMetrics.incrementLeadsProcessed({
      dealership_id: '0',
      source_provider: 'data-retention',
      lead_type: 'delete',
      status: 'error'
    });
    
    throw error;
  }
}

/**
 * Verify consent and update retention dates accordingly
 */
async function verifyConsentAndUpdateRetention(): Promise<void> {
  logger.info('Starting consent verification and retention date updates');
  
  try {
    // Count records for scanning
    const countResult = await pool.query(`
      SELECT COUNT(*) AS count
      FROM adf_leads
      WHERE NOT anonymized
    `);
    
    stats.recordsScanned = parseInt(countResult.rows[0].count, 10);
    
    if (config.execution.dryRun) {
      // In dry run mode, just count the records that would be updated
      const consentResult = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE consent_given = true) AS consent_count,
          COUNT(*) FILTER (WHERE consent_given = false) AS no_consent_count
        FROM adf_leads
        WHERE NOT anonymized
      `);
      
      stats.consentVerified = parseInt(consentResult.rows[0].consent_count, 10);
      stats.retentionExtended = Math.floor(stats.consentVerified * 0.8); // Estimate for dry run
      
      logger.info('Dry run: would verify consent and update retention dates', {
        consentVerified: stats.consentVerified,
        retentionExtended: stats.retentionExtended
      });
    } else {
      // Process in batches to avoid memory issues with large datasets
      let processed = 0;
      const batchSize = config.retention.batchSize;
      
      while (processed < stats.recordsScanned) {
        // Get a batch of records
        const batchResult = await pool.query(`
          SELECT id, consent_given, data_retention_date
          FROM adf_leads
          WHERE NOT anonymized
          ORDER BY id
          LIMIT $1 OFFSET $2
        `, [batchSize, processed]);
        
        if (batchResult.rows.length === 0) {
          break; // No more records
        }
        
        // Process each record in the batch
        for (const record of batchResult.rows) {
          if (record.consent_given) {
            stats.consentVerified++;
            
            // For records with consent, extend retention period if needed
            const currentRetention = new Date(record.data_retention_date);
            const extendedRetention = new Date();
            extendedRetention.setDate(extendedRetention.getDate() + config.retention.extendedConsentDays);
            
            if (currentRetention < extendedRetention) {
              // Update retention date for consented records
              await pool.query(`
                UPDATE adf_leads
                SET data_retention_date = $1
                WHERE id = $2
              `, [extendedRetention, record.id]);
              
              stats.retentionExtended++;
            }
          }
        }
        
        processed += batchResult.rows.length;
        logger.debug(`Processed ${processed}/${stats.recordsScanned} records`);
      }
      
      logger.info('Verified consent and updated retention dates', {
        consentVerified: stats.consentVerified,
        retentionExtended: stats.retentionExtended
      });
      
      // Record metrics
      prometheusMetrics.incrementLeadsProcessed({
        dealership_id: '0',
        source_provider: 'data-retention',
        lead_type: 'consent-verify',
        status: 'success'
      });
    }
  } catch (error) {
    stats.errors++;
    logger.error('Error verifying consent and updating retention dates', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Record error metrics
    prometheusMetrics.incrementLeadsProcessed({
      dealership_id: '0',
      source_provider: 'data-retention',
      lead_type: 'consent-verify',
      status: 'error'
    });
    
    throw error;
  }
}

/**
 * Generate audit report for compliance documentation
 */
async function generateAuditReport(): Promise<string> {
  logger.info('Generating audit report');
  
  try {
    // Create a timestamp for the report filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(config.execution.auditLogPath, `data-retention-${timestamp}.json`);
    
    // Create the report content
    const report = {
      timestamp: new Date().toISOString(),
      stats: {
        ...stats,
        endTime: stats.endTime || new Date(),
        durationMs: (stats.endTime || new Date()).getTime() - stats.startTime.getTime()
      },
      config: {
        dryRun: config.execution.dryRun,
        retentionDays: config.retention.defaultDays,
        extendedConsentDays: config.retention.extendedConsentDays,
        veryOldRecordsDays: config.retention.veryOldRecordsDays
      },
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Write the report to file
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    logger.info('Audit report generated', { path: reportPath });
    return reportPath;
  } catch (error) {
    stats.errors++;
    logger.error('Error generating audit report', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Return empty path
    return '';
  }
}

/**
 * Send completion notification email
 */
async function sendCompletionNotification(reportPath: string): Promise<void> {
  if (!config.execution.notifyEmail) {
    return;
  }
  
  try {
    logger.info('Sending completion notification', { to: maskPII(config.execution.notifyEmail, 'email') });
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '25', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });
    
    const durationMs = (stats.endTime || new Date()).getTime() - stats.startTime.getTime();
    const durationFormatted = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: config.execution.notifyEmail,
      subject: `Data Retention Process Completed - ${stats.recordsAnonymized} anonymized, ${stats.recordsDeleted} deleted`,
      text: `
Data Retention Process Completed Successfully

Environment: ${process.env.NODE_ENV || 'development'}
Timestamp: ${new Date().toISOString()}
Duration: ${durationFormatted}

Statistics:
- Records Scanned: ${stats.recordsScanned}
- Records Anonymized: ${stats.recordsAnonymized}
- Records Deleted: ${stats.recordsDeleted}
- Consent Verified: ${stats.consentVerified}
- Retention Extended: ${stats.retentionExtended}
- Errors: ${stats.errors}
- Dry Run: ${stats.dryRun ? 'Yes' : 'No'}

Audit Report: ${reportPath}

This is an automated message from the Data Retention System.
      `,
      attachments: reportPath ? [
        {
          filename: path.basename(reportPath),
          path: reportPath
        }
      ] : undefined
    });
    
    logger.info('Completion notification sent successfully');
  } catch (error) {
    logger.error('Error sending completion notification', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't throw, this is a non-critical operation
  }
}

/**
 * Send error notification email
 */
async function sendErrorNotification(error: unknown): Promise<void> {
  if (!config.execution.notifyEmail) {
    return;
  }
  
  try {
    logger.info('Sending error notification', { to: maskPII(config.execution.notifyEmail, 'email') });
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '25', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: config.execution.notifyEmail,
      subject: `ERROR: Data Retention Process Failed`,
      text: `
Data Retention Process Failed

Environment: ${process.env.NODE_ENV || 'development'}
Timestamp: ${new Date().toISOString()}

Error:
${error instanceof Error ? error.message : String(error)}

${error instanceof Error && error.stack ? `Stack Trace:
${error.stack}` : ''}

Partial Statistics:
- Records Scanned: ${stats.recordsScanned}
- Records Anonymized: ${stats.recordsAnonymized}
- Records Deleted: ${stats.recordsDeleted}
- Consent Verified: ${stats.consentVerified}
- Retention Extended: ${stats.retentionExtended}
- Errors: ${stats.errors + 1}
- Dry Run: ${stats.dryRun ? 'Yes' : 'No'}

This is an automated message from the Data Retention System.
URGENT: Please investigate this issue as it may impact GDPR/CCPA compliance.
      `
    });
    
    logger.info('Error notification sent successfully');
  } catch (notifyError) {
    logger.error('Error sending error notification', {
      error: notifyError instanceof Error ? notifyError.message : String(notifyError)
    });
    // Don't throw, this is a non-critical operation
  }
}

/**
 * Record metrics for monitoring
 */
function recordMetrics(): void {
  try {
    // Record overall process metrics
    prometheusMetrics.incrementLeadsProcessed({
      dealership_id: '0',
      source_provider: 'data-retention',
      lead_type: 'process',
      status: stats.errors > 0 ? 'error' : 'success'
    });
    
    // Record anonymization metrics
    if (stats.recordsAnonymized > 0) {
      prometheusMetrics.incrementLeadsProcessed({
        dealership_id: '0',
        source_provider: 'data-retention',
        lead_type: 'anonymize',
        status: 'success'
      });
    }
    
    // Record deletion metrics
    if (stats.recordsDeleted > 0) {
      prometheusMetrics.incrementLeadsProcessed({
        dealership_id: '0',
        source_provider: 'data-retention',
        lead_type: 'delete',
        status: 'success'
      });
    }
    
    // Record consent verification metrics
    if (stats.consentVerified > 0) {
      prometheusMetrics.incrementLeadsProcessed({
        dealership_id: '0',
        source_provider: 'data-retention',
        lead_type: 'consent-verify',
        status: 'success'
      });
    }
    
    logger.debug('Recorded metrics for data retention process');
  } catch (error) {
    logger.error('Error recording metrics', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't throw, this is a non-critical operation
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in data retention process:', error);
    process.exit(1);
  });
}

// Export for testing
export {
  main,
  anonymizeExpiredRecords,
  deleteVeryOldRecords,
  verifyConsentAndUpdateRetention,
  generateAuditReport,
  config,
  stats
};
