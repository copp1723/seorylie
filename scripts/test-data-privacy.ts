#!/usr/bin/env ts-node
/**
 * Data Privacy & Compliance Testing Script
 *
 * This script performs comprehensive testing of GDPR/CCPA compliance features:
 * - PII encryption/decryption
 * - Log redaction
 * - Database encryption
 * - GDPR right to be forgotten
 * - Consent tracking
 * - Data export
 * - Data retention/purging
 *
 * Usage:
 *   npm run test:data-privacy
 *
 * Environment variables:
 *   TEST_DATABASE_URL - Database connection URL (default: uses main database)
 *   ENCRYPTION_KEY - Encryption key for testing (default: test-encryption-key)
 */

import dotenv from "dotenv";
import { Pool } from "pg";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { performance } from "perf_hooks";
import {
  encrypt,
  decrypt,
  maskPII,
  clearKeyCache,
} from "../server/utils/crypto";
import {
  redactSensitiveInfo,
  redactSensitivePatterns,
} from "../server/middleware/log-redaction";
import logger from "../server/utils/logger";
import { exec } from "child_process";
import { promisify } from "util";

// Load environment variables
dotenv.config();

// Set test encryption key if not set
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-data-privacy-testing";
}

// Configuration
const config = {
  database: {
    connectionString:
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/cleanrylie",
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  },
  api: {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3000",
    token: process.env.TEST_API_TOKEN || "test-token",
  },
  test: {
    cleanup: process.env.TEST_CLEANUP !== "false",
    verbose: process.env.TEST_VERBOSE === "true",
  },
};

// Test data
const testData = {
  user: {
    id: 9999,
    name: "Test User",
    email: "gdpr-test@example.com",
    phone: "555-123-4567",
  },
  dealership: {
    id: 9999,
    name: "Test Dealership",
    email: "test-dealership@example.com",
  },
  lead: {
    externalId: `test-gdpr-${Date.now()}`,
    customerName: "John Privacy Doe",
    customerEmail: "john.privacy.doe@example.com",
    customerPhone: "555-987-6543",
    customerComments: "This is a test lead for GDPR compliance testing",
    vehicleYear: "2023",
    vehicleMake: "Tesla",
    vehicleModel: "Model Y",
    vehicleTrim: "Long Range",
    vehicleStockNumber: "GDPR123",
  },
};

// Database connection
let pool: Pool;

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: {} as Record<
    string,
    {
      status: "passed" | "failed" | "skipped";
      duration: number;
      error?: string;
    }
  >,
};

