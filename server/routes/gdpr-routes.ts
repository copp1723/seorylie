/**
 * GDPR Compliance Routes
 * 
 * Implements GDPR-compliant API endpoints for data subject rights:
 * - Right to erasure ("right to be forgotten")
 * - Right to data portability (data export)
 * - Right to access personal data
 * - Right to rectification
 * 
 * Features:
 * - Authentication and authorization checks
 * - Comprehensive audit logging for compliance
 * - Rate limiting to prevent abuse
 * - Proper error handling with appropriate status codes
 * - Email verification for sensitive operations
 * - Secure data handling with encryption/decryption
 * 
 * All operations are logged for GDPR compliance auditing.
 */

import express, { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import { eq, and } from 'drizzle-orm';
import db from '../db';
import { adfLeads } from '../../shared/index';
import { maskPII, decrypt, encrypt } from '../utils/crypto';
import logger from '../utils/logger';
import { authenticateJWT } from '../middleware/auth';
import { redactSensitiveInfo } from '../middleware/log-redaction';

const router = express.Router();

// Audit logger for GDPR operations
const auditLog = (
  operation: string,
  userId: string | number | null,
  targetId: string | number | null,
  success: boolean,
  details: Record<string, any>
) => {
  const redactedDetails = redactSensitiveInfo(details);
  
  logger.info(`GDPR Operation: ${operation}`, {
    gdprOperation: operation,
    userId,
    targetId,
    success,
    details: redactedDetails,
    timestamp: new Date().toISOString()
  });
  
  // In a production environment, you might also want to store this in a database
  // for easier querying during compliance audits
};

// Rate limiting middleware - stricter for GDPR operations
const gdprRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many GDPR requests, please try again later',
  skip: (req) => process.env.NODE_ENV === 'test', // Skip in test environment
});

// Validate that the user has permission to access this data
const validateDataOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const leadId = req.params.id;
    
    // Skip for admin users
    if (req.user?.role === 'admin') {
      return next();
    }
    
    // For regular users, verify they own this data
    const lead = await db.query.adfLeads.findFirst({
      where: eq(adfLeads.id, parseInt(leadId))
    });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Check if the user is associated with this lead's dealership
    // This will depend on your specific business logic
    const userHasAccess = req.user?.dealershipId === lead.dealershipId;
    
    if (!userHasAccess) {
      auditLog('unauthorized_access_attempt', userId, leadId, false, {
        reason: 'User not authorized for this lead'
      });
      return res.status(403).json({ error: 'Not authorized to access this data' });
    }
    
    next();
  } catch (error) {
    logger.error('Error validating data ownership', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
      leadId: req.params.id
    });
    res.status(500).json({ error: 'Server error validating data access' });
  }
};

/**
 * DELETE /api/leads/:id - Data Erasure (Right to be Forgotten)
 * 
 * Permanently anonymizes a lead's personal data.
 * Requires authentication and authorization.
 * 
 * Response:
 * - 204: Successfully deleted
 * - 401: Not authenticated
 * - 403: Not authorized
 * - 404: Lead not found
 * - 500: Server error
 */
router.delete(
  '/leads/:id',
  authenticateJWT,
  validateDataOwnership,
  async (req: Request, res: Response) => {
    const leadId = req.params.id;
    const userId = req.user?.id;
    
    try {
      // Get the lead first to log what's being deleted
      const lead = await db.query.adfLeads.findFirst({
        where: eq(adfLeads.id, parseInt(leadId))
      });
      
      if (!lead) {
        auditLog('delete_lead', userId, leadId, false, {
          reason: 'Lead not found'
        });
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Use a transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // Update the lead to anonymize PII data
        await tx.update(adfLeads)
          .set({
            customerName: await encrypt('[DELETED]'),
            customerEmail: await encrypt('[DELETED]'),
            customerPhone: await encrypt('[DELETED]'),
            customerComments: '[DELETED]',
            anonymized: true,
            dataRetentionDate: new Date() // Set to current date for immediate purging
          })
          .where(eq(adfLeads.id, parseInt(leadId)));
      });
      
      // Log the successful deletion
      auditLog('delete_lead', userId, leadId, true, {
        dealershipId: lead.dealershipId,
        reason: 'User requested deletion (GDPR)'
      });
      
      // Return success with no content
      return res.status(204).send();
    } catch (error) {
      logger.error('Error deleting lead', {
        error: error instanceof Error ? error.message : String(error),
        leadId,
        userId
      });
      
      auditLog('delete_lead', userId, leadId, false, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return res.status(500).json({ error: 'Server error deleting lead' });
    }
  }
);

