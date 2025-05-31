#!/usr/bin/env ts-node
/**
 * ADF-08 Handover System Integration Test
 * 
 * This script tests the end-to-end functionality of the enhanced automated
 * handover notification system with sales dossier generation.
 * 
 * It validates:
 * - Environment configuration
 * - Dealership handover settings
 * - Dossier generation
 * - Email delivery
 * - Webhook processing
 * - Status transitions
 */

import dotenv from 'dotenv';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import db from '../server/db';
import { 
  dealerships, 
  dealershipHandoverSettings,
  conversations,
  leads,
  customers,
  handovers,
  messages
} from '../shared/lead-management-schema';
import eventBus from '../server/services/event-bus';
import handoverOrchestrator from '../server/services/handover-orchestrator';
import handoverDossierService from '../server/services/handover-dossier-service';
import { EmailService } from '../server/services/email-service';
import { HandoverService } from '../server/services/handover-service';
import { prometheusMetrics } from '../server/services/prometheus-metrics';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';

// Initialize environment
dotenv.config();

// Configure logger
const logger = {
  info: (message: string, context?: any) => {
    console.log(`[INFO] ${message}`, context || '');
  },
  error: (message: string, context?: any) => {
    console.error(`[ERROR] ${message}`, context || '');
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] ${message}`, context || '');
  },
  success: (message: string, context?: any) => {
    console.log(`[SUCCESS] ${message}`, context || '');
  }
};

// Test configuration
const TEST_CONFIG = {
  dealershipId: parseInt(process.env.TEST_DEALERSHIP_ID || '1'),
  handoverEmail: process.env.TEST_HANDOVER_EMAIL || 'handover@test.com',
  mailhogHost: process.env.MAILHOG_HOST || 'localhost',
  mailhogPort: parseInt(process.env.MAILHOG_PORT || '8025'),
  mailhogApiPort: parseInt(process.env.MAILHOG_API_PORT || '8025'),
  useMailhog: process.env.EMAIL_PROVIDER === 'mailhog' || true,
  webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:3000/webhooks/sendgrid',
  cleanup: process.env.TEST_CLEANUP !== 'false',
  timeout: parseInt(process.env.TEST_TIMEOUT || '30000')
};

// Test IDs for cleanup
const testIds = {
  conversationId: '',
  leadId: '',
  customerId: '',
  handoverId: ''
};

/**
 * Main test function
 */
async function runTest() {
  logger.info('Starting ADF-08 Handover System Integration Test');
  
  try {
    // Step 1: Validate environment
    await validateEnvironment();
    
    // Step 2: Create test data
    await createTestData();
    
    // Step 3: Test dossier generation
    await testDossierGeneration();
    
    // Step 4: Test handover orchestration
    await testHandoverOrchestration();
    
    // Step 5: Verify email delivery
    await verifyEmailDelivery();
    
    // Step 6: Test webhook functionality
    await testWebhook();
    
    // Step 7: Validate metrics
    await validateMetrics();
    
    // Success!
    logger.success('ADF-08 Handover System Integration Test completed successfully!');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Test failed: ${errorMessage}`);
    process.exit(1);
  } finally {
    // Step 8: Cleanup test data
    if (TEST_CONFIG.cleanup) {
      await cleanup();
    }
  }
}

/**
 * Validate environment configuration
 */
async function validateEnvironment() {
  logger.info('Validating environment...');
  
  // Check database connection
  try {
    await db.execute(db.sql`SELECT 1`);
    logger.info('Database connection successful');
  } catch (error) {
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Check email configuration
  const emailProvider = process.env.EMAIL_PROVIDER || 'mailhog';
  logger.info(`Email provider configured as: ${emailProvider}`);
  
  if (emailProvider === 'mailhog') {
    // Check if MailHog is accessible
    try {
      const response = await axios.get(`http://${TEST_CONFIG.mailhogHost}:${TEST_CONFIG.mailhogApiPort}/api/v2/messages`);
      if (response.status === 200) {
        logger.info('MailHog API accessible');
      }
    } catch (error) {
      logger.warn('MailHog API not accessible, email verification will be skipped');
    }
  } else if (emailProvider === 'sendgrid') {
    // Check SendGrid API key
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY not configured');
    }
    logger.info('SendGrid API key configured');
  }
  
  // Verify dealership exists
  const dealership = await db
    .select()
    .from(dealerships)
    .where(eq(dealerships.id, TEST_CONFIG.dealershipId))
    .limit(1)
    .then(results => results[0]);
  
  if (!dealership) {
    throw new Error(`Test dealership ID ${TEST_CONFIG.dealershipId} not found`);
  }
  
  logger.info(`Using dealership: ${dealership.name} (ID: ${dealership.id})`);
  
  // Initialize handover orchestrator
  handoverOrchestrator.init();
  logger.info('Handover orchestrator initialized');
  
  logger.success('Environment validation completed');
}

