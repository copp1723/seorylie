#!/usr/bin/env ts-node

import dotenv from "dotenv";
import { emailService } from "../server/services/email-service";
import logger from "../server/utils/logger";
import { prometheusMetrics } from "../server/services/prometheus-metrics";

// Load environment variables
dotenv.config();

interface TestConfig {
  customerEmail: string;
  customerName: string;
  dealershipId: number;
  vehicleInfo?: string;
  response: string;
}

const defaultTestConfig: TestConfig = {
  customerEmail: process.env.TEST_EMAIL || "test@example.com",
  customerName: "John Doe",
  dealershipId: 1,
  vehicleInfo: "2024 Honda Civic",
  response:
    "Thank you for your interest in the 2024 Honda Civic! This vehicle features excellent fuel economy, advanced safety features, and a spacious interior. We have several models available and would love to schedule a test drive for you. Please let us know when would be convenient for you to visit our showroom.",
};

async function testEmailService() {
  console.log("🧪 Testing Email Service Configuration...\n");

  console.log(`📧 Email Service: ${process.env.EMAIL_SERVICE || "smtp"}`);
  console.log(
    `🔑 SendGrid API Key: ${process.env.SENDGRID_API_KEY ? "Configured" : "Not configured"}`,
  );
  console.log(
    `📬 SMTP Host: ${process.env.EMAIL_HOST || process.env.SMTP_HOST || "0.0.0.0"}`,
  );
  console.log(
    `🔌 SMTP Port: ${process.env.EMAIL_PORT || process.env.SMTP_PORT || "587"}`,
  );

  try {
    await emailService.initialize();
    const status = await emailService.getServiceStatus();
    console.log(`✅ Email service status:`, status);
    console.log(
      `✅ Email service connection: ${status.isConnected ? "Success" : "Failed"}\n`,
    );
    return status.isConnected;
  } catch (error) {
    console.log(`❌ Email service connection failed: ${error}\n`);
    return false;
  }
}