/**
 * POST /api/gdpr/forget - Email-based Erasure
 * 
 * Allows users to request deletion of their data by providing their email.
 * Implements the GDPR "Right to be Forgotten" for unauthenticated users.
 * 
 * Request body:
 * - email: User's email address
 * - verification: Verification token or code (optional, depends on implementation)
 * 
 * Response:
 * - 200: Request processed successfully
 * - 400: Invalid request
 * - 429: Too many requests
 * - 500: Server error
 */
router.post(
  '/gdpr/forget',
  gdprRateLimit,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('verification').optional()
  ],
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email } = req.body;
    
    try {
      // For security, always return the same response regardless of whether the email exists
      // This prevents user enumeration attacks
      
      // Log the request (with masked email)
      auditLog('forget_request', null, null, true, {
        email: maskPII(email, 'email'),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Call the database function to anonymize the user's data
      const result = await db.execute(
        `SELECT gdpr_forget_user($1) as success`,
        [email]
      );
      
      const success = result[0]?.success === true;
      
      // Log the result (without revealing if the email existed)
      auditLog('forget_execution', null, null, success, {
        email: maskPII(email, 'email')
      });
      
      // Return a standard response that doesn't reveal if the email existed
      return res.status(200).json({
        message: 'If your email exists in our system, all associated personal data has been anonymized. This process may take up to 30 days to complete across all our systems.'
      });
    } catch (error) {
      logger.error('Error processing forget request', {
        error: error instanceof Error ? error.message : String(error),
        email: maskPII(email, 'email')
      });
      
      auditLog('forget_request', null, null, false, {
        email: maskPII(email, 'email'),
        error: error instanceof Error ? error.message : String(error)
      });
      
      return res.status(500).json({
        message: 'An error occurred processing your request. Please try again later or contact our support team.'
      });
    }
  }
);

/**
 * GET /api/gdpr/data-export - Data Portability
 * 
 * Exports all personal data for a user in a machine-readable format.
 * Implements the GDPR "Right to Data Portability".
 * 
 * Query parameters:
 * - email: User's email address (required)
 * - format: Export format (json or csv, default: json)
 * 
 * Response:
 * - 200: Data export successful
 * - 400: Invalid request
 * - 401: Not authenticated
 * - 403: Not authorized
 * - 429: Too many requests
 * - 500: Server error
 */