// Utility to run a test and track results
async function runTest(
  name: string,
  testFn: () => Promise<void>,
): Promise<void> {
  results.total++;
  console.log(`\n🧪 Running test: ${name}`);

  const startTime = performance.now();
  try {
    await testFn();
    const duration = performance.now() - startTime;
    results.passed++;
    results.tests[name] = { status: "passed", duration };
    console.log(`✅ Test passed: ${name} (${duration.toFixed(2)}ms)`);
  } catch (error) {
    const duration = performance.now() - startTime;
    results.failed++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.tests[name] = { status: "failed", duration, error: errorMessage };
    console.error(`❌ Test failed: ${name} (${duration.toFixed(2)}ms)`);
    console.error(`   Error: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      console.error(
        `   Stack: ${error.stack.split("\n").slice(1, 3).join("\n")}`,
      );
    }
  }
}

// Skip a test and track results
function skipTest(name: string, reason: string): void {
  results.total++;
  results.skipped++;
  results.tests[name] = { status: "skipped", duration: 0 };
  console.log(`⏭️ Skipping test: ${name} - ${reason}`);
}

// Main test function
async function main() {
  console.log("🔒 Starting Data Privacy & Compliance Tests");
  console.log("==========================================");

  try {
    // Initialize database connection
    pool = new Pool(config.database);

    // Run tests
    await runSetupTests();
    await runEncryptionTests();
    await runLogRedactionTests();
    await runDatabaseEncryptionTests();
    await runGdprEndpointTests();
    await runConsentTrackingTests();
    await runDataExportTests();
    await runPurgeScriptTests();

    // Print summary
    printSummary();
  } catch (error) {
    console.error("❌ Unhandled error in test suite:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (config.test.cleanup) {
      await cleanup();
    }

    // Close database connection
    if (pool) {
      await pool.end();
    }
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Setup tests
async function runSetupTests() {
  console.log("\n📋 Running Setup Tests");

  await runTest("Environment Variables", async () => {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY environment variable is not set");
    }

    // Test database connection
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT NOW()");
      if (!result.rows || result.rows.length === 0) {
        throw new Error("Database query failed");
      }
    } finally {
      client.release();
    }
  });

  await runTest("Database Migration Status", async () => {
    const client = await pool.connect();
    try {
      // Check if pgcrypto extension is installed
      const pgcryptoResult = await client.query(`
        SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto'
      `);

      if (parseInt(pgcryptoResult.rows[0].count) === 0) {
        throw new Error("pgcrypto extension is not installed");
      }

      // Check if encryption functions exist
      const encryptFnResult = await client.query(`
        SELECT COUNT(*) FROM pg_proc 
        WHERE proname IN ('encrypt_pii', 'decrypt_pii')
      `);

      if (parseInt(encryptFnResult.rows[0].count) < 2) {
        throw new Error("Encryption functions are not installed");
      }

      // Check if adf_leads table has the required columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'adf_leads' 
        AND column_name IN ('customer_email', 'customer_phone', 'customer_name', 'consent_given', 'data_retention_date')
      `);

      const columns = columnsResult.rows.map((row) => row.column_name);

      if (
        !columns.includes("customer_email") ||
        !columns.includes("customer_phone") ||
        !columns.includes("customer_name") ||
        !columns.includes("consent_given") ||
        !columns.includes("data_retention_date")
      ) {
        throw new Error("adf_leads table is missing required columns");
      }

      // Check if bytea type is used for PII columns
      const byteaColumns = columnsResult.rows
        .filter((row) => row.data_type === "bytea")
        .map((row) => row.column_name);

      if (
        !byteaColumns.includes("customer_email") ||
        !byteaColumns.includes("customer_phone") ||
        !byteaColumns.includes("customer_name")
      ) {
        throw new Error("PII columns are not using bytea type for encryption");
      }
    } finally {
      client.release();
    }
  });

  await runTest("Create Test Data", async () => {
    const client = await pool.connect();
    try {
      // First check if test data already exists
      const existingResult = await client.query(
        `
        SELECT id FROM adf_leads 
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      if (existingResult.rows.length > 0) {
        console.log("   Test data already exists, skipping creation");
        return;
      }

      // Encrypt PII fields
      const encryptedName = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        [testData.lead.customerName],
      );

      const encryptedEmail = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        [testData.lead.customerEmail],
      );

      const encryptedPhone = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        [testData.lead.customerPhone],
      );

      // Insert test lead
      await client.query(
        `
        INSERT INTO adf_leads (
          external_id, dealership_id, customer_name, customer_email, customer_phone,
          customer_comments, vehicle_year, vehicle_make, vehicle_model, vehicle_trim,
          vehicle_stock_number, consent_given, consent_timestamp, consent_source,
          data_retention_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
        )
      `,
        [
          testData.lead.externalId,
          testData.dealership.id,
          encryptedName.rows[0].encrypted,
          encryptedEmail.rows[0].encrypted,
          encryptedPhone.rows[0].encrypted,
          testData.lead.customerComments,
          testData.lead.vehicleYear,
          testData.lead.vehicleMake,
          testData.lead.vehicleModel,
          testData.lead.vehicleTrim,
          testData.lead.vehicleStockNumber,
          true, // consent_given
          new Date(), // consent_timestamp
          "test_script", // consent_source
          new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // data_retention_date (2 years)
        ],
      );

      console.log("   Test data created successfully");
    } finally {
      client.release();
    }
  });
}

// Encryption tests
async function runEncryptionTests() {
  console.log("\n🔐 Running Encryption/Decryption Tests");

  await runTest("Basic Encryption/Decryption", async () => {
    const testValue =
      "This is a test value with PII: john.doe@example.com and 555-123-4567";

    // Encrypt the value
    const encrypted = await encrypt(testValue);

    // Ensure it's encrypted (not plaintext)
    if (encrypted.toString().includes(testValue)) {
      throw new Error("Value was not properly encrypted");
    }

    // Decrypt the value
    const decrypted = await decrypt(encrypted);

    // Verify decryption worked
    if (decrypted !== testValue) {
      throw new Error(
        `Decryption failed. Expected: "${testValue}", Got: "${decrypted}"`,
      );
    }
  });

  await runTest("Encryption Performance", async () => {
    const testValues = Array(100)
      .fill(0)
      .map(
        (_, i) =>
          `Test value ${i}: user${i}@example.com, 555-123-${i.toString().padStart(4, "0")}`,
      );

    const startTime = performance.now();

    // Encrypt all values
    const encrypted = await Promise.all(testValues.map((v) => encrypt(v)));

    // Decrypt all values
    const decrypted = await Promise.all(encrypted.map((e) => decrypt(e)));

    const duration = performance.now() - startTime;

    // Verify all decryptions match originals
    for (let i = 0; i < testValues.length; i++) {
      if (decrypted[i] !== testValues[i]) {
        throw new Error(`Decryption mismatch at index ${i}`);
      }
    }

    console.log(
      `   Encrypted and decrypted ${testValues.length} values in ${duration.toFixed(2)}ms (${(duration / testValues.length).toFixed(2)}ms per value)`,
    );

    // Performance should be reasonable
    if (duration > 5000) {
      throw new Error(
        `Encryption performance is too slow: ${duration.toFixed(2)}ms for ${testValues.length} values`,
      );
    }
  });

  await runTest("PII Masking", async () => {
    const testEmail = "john.doe@example.com";
    const testPhone = "555-123-4567";
    const testName = "John Smith";

    const maskedEmail = maskPII(testEmail, "email");
    const maskedPhone = maskPII(testPhone, "phone");
    const maskedName = maskPII(testName, "name");

    // Email should be masked but retain structure
    if (
      maskedEmail === testEmail ||
      !maskedEmail.includes("@") ||
      !maskedEmail.includes("***")
    ) {
      throw new Error(`Email masking failed: ${maskedEmail}`);
    }

    // Phone should be masked but retain last 4 digits
    if (
      maskedPhone === testPhone ||
      !maskedPhone.includes("***") ||
      !maskedPhone.includes("4567")
    ) {
      throw new Error(`Phone masking failed: ${maskedPhone}`);
    }

    // Name should be masked but retain initials
    if (
      maskedName === testName ||
      !maskedName.includes("J***") ||
      !maskedName.includes("S***")
    ) {
      throw new Error(`Name masking failed: ${maskedName}`);
    }

    console.log(`   Masked email: ${maskedEmail}`);
    console.log(`   Masked phone: ${maskedPhone}`);
    console.log(`   Masked name: ${maskedName}`);
  });

  await runTest("Key Cache Management", async () => {
    // Fill cache with some operations
    await Promise.all(
      Array(10)
        .fill(0)
        .map((_, i) => encrypt(`Cache test ${i}`)),
    );

    // Clear the key cache
    clearKeyCache();

    // Ensure encryption still works after cache clear
    const testValue = "Test after cache clear";
    const encrypted = await encrypt(testValue);
    const decrypted = await decrypt(encrypted);

    if (decrypted !== testValue) {
      throw new Error("Encryption failed after cache clear");
    }
  });
}

// Log redaction tests
async function runLogRedactionTests() {
  console.log("\n📝 Running Log Redaction Tests");

  await runTest("Redact Sensitive Patterns", async () => {
    const testData = `
      User email: john.doe@example.com
      Phone number: 555-123-4567
      SSN: 123-45-6789
      Credit card: 4111 1111 1111 1111
      IP address: 192.168.1.1
    `;

    const redacted = redactSensitivePatterns(testData);

    // Email should be redacted
    if (redacted.includes("john.doe@example.com")) {
      throw new Error("Email was not redacted");
    }

    // Phone should be redacted
    if (redacted.includes("555-123-4567")) {
      throw new Error("Phone number was not redacted");
    }

    // SSN should be redacted
    if (redacted.includes("123-45-6789")) {
      throw new Error("SSN was not redacted");
    }

    // Credit card should be redacted
    if (redacted.includes("4111 1111 1111 1111")) {
      throw new Error("Credit card was not redacted");
    }

    // IP should be redacted
    if (redacted.includes("192.168.1.1")) {
      throw new Error("IP address was not redacted");
    }

    console.log("   Original length:", testData.length);
    console.log("   Redacted length:", redacted.length);
    console.log(
      "   Redacted sample:",
      redacted.split("\n").slice(1, 3).join("\n"),
    );
  });

  await runTest("Redact Object Properties", async () => {
    const testObject = {
      user: {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "555-123-4567",
        password: "secret123",
        preferences: {
          newsletter: true,
          sms_notifications: false,
        },
      },
      payment: {
        credit_card: "4111 1111 1111 1111",
        cvv: "123",
        expiry: "12/25",
      },
      comments: "Please contact me at john.doe@example.com or 555-123-4567",
    };

    const redacted = redactSensitiveInfo(testObject);

    // Check sensitive fields are redacted
    if (
      redacted.user.email !== "[REDACTED]" ||
      redacted.user.phone !== "[REDACTED]" ||
      redacted.user.password !== "[REDACTED]" ||
      redacted.payment.credit_card !== "[REDACTED]" ||
      redacted.payment.cvv !== "[REDACTED]"
    ) {
      throw new Error("Sensitive fields were not properly redacted");
    }

    // Check non-sensitive fields are preserved
    if (
      redacted.user.preferences.newsletter !== true ||
      redacted.user.preferences.sms_notifications !== false
    ) {
      throw new Error("Non-sensitive fields were incorrectly redacted");
    }

    // Check text content is redacted
    if (
      redacted.comments.includes("john.doe@example.com") ||
      redacted.comments.includes("555-123-4567")
    ) {
      throw new Error("Sensitive patterns in text were not redacted");
    }

    console.log(
      "   Redacted object:",
      JSON.stringify(redacted, null, 2).substring(0, 100) + "...",
    );
  });

  await runTest("Logger Integration", async () => {
    // Create a temporary log file for testing
    const logFile = path.join(__dirname, "test-log-redaction.log");

    // Override logger transport temporarily
    const originalTransports = logger.transports;
    logger.transports = [
      {
        write: (chunk: string) => {
          fs.appendFileSync(logFile, chunk);
          return true;
        },
      },
    ];

    try {
      // Log sensitive information
      logger.info("User logged in", {
        email: "john.doe@example.com",
        phone: "555-123-4567",
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      // Wait for log to be written
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Read log file
      const logContent = fs.readFileSync(logFile, "utf8");

      // Check sensitive information is redacted
      if (
        logContent.includes("john.doe@example.com") ||
        logContent.includes("555-123-4567")
      ) {
        throw new Error("Sensitive information was not redacted in logs");
      }

      // Check non-sensitive information is preserved
      if (
        !logContent.includes("User logged in") ||
        !logContent.includes("userAgent")
      ) {
        throw new Error("Non-sensitive information was incorrectly redacted");
      }

      console.log(
        "   Log content sample:",
        logContent.substring(0, 100) + "...",
      );
    } finally {
      // Restore original transports
      logger.transports = originalTransports;

      // Clean up test log file
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
      }
    }
  });
}

// Database encryption tests
async function runDatabaseEncryptionTests() {
  console.log("\n🗄️ Running Database Encryption Tests");

  await runTest("PII Column Encryption", async () => {
    const client = await pool.connect();
    try {
      // Get the test lead
      const result = await client.query(
        `
        SELECT customer_name, customer_email, customer_phone
        FROM adf_leads
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      if (result.rows.length === 0) {
        throw new Error("Test lead not found");
      }

      const row = result.rows[0];

      // Verify fields are stored as bytea
      if (
        !(row.customer_name instanceof Buffer) ||
        !(row.customer_email instanceof Buffer) ||
        !(row.customer_phone instanceof Buffer)
      ) {
        throw new Error("PII fields are not stored as bytea");
      }

      // Verify raw values don't contain plaintext
      const nameStr = row.customer_name.toString();
      const emailStr = row.customer_email.toString();
      const phoneStr = row.customer_phone.toString();

      if (
        nameStr.includes(testData.lead.customerName) ||
        emailStr.includes(testData.lead.customerEmail) ||
        phoneStr.includes(testData.lead.customerPhone)
      ) {
        throw new Error("PII fields contain plaintext");
      }

      console.log("   PII fields are properly encrypted in the database");
    } finally {
      client.release();
    }
  });

  await runTest("Database Decryption Functions", async () => {
    const client = await pool.connect();
    try {
      // Decrypt fields using database functions
      const result = await client.query(
        `
        SELECT 
          decrypt_pii(customer_name) AS name,
          decrypt_pii(customer_email) AS email,
          decrypt_pii(customer_phone) AS phone
        FROM adf_leads
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      if (result.rows.length === 0) {
        throw new Error("Test lead not found");
      }

      const row = result.rows[0];

      // Verify decryption worked
      if (
        row.name !== testData.lead.customerName ||
        row.email !== testData.lead.customerEmail ||
        row.phone !== testData.lead.customerPhone
      ) {
        throw new Error("Database decryption functions failed");
      }

      console.log("   Database decryption functions working correctly");
    } finally {
      client.release();
    }
  });

  await runTest("Decrypted View", async () => {
    const client = await pool.connect();
    try {
      // Check if view exists
      const viewCheck = await client.query(`
        SELECT COUNT(*) FROM information_schema.views
        WHERE table_name = 'vw_adf_leads_decrypted'
      `);

      if (parseInt(viewCheck.rows[0].count) === 0) {
        throw new Error("Decrypted view does not exist");
      }

      // Query the view
      const result = await client.query(
        `
        SELECT customer_name, customer_email, customer_phone
        FROM vw_adf_leads_decrypted
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      if (result.rows.length === 0) {
        throw new Error("Test lead not found in view");
      }

      const row = result.rows[0];

      // Verify view returns decrypted data
      if (
        row.customer_name !== testData.lead.customerName ||
        row.customer_email !== testData.lead.customerEmail ||
        row.customer_phone !== testData.lead.customerPhone
      ) {
        throw new Error("Decrypted view not working correctly");
      }

      console.log("   Decrypted view working correctly");
    } finally {
      client.release();
    }
  });

  await runTest("Anonymization Function", async () => {
    const client = await pool.connect();
    try {
      // Create a temporary lead for anonymization
      const tempLeadId = `temp-anon-${Date.now()}`;

      // Encrypt PII fields
      const encryptedName = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        ["Temp Anonymize User"],
      );

      const encryptedEmail = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        ["temp-anon@example.com"],
      );

      const encryptedPhone = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        ["555-999-8888"],
      );

      // Insert temporary lead
      await client.query(
        `
        INSERT INTO adf_leads (
          external_id, dealership_id, customer_name, customer_email, customer_phone,
          customer_comments, consent_given, data_retention_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
      `,
        [
          tempLeadId,
          testData.dealership.id,
          encryptedName.rows[0].encrypted,
          encryptedEmail.rows[0].encrypted,
          encryptedPhone.rows[0].encrypted,
          "Temporary lead for anonymization testing",
          true,
          new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago (expired)
        ],
      );

      // Run anonymization function
      await client.query(`
        SELECT anonymize_expired_leads()
      `);

      // Check if lead was anonymized
      const result = await client.query(
        `
        SELECT 
          anonymized,
          decrypt_pii(customer_name) AS name,
          decrypt_pii(customer_email) AS email,
          decrypt_pii(customer_phone) AS phone
        FROM adf_leads
        WHERE external_id = $1
      `,
        [tempLeadId],
      );

      if (result.rows.length === 0) {
        throw new Error("Temporary lead not found");
      }

      const row = result.rows[0];

      // Verify anonymization
      if (!row.anonymized) {
        throw new Error("Lead was not marked as anonymized");
      }

      if (
        row.name !== "[ANONYMIZED]" ||
        row.email !== "[ANONYMIZED]" ||
        row.phone !== "[ANONYMIZED]"
      ) {
        throw new Error("PII fields were not anonymized");
      }

      console.log("   Anonymization function working correctly");

      // Clean up
      await client.query(
        `
        DELETE FROM adf_leads WHERE external_id = $1
      `,
        [tempLeadId],
      );
    } finally {
      client.release();
    }
  });
}

