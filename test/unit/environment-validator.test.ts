import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  EnvironmentValidator,
  type ValidationOptions,
} from "../../tools/validation/validate-environment";

describe("EnvironmentValidator", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Required Variables Validation", () => {
    it("should pass when all required variables are valid", async () => {
      // Set up valid environment
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.NODE_ENV = "development";

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.exitCode).toBe(0);
      expect(result.hasFailures).toBe(false);
    });

    it("should fail when required variables are missing", async () => {
      // Clear environment
      delete process.env.DATABASE_URL;
      delete process.env.SESSION_SECRET;
      delete process.env.OPENAI_API_KEY;
      delete process.env.SENDGRID_API_KEY;

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.exitCode).toBe(1);
      expect(result.hasFailures).toBe(true);
    });

    it("should fail when DATABASE_URL has invalid format", async () => {
      process.env.DATABASE_URL = "invalid-url";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.hasFailures).toBe(true);
    });

    it("should fail when SESSION_SECRET is too short", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET = "short"; // Too short
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.hasFailures).toBe(true);
    });

    it("should fail when OPENAI_API_KEY has invalid format", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY = "invalid-key"; // Wrong format
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.hasFailures).toBe(true);
    });

    it("should fail when SENDGRID_API_KEY has invalid format", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY = "invalid-sendgrid-key"; // Wrong format

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.hasFailures).toBe(true);
    });
  });

  describe("Production Environment Validation", () => {
    it("should require additional variables in production", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.NODE_ENV = "production";
      // Missing REDIS_URL and CREDENTIALS_ENCRYPTION_KEY

      const validator = new EnvironmentValidator({
        environment: "production",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.hasFailures).toBe(true);
    });

    it("should pass when all production variables are set", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-for-production-use-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CREDENTIALS_ENCRYPTION_KEY =
        "very-long-encryption-key-for-production-use-with-sufficient-entropy-12345";
      process.env.NODE_ENV = "production";

      const validator = new EnvironmentValidator({
        environment: "production",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.exitCode).toBe(0);
      expect(result.hasFailures).toBe(false);
    });

    it("should fail when production has insecure configurations", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-for-production-use-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CREDENTIALS_ENCRYPTION_KEY =
        "very-long-encryption-key-for-production-use-with-sufficient-entropy-12345";
      process.env.NODE_ENV = "production";
      process.env.AUTH_BYPASS = "true"; // Insecure!
      process.env.DEBUG = "true"; // Insecure in production!

      const validator = new EnvironmentValidator({
        environment: "production",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.hasFailures).toBe(true);
    });
  });

  describe("Optional Variables Validation", () => {
    it("should validate optional variable formats", async () => {
      process.env.PORT = "not-a-number"; // Invalid
      process.env.LOG_LEVEL = "invalid-level"; // Invalid
      process.env.REDIS_PORT = "99999"; // Invalid port

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      // Set required vars to valid values
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const result = await validator.runAll();

      expect(result.hasWarnings).toBe(true);
    });

    it("should accept valid optional variables", async () => {
      process.env.PORT = "3000";
      process.env.LOG_LEVEL = "info";
      process.env.REDIS_PORT = "6379";
      process.env.FRONTEND_URL = "https://example.com";

      // Set required vars to valid values
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.exitCode).toBe(0);
    });
  });

  describe("Environment Settings Validation", () => {
    it("should fail when NODE_ENV is invalid", async () => {
      process.env.NODE_ENV = "invalid-environment";

      const validator = new EnvironmentValidator({
        environment: "invalid-environment" as any,
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.hasFailures).toBe(true);
    });

    it("should pass when NODE_ENV is valid", async () => {
      process.env.NODE_ENV = "development";

      // Set required vars
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.exitCode).toBe(0);
    });
  });

  describe("Exit Codes", () => {
    it("should return exit code 0 when all validations pass", async () => {
      // Set up valid environment
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
      process.env.SESSION_SECRET =
        "very-long-secure-session-secret-with-enough-entropy-12345";
      process.env.OPENAI_API_KEY =
        "sk-1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.SENDGRID_API_KEY =
        "SG.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.NODE_ENV = "development";

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.exitCode).toBe(0);
    });

    it("should return exit code 1 when critical validations fail", async () => {
      // Missing critical environment variables
      delete process.env.DATABASE_URL;
      delete process.env.SESSION_SECRET;

      const validator = new EnvironmentValidator({
        environment: "development",
        skipConnectionTests: true,
      });

      const result = await validator.runAll();

      expect(result.exitCode).toBe(1);
    });
  });
});