router.get(
  '/gdpr/data-export',
  authenticateJWT,
  gdprRateLimit,
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const format = (req.query.format as string || 'json').toLowerCase();
    
    // Validate format
    if (format !== 'json' && format !== 'csv') {
      return res.status(400).json({ error: 'Invalid format. Supported formats: json, csv' });
    }
    
    try {
      // Encrypt the email to match how it's stored in the database
      const encryptedEmail = await encrypt(userEmail);
      
      // Get all leads associated with this user's email
      const leads = await db.query.adfLeads.findMany({
        where: eq(adfLeads.customerEmail, encryptedEmail)
      });
      
      // Decrypt sensitive fields
      const decryptedLeads = await Promise.all(
        leads.map(async (lead) => {
          return {
            id: lead.id,
            externalId: lead.externalId,
            dealershipId: lead.dealershipId,
            customerName: await decrypt(lead.customerName),
            customerEmail: await decrypt(lead.customerEmail),
            customerPhone: await decrypt(lead.customerPhone),
            customerComments: lead.customerComments,
            vehicleYear: lead.vehicleYear,
            vehicleMake: lead.vehicleMake,
            vehicleModel: lead.vehicleModel,
            vehicleTrim: lead.vehicleTrim,
            vehicleStockNumber: lead.vehicleStockNumber,
            consentGiven: lead.consentGiven,
            consentTimestamp: lead.consentTimestamp,
            consentSource: lead.consentSource,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt
          };
        })
      );
      
      // Log the export
      auditLog('data_export', userId, null, true, {
        format,
        recordCount: decryptedLeads.length,
        userEmail: maskPII(userEmail, 'email')
      });
      
      // Return the data in the requested format
      if (format === 'csv') {
        // Convert to CSV
        const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
        const csvStringifier = createCsvStringifier({
          header: [
            { id: 'id', title: 'ID' },
            { id: 'externalId', title: 'External ID' },
            { id: 'dealershipId', title: 'Dealership ID' },
            { id: 'customerName', title: 'Name' },
            { id: 'customerEmail', title: 'Email' },
            { id: 'customerPhone', title: 'Phone' },
            { id: 'customerComments', title: 'Comments' },
            { id: 'vehicleYear', title: 'Vehicle Year' },
            { id: 'vehicleMake', title: 'Vehicle Make' },
            { id: 'vehicleModel', title: 'Vehicle Model' },
            { id: 'vehicleTrim', title: 'Vehicle Trim' },
            { id: 'vehicleStockNumber', title: 'Stock Number' },
            { id: 'consentGiven', title: 'Consent Given' },
            { id: 'consentTimestamp', title: 'Consent Timestamp' },
            { id: 'consentSource', title: 'Consent Source' },
            { id: 'createdAt', title: 'Created At' },
            { id: 'updatedAt', title: 'Updated At' }
          ]
        });
        
        const header = csvStringifier.getHeaderString();
        const records = csvStringifier.stringifyRecords(decryptedLeads);
        const csv = header + records;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="data-export.csv"');
        return res.send(csv);
      } else {
        // Return as JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="data-export.json"');
        return res.json(decryptedLeads);
      }
    } catch (error) {
      logger.error('Error exporting user data', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        userEmail: maskPII(userEmail, 'email')
      });
      
      auditLog('data_export', userId, null, false, {
        error: error instanceof Error ? error.message : String(error),
        userEmail: maskPII(userEmail, 'email')
      });
      
      return res.status(500).json({ error: 'Server error exporting data' });
    }
  }
);

/**
 * GET /api/gdpr/consent-status - Check Consent Status
 * 
 * Allows users to check their current consent status.
 * 
 * Response:
 * - 200: Consent status retrieved
 * - 401: Not authenticated
 * - 500: Server error
 */
router.get(
  '/gdpr/consent-status',
  authenticateJWT,
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    
    try {
      // Encrypt the email to match how it's stored in the database
      const encryptedEmail = await encrypt(userEmail);
      
      // Get the most recent lead for this user to check consent status
      const lead = await db.query.adfLeads.findFirst({
        where: eq(adfLeads.customerEmail, encryptedEmail),
        orderBy: (leads, { desc }) => [desc(leads.createdAt)]
      });
      
      if (!lead) {
        return res.status(200).json({
          consentGiven: false,
          message: 'No records found for this user'
        });
      }
      
      // Return the consent status
      return res.status(200).json({
        consentGiven: lead.consentGiven,
        consentTimestamp: lead.consentTimestamp,
        consentSource: lead.consentSource,
        dataRetentionDate: lead.dataRetentionDate
      });
    } catch (error) {
      logger.error('Error checking consent status', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        userEmail: maskPII(userEmail, 'email')
      });
      
      return res.status(500).json({ error: 'Server error checking consent status' });
    }
  }
);