// GDPR endpoint tests
async function runGdprEndpointTests() {
  console.log("\n🇪🇺 Running GDPR Endpoint Tests");

  // Check if API server is running
  let apiRunning = false;
  try {
    const response = await axios.get(`${config.api.baseUrl}/health`);
    apiRunning = response.status === 200;
  } catch (error) {
    apiRunning = false;
  }

  if (!apiRunning) {
    skipTest("GDPR API Endpoints", "API server is not running");
    return;
  }

  await runTest("Right to be Forgotten Endpoint", async () => {
    // Create a temporary lead for deletion
    const tempLeadId = `temp-delete-${Date.now()}`;
    const tempEmail = `temp-delete-${Date.now()}@example.com`;

    const client = await pool.connect();
    try {
      // Encrypt PII fields
      const encryptedName = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        ["Temp Delete User"],
      );

      const encryptedEmail = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        [tempEmail],
      );

      const encryptedPhone = await client.query(
        `
        SELECT encrypt_pii($1) AS encrypted
      `,
        ["555-777-6666"],
      );

      // Insert temporary lead
      await client.query(
        `
        INSERT INTO adf_leads (
          external_id, dealership_id, customer_name, customer_email, customer_phone,
          customer_comments, consent_given, data_retention_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
        RETURNING id
      `,
        [
          tempLeadId,
          testData.dealership.id,
          encryptedName.rows[0].encrypted,
          encryptedEmail.rows[0].encrypted,
          encryptedPhone.rows[0].encrypted,
          "Temporary lead for deletion testing",
          true,
          new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // 2 years
        ],
      );

      // Get the lead ID
      const leadId = (
        await client.query(
          `
        SELECT id FROM adf_leads WHERE external_id = $1
      `,
          [tempLeadId],
        )
      ).rows[0].id;

      // Call the GDPR forget endpoint
      const response = await axios.post(
        `${config.api.baseUrl}/api/gdpr/forget`,
        {
          email: tempEmail,
        },
      );

      if (response.status !== 200) {
        throw new Error(
          `GDPR forget endpoint returned status ${response.status}`,
        );
      }

      // Verify lead was anonymized
      const result = await client.query(
        `
        SELECT 
          anonymized,
          decrypt_pii(customer_name) AS name,
          decrypt_pii(customer_email) AS email,
          decrypt_pii(customer_phone) AS phone
        FROM adf_leads
        WHERE external_id = $1
      `,
        [tempLeadId],
      );

      if (result.rows.length === 0) {
        throw new Error("Temporary lead not found");
      }

      const row = result.rows[0];

      // Verify anonymization
      if (!row.anonymized) {
        throw new Error("Lead was not marked as anonymized");
      }

      if (
        row.name !== "[DELETED]" ||
        row.email !== "[DELETED]" ||
        row.phone !== "[DELETED]"
      ) {
        throw new Error("PII fields were not anonymized");
      }

      console.log("   GDPR forget endpoint working correctly");

      // Clean up
      await client.query(
        `
        DELETE FROM adf_leads WHERE external_id = $1
      `,
        [tempLeadId],
      );
    } finally {
      client.release();
    }
  });

  // Skip other API tests if not running with auth token
  if (!process.env.TEST_API_TOKEN) {
    skipTest("Data Export Endpoint", "TEST_API_TOKEN not set");
    skipTest("Consent Update Endpoint", "TEST_API_TOKEN not set");
    return;
  }

  await runTest("Data Export Endpoint", async () => {
    // This test requires authentication, which is complex to set up in a test script
    // In a real scenario, you would use a test user with a valid JWT token

    // For now, just verify the endpoint exists by checking for 401 response
    try {
      await axios.get(`${config.api.baseUrl}/api/gdpr/data-export`);
      throw new Error("Endpoint should require authentication");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log(
          "   Data export endpoint correctly requires authentication",
        );
      } else {
        throw error;
      }
    }
  });

  await runTest("Consent Update Endpoint", async () => {
    // This test requires authentication, which is complex to set up in a test script
    // In a real scenario, you would use a test user with a valid JWT token

    // For now, just verify the endpoint exists by checking for 401 response
    try {
      await axios.post(`${config.api.baseUrl}/api/gdpr/update-consent`, {
        consent: true,
        source: "test",
      });
      throw new Error("Endpoint should require authentication");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log(
          "   Consent update endpoint correctly requires authentication",
        );
      } else {
        throw error;
      }
    }
  });
}

