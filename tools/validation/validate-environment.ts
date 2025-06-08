#!/usr/bin/env tsx

/**
 * Comprehensive Environment Validation Script
 *
 * Enhanced version for production readiness with strict validation,
 * proper exit codes, and detailed error reporting.
 *
 * Usage:
 *   npx tsx tools/validation/validate-environment.ts
 *   npm run env:validate
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { createConnection } from "net";
import chalk from "chalk";

// Load environment variables
config();

interface ValidationResult {
  category: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: string[];
  critical?: boolean;
}

interface ValidationOptions {
  environment?: "development" | "production" | "test";
  skipConnectionTests?: boolean;
  verbose?: boolean;
}

class EnvironmentValidator {
  private results: ValidationResult[] = [];
  private options: ValidationOptions;

  constructor(options: ValidationOptions = {}) {
    this.options = {
      environment: (process.env.NODE_ENV as any) || "development",
      skipConnectionTests: false,
      verbose: false,
      ...options,
    };
  }

  /**
   * Add a validation result
   */
  private addResult(
    category: string,
    status: "pass" | "fail" | "warning",
    message: string,
    details?: string[],
    critical: boolean = false,
  ) {
    this.results.push({ category, status, message, details, critical });
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate required environment variables with format checking
   */
  validateRequiredVariables(): void {
    console.log(chalk.blue("🔍 Validating Required Environment Variables..."));

    const requiredVars = [
      {
        name: "DATABASE_URL",
        validator: (value: string) => {
          if (!this.isValidUrl(value)) return "Invalid URL format";
          if (
            !value.startsWith("postgresql://") &&
            !value.startsWith("postgres://")
          ) {
            return "Must be a PostgreSQL connection string";
          }
          return null;
        },
        critical: true,
      },
      {
        name: "SESSION_SECRET",
        validator: (value: string) => {
          if (value.length < 32) return "Must be at least 32 characters long";
          if (value.includes("change-me") || value.includes("default")) {
            return "Must not contain placeholder values";
          }
          return null;
        },
        critical: true,
      },
      {
        name: "OPENAI_API_KEY",
        validator: (value: string) => {
          if (!value.startsWith("sk-")) return 'Must start with "sk-"';
          if (value.length < 20) return "Too short for a valid OpenAI API key";
          if (value.includes("your-") || value.includes("change-me")) {
            return "Must not contain placeholder values";
          }
          return null;
        },
        critical: true,
      },
      {
        name: "SENDGRID_API_KEY",
        validator: (value: string) => {
          if (!value.startsWith("SG.")) return 'Must start with "SG."';
          if (value.length < 50)
            return "Too short for a valid SendGrid API key";
          if (value.includes("your-") || value.includes("change-me")) {
            return "Must not contain placeholder values";
          }
          return null;
        },
        critical: true, // Always critical for proper email functionality
      },
    ];

    // Add production-specific required variables
    if (this.options.environment === "production") {
      requiredVars.push(
        {
          name: "REDIS_URL",
          validator: (value: string) => {
            if (
              !this.isValidUrl(value) &&
              !value.startsWith("redis://") &&
              !value.startsWith("rediss://")
            ) {
              return "Must be a valid Redis URL";
            }
            return null;
          },
          critical: true,
        },
        {
          name: "CREDENTIALS_ENCRYPTION_KEY",
          validator: (value: string) => {
            if (value.length < 32) return "Must be at least 32 characters long";
            if (value.includes("default") || value.includes("change-me")) {
              return "Must not contain placeholder values in production";
            }
            return null;
          },
          critical: true,
        },
      );
    }

    let criticalFailures = 0;
    const missing: string[] = [];
    const invalid: string[] = [];
    const valid: string[] = [];

    for (const varConfig of requiredVars) {
      const value = process.env[varConfig.name];

      if (!value || value.trim() === "") {
        missing.push(varConfig.name);
        if (varConfig.critical) criticalFailures++;
      } else {
        const validationError = varConfig.validator(value);
        if (validationError) {
          invalid.push(`${varConfig.name}: ${validationError}`);
          if (varConfig.critical) criticalFailures++;
        } else {
          valid.push(varConfig.name);
        }
      }
    }

    if (missing.length === 0 && invalid.length === 0) {
      this.addResult(
        "Required Variables",
        "pass",
        `All ${requiredVars.length} required environment variables are valid`,
        valid,
      );
    } else {
      const status = criticalFailures > 0 ? "fail" : "warning";
      const details = [...missing.map((v) => `Missing: ${v}`), ...invalid];

      this.addResult(
        "Required Variables",
        status,
        `${missing.length + invalid.length} validation issues found`,
        details,
        criticalFailures > 0,
      );
    }
  }

  /**
   * Validate optional environment variables
   */
  validateOptionalVariables(): void {
    console.log(chalk.blue("🔍 Validating Optional Environment Variables..."));

    const optionalVars = [
      {
        name: "PORT",
        validator: (v: string) =>
          isNaN(parseInt(v)) ? "Must be a number" : null,
      },
      {
        name: "LOG_LEVEL",
        validator: (v: string) =>
          !["debug", "info", "warn", "error"].includes(v)
            ? "Must be debug, info, warn, or error"
            : null,
      },
      {
        name: "REDIS_HOST",
        validator: (v: string) =>
          v.includes(" ") ? "Invalid hostname format" : null,
      },
      {
        name: "REDIS_PORT",
        validator: (v: string) =>
          isNaN(parseInt(v)) || parseInt(v) < 1 || parseInt(v) > 65535
            ? "Must be a valid port number"
            : null,
      },
      {
        name: "TWILIO_ACCOUNT_SID",
        validator: (v: string) =>
          !v.startsWith("AC") ? 'Must start with "AC"' : null,
      },
      {
        name: "TWILIO_AUTH_TOKEN",
        validator: (v: string) =>
          v.length < 20 ? "Too short for valid Twilio auth token" : null,
      },
      {
        name: "FRONTEND_URL",
        validator: (v: string) =>
          !this.isValidUrl(v) ? "Must be a valid URL" : null,
      },
      {
        name: "SMTP_PORT",
        validator: (v: string) =>
          isNaN(parseInt(v)) ? "Must be a number" : null,
      },
      {
        name: "EMAIL_MAX_RETRIES",
        validator: (v: string) =>
          isNaN(parseInt(v)) ? "Must be a number" : null,
      },
    ];

    const configured: string[] = [];
    const warnings: string[] = [];
    const invalid: string[] = [];

    for (const varConfig of optionalVars) {
      const value = process.env[varConfig.name];
      if (value) {
        if (
          value.includes("your-") ||
          value.includes("change-me") ||
          value.includes("placeholder")
        ) {
          warnings.push(`${varConfig.name} has placeholder value`);
        } else {
          const validationError = varConfig.validator(value);
          if (validationError) {
            invalid.push(`${varConfig.name}: ${validationError}`);
          } else {
            configured.push(varConfig.name);
          }
        }
      }
    }

    if (invalid.length === 0) {
      this.addResult(
        "Optional Variables",
        configured.length > 0 ? "pass" : "warning",
        `${configured.length} optional variables configured correctly`,
        configured.length > 0
          ? configured
          : ["No optional variables configured"],
      );
    } else {
      this.addResult(
        "Optional Variables",
        "warning",
        `${invalid.length} optional variables have validation issues`,
        invalid,
      );
    }

    if (warnings.length > 0) {
      this.addResult(
        "Optional Variable Warnings",
        "warning",
        "Some optional variables have placeholder values",
        warnings,
      );
    }
  }

  /**
   * Validate environment-specific settings with production hardening
   */
  validateEnvironmentSettings(): void {
    console.log(chalk.blue("🔍 Validating Environment Settings..."));

    const nodeEnv = process.env.NODE_ENV || "development";
    const validEnvs = ["development", "production", "test"];

    if (!validEnvs.includes(nodeEnv)) {
      this.addResult(
        "Environment",
        "fail",
        `NODE_ENV "${nodeEnv}" is not valid`,
        [`Expected: ${validEnvs.join(", ")}`],
        true,
      );
    } else {
      this.addResult("Environment", "pass", `NODE_ENV is set to "${nodeEnv}"`);
    }

    // Validate production-specific security requirements
    if (nodeEnv === "production") {
      const securityIssues: string[] = [];

      // Check for insecure configurations
      if (
        process.env.AUTH_BYPASS === "true" ||
        process.env.ALLOW_AUTH_BYPASS === "true"
      ) {
        securityIssues.push("Authentication bypass is enabled");
      }

      if (process.env.DEBUG === "true" || process.env.LOG_LEVEL === "debug") {
        securityIssues.push("Debug mode is enabled");
      }

      if (
        process.env.DISABLE_SSL === "true" ||
        process.env.SSL_DISABLED === "true"
      ) {
        securityIssues.push("SSL is disabled");
      }

      const sessionSecret = process.env.SESSION_SECRET || "";
      if (
        sessionSecret.includes("default") ||
        sessionSecret.includes("change-me") ||
        sessionSecret.length < 64
      ) {
        securityIssues.push(
          "Session secret is weak or contains default values",
        );
      }

      if (securityIssues.length > 0) {
        this.addResult(
          "Production Security",
          "fail",
          "Critical security issues detected in production",
          securityIssues,
          true,
        );
      } else {
        this.addResult(
          "Production Security",
          "pass",
          "Production security settings are properly configured",
        );
      }
    }
  }

  /**
   * Test database connectivity with timeout
   */
  async validateDatabaseConnection(): Promise<void> {
    if (this.options.skipConnectionTests) {
      this.addResult(
        "Database Connection",
        "warning",
        "Skipped (connection tests disabled)",
      );
      return;
    }

    console.log(chalk.blue("🔍 Testing Database Connection..."));

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      this.addResult(
        "Database Connection",
        "fail",
        "DATABASE_URL not configured",
        undefined,
        true,
      );
      return;
    }

    try {
      // Parse database URL
      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = parseInt(url.port) || 5432;

      // Test TCP connection with timeout
      const isReachable = await this.testConnection(host, port, 5000);

      if (isReachable) {
        this.addResult(
          "Database Connection",
          "pass",
          `Database at ${host}:${port} is reachable`,
        );
      } else {
        this.addResult(
          "Database Connection",
          "fail",
          `Cannot connect to database at ${host}:${port}`,
          [
            "Check if database server is running",
            "Verify network connectivity",
            "Check firewall settings",
          ],
          true,
        );
      }
    } catch (error) {
      this.addResult(
        "Database Connection",
        "fail",
        "Database connection test failed",
        [error instanceof Error ? error.message : String(error)],
        true,
      );
    }
  }

  /**
   * Test Redis connectivity
   */
  async validateRedisConnection(): Promise<void> {
    if (this.options.skipConnectionTests) {
      this.addResult(
        "Redis Connection",
        "warning",
        "Skipped (connection tests disabled)",
      );
      return;
    }

    // Check if Redis is explicitly disabled
    if (process.env.SKIP_REDIS === "true") {
      this.addResult(
        "Redis Connection",
        "pass",
        "Redis disabled for staging environment (SKIP_REDIS=true)",
      );
      return;
    }

    console.log(chalk.blue("🔍 Testing Redis Connection..."));

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl && this.options.environment === "production") {
      this.addResult(
        "Redis Connection",
        "fail",
        "REDIS_URL not configured for production",
        undefined,
        true,
      );
      return;
    }

    if (!redisUrl) {
      this.addResult(
        "Redis Connection",
        "warning",
        "Redis not configured (optional for development)",
      );
      return;
    }

    try {
      const url = new URL(redisUrl);
      const host = url.hostname;
      const port = parseInt(url.port) || 6379;

      const isReachable = await this.testConnection(host, port, 3000);

      if (isReachable) {
        this.addResult(
          "Redis Connection",
          "pass",
          `Redis at ${host}:${port} is reachable`,
        );
      } else {
        const status =
          this.options.environment === "production" ? "fail" : "warning";
        this.addResult(
          "Redis Connection",
          status,
          `Cannot connect to Redis at ${host}:${port}`,
          ["Check if Redis server is running", "Verify network connectivity"],
          this.options.environment === "production",
        );
      }
    } catch (error) {
      const status =
        this.options.environment === "production" ? "fail" : "warning";
      this.addResult(
        "Redis Connection",
        status,
        "Redis connection test failed",
        [error instanceof Error ? error.message : String(error)],
        this.options.environment === "production",
      );
    }
  }

  /**
   * Test TCP connection with timeout
   */
  private testConnection(
    host: string,
    port: number,
    timeout: number = 5000,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({ host, port });

      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.on("connect", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Validate file system permissions and required directories
   */
  validateFileSystem(): void {
    console.log(chalk.blue("🔍 Validating File System..."));

    const requiredPaths = [
      { path: "./logs", description: "Logs directory" },
      {
        path: "./dist",
        description: "Build output directory",
        createIfMissing: true,
      },
      {
        path: "./uploads",
        description: "File uploads directory",
        createIfMissing: true,
      },
    ];

    const issues: string[] = [];
    const verified: string[] = [];

    for (const { path, description, createIfMissing } of requiredPaths) {
      if (existsSync(path)) {
        verified.push(`${description} exists`);
      } else if (createIfMissing) {
        try {
          require("fs").mkdirSync(path, { recursive: true });
          verified.push(`${description} created`);
        } catch (error) {
          issues.push(
            `Cannot create ${description}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        issues.push(`${description} does not exist`);
      }
    }

    if (issues.length === 0) {
      this.addResult(
        "File System",
        "pass",
        "All required paths are accessible",
        verified,
      );
    } else {
      this.addResult(
        "File System",
        "warning",
        "Some file system issues detected",
        issues,
      );
    }
  }

  /**
   * Print validation results with proper formatting
   */
  printResults(): { hasFailures: boolean; hasWarnings: boolean } {
    console.log("\\n" + chalk.bold("🔍 ENVIRONMENT VALIDATION RESULTS"));
    console.log("=".repeat(60));

    let hasFailures = false;
    let hasWarnings = false;
    const criticalFailures: string[] = [];

    for (const result of this.results) {
      const icon =
        result.status === "pass"
          ? "✅"
          : result.status === "warning"
            ? "⚠️"
            : "❌";
      const color =
        result.status === "pass"
          ? chalk.green
          : result.status === "warning"
            ? chalk.yellow
            : chalk.red;

      console.log(`\\n${icon} ${chalk.bold(result.category)}`);
      console.log(`   ${color(result.message)}`);

      if (result.details && result.details.length > 0) {
        result.details.forEach((detail) => {
          console.log(`   • ${detail}`);
        });
      }

      if (result.status === "fail") {
        hasFailures = true;
        if (result.critical) {
          criticalFailures.push(result.category);
        }
      }
      if (result.status === "warning") hasWarnings = true;
    }

    // Summary
    console.log("\\n" + "=".repeat(60));
    if (hasFailures) {
      console.log(chalk.red.bold("❌ VALIDATION FAILED"));
      if (criticalFailures.length > 0) {
        console.log(
          chalk.red.bold(
            `   ${criticalFailures.length} critical issues must be resolved before deployment`,
          ),
        );
        console.log(
          chalk.red(`   Critical failures: ${criticalFailures.join(", ")}`),
        );
      }
    } else if (hasWarnings) {
      console.log(chalk.yellow.bold("⚠️  VALIDATION PASSED WITH WARNINGS"));
      console.log(
        chalk.yellow(
          "   Environment is functional but some optimizations are recommended",
        ),
      );
    } else {
      console.log(chalk.green.bold("✅ VALIDATION PASSED"));
      console.log(
        chalk.green("   Environment is properly configured for deployment"),
      );
    }

    return { hasFailures, hasWarnings };
  }

  /**
   * Run all validations
   */
  async runAll(): Promise<{
    exitCode: number;
    hasFailures: boolean;
    hasWarnings: boolean;
  }> {
    console.log(
      chalk.bold.blue(
        `🚀 Starting Environment Validation (${this.options.environment} mode)\\n`,
      ),
    );

    this.validateRequiredVariables();
    this.validateOptionalVariables();
    this.validateEnvironmentSettings();
    this.validateFileSystem();
    await this.validateDatabaseConnection();
    await this.validateRedisConnection();

    const { hasFailures, hasWarnings } = this.printResults();

    // Determine exit code
    let exitCode = 0;
    if (hasFailures) {
      const criticalFailures = this.results.filter(
        (r) => r.status === "fail" && r.critical,
      );
      exitCode = criticalFailures.length > 0 ? 1 : 0;
    }

    console.log("\\n📋 NEXT STEPS:");
    if (hasFailures) {
      console.log("1. Fix the failed validations above");
      console.log("2. Re-run this validation script");
      console.log("3. Do not deploy until all critical issues are resolved");
    } else {
      console.log("1. Environment is ready for deployment");
      if (hasWarnings) {
        console.log("2. Consider addressing warnings for optimal performance");
      }
    }

    return { exitCode, hasFailures, hasWarnings };
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {
    environment: args.includes("--production")
      ? "production"
      : args.includes("--test")
        ? "test"
        : (process.env.NODE_ENV as any) || "development",
    skipConnectionTests: args.includes("--skip-connections"),
    verbose: args.includes("--verbose"),
  };

  const validator = new EnvironmentValidator(options);

  validator
    .runAll()
    .then(({ exitCode }) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error(chalk.red("❌ Validation script failed:"), error);
      process.exit(1);
    });
}

export { EnvironmentValidator, type ValidationOptions, type ValidationResult };