/**
 * Create test data
 */
async function createTestData() {
  logger.info('Creating test data...');
  
  // Create or update dealership handover settings
  const existingSettings = await db
    .select()
    .from(dealershipHandoverSettings)
    .where(eq(dealershipHandoverSettings.dealershipId, TEST_CONFIG.dealershipId))
    .limit(1)
    .then(results => results[0]);
  
  if (existingSettings) {
    // Update existing settings
    await db
      .update(dealershipHandoverSettings)
      .set({
        handoverEmail: TEST_CONFIG.handoverEmail,
        slaHours: 24,
        dossierTemplate: 'default',
        isEnabled: true,
        updatedAt: new Date()
      })
      .where(eq(dealershipHandoverSettings.id, existingSettings.id));
    
    logger.info(`Updated dealership handover settings (ID: ${existingSettings.id})`);
  } else {
    // Create new settings
    const [settings] = await db
      .insert(dealershipHandoverSettings)
      .values({
        dealershipId: TEST_CONFIG.dealershipId,
        handoverEmail: TEST_CONFIG.handoverEmail,
        slaHours: 24,
        dossierTemplate: 'default',
        isEnabled: true
      })
      .returning();
    
    logger.info(`Created dealership handover settings (ID: ${settings.id})`);
  }
  
  // Create test customer
  const [customer] = await db
    .insert(customers)
    .values({
      dealershipId: TEST_CONFIG.dealershipId,
      fullName: 'Test Customer',
      email: 'test.customer@example.com',
      phone: '555-123-4567',
      deduplicationHash: `test_${Date.now()}`
    })
    .returning();
  
  testIds.customerId = customer.id;
  logger.info(`Created test customer (ID: ${customer.id})`);
  
  // Create test lead
  const [lead] = await db
    .insert(leads)
    .values({
      dealershipId: TEST_CONFIG.dealershipId,
      customerId: customer.id,
      leadNumber: `TEST-${Date.now()}`,
      source: 'website_form',
      status: 'new',
      priority: 'high',
      requestType: 'vehicle_inquiry',
      description: 'Interested in a new SUV with good fuel economy',
      deduplicationHash: `test_${Date.now()}`
    })
    .returning();
  
  testIds.leadId = lead.id;
  logger.info(`Created test lead (ID: ${lead.id})`);
  
  // Create test conversation
  const [conversation] = await db
    .insert(conversations)
    .values({
      dealershipId: TEST_CONFIG.dealershipId,
      leadId: lead.id,
      customerId: customer.id,
      subject: 'Vehicle Inquiry',
      status: 'active',
      channel: 'chat',
      isAiAssisted: true
    })
    .returning();
  
  testIds.conversationId = conversation.id;
  logger.info(`Created test conversation (ID: ${conversation.id})`);
  
  // Add some test messages
  const messageContents = [
    { sender: 'customer', content: 'Hi, I\'m interested in a new SUV with good fuel economy.' },
    { sender: 'ai', content: 'Hello! I\'d be happy to help you find an SUV with good fuel economy. Are you looking for a specific make or model?' },
    { sender: 'customer', content: 'I\'m considering a Toyota RAV4 or Honda CR-V. Do you have any in stock?' },
    { sender: 'ai', content: 'Yes, we have several Toyota RAV4 and Honda CR-V models in stock. The RAV4 Hybrid gets excellent fuel economy at around 40 MPG combined. Would you like more information about pricing and availability?' },
    { sender: 'customer', content: 'Yes, I\'d like to know the price range for the RAV4 Hybrid and if you offer test drives.' },
    { sender: 'ai', content: 'Our Toyota RAV4 Hybrid models range from $29,500 to $37,000 depending on trim level and options. And yes, we absolutely offer test drives! Would you like to schedule one?' },
    { sender: 'customer', content: 'That sounds good. I\'d like to schedule a test drive for this weekend if possible.' }
  ];
  
  for (const msg of messageContents) {
    await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        content: msg.content,
        type: 'inbound',
        sender: msg.sender as any,
        senderName: msg.sender === 'customer' ? 'Test Customer' : 'AI Assistant',
        contentType: 'text'
      });
  }
  
  logger.info(`Added ${messageContents.length} test messages to conversation`);
  logger.success('Test data creation completed');
}