// Consent tracking tests
async function runConsentTrackingTests() {
  console.log("\n📝 Running Consent Tracking Tests");

  await runTest("Consent Fields", async () => {
    const client = await pool.connect();
    try {
      // Get the test lead
      const result = await client.query(
        `
        SELECT consent_given, consent_timestamp, consent_source, data_retention_date
        FROM adf_leads
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      if (result.rows.length === 0) {
        throw new Error("Test lead not found");
      }

      const row = result.rows[0];

      // Verify consent fields
      if (row.consent_given !== true) {
        throw new Error("Consent given field is not true");
      }

      if (!row.consent_timestamp) {
        throw new Error("Consent timestamp is not set");
      }

      if (row.consent_source !== "test_script") {
        throw new Error("Consent source is not correct");
      }

      if (!row.data_retention_date) {
        throw new Error("Data retention date is not set");
      }

      // Verify retention date is in the future
      const retentionDate = new Date(row.data_retention_date);
      if (retentionDate <= new Date()) {
        throw new Error("Data retention date is not in the future");
      }

      console.log("   Consent fields are correctly set");
    } finally {
      client.release();
    }
  });

  await runTest("Update Consent", async () => {
    const client = await pool.connect();
    try {
      // Update consent
      await client.query(
        `
        UPDATE adf_leads
        SET 
          consent_given = false,
          consent_timestamp = NOW(),
          consent_source = 'test_update',
          data_retention_date = NOW() + interval '1 year'
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      // Verify update
      const result = await client.query(
        `
        SELECT consent_given, consent_source, data_retention_date
        FROM adf_leads
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      if (result.rows.length === 0) {
        throw new Error("Test lead not found");
      }

      const row = result.rows[0];

      // Verify updated values
      if (row.consent_given !== false) {
        throw new Error("Consent given field was not updated");
      }

      if (row.consent_source !== "test_update") {
        throw new Error("Consent source was not updated");
      }

      // Reset consent for other tests
      await client.query(
        `
        UPDATE adf_leads
        SET 
          consent_given = true,
          consent_timestamp = NOW(),
          consent_source = 'test_script',
          data_retention_date = NOW() + interval '2 years'
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      console.log("   Consent update works correctly");
    } finally {
      client.release();
    }
  });
}

// Data export tests
async function runDataExportTests() {
  console.log("\n📤 Running Data Export Tests");

  await runTest("Export Decrypted Data", async () => {
    const client = await pool.connect();
    try {
      // Export data using the view
      const result = await client.query(
        `
        SELECT *
        FROM vw_adf_leads_decrypted
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      if (result.rows.length === 0) {
        throw new Error("Test lead not found");
      }

      const row = result.rows[0];

      // Verify export contains decrypted data
      if (
        row.customer_name !== testData.lead.customerName ||
        row.customer_email !== testData.lead.customerEmail ||
        row.customer_phone !== testData.lead.customerPhone
      ) {
        throw new Error("Export does not contain correctly decrypted data");
      }

      // Verify non-PII fields
      if (
        row.vehicle_make !== testData.lead.vehicleMake ||
        row.vehicle_model !== testData.lead.vehicleModel
      ) {
        throw new Error("Export does not contain correct non-PII data");
      }

      console.log("   Data export works correctly");
    } finally {
      client.release();
    }
  });

  await runTest("CSV Export Format", async () => {
    const client = await pool.connect();
    try {
      // Get data for CSV export
      const result = await client.query(
        `
        SELECT 
          id,
          external_id,
          customer_name,
          customer_email,
          customer_phone,
          vehicle_year,
          vehicle_make,
          vehicle_model,
          consent_given,
          created_at
        FROM vw_adf_leads_decrypted
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      if (result.rows.length === 0) {
        throw new Error("Test lead not found");
      }

      // Create CSV string
      const row = result.rows[0];
      const headers = Object.keys(row).join(",");
      const values = Object.values(row)
        .map((v) => (typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v))
        .join(",");
      const csv = `${headers}\n${values}`;

      // Verify CSV format
      if (!csv.startsWith("id,external_id")) {
        throw new Error("CSV headers are not correct");
      }

      if (
        !csv.includes(testData.lead.customerName) ||
        !csv.includes(testData.lead.customerEmail)
      ) {
        throw new Error("CSV values are not correct");
      }

      console.log("   CSV export format is correct");
    } finally {
      client.release();
    }
  });
}

// Purge script tests
async function runPurgeScriptTests() {
  console.log("\n🗑️ Running Purge Script Tests");

  await runTest("Purge Script Execution", async () => {
    // Create temporary leads for purging
    const client = await pool.connect();

    try {
      // Create expired lead (for anonymization)
      const expiredLeadId = `expired-${Date.now()}`;
      const encryptedName1 = await client.query(
        `SELECT encrypt_pii($1) AS encrypted`,
        ["Expired User"],
      );
      const encryptedEmail1 = await client.query(
        `SELECT encrypt_pii($1) AS encrypted`,
        ["expired@example.com"],
      );
      const encryptedPhone1 = await client.query(
        `SELECT encrypt_pii($1) AS encrypted`,
        ["555-111-2222"],
      );

      await client.query(
        `
        INSERT INTO adf_leads (
          external_id, dealership_id, customer_name, customer_email, customer_phone,
          customer_comments, consent_given, data_retention_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
      `,
        [
          expiredLeadId,
          testData.dealership.id,
          encryptedName1.rows[0].encrypted,
          encryptedEmail1.rows[0].encrypted,
          encryptedPhone1.rows[0].encrypted,
          "Expired lead for purge testing",
          false,
          new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago (expired)
        ],
      );

      // Create very old lead (for deletion)
      const veryOldLeadId = `very-old-${Date.now()}`;
      const encryptedName2 = await client.query(
        `SELECT encrypt_pii($1) AS encrypted`,
        ["Very Old User"],
      );
      const encryptedEmail2 = await client.query(
        `SELECT encrypt_pii($1) AS encrypted`,
        ["very-old@example.com"],
      );
      const encryptedPhone2 = await client.query(
        `SELECT encrypt_pii($1) AS encrypted`,
        ["555-333-4444"],
      );

      await client.query(
        `
        INSERT INTO adf_leads (
          external_id, dealership_id, customer_name, customer_email, customer_phone,
          customer_comments, consent_given, data_retention_date, anonymized, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
        )
      `,
        [
          veryOldLeadId,
          testData.dealership.id,
          encryptedName2.rows[0].encrypted,
          encryptedEmail2.rows[0].encrypted,
          encryptedPhone2.rows[0].encrypted,
          "Very old lead for purge testing",
          false,
          new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000), // 4 years ago
          true, // already anonymized
        ],
      );

      // Run purge script with dry run
      const execPromise = promisify(exec);
      const scriptPath = path.join(__dirname, "purge-old-leads.ts");

      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Purge script not found: ${scriptPath}`);
      }

      const { stdout, stderr } = await execPromise(
        `DRY_RUN=true tsx ${scriptPath}`,
      );

      console.log("   Purge script output:", stdout.substring(0, 200) + "...");

      if (stderr) {
        console.error("   Purge script errors:", stderr);
      }

      // Check if script identified the leads correctly
      if (
        !stdout.includes("would anonymize") ||
        !stdout.includes("would delete")
      ) {
        throw new Error("Purge script did not identify leads correctly");
      }

      // Clean up
      await client.query(
        `
        DELETE FROM adf_leads WHERE external_id IN ($1, $2)
      `,
        [expiredLeadId, veryOldLeadId],
      );

      console.log("   Purge script execution successful");
    } finally {
      client.release();
    }
  });
}

// Cleanup function
async function cleanup() {
  console.log("\n🧹 Cleaning up test data");

  try {
    // Delete test lead
    const client = await pool.connect();
    try {
      await client.query(
        `
        DELETE FROM adf_leads
        WHERE external_id = $1
      `,
        [testData.lead.externalId],
      );

      console.log("   Test data cleaned up successfully");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("   Error cleaning up test data:", error);
  }
}

// Print test results summary
function printSummary() {
  console.log("\n📊 Test Results Summary");
  console.log("=====================");
  console.log(`Total tests: ${results.total}`);
  console.log(
    `Passed: ${results.passed} (${Math.round((results.passed / results.total) * 100)}%)`,
  );
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log("\nTest Details:");

  // Group tests by category
  const categories: Record<
    string,
    Array<{ name: string; status: string; duration: number }>
  > = {};

  for (const [name, result] of Object.entries(results.tests)) {
    const category = name.split(" ")[0];
    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push({
      name,
      status: result.status,
      duration: result.duration,
    });
  }

  // Print tests by category
  for (const [category, tests] of Object.entries(categories)) {
    console.log(`\n${category}:`);

    for (const test of tests) {
      const icon =
        test.status === "passed"
          ? "✅"
          : test.status === "skipped"
            ? "⏭️"
            : "❌";
      console.log(`  ${icon} ${test.name} (${test.duration.toFixed(2)}ms)`);
    }
  }

  console.log("\n=====================");
}

// Run the tests
if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

// Export for testing
export {
  runEncryptionTests,
  runLogRedactionTests,
  runDatabaseEncryptionTests,
  runGdprEndpointTests,
  runConsentTrackingTests,
  runDataExportTests,
  runPurgeScriptTests,
};
