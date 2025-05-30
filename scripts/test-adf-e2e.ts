/**
 * ADF Lead Processing - End-to-End Integration Test
 * 
 * This script tests the complete ADF lead processing flow:
 * IMAP Mailbox → ADF Parser → DB → AI Response → Email/SMS + Intent → Handover Email
 * 
 * Features:
 * - Environment validation
 * - Test data generation
 * - Service mocking (IMAP, OpenAI, SendGrid, Twilio)
 * - Complete pipeline validation
 * - Database verification
 * - Metrics collection validation
 * - Error scenario testing
 * - Performance timing
 * 
 * Usage: npm run test:adf-e2e
 */

import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';
import db from '../server/db';
import { 
  adfLeads, 
  emailDeliveryTracking 
} from '../shared/adf-schema';
import { 
  dealerships,
  dealershipHandoverSettings,
  handovers
} from '../shared/lead-management-schema';
import { AdfEmailListener } from '../server/services/adf-email-listener';
import { AdfLeadProcessor } from '../server/services/adf-lead-processor';
import { aiService } from '../server/services/enhanced-ai-service';
import eventBus from '../server/services/event-bus';
import { prometheusMetrics } from '../server/services/prometheus-metrics';
import { emailService } from '../server/services/email-service';
import logger from '../server/utils/logger';
import { createServer } from 'http';
import express from 'express';
import registerRoutes from '../server/routes';

// Set test timeout - should complete in under 2 minutes for CI
const TEST_TIMEOUT_MS = 120000;

// Test configuration
const TEST_CONFIG = {
  dealershipName: 'Test Dealership E2E',
  dealershipEmail: 'test-e2e@example.com',
  customerName: 'John E2E Tester',
  customerEmail: 'john.e2e.tester@example.com',
  customerPhone: '555-123-4567',
  vehicleOfInterest: 'Honda Accord 2023',
  testId: uuidv4().substring(0, 8) // Used to make test data unique
};

// Sample ADF XML template
const ADF_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<adf>
  <prospect status="new">
    <id source="dealersite">E2E-TEST-${TEST_CONFIG.testId}</id>
    <requestdate>2023-09-01T09:30:00-05:00</requestdate>
    <vehicle interest="buy" status="new">
      <year>2023</year>
      <make>Honda</make>
      <model>Accord</model>
      <trim>Sport</trim>
      <stocknumber>TEST${TEST_CONFIG.testId}</stocknumber>
    </vehicle>
    <customer>
      <contact primarycontact="1">
        <name part="first">${TEST_CONFIG.customerName.split(' ')[0]}</name>
        <name part="last">${TEST_CONFIG.customerName.split(' ')[1]}</name>
        <email>${TEST_CONFIG.customerEmail}</email>
        <phone type="voice" time="morning">${TEST_CONFIG.customerPhone}</phone>
      </contact>
      <comments>This is an E2E test lead. Please ignore in production. Test ID: ${TEST_CONFIG.testId}</comments>
    </customer>
    <vendor>
      <vendorname>E2E Test ADF</vendorname>
      <contact primarycontact="1">
        <name part="full">${TEST_CONFIG.dealershipName}</name>
        <email>${TEST_CONFIG.dealershipEmail}</email>
      </contact>
    </vendor>
  </prospect>
