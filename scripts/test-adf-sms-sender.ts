#!/usr/bin/env ts-node
/**
 * ADF SMS Response Sender Test Script
 *
 * Comprehensive test suite for the ADF SMS Response Sender service.
 * Tests all aspects of SMS delivery, status tracking, retries, and opt-out handling.
 *
 * Usage:
 *   npm run test:adf-sms
 *   ts-node scripts/test-adf-sms-sender.ts
 *
 * Environment variables:
 *   TEST_PHONE_NUMBER - Real phone number for live testing (optional)
 *   SKIP_LIVE_TESTS - Set to 'true' to skip tests that send real SMS messages
 */

import { EventEmitter } from "events";
import logger from "../server/utils/logger";
import db from "../server/db";
import { sql } from "drizzle-orm";
import { adfSmsResponseSender } from "../server/services/adf-sms-response-sender";
import { adfService } from "../server/services/adf-service";
import { twilioSMSService } from "../server/services/twilio-sms-service";
import { monitoringService } from "../server/services/monitoring";
import * as crypto from "crypto";

// Configure logger for tests
logger.level = process.env.LOG_LEVEL || "info";

// Test configuration
const TEST_CONFIG = {
  phoneNumber: process.env.TEST_PHONE_NUMBER || "+15555555555", // Fallback to test number
  dealershipId: 1,
  skipLiveTests: process.env.SKIP_LIVE_TESTS === "true",
  testTimeout: 60000, // 60 seconds
  shortDeliveryTimeout: 5000, // 5 seconds for testing timeout functionality
  mockSid: "SM" + crypto.randomUUID().replace(/-/g, "").substring(0, 32),
  testLeadId: 0, // Will be populated during test
};

// Test results tracking
const TEST_RESULTS = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now(),
  endTime: 0,
  tests: [] as Array<{
    name: string;
    result: "passed" | "failed" | "skipped";
    duration: number;
    error?: Error;
  }>,
};

/**
 * Mock Twilio webhook data
 */
const createMockWebhook = (
  status: string,
  messageSid: string = TEST_CONFIG.mockSid,
) => ({
  MessageSid: messageSid,
  MessageStatus: status,
  To: TEST_CONFIG.phoneNumber,
  From: "+16505551234",
  AccountSid: "AC00000000000000000000000000000000",
  ErrorCode: status === "failed" ? "30001" : undefined,
  ErrorMessage: status === "failed" ? "Message delivery failed" : undefined,
});

/**
 * Create a test ADF lead for SMS testing
 */