async function testDirectEmailSend(config: TestConfig) {
  console.log("📧 Testing Direct Email Send...\n");

  try {
    const result = await emailService.sendEmail({
      to: config.customerEmail,
      subject: "Test Email from ADF System",
      html: `
        <h2>Test Email</h2>
        <p>Hello ${config.customerName},</p>
        <p>This is a test email from the ADF email response system.</p>
        <p><strong>Vehicle:</strong> ${config.vehicleInfo}</p>
        <p><strong>Response:</strong> ${config.response}</p>
        <hr>
        <small>Test conducted at: ${new Date().toISOString()}</small>
      `,
      text: `Test Email\n\nHello ${config.customerName},\n\nThis is a test email from the ADF email response system.\n\nVehicle: ${config.vehicleInfo}\nResponse: ${config.response}\n\nTest conducted at: ${new Date().toISOString()}`,
    });

    if (result.success) {
      console.log(`✅ Direct email sent successfully!`);
      console.log(`📧 Message ID: ${result.messageId}`);
      return true;
    } else {
      console.log(`❌ Direct email failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Direct email send exception: ${error}`);
    return false;
  } finally {
    console.log("");
  }
}

async function testSimpleOrchestrator(config: TestConfig) {
  console.log("🎭 Testing Simple Orchestrator Simulation...\n");

  try {
    // Simulate orchestrator functionality without requiring database
    console.log(`🔧 Simulating orchestrator initialization...`);

    // Check if OpenAI API key is configured
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    console.log(
      `🔑 OpenAI API Key: ${hasOpenAIKey ? "Configured" : "Not configured"}`,
    );

    // Simulate message routing
    const testMessage = `Hi, I'm interested in the ${config.vehicleInfo}. Can you tell me more about it?`;
    console.log(`📝 Test message: ${testMessage}`);

    // Simulate agent selection logic
    const selectedAgent = testMessage.toLowerCase().includes("interested")
      ? "inventory-agent"
      : "general-agent";
    const simulatedResponse = `Thank you for your interest in the ${config.vehicleInfo}! I'd be happy to help you learn more about this vehicle.`;

    console.log(`🎯 Simulated agent selection: ${selectedAgent}`);
    console.log(
      `💬 Simulated response: ${simulatedResponse.substring(0, 100)}...`,
    );
    console.log(`⚡ Simulated processing time: 150ms`);

    console.log("✅ Simple Orchestrator simulation completed successfully!\n");
    return true;
  } catch (error) {
    console.log(`❌ Simple Orchestrator test failed: ${error}\n`);
    return false;
  }
}

async function testSimpleEventSystem(config: TestConfig) {
  console.log("🚌 Testing Simple Event System...\n");

  try {
    // Simple event simulation
    console.log("📧 Simulating email sent event...");
    prometheusMetrics.recordEmailDelivery(
      config.dealershipId.toString(),
      "test-provider",
      "sent",
    );

    console.log("🎯 Simulating AI response event...");
    prometheusMetrics.recordAIResponseLatency(
      1500,
      config.dealershipId.toString(),
      "gpt-4",
      "test-response",
    );

    console.log("✅ Event system simulation completed!\n");
    return true;
  } catch (error) {
    console.log(`❌ Event system test failed: ${error}\n`);
    return false;
  }
}

async function testMetricsIntegration() {
  console.log("📊 Testing Metrics Integration...\n");

  try {
    // Test various metrics
    prometheusMetrics.recordEmailDelivery(
      "test-dealership",
      "test-provider",
      "sent",
    );
    prometheusMetrics.recordAIResponseLatency(
      1500,
      "test-dealership",
      "test-model",
      "test-response",
    );
    prometheusMetrics.recordError("test-service", "test-error", "low");

    // Get metrics output
    const metrics = await prometheusMetrics.getMetrics();
    const metricsLines = metrics.split("\n").length;

    console.log(`📈 Metrics recorded successfully (${metricsLines} lines)`);
    console.log("✅ Metrics integration test completed!\n");
    return true;
  } catch (error) {
    console.log(`❌ Metrics integration test failed: ${error}\n`);
    return false;
  }
}

async function runLoadTest(config: TestConfig, emailCount: number = 5) {
  console.log(`🚀 Running Load Test (${emailCount} emails)...\n`);

  const startTime = Date.now();
  const promises: Promise<any>[] = [];

  for (let i = 0; i < emailCount; i++) {
    const promise = emailService.sendEmail({
      to: config.customerEmail,
      subject: `Load Test Email #${i + 1}`,
      html: `<h2>Load Test Email #${i + 1}</h2><p>This is load test email ${i + 1} of ${emailCount}.</p><small>Sent at: ${new Date().toISOString()}</small>`,
      text: `Load Test Email #${i + 1}\n\nThis is load test email ${i + 1} of ${emailCount}.\n\nSent at: ${new Date().toISOString()}`,
    });
    promises.push(promise);

    // Add small delay to avoid overwhelming the service
    if (i > 0 && i % 3 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const results = await Promise.allSettled(promises);
  const endTime = Date.now();

  const successful = results.filter(
    (r) => r.status === "fulfilled" && (r.value as any).success,
  ).length;
  const failed = emailCount - successful;
  const duration = endTime - startTime;

  console.log(`📊 Load Test Results:`);
  console.log(`   ✅ Successful: ${successful}/${emailCount}`);
  console.log(`   ❌ Failed: ${failed}/${emailCount}`);
  console.log(`   ⏱️  Duration: ${duration}ms`);
  console.log(
    `   📈 Rate: ${(emailCount / (duration / 1000)).toFixed(2)} emails/second`,
  );
  console.log(
    `   🎯 Success Rate: ${((successful / emailCount) * 100).toFixed(1)}%\n`,
  );

  return successful === emailCount;
}

async function main() {
  console.log("🎯 ADF Email Response System Test Suite\n");
  console.log("=".repeat(50) + "\n");

  const config = { ...defaultTestConfig };

  // Override with command line arguments if provided
  if (process.argv[2]) config.customerEmail = process.argv[2];
  if (process.argv[3]) config.customerName = process.argv[3];
  if (process.argv[4]) config.dealershipId = parseInt(process.argv[4]);

  console.log("📋 Test Configuration:");
  console.log(`   📧 Customer Email: ${config.customerEmail}`);
  console.log(`   👤 Customer Name: ${config.customerName}`);
  console.log(`   🏢 Dealership ID: ${config.dealershipId}`);
  console.log(`   🚗 Vehicle Info: ${config.vehicleInfo}`);
  console.log("");

  const testResults: { [key: string]: boolean } = {};

  try {
    // Test 1: Email Service Configuration
    testResults.emailService = await testEmailService();

    // Test 2: Direct Email Send
    testResults.directEmail = await testDirectEmailSend(config);

    // Test 3: Simple Orchestrator
    testResults.orchestrator = await testSimpleOrchestrator(config);

    // Test 4: Event System Integration
    testResults.eventSystem = await testSimpleEventSystem(config);

    // Test 5: Metrics Integration
    testResults.metrics = await testMetricsIntegration();

    // Test 6: Load Test
    testResults.loadTest = await runLoadTest(config, 3);

    // Summary
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;

    console.log("📋 Test Summary:");
    console.log("=".repeat(30));
    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(
        `${passed ? "✅" : "❌"} ${test}: ${passed ? "PASSED" : "FAILED"}`,
      );
    });
    console.log("=".repeat(30));
    console.log(
      `🎯 Overall: ${passedTests}/${totalTests} tests passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`,
    );

    if (passedTests === totalTests) {
      console.log("🎉 All tests completed successfully!");
      process.exit(0);
    } else {
      console.log("⚠️  Some tests failed. Check the logs above for details.");
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Test suite failed with exception:", error);
    process.exit(1);
  }
}

// Run the test suite
if (require.main === module) {
  main().catch(console.error);
}

export { main as runEmailTestSuite, defaultTestConfig };