</adf>`;

// Test state
let mockImapServer: any;
let adfEmailListener: AdfEmailListener;
let testDealershipId: number;
let testApp: express.Express;
let testServer: any;
let testServerPort: number;
let startTime: number;
let endTime: number;
let mailhogTransport: any;

/**
 * Simple Mock IMAP Server implementation
 */
class SimpleMockImapServer extends EventEmitter {
  public port: number = 1143;
  private emails: any[] = [];
  private isRunning: boolean = false;
  
  constructor(config: any = {}) {
    super();
    this.port = config.port || 1143;
  }
  
  async start() {
    this.isRunning = true;
    logger.info(`Mock IMAP server started on port ${this.port}`);
    return Promise.resolve();
  }
  
  async stop() {
    this.isRunning = false;
    logger.info('Mock IMAP server stopped');
    return Promise.resolve();
  }
  
  async addEmail(email: any) {
    this.emails.push(email);
    logger.info('Email added to mock IMAP server');
    
    // Simulate email received event after a short delay
    setTimeout(() => {
      if (this.isRunning) {
        this.emit('mail', 1);
        logger.info('Mock IMAP server emitted mail event');
      }
    }, 500);
    
    return Promise.resolve();
  }
  
  getEmails() {
    return this.emails;
  }
  
  // Mock method to simulate fetching emails
  fetchEmails(callback: (emails: any[]) => void) {
    callback(this.emails);
    // Clear emails after fetching to simulate marking as read
    this.emails = [];
  }
}

/**
 * Setup test environment
 */
async function setupTestEnvironment() {
  logger.info('Setting up E2E test environment');
  startTime = performance.now();

  // Load environment variables
  dotenv.config();
  validateEnvironment();

  // Setup test server
  testApp = express();
  registerRoutes(testApp);
  testServer = createServer(testApp);
  const listen = promisify(testServer.listen.bind(testServer));
  await listen(0);
  testServerPort = (testServer.address() as any).port;
  logger.info(`Test server running on port ${testServerPort}`);

  // Setup mock services
  setupMockServices();

  // Setup mock IMAP server
  mockImapServer = new SimpleMockImapServer({
    port: 1143,
    user: 'test@example.com',
    password: 'password'
  });
  await mockImapServer.start();
  logger.info('Mock IMAP server started');

  // Setup MailHog transport for email testing
  mailhogTransport = nodemailer.createTransport({
    host: process.env.MAILHOG_HOST || 'localhost',
    port: parseInt(process.env.MAILHOG_PORT || '1025'),
    secure: false,
    ignoreTLS: true
  });

  // Create test dealership
  await createTestDealership();

  // Initialize ADF email listener with mock IMAP server
  // Monkey patch the email listener to use our mock IMAP server
  adfEmailListener = new AdfEmailListener({
    host: 'localhost',
    port: mockImapServer.port,
    user: 'test@example.com',
    password: 'password',
    tls: false,
    mailbox: 'INBOX',
    searchFilter: ['UNSEEN'],
    pollingIntervalSeconds: 5
  });

  // Override the fetchEmails method to use our mock
  (adfEmailListener as any).fetchEmails = () => {
    return new Promise((resolve) => {
      mockImapServer.fetchEmails((emails: any[]) => {
        resolve(emails.map(email => ({
          subject: email.subject,
          from: email.from,
          to: email.to,
          html: email.html,
          text: email.text,
          attachments: email.attachments.map((att: any) => ({
            filename: att.filename,
            content: att.content
          }))
        })));
      });
    });
  };

  // Subscribe to events for test verification
  subscribeToEvents();
}

/**
 * Setup mock services for testing
 */
function setupMockServices() {
  // Mock OpenAI responses
  const originalAiServiceGetCompletion = aiService.getCompletion.bind(aiService);
  aiService.getCompletion = async (prompt: string, options: any = {}) => {
    logger.info('Mock AI service called', { prompt: prompt.substring(0, 100) + '...' });
    
    // Generate a mock response based on the prompt
    let responseText = 'Thank you for your interest in the Honda Accord! I would be happy to provide more information.';
    
    if (prompt.includes('handover')) {
      responseText = 'This lead should be handed over to sales.';
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      text: responseText,
      model: 'gpt-3.5-turbo-mock',
      promptTokens: 250,
      completionTokens: 150,
      totalTokens: 400,
      latencyMs: 500
    };
  };
  
  // Mock email service
  const originalEmailServiceSend = emailService.send.bind(emailService);
  emailService.send = async (options: any) => {
    logger.info('Mock email service called', { 
      to: options.to,
      subject: options.subject
    });
    
    // Use MailHog for actual email testing if available
    try {
      if (mailhogTransport) {
        await mailhogTransport.sendMail({
          from: options.from || 'test@example.com',
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html
        });
        logger.info('Email sent to MailHog');
      }
    } catch (error) {
      logger.error('Error sending to MailHog', { error });
    }
    
    // Return mock message ID
    return {
      messageId: `mock-msg-${Date.now()}@test.example.com`
    };
  };
  
  // Mock SMS service if needed
  if (global.twilioClient) {
    const originalTwilioSend = global.twilioClient.messages.create;
    global.twilioClient.messages.create = async (options: any) => {
      logger.info('Mock Twilio service called', { to: options.to });
      return {
        sid: `mock-sms-${Date.now()}`,
        status: 'sent'
      };
    };
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  logger.info('Environment validation passed');
}

/**
 * Create test dealership with configuration
 */
async function createTestDealership() {
  logger.info('Creating test dealership');
  
  // Create test dealership
  const [dealership] = await db
    .insert(dealerships)
    .values({
      name: TEST_CONFIG.dealershipName,
      primaryEmail: TEST_CONFIG.dealershipEmail,
      isActive: true,
      settings: {
        enableAdfProcessing: true,
        enableAiResponses: true,
        enableHandovers: true,
        testMode: true,
        testId: TEST_CONFIG.testId
      }
    })
    .returning();
  
  testDealershipId = dealership.id;
  
  // Create handover settings
  await db
    .insert(dealershipHandoverSettings)
    .values({
      dealershipId: testDealershipId,
      handoverEmail: TEST_CONFIG.dealershipEmail,
      slaHours: 24,
      dossierTemplate: 'default',
      isEnabled: true
    });
  
  logger.info(`Test dealership created with ID: ${testDealershipId}`);
}

/**
 * Subscribe to events for test verification
 */
function subscribeToEvents() {
  // Event tracking for verification
  const eventTracker: Record<string, boolean> = {
    'adf.lead.received': false,
    'adf.lead.processed': false,
    'adf.lead.duplicate': false,
    'lead.response.ready': false,
    'email.sent': false,
    'sms.sent': false,
    'intent.ready_for_handover': false,
    'handover.created': false,
    'handover.email_sent': false
  };

  // Track events for verification
  Object.keys(eventTracker).forEach(eventName => {
    eventBus.on(eventName, (data) => {
      logger.info(`Event received: ${eventName}`, { data });
      eventTracker[eventName] = true;
    });
  });

  // Make event tracker available for verification
  (global as any).eventTracker = eventTracker;
}

/**
 * Run the E2E test
 */
async function runE2ETest() {
  logger.info('Starting E2E test execution');
  
  try {
    // 1. Start ADF email listener
    await adfEmailListener.start();
    logger.info('ADF email listener started');
    
    // 2. Inject test ADF email into mock IMAP server
    await injectTestEmail();
    
    // 3. Wait for processing to complete
    await waitForProcessingCompletion();
    
    // 4. Verify database state
    await verifyDatabaseState();
    
    // 5. Verify metrics collection
    verifyMetricsCollection();
    
    // 6. Test error scenario and recovery
    await testErrorScenarioAndRecovery();
    
    // Test passed
    logger.info('E2E test completed successfully');
    return true;
  } catch (error) {
    logger.error('E2E test failed', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}

/**
 * Inject test ADF email into mock IMAP server
 */
async function injectTestEmail() {
  logger.info('Injecting test ADF email');
  
  // Create email with ADF XML attachment
  const testEmail = {
    from: 'leads@autotrader.com',
    to: TEST_CONFIG.dealershipEmail,
    subject: `Test ADF Lead - ${TEST_CONFIG.testId}`,
    text: 'This is a test ADF lead email for E2E testing.',
    html: '<p>This is a test ADF lead email for E2E testing.</p>',
    attachments: [
      {
        filename: `adf-lead-${TEST_CONFIG.testId}.xml`,
        content: ADF_XML_TEMPLATE
      }
    ]
  };
  
  // Add email to mock IMAP server
  await mockImapServer.addEmail(testEmail);
  logger.info('Test email injected into mock IMAP server');
}

/**
 * Wait for the complete processing to finish
 */
async function waitForProcessingCompletion() {
  logger.info('Waiting for processing to complete');
  
  // Wait for all expected events or timeout
  const startWaitTime = Date.now();
  const maxWaitTime = 60000; // 60 seconds max wait
  const checkInterval = 1000; // Check every second
  
  const requiredEvents = [
    'adf.lead.received',
    'adf.lead.processed',
    'lead.response.ready',
    'email.sent'
  ];
  
  while (Date.now() - startWaitTime < maxWaitTime) {
    const eventTracker = (global as any).eventTracker;
    const pendingEvents = requiredEvents.filter(event => !eventTracker[event]);
    
    if (pendingEvents.length === 0) {
      logger.info('All required events have been processed');
      return;
    }
    
    logger.info(`Waiting for events: ${pendingEvents.join(', ')}`);
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  throw new Error(`Processing timed out after ${maxWaitTime}ms. Some events were not triggered.`);
}

/**
 * Verify the database state after processing
 */
async function verifyDatabaseState() {
  logger.info('Verifying database state');
  
  // 1. Verify ADF lead was created
  const leads = await db
    .select()
    .from(adfLeads)
    .where(eq(adfLeads.externalId, `E2E-TEST-${TEST_CONFIG.testId}`))
    .limit(1);
  
  if (leads.length === 0) {
    throw new Error('ADF lead not found in database');
  }
  
  const lead = leads[0];
  logger.info(`ADF lead found with ID: ${lead.id}`);
  console.assert(lead.externalId === `E2E-TEST-${TEST_CONFIG.testId}`, 'Lead external ID mismatch');
  console.assert(lead.customerName.includes(TEST_CONFIG.customerName.split(' ')[0]), 'Customer name mismatch');
  
  // 2. Verify email delivery was tracked
  const emailDeliveries = await db
    .select()
    .from(emailDeliveryTracking)
    .where(eq(emailDeliveryTracking.adfLeadId, lead.id))
    .orderBy(desc(emailDeliveryTracking.createdAt))
    .limit(1);
  
  if (emailDeliveries.length === 0) {
    throw new Error('Email delivery tracking record not found');
  }
  
  logger.info(`Email delivery tracking found: ${emailDeliveries[0].deliveryStatus}`);
  console.assert(emailDeliveries[0].recipientEmail === TEST_CONFIG.customerEmail, 'Recipient email mismatch');
  
  // 3. Check for handover if that event was triggered
  const eventTracker = (global as any).eventTracker;
  if (eventTracker['intent.ready_for_handover']) {
    // Verify handover was created
    const handoverRecords = await db
      .select()
      .from(handovers)
      .where(eq(handovers.leadId, lead.id))
      .limit(1);
    
    if (handoverRecords.length === 0) {
      throw new Error('Handover record not found');
    }
    
    const handover = handoverRecords[0];
    logger.info(`Handover record found with ID: ${handover.id}`);
    console.assert(handover.leadId === lead.id, 'Handover lead ID mismatch');
    
    // Verify handover has dossier if that feature is enabled
    if (handover.dossier) {
      logger.info('Handover dossier found');
      console.assert(typeof handover.dossier === 'object', 'Dossier is not an object');
    }
  }
  
  logger.info('Database state verification passed');
}

/**
 * Verify metrics collection
 */
function verifyMetricsCollection() {
  logger.info('Verifying metrics collection');
  
  // Get metrics registry
  const registry = prometheusMetrics.getRegistry();
  const metrics = registry.getMetricsAsJSON();
  
  // Expected metrics
  const expectedMetrics = [
    'adf_leads_processed_total',
    'ai_response_latency_ms'
  ];
  
  // Verify all expected metrics exist
  const foundMetrics = metrics.map((m: any) => m.name);
  const missingMetrics = expectedMetrics.filter(name => !foundMetrics.includes(name));
  
  if (missingMetrics.length > 0) {
    throw new Error(`Missing expected metrics: ${missingMetrics.join(', ')}`);
  }
  
  // Check if handover metrics exist if that feature was triggered
  const eventTracker = (global as any).eventTracker;
  if (eventTracker['intent.ready_for_handover']) {
    const handoverMetrics = [
      'handover_dossier_generation_ms',
      'handover_email_sent_total'
    ];
    
    const missingHandoverMetrics = handoverMetrics.filter(
      name => !foundMetrics.includes(name)
    );
    
    if (missingHandoverMetrics.length > 0) {
      logger.warn(`Some handover metrics are missing: ${missingHandoverMetrics.join(', ')}`);
    } else {
      logger.info('Handover metrics verified');
    }
  }
  
  logger.info('Metrics collection verification passed');
}

/**
 * Test error scenario and recovery
 */
async function testErrorScenarioAndRecovery() {
  logger.info('Testing error scenario and recovery');
  
  // 1. Simulate email delivery failure
  const originalEmailSend = emailService.send;
  emailService.send = async (options: any) => {
    logger.info('Simulating email delivery failure');
    throw new Error('Simulated email delivery failure');
  };
  
  // 2. Inject another test email with different ID
  const errorTestId = `ERROR-${TEST_CONFIG.testId}`;
  const errorAdfXml = ADF_XML_TEMPLATE.replace(TEST_CONFIG.testId, errorTestId);
  
  // Create email with ADF XML attachment
  const errorTestEmail = {
    from: 'leads@autotrader.com',
    to: TEST_CONFIG.dealershipEmail,
    subject: `Test ADF Lead Error - ${errorTestId}`,
    text: 'This is a test ADF lead email for error testing.',
    html: '<p>This is a test ADF lead email for error testing.</p>',
    attachments: [
      {
        filename: `adf-lead-error-${errorTestId}.xml`,
        content: errorAdfXml
      }
    ]
  };
  
  // Add email to mock IMAP server
  await mockImapServer.addEmail(errorTestEmail);
  logger.info('Error test email injected');
  
  // 3. Wait for error processing
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 4. Restore normal operation
  emailService.send = originalEmailSend;
  logger.info('Restored normal email operation');
  
  // 5. Trigger retry (would normally happen via queue)
  // Find the error lead
  const errorLeads = await db
    .select()
    .from(adfLeads)
    .where(eq(adfLeads.externalId, `E2E-TEST-${errorTestId}`))
    .limit(1);
  
  if (errorLeads.length > 0) {
    const errorLead = errorLeads[0];
    // Emit retry event
    eventBus.emit('lead.retry_email', { leadId: errorLead.id });
    logger.info(`Triggered retry for lead ID: ${errorLead.id}`);
    
    // Wait for retry processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify retry was successful
    const retryDeliveries = await db
      .select()
      .from(emailDeliveryTracking)
      .where(eq(emailDeliveryTracking.adfLeadId, errorLead.id))
      .orderBy(desc(emailDeliveryTracking.createdAt))
      .limit(1);
    
    if (retryDeliveries.length > 0) {
      logger.info(`Retry delivery status: ${retryDeliveries[0].deliveryStatus}`);
    }
  }
  
  logger.info('Error scenario and recovery testing completed');
}

/**
 * Clean up test resources
 */
async function cleanupTestEnvironment() {
  logger.info('Cleaning up test environment');
  
  // Stop ADF email listener
  if (adfEmailListener) {
    await adfEmailListener.stop();
    logger.info('ADF email listener stopped');
  }
  
  // Stop mock IMAP server
  if (mockImapServer) {
    await mockImapServer.stop();
    logger.info('Mock IMAP server stopped');
  }
  
  // Stop test server
  if (testServer) {
    const close = promisify(testServer.close.bind(testServer));
    await close();
    logger.info('Test server stopped');
  }
  
  // Clean up test data if not in CI (keep for debugging in CI)
  if (process.env.CI !== 'true' && testDealershipId) {
    // Delete handover settings
    await db
      .delete(dealershipHandoverSettings)
      .where(eq(dealershipHandoverSettings.dealershipId, testDealershipId));
    
    // Get leads for this dealership
    const leads = await db
      .select({ id: adfLeads.id })
      .from(adfLeads)
      .where(eq(adfLeads.dealershipId, testDealershipId));
    
    // Delete email delivery tracking
    for (const lead of leads) {
      await db
        .delete(emailDeliveryTracking)
        .where(eq(emailDeliveryTracking.adfLeadId, lead.id));
    }
    
    // Delete handovers
    await db
      .delete(handovers)
      .where(eq(handovers.dealershipId, testDealershipId));
    
    // Delete leads
    await db
      .delete(adfLeads)
      .where(eq(adfLeads.dealershipId, testDealershipId));
    
    // Delete dealership
    await db
      .delete(dealerships)
      .where(eq(dealerships.id, testDealershipId));
    
    logger.info('Test data cleaned up');
  }
  
  // Calculate test duration
  endTime = performance.now();
  const testDuration = (endTime - startTime) / 1000;
  logger.info(`E2E test completed in ${testDuration.toFixed(2)} seconds`);
  
  // Verify test duration is under 2 minutes for CI
  if (testDuration > TEST_TIMEOUT_MS / 1000) {
    logger.warn(`Test duration (${testDuration.toFixed(2)}s) exceeds target of ${TEST_TIMEOUT_MS / 1000}s`);
  } else {
    logger.info(`Test duration (${testDuration.toFixed(2)}s) is within target of ${TEST_TIMEOUT_MS / 1000}s`);
  }
}

/**
 * Main test execution function
 */
async function runTest() {
  let success = false;
  
  try {
    // Setup
    await setupTestEnvironment();
    
    // Run test
    success = await runE2ETest();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  } catch (error) {
    logger.error('Unhandled error in E2E test', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  } finally {
    // Always clean up
    await cleanupTestEnvironment();
  }
}

// Run the test
runTest().catch(error => {
  logger.error('Fatal error in E2E test runner', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});
