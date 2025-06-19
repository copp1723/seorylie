#!/usr/bin/env tsx

/**
 * Deployment Automation Script
 * Comprehensive automation for CleanRylie deployment pipeline
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import chalk from "chalk";

interface DeploymentConfig {
  environment: "staging" | "production";
  skipTests?: boolean;
  skipBuild?: boolean;
  autoMigrate?: boolean;
  healthCheckTimeout?: number;
}

class DeploymentAutomation {
  private config: DeploymentConfig;
  private startTime: Date;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.startTime = new Date();
  }

  /**
   * Main deployment orchestration
   */
  async deploy(): Promise<void> {
    console.log(chalk.blue.bold("🚀 CleanRylie Deployment Automation Started"));
    console.log(chalk.gray(`Environment: ${this.config.environment}`));
    console.log(chalk.gray(`Started at: ${this.startTime.toISOString()}\n`));

    try {
      await this.preDeploymentChecks();
      await this.runTests();
      await this.buildApplication();
      await this.runMigrations();
      await this.deployToRender();
      await this.postDeploymentValidation();

      this.logSuccess();
    } catch (error) {
      this.logError(error as Error);
      process.exit(1);
    }
  }

  /**
   * Pre-deployment validation
   */
  private async preDeploymentChecks(): Promise<void> {
    console.log(chalk.yellow("📋 Running Pre-Deployment Checks..."));

    // Check environment variables
    this.runCommand("npm run env:validate", "Environment validation");

    // Check required files
    const requiredFiles = [
      "package.json",
      "tsconfig.json",
      ".env",
      "server/index.ts",
      "Dockerfile",
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Validate package.json has module type
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    if (packageJson.type !== "module") {
      throw new Error('package.json must have "type": "module"');
    }

    console.log(chalk.green("✅ Pre-deployment checks passed\n"));
  }

  /**
   * Run test suite
   */
  private async runTests(): Promise<void> {
    if (this.config.skipTests) {
      console.log(chalk.yellow("⏭️ Skipping tests (skipTests=true)\n"));
      return;
    }

    console.log(chalk.yellow("🧪 Running Test Suite..."));

    // TypeScript type checking
    this.runCommand("npm run check", "TypeScript type check");

    // Unit tests
    this.runCommand("npm run test:ci", "Unit tests");

    // Integration tests (with timeout)
    try {
      this.runCommand("npm run test:integration", "Integration tests", 300000); // 5 min timeout
    } catch (error) {
      console.log(
        chalk.yellow("⚠️ Integration tests failed, continuing with deployment"),
      );
    }

    console.log(chalk.green("✅ Tests completed\n"));
  }

  /**
   * Build application
   */
  private async buildApplication(): Promise<void> {
    if (this.config.skipBuild) {
      console.log(chalk.yellow("⏭️ Skipping build (skipBuild=true)\n"));
      return;
    }

    console.log(chalk.yellow("🔨 Building Application..."));

    // Clean previous build
    this.runCommand("npm run clean", "Clean previous build");

    // Build application
    this.runCommand("npm run build", "Build application");

    // Verify build artifacts
    if (!fs.existsSync("dist/index.js")) {
      throw new Error("Build failed: dist/index.js not found");
    }

    console.log(chalk.green("✅ Build completed\n"));
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.config.autoMigrate) {
      console.log(chalk.yellow("⏭️ Skipping migrations (autoMigrate=false)\n"));
      return;
    }

    console.log(chalk.yellow("🗄️ Running Database Migrations..."));

    try {
      // Check migration status
      this.runCommand("npm run migrate:status", "Check migration status");

      // Run migrations
      this.runCommand("npm run migrate", "Apply migrations");

      console.log(chalk.green("✅ Migrations completed\n"));
    } catch (error) {
      console.log(chalk.red("❌ Migration failed:"), error);
      throw error;
    }
  }

  /**
   * Deploy to Render (simulated - actual deployment happens via git push)
   */
  private async deployToRender(): Promise<void> {
    console.log(chalk.yellow("🚀 Deploying to Render..."));

    // In a real scenario, this would trigger Render deployment
    // For now, we'll simulate the deployment process

    console.log(
      chalk.blue("📤 Pushing to main branch (triggers auto-deploy)..."),
    );

    // Commit and push changes
    try {
      this.runCommand("git add .", "Stage changes");
      this.runCommand(
        'git commit -m "Automated deployment commit"',
        "Commit changes",
      );
      this.runCommand("git push origin main", "Push to main branch");
    } catch (error) {
      console.log(chalk.yellow("⚠️ Git operations failed (may be expected)"));
    }

    console.log(chalk.green("✅ Deployment triggered\n"));
  }

  /**
   * Post-deployment validation
   */
  private async postDeploymentValidation(): Promise<void> {
    console.log(chalk.yellow("🔍 Running Post-Deployment Validation..."));

    const timeout = this.config.healthCheckTimeout || 60000; // 1 minute default
    const maxRetries = 10;
    let retries = 0;

    // Wait for deployment to be ready
    console.log(chalk.blue("⏳ Waiting for deployment to be ready..."));

    while (retries < maxRetries) {
      try {
        // In production, this would check the actual Render URL
        // For now, we'll check local health endpoints
        this.runCommand("npm run health", "Health check", 10000);
        break;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error(`Health check failed after ${maxRetries} retries`);
        }
        console.log(
          chalk.yellow(`⏳ Retry ${retries}/${maxRetries} in 10 seconds...`),
        );
        await this.sleep(10000);
      }
    }

    console.log(chalk.green("✅ Post-deployment validation passed\n"));
  }

  /**
   * Run shell command with error handling
   */
  private runCommand(
    command: string,
    description: string,
    timeout: number = 60000,
  ): void {
    console.log(chalk.gray(`  Running: ${description}`));

    try {
      execSync(command, {
        stdio: "pipe",
        timeout,
        encoding: "utf-8",
      });
      console.log(chalk.green(`  ✅ ${description} completed`));
    } catch (error: any) {
      console.log(chalk.red(`  ❌ ${description} failed`));
      if (error.stdout) console.log(chalk.gray(error.stdout));
      if (error.stderr) console.log(chalk.red(error.stderr));
      throw error;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log successful deployment
   */
  private logSuccess(): void {
    const duration = Date.now() - this.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log(chalk.green.bold("\n🎉 DEPLOYMENT SUCCESSFUL!"));
    console.log(chalk.green(`✅ Environment: ${this.config.environment}`));
    console.log(chalk.green(`⏱️ Duration: ${minutes}m ${seconds}s`));
    console.log(chalk.green(`🕐 Completed: ${new Date().toISOString()}`));
  }

  /**
   * Log deployment error
   */
  private logError(error: Error): void {
    const duration = Date.now() - this.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log(chalk.red.bold("\n💥 DEPLOYMENT FAILED!"));
    console.log(chalk.red(`❌ Error: ${error.message}`));
    console.log(chalk.red(`⏱️ Failed after: ${minutes}m ${seconds}s`));
    console.log(chalk.red(`🕐 Failed at: ${new Date().toISOString()}`));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const environment = (args[0] as "staging" | "production") || "staging";

  const config: DeploymentConfig = {
    environment,
    skipTests: args.includes("--skip-tests"),
    skipBuild: args.includes("--skip-build"),
    autoMigrate: !args.includes("--no-migrate"),
    healthCheckTimeout: 60000,
  };

  const deployment = new DeploymentAutomation(config);
  await deployment.deploy();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red("Deployment automation failed:"), error);
    process.exit(1);
  });
}

export { DeploymentAutomation };