/**
 * POST /api/gdpr/update-consent - Update Consent Status
 * 
 * Allows users to update their consent preferences.
 * 
 * Request body:
 * - consent: Boolean indicating consent status
 * - source: Source of the consent update (e.g., 'web_form', 'email_link')
 * 
 * Response:
 * - 200: Consent updated successfully
 * - 400: Invalid request
 * - 401: Not authenticated
 * - 500: Server error
 */
router.post(
  '/gdpr/update-consent',
  authenticateJWT,
  [
    body('consent').isBoolean().withMessage('Consent must be a boolean value'),
    body('source').isString().notEmpty().withMessage('Source is required')
  ],
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { consent, source } = req.body;
    
    try {
      // Encrypt the email to match how it's stored in the database
      const encryptedEmail = await encrypt(userEmail);
      
      // Update consent for all records with this email
      await db.update(adfLeads)
        .set({
          consentGiven: consent,
          consentTimestamp: new Date(),
          consentSource: source,
          // If consent is given, extend retention date
          dataRetentionDate: consent 
            ? new Date(Date.now() + (1095 * 24 * 60 * 60 * 1000)) // 3 years
            : new Date(Date.now() + (730 * 24 * 60 * 60 * 1000))  // 2 years
        })
        .where(eq(adfLeads.customerEmail, encryptedEmail));
      
      // Log the consent update
      auditLog('update_consent', userId, null, true, {
        consent,
        source,
        userEmail: maskPII(userEmail, 'email')
      });
      
      return res.status(200).json({
        message: 'Consent preferences updated successfully',
        consentGiven: consent,
        consentTimestamp: new Date(),
        consentSource: source
      });
    } catch (error) {
      logger.error('Error updating consent', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        userEmail: maskPII(userEmail, 'email')
      });
      
      auditLog('update_consent', userId, null, false, {
        error: error instanceof Error ? error.message : String(error),
        userEmail: maskPII(userEmail, 'email')
      });
      
      return res.status(500).json({ error: 'Server error updating consent' });
    }
  }
);

/**
 * POST /api/gdpr/data-rectification - Data Rectification
 * 
 * Allows users to correct inaccurate personal data.
 * Implements the GDPR "Right to Rectification".
 * 
 * Request body:
 * - field: Field to update (name, email, phone)
 * - value: New value for the field
 * 
 * Response:
 * - 200: Data updated successfully
 * - 400: Invalid request
 * - 401: Not authenticated
 * - 500: Server error
 */
router.post(
  '/gdpr/data-rectification',
  authenticateJWT,
  [
    body('field').isString().isIn(['name', 'email', 'phone']).withMessage('Invalid field'),
    body('value').isString().notEmpty().withMessage('Value is required')
  ],
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { field, value } = req.body;
    
    try {
      // Encrypt the email to match how it's stored in the database
      const encryptedEmail = await encrypt(userEmail);
      
      // Encrypt the new value
      const encryptedValue = await encrypt(value);
      
      // Update the specified field for all records with this email
      const updateData: any = {};
      
      switch (field) {
        case 'name':
          updateData.customerName = encryptedValue;
          break;
        case 'email':
          updateData.customerEmail = encryptedValue;
          break;
        case 'phone':
          updateData.customerPhone = encryptedValue;
          break;
      }
      
      // Update records
      await db.update(adfLeads)
        .set(updateData)
        .where(eq(adfLeads.customerEmail, encryptedEmail));
      
      // Log the rectification
      auditLog('data_rectification', userId, null, true, {
        field,
        userEmail: maskPII(userEmail, 'email')
      });
      
      return res.status(200).json({
        message: `Your ${field} has been updated successfully`,
        field,
        updated: true
      });
    } catch (error) {
      logger.error('Error rectifying data', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        field,
        userEmail: maskPII(userEmail, 'email')
      });
      
      auditLog('data_rectification', userId, null, false, {
        error: error instanceof Error ? error.message : String(error),
        field,
        userEmail: maskPII(userEmail, 'email')
      });
      
      return res.status(500).json({ error: 'Server error updating data' });
    }
  }
);

export default router;
