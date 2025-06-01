#!/usr/bin/env tsx

/**
 * STAB-402: Continuous Validation Suite Daemon
 * 
 * Daemon process that executes health, schema, and performance checks every 30 minutes.
 * Uses node-cron for scheduling and runs the continuous validation suite.
 * 
 * Features:
 * - Scheduled execution every 30 minutes
 * - Graceful shutdown handling
 * - Process monitoring and restart capability
 * - Logging and error handling
 * - Health check endpoint for monitoring
 */

import * as cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { createServer } from 'http';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  cronSchedule: '*/30 * * * *', // Every 30 minutes
  healthCheckPort: 8082,
  validationScript: 'validation/continuous-checks.ts',
  outputFile: 'validation/latest.json',
  logFile: 'validation/daemon.log',
  maxLogSize: 10 * 1024 * 1024, // 10MB
  timezone: 'UTC'
};

interface DaemonStatus {
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  runCount: number;
  errorCount: number;
  uptime: number;
  startTime: string;
}

class ValidationDaemon {
  private task: cron.ScheduledTask | null = null;
  private status: DaemonStatus;
  private startTime: number;
  private healthServer: any = null;

  constructor() {
    this.startTime = Date.now();
    this.status = {
      isRunning: false,
      lastRun: null,
      nextRun: null,
      runCount: 0,
      errorCount: 0,
      uptime: 0,
      startTime: new Date().toISOString()
    };
  }

  async start(): Promise<void> {
    console.log('🚀 Starting STAB-402 Continuous Validation Daemon...');
    
    try {
      // Ensure validation directory exists
      await this.ensureDirectories();
      
      // Start health check server
      await this.startHealthServer();
      
      // Schedule the validation task
      this.scheduleValidation();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      this.status.isRunning = true;
      console.log(`✅ Validation daemon started successfully`);
      console.log(`📅 Schedule: ${CONFIG.cronSchedule} (every 30 minutes)`);
      console.log(`🏥 Health check: http://localhost:${CONFIG.healthCheckPort}/health`);
      console.log(`📊 Status: http://localhost:${CONFIG.healthCheckPort}/status`);
      
      // Run initial validation
      console.log('🔍 Running initial validation check...');
      await this.runValidation();
      
    } catch (error) {
      console.error('❌ Failed to start validation daemon:', error);
      process.exit(1);
    }
  }

  private async ensureDirectories(): Promise<void> {
    const validationDir = path.dirname(CONFIG.outputFile);
    try {
      await fs.mkdir(validationDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  private scheduleValidation(): void {
    this.task = cron.schedule(CONFIG.cronSchedule, async () => {
      await this.runValidation();
    }, {
      scheduled: true,
      timezone: CONFIG.timezone
    });

    // Update next run time
    this.updateNextRunTime();
    
    console.log(`⏰ Validation scheduled: ${CONFIG.cronSchedule}`);
  }

  private async runValidation(): Promise<void> {
    const runStart = Date.now();
    console.log(`🔍 Starting validation run #${this.status.runCount + 1} at ${new Date().toISOString()}`);
    
    try {
      // Execute the continuous validation script
      const { stdout, stderr } = await execAsync(`npx tsx ${CONFIG.validationScript}`, {
        timeout: 300000, // 5 minutes timeout
        cwd: process.cwd()
      });
      
      const duration = Date.now() - runStart;
      this.status.runCount++;
      this.status.lastRun = new Date().toISOString();
      this.updateNextRunTime();
      
      // Log the results
      await this.logValidationRun(true, duration, stdout, stderr);
      
      console.log(`✅ Validation run #${this.status.runCount} completed in ${duration}ms`);
      
      // Check if validation file was created and has minimum size
      await this.validateOutput();
      
    } catch (error) {
      const duration = Date.now() - runStart;
      this.status.errorCount++;
      this.status.lastRun = new Date().toISOString();
      this.updateNextRunTime();
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logValidationRun(false, duration, '', errorMessage);
      
      console.error(`❌ Validation run #${this.status.runCount + 1} failed after ${duration}ms:`, errorMessage);
    }
  }

  private async validateOutput(): Promise<void> {
    try {
      const stats = await fs.stat(CONFIG.outputFile);
      const fileSizeKB = Math.round(stats.size / 1024);
      
      if (stats.size >= 1024) { // At least 1KB as per acceptance criteria
        console.log(`📊 Validation output: ${CONFIG.outputFile} (${fileSizeKB} KB)`);
      } else {
        throw new Error(`Validation output file too small: ${fileSizeKB} KB (expected ≥1 KB)`);
      }
    } catch (error) {
      console.error(`❌ Validation output check failed:`, error);
      throw error;
    }
  }

  private updateNextRunTime(): void {
    if (this.task) {
      // Calculate next run time based on cron schedule
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
      if (nextRun <= now) {
        nextRun.setMinutes(nextRun.getMinutes() + 30);
      }
      this.status.nextRun = nextRun.toISOString();
    }
  }

  private async logValidationRun(success: boolean, duration: number, stdout: string, stderr: string): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      success,
      duration,
      runNumber: success ? this.status.runCount : this.status.runCount + 1,
      stdout: stdout.substring(0, 1000), // Truncate long output
      stderr: stderr.substring(0, 1000)
    };

    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(CONFIG.logFile, logLine);
      
      // Rotate log if it gets too large
      await this.rotateLogIfNeeded();
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async rotateLogIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(CONFIG.logFile);
      if (stats.size > CONFIG.maxLogSize) {
        const backupFile = `${CONFIG.logFile}.${Date.now()}`;
        await fs.rename(CONFIG.logFile, backupFile);
        console.log(`📋 Log rotated: ${backupFile}`);
      }
    } catch (error) {
      // Log file might not exist yet, ignore error
    }
  }

  private async startHealthServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.healthServer = createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        
        if (req.url === '/health') {
          res.writeHead(200);
          res.end(JSON.stringify({
            status: 'healthy',
            service: 'validation-daemon',
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime
          }));
        } else if (req.url === '/status') {
          this.status.uptime = Date.now() - this.startTime;
          res.writeHead(200);
          res.end(JSON.stringify(this.status, null, 2));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });

      this.healthServer.listen(CONFIG.healthCheckPort, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      if (this.task) {
        this.task.stop();
        console.log('⏰ Stopped scheduled validation task');
      }
      
      if (this.healthServer) {
        this.healthServer.close();
        console.log('🏥 Stopped health check server');
      }
      
      this.status.isRunning = false;
      console.log('✅ Validation daemon stopped');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }

  async stop(): Promise<void> {
    if (this.task) {
      this.task.stop();
    }
    if (this.healthServer) {
      this.healthServer.close();
    }
    this.status.isRunning = false;
  }
}

// Main execution
async function main() {
  const daemon = new ValidationDaemon();
  await daemon.start();
  
  // Keep the process alive
  process.stdin.resume();
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the daemon if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start validation daemon:', error);
    process.exit(1);
  });
}

export { ValidationDaemon };
