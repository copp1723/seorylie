#!/usr/bin/env tsx
/**
 * Daily Maintenance Script for CleanRylie Platform
 *
 * Performs automated daily maintenance tasks:
 * - Database cleanup and optimization
 * - Log rotation and cleanup
 * - Cache optimization
 * - Health checks and monitoring
 * - Performance metrics collection
 *
 * Designed to run as a scheduled job in production environments.
 */

import { execSync } from "child_process";
import { existsSync, statSync, unlinkSync, readdirSync } from "fs";
import path from "path";
import logger from "../../server/utils/logger.js";
import db from "../../server/db.js";
import { sql } from "drizzle-orm";

interface MaintenanceResult {
  task: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: any;
}

class DailyMaintenanceRunner {
  private results: MaintenanceResult[] = [];
  private startTime = new Date();

  constructor() {
    logger.info("🔧 Starting daily maintenance routine", {
      timestamp: this.startTime.toISOString(),
      environment: process.env.NODE_ENV,
    });
  }

  private addResult(result: MaintenanceResult) {
    this.results.push(result);
    const emoji =
      result.status === "success"
        ? "✅"
        : result.status === "warning"
          ? "⚠️"
          : "❌";
    logger.info(`${emoji} ${result.task}: ${result.message}`, result.details);
  }

  /**
   * Clean up old log files (keep last 30 days)
   */
  private async cleanupLogs(): Promise<void> {
    try {
      const logDir = "./logs";
      if (!existsSync(logDir)) {
        this.addResult({
          task: "Log Cleanup",
          status: "warning",
          message: "Log directory not found, skipping cleanup",
        });
        return;
      }

      const files = readdirSync(logDir);
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(logDir, file);
        const stats = statSync(filePath);

        if (stats.mtime.getTime() < thirtyDaysAgo) {
          unlinkSync(filePath);
          deletedCount++;
        }
      }

      this.addResult({
        task: "Log Cleanup",
        status: "success",
        message: `Cleaned up ${deletedCount} old log files`,
        details: { deletedFiles: deletedCount, totalFiles: files.length },
      });
    } catch (error) {
      this.addResult({
        task: "Log Cleanup",
        status: "error",
        message: "Failed to cleanup logs",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Optimize database tables and clean up old data
   */
  private async optimizeDatabase(): Promise<void> {
    try {
      // Clean up old conversation logs (keep last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const cleanupResult = await db.execute(
        sql`DELETE FROM conversation_logs WHERE created_at < ${ninetyDaysAgo}`,
      );

      // Vacuum and analyze tables (PostgreSQL)
      await db.execute(sql`VACUUM ANALYZE`);

      this.addResult({
        task: "Database Optimization",
        status: "success",
        message: "Database optimized successfully",
        details: {
          oldLogsDeleted: cleanupResult.rowCount,
          optimizedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.addResult({
        task: "Database Optimization",
        status: "error",
        message: "Database optimization failed",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Check system health and resources
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      // Check database connection
      await db.execute(sql`SELECT 1`);

      // Check disk space (if on Unix-like system)
      let diskUsage = "N/A";
      try {
        const df = execSync("df -h /", { encoding: "utf8" });
        diskUsage = df.split("\n")[1]?.split(/\s+/)[4] || "N/A";
      } catch (e) {
        // Ignore disk check errors on non-Unix systems
      }

      // Check memory usage
      const memUsage = process.memoryUsage();

      this.addResult({
        task: "System Health Check",
        status: "success",
        message: "System health check completed",
        details: {
          database: "connected",
          diskUsage,
          memoryUsage: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          },
        },
      });
    } catch (error) {
      this.addResult({
        task: "System Health Check",
        status: "error",
        message: "System health check failed",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Clean up temporary files and cache
   */
  private async cleanupTempFiles(): Promise<void> {
    try {
      const tempDirs = ["./tmp", "./temp", "./uploads/temp"];
      let cleanedCount = 0;

      for (const dir of tempDirs) {
        if (existsSync(dir)) {
          const files = readdirSync(dir);
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

          for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = statSync(filePath);

            if (stats.mtime.getTime() < oneDayAgo) {
              unlinkSync(filePath);
              cleanedCount++;
            }
          }
        }
      }

      this.addResult({
        task: "Temporary File Cleanup",
        status: "success",
        message: `Cleaned up ${cleanedCount} temporary files`,
        details: { cleanedFiles: cleanedCount },
      });
    } catch (error) {
      this.addResult({
        task: "Temporary File Cleanup",
        status: "error",
        message: "Failed to cleanup temporary files",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Generate maintenance report
   */
  private generateReport(): void {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    const summary = {
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: `${Math.round(duration / 1000)}s`,
      totalTasks: this.results.length,
      successful: this.results.filter((r) => r.status === "success").length,
      warnings: this.results.filter((r) => r.status === "warning").length,
      errors: this.results.filter((r) => r.status === "error").length,
    };

    logger.info("🏁 Daily maintenance completed", {
      summary,
      results: this.results,
    });

    // Exit with error code if any critical tasks failed
    if (summary.errors > 0) {
      process.exit(1);
    }
  }

  /**
   * Run all maintenance tasks
   */
  public async run(): Promise<void> {
    try {
      await this.cleanupLogs();
      await this.optimizeDatabase();
      await this.checkSystemHealth();
      await this.cleanupTempFiles();

      this.generateReport();
    } catch (error) {
      logger.error("❌ Daily maintenance failed with critical error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  }
}

// Run maintenance if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const maintenance = new DailyMaintenanceRunner();
  maintenance.run().catch((error) => {
    logger.error("Fatal error in daily maintenance", error);
    process.exit(1);
  });
}

export default DailyMaintenanceRunner;