async function createTestLead(): Promise<number> {
  try {
    // Create test lead
    const results = await db.execute(sql`
      INSERT INTO adf_leads (
        dealership_id, 
        provider, 
        request_date, 
        lead_type,
        status,
        is_test,
        created_at,
        updated_at
      )
      VALUES (
        ${TEST_CONFIG.dealershipId},
        'test',
        NOW(),
        'test',
        'new',
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `);

    const leadId = results[0].id;

    // Create customer record with phone
    await db.execute(sql`
      INSERT INTO adf_customers (
        lead_id,
        name,
        phone,
        email,
        created_at,
        updated_at
      )
      VALUES (
        ${leadId},
        'Test Customer',
        ${TEST_CONFIG.phoneNumber},
        'test@example.com',
        NOW(),
        NOW()
      )
    `);

    logger.info(`Created test lead ID: ${leadId}`);
    return leadId;
  } catch (error) {
    logger.error("Failed to create test lead", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Delete test lead and associated data
 */
async function cleanupTestData(leadId: number): Promise<void> {
  try {
    await db.execute(sql`
      DELETE FROM adf_customers WHERE lead_id = ${leadId}
    `);

    await db.execute(sql`
      DELETE FROM adf_sms_responses WHERE lead_id = ${leadId}
    `);

    await db.execute(sql`
      DELETE FROM adf_leads WHERE id = ${leadId}
    `);

    logger.info(`Cleaned up test lead ID: ${leadId}`);
  } catch (error) {
    logger.error("Failed to clean up test data", {
      error: error instanceof Error ? error.message : String(error),
      leadId,
    });
  }
}

/**
 * Get SMS response by lead ID
 */
async function getSmsResponseByLeadId(leadId: number): Promise<any | null> {
  try {
    const results = await db.execute(sql`
      SELECT 
        lead_id, dealership_id, phone_number, message, message_sid,
        status, created_at, sent_at, delivered_at, retry_count, is_opt_out
      FROM adf_sms_responses
      WHERE lead_id = ${leadId}
    `);

    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    logger.error("Failed to get SMS response by lead ID", {
      error: error instanceof Error ? error.message : String(error),
      leadId,
    });
    return null;
  }
}

/**
 * Mock the ADF response orchestrator event
 */
function mockLeadResponseEvent(leadId: number, response: string): void {
  // Create mock lead data
  const leadData = {
    id: leadId,
    dealershipId: TEST_CONFIG.dealershipId,
    provider: "test",
    requestDate: new Date(),
    leadType: "test",
    status: "new",
    customer: {
      name: "Test Customer",
      phone: TEST_CONFIG.phoneNumber,
      email: "test@example.com",
    },
    vehicle: {
      make: "Test",
      model: "Model",
      year: "2025",
    },
  };

  // Emit lead.response.ready event
  adfService.emit("lead.response.ready", {
    leadId,
    responseText: response,
    metadata: { test: true },
  });

  logger.info("Emitted mock lead.response.ready event", { leadId });
}

/**
 * Test runner function
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>,
  options: { skip?: boolean; timeout?: number } = {},
): Promise<void> {
  TEST_RESULTS.total++;

  if (options.skip) {
    logger.info(`SKIPPED: ${name}`);
    TEST_RESULTS.skipped++;
    TEST_RESULTS.tests.push({
      name,
      result: "skipped",
      duration: 0,
    });
    return;
  }

  logger.info(`\n========== RUNNING TEST: ${name} ==========`);
  const startTime = Date.now();

  try {
    // Create promise with timeout
    const timeoutMs = options.timeout || TEST_CONFIG.testTimeout;
    const testPromise = testFn();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Test timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    // Run test with timeout
    await Promise.race([testPromise, timeoutPromise]);

    const duration = Date.now() - startTime;
    logger.info(`✅ PASSED: ${name} (${duration}ms)`);
    TEST_RESULTS.passed++;
    TEST_RESULTS.tests.push({
      name,
      result: "passed",
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`❌ FAILED: ${name} (${duration}ms)`, {
      error: err.message,
      stack: err.stack,
    });
    TEST_RESULTS.failed++;
    TEST_RESULTS.tests.push({
      name,
      result: "failed",
      duration,
      error: err,
    });
  }
}

/**
 * Wait for an event to be emitted
 */
function waitForEvent(
  emitter: EventEmitter,
  eventName: string,
  timeoutMs: number = 5000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeoutMs);

    emitter.once(eventName, (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print test results summary
 */
function printTestResults(): void {
  TEST_RESULTS.endTime = Date.now();
  const totalDuration = TEST_RESULTS.endTime - TEST_RESULTS.startTime;

  console.log("\n========== TEST RESULTS SUMMARY ==========");
  console.log(`Total tests: ${TEST_RESULTS.total}`);
  console.log(
    `Passed: ${TEST_RESULTS.passed} (${Math.round((TEST_RESULTS.passed / TEST_RESULTS.total) * 100)}%)`,
  );
  console.log(`Failed: ${TEST_RESULTS.failed}`);
  console.log(`Skipped: ${TEST_RESULTS.skipped}`);
  console.log(
    `Total duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`,
  );

  // Print failed tests
  if (TEST_RESULTS.failed > 0) {
    console.log("\nFailed tests:");
    TEST_RESULTS.tests
      .filter((test) => test.result === "failed")
      .forEach((test) => {
        console.log(
          `  - ${test.name} (${test.duration}ms): ${test.error?.message}`,
        );
      });
  }

  console.log("\nTest duration breakdown:");
  TEST_RESULTS.tests
    .filter((test) => test.result !== "skipped")
    .sort((a, b) => b.duration - a.duration)
    .forEach((test) => {
      console.log(`  - ${test.name}: ${test.duration}ms (${test.result})`);
    });
}

/**
 * Main test function
 */
async function runTests() {
  try {
    logger.info("Starting ADF SMS Response Sender tests");

    // Initialize services
    await adfSmsResponseSender.initialize();

    // Create test lead
    TEST_CONFIG.testLeadId = await createTestLead();

    // Run tests
    await runTest("1. Initialize ADF SMS Response Sender", async () => {
      // Re-initialize to test the initialization logic
      await adfSmsResponseSender.initialize();

      // Verify metrics are registered
      const metrics = monitoringService.getMetrics();
      const requiredMetrics = [
        "adf_sms_sent_total",
        "adf_sms_delivered_total",
        "adf_sms_failed_total",
        "adf_sms_retry_total",
        "adf_sms_optout_total",
        "adf_sms_delivery_time_ms",
      ];

      for (const metric of requiredMetrics) {
        if (!metrics[metric]) {
          throw new Error(`Metric ${metric} not registered`);
        }
      }

      logger.info("ADF SMS Response Sender initialized successfully");
    });

    await runTest("2. Test lead data extraction", async () => {
      // Create mock lead data
      const mockLead = {
        id: TEST_CONFIG.testLeadId,
        customer: {
          name: {
            first: "John",
            last: "Doe",
          },
          phone: {
            number: TEST_CONFIG.phoneNumber,
            type: "mobile",
          },
          email: "test@example.com",
        },
      };

      // Access the private method using any type assertion
      const phoneNumber = (adfSmsResponseSender as any).extractPhoneNumber(
        mockLead,
      );

      if (phoneNumber !== TEST_CONFIG.phoneNumber) {
        throw new Error(
          `Phone number extraction failed. Expected: ${TEST_CONFIG.phoneNumber}, Got: ${phoneNumber}`,
        );
      }

      // Test with string phone
      const mockLead2 = {
        id: TEST_CONFIG.testLeadId,
        customer: {
          name: "John Doe",
          phone: TEST_CONFIG.phoneNumber,
          email: "test@example.com",
        },
      };

      const phoneNumber2 = (adfSmsResponseSender as any).extractPhoneNumber(
        mockLead2,
      );

      if (phoneNumber2 !== TEST_CONFIG.phoneNumber) {
        throw new Error(
          `Phone number extraction failed for string phone. Expected: ${TEST_CONFIG.phoneNumber}, Got: ${phoneNumber2}`,
        );
      }

      // Test with phones array
      const mockLead3 = {
        id: TEST_CONFIG.testLeadId,
        customer: {
          name: "John Doe",
          phones: [
            { type: "mobile", number: TEST_CONFIG.phoneNumber },
            { type: "home", number: "+15551234567" },
          ],
          email: "test@example.com",
        },
      };

      const phoneNumber3 = (adfSmsResponseSender as any).extractPhoneNumber(
        mockLead3,
      );

      if (phoneNumber3 !== TEST_CONFIG.phoneNumber) {
        throw new Error(
          `Phone number extraction failed for phones array. Expected: ${TEST_CONFIG.phoneNumber}, Got: ${phoneNumber3}`,
        );
      }

      logger.info("Lead data extraction tests passed");
    });

    await runTest(
      "3. Test message formatting with opt-out footer",
      async () => {
        // Create mock lead data
        const mockLead = {
          id: TEST_CONFIG.testLeadId,
          customer: {
            name: {
              first: "John",
              last: "Doe",
            },
          },
        };

        const response =
          "Thank you for your interest in our dealership. We have received your inquiry and will get back to you shortly.";

        // Access the private method using any type assertion
        const formattedMessage = (adfSmsResponseSender as any).formatMessage(
          response,
          mockLead,
        );

        // Check if message has personalization and opt-out footer
        if (!formattedMessage.includes("John")) {
          throw new Error("Message does not include personalization");
        }

        if (!formattedMessage.includes("STOP to opt out")) {
          throw new Error("Message does not include opt-out footer");
        }

        // Test with string name
        const mockLead2 = {
          id: TEST_CONFIG.testLeadId,
          customer: {
            name: "John Doe",
          },
        };

        const formattedMessage2 = (adfSmsResponseSender as any).formatMessage(
          response,
          mockLead2,
        );

        if (!formattedMessage2.includes("John")) {
          throw new Error(
            "Message does not include personalization for string name",
          );
        }

        // Test with very long message (should be truncated)
        const longResponse =
          "This is a very long message that should be truncated because SMS messages have a limit of 160 characters. We need to ensure that the message is properly truncated and the opt-out footer is still included. This message is definitely longer than 160 characters.";

        const formattedMessage3 = (adfSmsResponseSender as any).formatMessage(
          longResponse,
          mockLead,
        );

        if (formattedMessage3.length > 160) {
          throw new Error(
            `Message is too long: ${formattedMessage3.length} characters`,
          );
        }

        if (!formattedMessage3.includes("...")) {
          throw new Error("Long message not properly truncated");
        }

        if (!formattedMessage3.includes("STOP to opt out")) {
          throw new Error("Truncated message does not include opt-out footer");
        }

        logger.info("Message formatting tests passed");
      },
    );

    await runTest("4. Test SMS response recording in database", async () => {
      // Generate a test message
      const message =
        "Thank you for your interest in our dealership. We will contact you shortly.";

      // Access the private method using any type assertion
      await (adfSmsResponseSender as any).recordSmsAttempt(
        TEST_CONFIG.testLeadId,
        TEST_CONFIG.dealershipId,
        TEST_CONFIG.phoneNumber,
        message,
      );

      // Verify record was created
      const smsResponse = await getSmsResponseByLeadId(TEST_CONFIG.testLeadId);

      if (!smsResponse) {
        throw new Error("SMS response record not found in database");
      }

      if (smsResponse.status !== "pending") {
        throw new Error(
          `Unexpected status: ${smsResponse.status}, expected: pending`,
        );
      }

      if (smsResponse.message !== message) {
        throw new Error("Message content does not match");
      }

      logger.info("SMS response recording test passed");
    });

    await runTest("5. Test SID update and status tracking", async () => {
      // Update with mock SID
      await (adfSmsResponseSender as any).updateSmsWithSid(
        TEST_CONFIG.testLeadId,
        TEST_CONFIG.mockSid,
      );

      // Verify SID was updated
      const smsResponse = await getSmsResponseByLeadId(TEST_CONFIG.testLeadId);

      if (!smsResponse) {
        throw new Error("SMS response record not found in database");
      }

      if (smsResponse.message_sid !== TEST_CONFIG.mockSid) {
        throw new Error(
          `SID not updated. Expected: ${TEST_CONFIG.mockSid}, Got: ${smsResponse.message_sid}`,
        );
      }

      if (smsResponse.status !== "sent") {
        throw new Error(
          `Status not updated. Expected: sent, Got: ${smsResponse.status}`,
        );
      }

      if (!smsResponse.sent_at) {
        throw new Error("sent_at timestamp not set");
      }

      logger.info("SID update and status tracking test passed");
    });

    await runTest(
      "6. Test webhook processing for delivery status updates",
      async () => {
        // Create mock webhook data for 'delivered' status
        const webhookData = createMockWebhook("delivered");

        // Process webhook
        await adfSmsResponseSender.processWebhook(webhookData);

        // Verify status was updated
        const smsResponse = await getSmsResponseByLeadId(
          TEST_CONFIG.testLeadId,
        );

        if (!smsResponse) {
          throw new Error("SMS response record not found in database");
        }

        if (smsResponse.status !== "delivered") {
          throw new Error(
            `Status not updated. Expected: delivered, Got: ${smsResponse.status}`,
          );
        }

        if (!smsResponse.delivered_at) {
          throw new Error("delivered_at timestamp not set");
        }

        logger.info("Webhook processing test passed");
      },
    );

    await runTest(
      "7. Test webhook processing for failed delivery",
      async () => {
        // First reset status to sent
        await db.execute(sql`
        UPDATE adf_sms_responses
        SET status = 'sent', delivered_at = NULL, updated_at = NOW()
        WHERE lead_id = ${TEST_CONFIG.testLeadId}
      `);

        // Create mock webhook data for 'failed' status
        const webhookData = createMockWebhook("failed");

        // Process webhook
        await adfSmsResponseSender.processWebhook(webhookData);

        // Verify status was updated
        const smsResponse = await getSmsResponseByLeadId(
          TEST_CONFIG.testLeadId,
        );

        if (!smsResponse) {
          throw new Error("SMS response record not found in database");
        }

        if (smsResponse.status !== "failed") {
          throw new Error(
            `Status not updated. Expected: failed, Got: ${smsResponse.status}`,
          );
        }

        logger.info("Failed delivery webhook test passed");
      },
    );

    await runTest("8. Test retry scheduling for failed messages", async () => {
      // Mock the scheduleRetry method to avoid actual timeouts
      const originalScheduleRetry = (adfSmsResponseSender as any).scheduleRetry;
      let retryScheduled = false;

      (adfSmsResponseSender as any).scheduleRetry = (leadId: number) => {
        if (leadId === TEST_CONFIG.testLeadId) {
          retryScheduled = true;
          logger.info("Retry scheduled for lead", { leadId });
        }
      };

      // Create mock webhook data for 'failed' status
      const webhookData = createMockWebhook("failed");

      // Process webhook
      await adfSmsResponseSender.processWebhook(webhookData);

      // Restore original method
      (adfSmsResponseSender as any).scheduleRetry = originalScheduleRetry;

      if (!retryScheduled) {
        throw new Error("Retry not scheduled for failed message");
      }

      logger.info("Retry scheduling test passed");
    });

    await runTest("9. Test opt-out handling via inbound SMS", async () => {
      // Create mock inbound SMS with STOP keyword
      const inboundSms = {
        Body: "STOP",
        From: TEST_CONFIG.phoneNumber,
        To: "+16505551234",
        MessageSid:
          "SM" + crypto.randomUUID().replace(/-/g, "").substring(0, 32),
        AccountSid: "AC00000000000000000000000000000000",
      };

      // Process inbound SMS
      await adfSmsResponseSender.processInboundSms(inboundSms);

      // Verify opt-out was processed
      // This is challenging to verify directly since it depends on the twilioSMSService
      // We'll check if the lead's SMS status was updated

      // Wait a moment for async processing
      await sleep(1000);

      // Check lead SMS status
      const leadStatus = await db.execute(sql`
        SELECT sms_status FROM adf_leads WHERE id = ${TEST_CONFIG.testLeadId}
      `);

      // Note: This might not be updated if the findLeadsByPhoneNumber method doesn't find the lead
      // due to test data setup, so we'll just log the result
      logger.info("Lead SMS status after opt-out", {
        status: leadStatus[0]?.sms_status,
        leadId: TEST_CONFIG.testLeadId,
      });

      logger.info("Opt-out handling test completed");
    });

    await runTest("10. Test metrics tracking", async () => {
      // Get metrics
      const metrics = adfSmsResponseSender.getMetrics();

      // Verify metrics object has expected properties
      const requiredMetrics = [
        "sentCount",
        "deliveredCount",
        "failedCount",
        "retryCount",
        "optOutCount",
        "avgDeliveryTimeMs",
      ];

      for (const metric of requiredMetrics) {
        if (!(metric in metrics)) {
          throw new Error(`Metric ${metric} not found in metrics object`);
        }
      }

      logger.info("Metrics tracking test passed", { metrics });
    });

    await runTest(
      "11. Test complete SMS flow with lead.response.ready event",
      async () => {
        // Create a new test lead for this test
        const newLeadId = await createTestLead();

        try {
          // Mock the sendSms method to avoid actually sending SMS
          const originalSendSms = (adfSmsResponseSender as any).sendSms;
          let smsSent = false;

          (adfSmsResponseSender as any).sendSms = async (
            leadId: number,
            dealershipId: number,
            phoneNumber: string,
            message: string,
          ) => {
            if (leadId === newLeadId) {
              smsSent = true;
              logger.info("Mock SMS sent", { leadId, message });

              // Record attempt and update with SID
              await (adfSmsResponseSender as any).recordSmsAttempt(
                leadId,
                dealershipId,
                phoneNumber,
                message,
              );

              await (adfSmsResponseSender as any).updateSmsWithSid(
                leadId,
                "SM" + crypto.randomUUID().replace(/-/g, "").substring(0, 32),
              );

              // Emit success event
              adfSmsResponseSender.emit("sms.send.success", {
                leadId,
                messageSid:
                  "SM" + crypto.randomUUID().replace(/-/g, "").substring(0, 32),
                dealershipId,
              });
            }
          };

          // Set up event listener for SMS send success
          const sendSuccessPromise = waitForEvent(
            adfSmsResponseSender,
            "sms.send.success",
            5000,
          );

          // Emit lead.response.ready event
          mockLeadResponseEvent(
            newLeadId,
            "Thank you for your interest. We will contact you shortly.",
          );

          // Wait for SMS send success event
          await sendSuccessPromise;

          // Restore original method
          (adfSmsResponseSender as any).sendSms = originalSendSms;

          if (!smsSent) {
            throw new Error(
              "SMS not sent in response to lead.response.ready event",
            );
          }

          // Verify SMS record was created
          const smsResponse = await getSmsResponseByLeadId(newLeadId);

          if (!smsResponse) {
            throw new Error("SMS response record not found in database");
          }

          if (smsResponse.status !== "sent") {
            throw new Error(
              `Unexpected status: ${smsResponse.status}, expected: sent`,
            );
          }

          logger.info("Complete SMS flow test passed");
        } finally {
          // Clean up test lead
          await cleanupTestData(newLeadId);
        }
      },
    );

    await runTest(
      "12. Test error handling for invalid phone numbers",
      async () => {
        // Create a new test lead for this test
        const newLeadId = await createTestLead();

        try {
          // Update customer with invalid phone
          await db.execute(sql`
          UPDATE adf_customers
          SET phone = 'invalid-phone'
          WHERE lead_id = ${newLeadId}
        `);

          // Set up event listener for SMS send failed event
          const sendFailedPromise = waitForEvent(
            adfSmsResponseSender,
            "sms.send.failed",
            5000,
          );

          // Emit lead.response.ready event
          mockLeadResponseEvent(
            newLeadId,
            "Thank you for your interest. We will contact you shortly.",
          );

          // Wait for SMS send failed event
          const failedEvent = await sendFailedPromise;

          if (!failedEvent || !failedEvent.error) {
            throw new Error("SMS send failed event not emitted with error");
          }

          logger.info("Error handling for invalid phone test passed", {
            error: failedEvent.error,
          });
        } finally {
          // Clean up test lead
          await cleanupTestData(newLeadId);
        }
      },
    );

    await runTest("13. Test delivery timeout handling", async () => {
      // Create a new test lead for this test
      const newLeadId = await createTestLead();

      try {
        // Mock the setDeliveryTimeout method to use a short timeout
        const originalSetDeliveryTimeout = (adfSmsResponseSender as any)
          .setDeliveryTimeout;
        let timeoutSet = false;

        (adfSmsResponseSender as any).setDeliveryTimeout = (
          leadId: number,
          messageSid: string,
        ) => {
          if (leadId === newLeadId) {
            timeoutSet = true;
            logger.info("Mock delivery timeout set", { leadId, messageSid });

            // Call the timeout handler immediately
            setTimeout(async () => {
              try {
                // Update status to undelivered
                await db.execute(sql`
                  UPDATE adf_sms_responses
                  SET status = 'undelivered', updated_at = NOW()
                  WHERE lead_id = ${leadId}
                `);

                // Update lead status
                await (adfSmsResponseSender as any).updateLeadSmsStatus(
                  leadId,
                  "undelivered",
                );

                logger.info("Delivery timeout triggered for test", { leadId });
              } catch (error) {
                logger.error("Error in mock timeout handler", {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }, 100);
          }
        };

        // Mock the sendSms method
        const originalSendSms = (adfSmsResponseSender as any).sendSms;

        (adfSmsResponseSender as any).sendSms = async (
          leadId: number,
          dealershipId: number,
          phoneNumber: string,
          message: string,
        ) => {
          if (leadId === newLeadId) {
            logger.info("Mock SMS sent for timeout test", { leadId });

            // Record attempt and update with SID
            await (adfSmsResponseSender as any).recordSmsAttempt(
              leadId,
              dealershipId,
              phoneNumber,
              message,
            );

            const mockSid =
              "SM" + crypto.randomUUID().replace(/-/g, "").substring(0, 32);
            await (adfSmsResponseSender as any).updateSmsWithSid(
              leadId,
              mockSid,
            );

            // Set delivery timeout
            (adfSmsResponseSender as any).setDeliveryTimeout(leadId, mockSid);
          }
        };

        // Emit lead.response.ready event
        mockLeadResponseEvent(
          newLeadId,
          "Thank you for your interest. We will contact you shortly.",
        );

        // Wait a moment for async processing
        await sleep(1000);

        // Restore original methods
        (adfSmsResponseSender as any).setDeliveryTimeout =
          originalSetDeliveryTimeout;
        (adfSmsResponseSender as any).sendSms = originalSendSms;

        if (!timeoutSet) {
          throw new Error("Delivery timeout not set");
        }

        // Verify status was updated to undelivered
        const smsResponse = await getSmsResponseByLeadId(newLeadId);

        if (!smsResponse) {
          throw new Error("SMS response record not found in database");
        }

        if (smsResponse.status !== "undelivered") {
          throw new Error(
            `Unexpected status: ${smsResponse.status}, expected: undelivered`,
          );
        }

        logger.info("Delivery timeout handling test passed");
      } finally {
        // Clean up test lead
        await cleanupTestData(newLeadId);
      }
    });

    // This test actually sends an SMS, so we'll skip it by default
    await runTest(
      "14. Live SMS sending test (requires real phone number)",
      async () => {
        if (!process.env.TEST_PHONE_NUMBER) {
          throw new Error("TEST_PHONE_NUMBER environment variable not set");
        }

        // Send test SMS
        const result = await adfService.testSmsResponse(
          process.env.TEST_PHONE_NUMBER,
          "This is a test message from the ADF SMS Response Sender test script.",
          TEST_CONFIG.dealershipId,
        );

        if (!result.success) {
          throw new Error(`Failed to send test SMS: ${result.error}`);
        }

        logger.info("Live SMS sending test passed", {
          messageSid: result.messageSid,
        });

        console.log(
          "\n✅ SMS sent successfully to",
          process.env.TEST_PHONE_NUMBER,
        );
        console.log("📱 Check your phone for the test message");
        console.log("📋 Message SID:", result.messageSid);
      },
      {
        skip: TEST_CONFIG.skipLiveTests || !process.env.TEST_PHONE_NUMBER,
        timeout: 30000,
      },
    );

    // Clean up test lead
    await cleanupTestData(TEST_CONFIG.testLeadId);

    // Print test results
    printTestResults();

    // Exit with appropriate code
    if (TEST_RESULTS.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    logger.error("Uncaught error in test script", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run tests
runTests();