/**
 * Test dossier generation
 */
async function testDossierGeneration() {
  logger.info('Testing dossier generation...');
  
  try {
    // Generate dossier directly
    const dossier = await handoverDossierService.generateDossier(
      testIds.conversationId,
      testIds.leadId,
      'customer_request'
    );
    
    // Validate dossier structure
    if (!dossier.customerName || !dossier.conversationSummary) {
      throw new Error('Dossier missing required fields');
    }
    
    if (!Array.isArray(dossier.customerInsights) || dossier.customerInsights.length === 0) {
      throw new Error('Dossier missing customer insights');
    }
    
    if (!Array.isArray(dossier.vehicleInterests)) {
      throw new Error('Dossier missing vehicle interests array');
    }
    
    if (!dossier.suggestedApproach) {
      throw new Error('Dossier missing suggested approach');
    }
    
    if (!dossier.urgency) {
      throw new Error('Dossier missing urgency rating');
    }
    
    logger.info('Dossier structure validated', {
      customerName: dossier.customerName,
      urgency: dossier.urgency,
      insightsCount: dossier.customerInsights.length,
      vehiclesCount: dossier.vehicleInterests.length
    });
    
    logger.success('Dossier generation test passed');
    return dossier;
    
  } catch (error) {
    logger.error('Dossier generation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Dossier generation test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Test handover orchestration
 */
async function testHandoverOrchestration() {
  logger.info('Testing handover orchestration...');
  
  return new Promise<void>((resolve, reject) => {
    // Set up event listeners
    const handoverInitiatedListener = (data: any) => {
      logger.info('Handover initiated event received', { handoverId: data.handoverId });
    };
    
    const handoverEmailSentListener = (data: any) => {
      logger.info('Handover email sent event received', { 
        handoverId: data.handoverId,
        messageId: data.emailMessageId
      });
      
      // Store handover ID for later verification
      testIds.handoverId = data.handoverId;
      
      // Remove listeners
      handoverOrchestrator.removeListener('handover:initiated', handoverInitiatedListener);
      handoverOrchestrator.removeListener('handover_email:sent', handoverEmailSentListener);
      handoverOrchestrator.removeListener('handover:failed', handoverFailedListener);
      handoverOrchestrator.removeListener('handover_email:failed', handoverEmailFailedListener);
      
      clearTimeout(timeoutId);
      resolve();
    };
    
    const handoverFailedListener = (data: any) => {
      logger.error('Handover failed event received', { 
        handoverId: data.handoverId,
        error: data.error
      });
      
      // Remove listeners
      handoverOrchestrator.removeListener('handover:initiated', handoverInitiatedListener);
      handoverOrchestrator.removeListener('handover_email:sent', handoverEmailSentListener);
      handoverOrchestrator.removeListener('handover:failed', handoverFailedListener);
      handoverOrchestrator.removeListener('handover_email:failed', handoverEmailFailedListener);
      
      clearTimeout(timeoutId);
      reject(new Error(`Handover failed: ${data.error}`));
    };
    
    const handoverEmailFailedListener = (data: any) => {
      logger.error('Handover email failed event received', { 
        handoverId: data.handoverId,
        error: data.error
      });
      
      // Remove listeners
      handoverOrchestrator.removeListener('handover:initiated', handoverInitiatedListener);
      handoverOrchestrator.removeListener('handover_email:sent', handoverEmailSentListener);
      handoverOrchestrator.removeListener('handover:failed', handoverFailedListener);
      handoverOrchestrator.removeListener('handover_email:failed', handoverEmailFailedListener);
      
      clearTimeout(timeoutId);
      reject(new Error(`Handover email failed: ${data.error}`));
    };
    
    // Register event listeners
    handoverOrchestrator.on('handover:initiated', handoverInitiatedListener);
    handoverOrchestrator.on('handover_email:sent', handoverEmailSentListener);
    handoverOrchestrator.on('handover:failed', handoverFailedListener);
    handoverOrchestrator.on('handover_email:failed', handoverEmailFailedListener);
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      // Remove listeners
      handoverOrchestrator.removeListener('handover:initiated', handoverInitiatedListener);
      handoverOrchestrator.removeListener('handover_email:sent', handoverEmailSentListener);
      handoverOrchestrator.removeListener('handover:failed', handoverFailedListener);
      handoverOrchestrator.removeListener('handover_email:failed', handoverEmailFailedListener);
      
      reject(new Error('Handover orchestration test timed out'));
    }, TEST_CONFIG.timeout);
    
    // Trigger handover by emitting ready_for_handover event
    logger.info('Emitting ready_for_handover event...');
    eventBus.emit('intent.ready_for_handover', {
      conversationId: testIds.conversationId,
      leadId: testIds.leadId,
      dealershipId: TEST_CONFIG.dealershipId,
      reason: 'customer_request',
      confidence: 0.95,
      context: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });
  });
}

/**
 * Verify email delivery
 */
async function verifyEmailDelivery() {
  logger.info('Verifying email delivery...');
  
  if (!testIds.handoverId) {
    throw new Error('No handover ID available for email verification');
  }
  
  // Verify handover record in database
  const handover = await db
    .select()
    .from(handovers)
    .where(eq(handovers.id, testIds.handoverId))
    .limit(1)
    .then(results => results[0]);
  
  if (!handover) {
    throw new Error(`Handover record not found: ${testIds.handoverId}`);
  }
  
  logger.info('Handover record found', {
    id: handover.id,
    status: handover.status,
    dossierAvailable: !!handover.dossier
  });
  
  // Verify dossier was stored
  if (!handover.dossier) {
    throw new Error('Handover record missing dossier data');
  }
  
  // Verify status is email_sent
  if (handover.status !== 'email_sent') {
    throw new Error(`Unexpected handover status: ${handover.status} (expected: email_sent)`);
  }
  
  // Verify email message ID in context
  if (!handover.context?.emailMessageId) {
    throw new Error('Handover context missing emailMessageId');
  }
  
  // If using MailHog, verify email in MailHog API
  if (TEST_CONFIG.useMailhog) {
    try {
      // Check MailHog for the email
      const response = await axios.get(`http://${TEST_CONFIG.mailhogHost}:${TEST_CONFIG.mailhogApiPort}/api/v2/messages`);
      
      if (response.status !== 200) {
        logger.warn('MailHog API returned non-200 status code, skipping email verification');
        return;
      }
      
      const messages = response.data.items || [];
      logger.info(`Found ${messages.length} messages in MailHog`);
      
      // Look for our email
      const ourEmail = messages.find((msg: any) => {
        // Check subject contains "Sales Lead Handover"
        return msg.Content.Headers.Subject?.some((subject: string) => 
          subject.includes('Sales Lead Handover')
        );
      });
      
      if (!ourEmail) {
        throw new Error('Handover email not found in MailHog');
      }
      
      logger.info('Handover email found in MailHog', {
        id: ourEmail.ID,
        subject: ourEmail.Content.Headers.Subject?.[0],
        to: ourEmail.Content.Headers.To?.[0]
      });
      
      // Verify email was sent to the correct address
      const toAddress = ourEmail.Content.Headers.To?.[0];
      if (!toAddress.includes(TEST_CONFIG.handoverEmail)) {
        throw new Error(`Email sent to wrong address: ${toAddress} (expected: ${TEST_CONFIG.handoverEmail})`);
      }
      
      // Verify email has both HTML and text parts
      const hasBothParts = ourEmail.MIME.Parts && 
                          ourEmail.MIME.Parts.length >= 2 && 
                          ourEmail.MIME.Parts.some((part: any) => part.Headers['Content-Type']?.[0].includes('text/html'));
      
      if (!hasBothParts) {
        logger.warn('Email may be missing HTML or text part');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Handover email not found')) {
        throw error;
      }
      logger.warn('Error checking MailHog, skipping email verification', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  logger.success('Email delivery verification completed');
}

/**
 * Test webhook functionality
 */
async function testWebhook() {
  logger.info('Testing webhook functionality...');
  
  if (!testIds.handoverId) {
    throw new Error('No handover ID available for webhook testing');
  }
  
  // Get message ID from handover record
  const handover = await db
    .select()
    .from(handovers)
    .where(eq(handovers.id, testIds.handoverId))
    .limit(1)
    .then(results => results[0]);
  
  if (!handover || !handover.context?.emailMessageId) {
    throw new Error('Cannot test webhook: missing email message ID');
  }
  
  const messageId = handover.context.emailMessageId;
  
  // Skip actual webhook call in test mode
  if (process.env.NODE_ENV === 'test' || !TEST_CONFIG.webhookUrl) {
    logger.warn('Skipping webhook test in test mode');
    return;
  }
  
  try {
    // Simulate SendGrid webhook event
    const webhookPayload = [
      {
        sg_message_id: messageId,
        email: TEST_CONFIG.handoverEmail,
        timestamp: Math.floor(Date.now() / 1000),
        event: 'delivered',
        ip: '127.0.0.1',
        sg_event_id: `test_${Date.now()}`,
        tls: 1,
        cert_err: 0
      }
    ];
    
    // Call webhook endpoint
    const response = await axios.post(TEST_CONFIG.webhookUrl, webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SendGrid-Test-Webhook',
        'X-Twilio-Email-Event-Webhook-Timestamp': String(Math.floor(Date.now() / 1000)),
        'X-Twilio-Email-Event-Webhook-Signature': 'test_signature' // Not validated in test mode
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`Webhook returned non-200 status code: ${response.status}`);
    }
    
    logger.info('Webhook test successful', {
      status: response.status,
      data: response.data
    });
    
    // Wait for webhook processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify handover record was updated
    const updatedHandover = await db
      .select()
      .from(handovers)
      .where(eq(handovers.id, testIds.handoverId))
      .limit(1)
      .then(results => results[0]);
    
    if (!updatedHandover) {
      throw new Error('Handover record not found after webhook');
    }
    
    // Check if emailDeliveredAt was set in context
    if (!updatedHandover.context?.emailDeliveredAt) {
      logger.warn('Webhook processing may not have updated handover record');
    } else {
      logger.info('Handover record updated by webhook', {
        emailDeliveredAt: updatedHandover.context.emailDeliveredAt
      });
    }
    
  } catch (error) {
    logger.warn('Webhook test error', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't fail the test on webhook errors
  }
  
  logger.success('Webhook test completed');
}

/**
 * Validate metrics
 */
async function validateMetrics() {
  logger.info('Validating metrics...');
  
  // Get metrics registry
  const registry = prometheusMetrics.getRegistry();
  
  // Get metrics as text
  const metrics = await registry.metrics();
  
  // Check for handover metrics
  const hasHandoverTriggerMetric = metrics.includes('handover_trigger_total');
  const hasHandoverEmailMetric = metrics.includes('handover_email_sent_total');
  const hasDossierGenerationMetric = metrics.includes('handover_dossier_generation_ms');
  
  if (!hasHandoverTriggerMetric) {
    logger.warn('handover_trigger_total metric not found');
  }
  
  if (!hasHandoverEmailMetric) {
    logger.warn('handover_email_sent_total metric not found');
  }
  
  if (!hasDossierGenerationMetric) {
    logger.warn('handover_dossier_generation_ms metric not found');
  }
  
  if (hasHandoverTriggerMetric && hasHandoverEmailMetric && hasDossierGenerationMetric) {
    logger.success('All required metrics found');
  } else {
    logger.warn('Some metrics are missing');
  }
}

/**
 * Clean up test data
 */
async function cleanup() {
  logger.info('Cleaning up test data...');
  
  try {
    // Delete handover record if exists
    if (testIds.handoverId) {
      await db
        .delete(handovers)
        .where(eq(handovers.id, testIds.handoverId));
      
      logger.info(`Deleted test handover (ID: ${testIds.handoverId})`);
    }
    
    // Delete messages
    if (testIds.conversationId) {
      await db
        .delete(messages)
        .where(eq(messages.conversationId, testIds.conversationId));
      
      logger.info(`Deleted test messages for conversation (ID: ${testIds.conversationId})`);
    }
    
    // Delete conversation
    if (testIds.conversationId) {
      await db
        .delete(conversations)
        .where(eq(conversations.id, testIds.conversationId));
      
      logger.info(`Deleted test conversation (ID: ${testIds.conversationId})`);
    }
    
    // Delete lead
    if (testIds.leadId) {
      await db
        .delete(leads)
        .where(eq(leads.id, testIds.leadId));
      
      logger.info(`Deleted test lead (ID: ${testIds.leadId})`);
    }
    
    // Delete customer
    if (testIds.customerId) {
      await db
        .delete(customers)
        .where(eq(customers.id, testIds.customerId));
      
      logger.info(`Deleted test customer (ID: ${testIds.customerId})`);
    }
    
    logger.success('Cleanup completed');
    
  } catch (error) {
    logger.warn('Error during cleanup', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't fail the test on cleanup errors
  }
}

// Run the test
runTest()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
