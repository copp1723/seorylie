import { performance } from "perf_hooks";
import db from "../../server/db";
import logger from "../../server/utils/logger";
import fs from "fs";
import path from "path";

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount?: number;
  error?: string;
}

interface PerformanceReport {
  testStartTime: Date;
  testEndTime: Date;
  totalQueries: number;
  averageQueryTime: number;
  slowestQueries: QueryMetrics[];
  fastestQueries: QueryMetrics[];
  errorQueries: QueryMetrics[];
  queryTypeBreakdown: Record<
    string,
    {
      count: number;
      avgDuration: number;
      maxDuration: number;
      minDuration: number;
    }
  >;
  memoryUsage: NodeJS.MemoryUsage[];
  recommendations: string[];
}

class DatabasePerformanceMonitor {
  private metrics: QueryMetrics[] = [];
  private memorySnapshots: NodeJS.MemoryUsage[] = [];
  private startTime: Date;
  private isMonitoring: boolean = false;
  private memoryInterval?: NodeJS.Timeout;

  constructor() {
    this.startTime = new Date();
  }

  startMonitoring(): void {
    this.isMonitoring = true;
    this.startTime = new Date();
    this.metrics = [];
    this.memorySnapshots = [];

    console.log("🔍 Starting database performance monitoring...");

    // Monitor memory usage every 5 seconds
    this.memoryInterval = setInterval(() => {
      this.memorySnapshots.push(process.memoryUsage());
    }, 5000);

    // Enable PostgreSQL slow query logging if possible
    this.enableSlowQueryLogging();
  }

  stopMonitoring(): PerformanceReport {
    this.isMonitoring = false;

    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }

    console.log("⏹️ Stopping database performance monitoring...");

    return this.generateReport();
  }

  private async enableSlowQueryLogging(): Promise<void> {
    try {
      // Enable slow query logging (queries > 100ms)
      await db.execute(`SET log_min_duration_statement = 100`);
      await db.execute(`SET log_statement = 'all'`);
      console.log("✅ Enabled PostgreSQL slow query logging");
    } catch (error) {
      console.warn("⚠️ Could not enable slow query logging:", error);
    }
  }

  async executeQuery<T>(
    queryFn: () => Promise<T>,
    queryDescription: string,
  ): Promise<T> {
    const startTime = performance.now();
    let result: T;
    let error: string | undefined;
    let rowCount: number | undefined;

    try {
      result = await queryFn();

      // Try to get row count if result is an array
      if (Array.isArray(result)) {
        rowCount = result.length;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = performance.now() - startTime;

      if (this.isMonitoring) {
        this.metrics.push({
          query: queryDescription,
          duration,
          timestamp: new Date(),
          rowCount,
          error,
        });
      }
    }

    return result!;
  }

  private generateReport(): PerformanceReport {
    const endTime = new Date();
    const totalQueries = this.metrics.length;
    const validMetrics = this.metrics.filter((m) => !m.error);

    const averageQueryTime =
      validMetrics.length > 0
        ? validMetrics.reduce((sum, m) => sum + m.duration, 0) /
          validMetrics.length
        : 0;

    // Sort queries by duration
    const sortedByDuration = [...validMetrics].sort(
      (a, b) => b.duration - a.duration,
    );

    const slowestQueries = sortedByDuration.slice(0, 10);
    const fastestQueries = sortedByDuration.slice(-10).reverse();
    const errorQueries = this.metrics.filter((m) => m.error);

    // Analyze query types
    const queryTypeBreakdown = this.analyzeQueryTypes();

    // Generate recommendations
    const recommendations = this.generateRecommendations(validMetrics);

    const report: PerformanceReport = {
      testStartTime: this.startTime,
      testEndTime: endTime,
      totalQueries,
      averageQueryTime,
      slowestQueries,
      fastestQueries,
      errorQueries,
      queryTypeBreakdown,
      memoryUsage: this.memorySnapshots,
      recommendations,
    };

    this.saveReport(report);
    this.printSummary(report);

    return report;
  }

  private analyzeQueryTypes(): Record<string, any> {
    const breakdown: Record<
      string,
      {
        count: number;
        durations: number[];
      }
    > = {};

    this.metrics.forEach((metric) => {
      if (metric.error) return;

      const queryType = this.getQueryType(metric.query);

      if (!breakdown[queryType]) {
        breakdown[queryType] = {
          count: 0,
          durations: [],
        };
      }

      breakdown[queryType].count++;
      breakdown[queryType].durations.push(metric.duration);
    });

    // Calculate statistics for each query type
    const result: Record<string, any> = {};

    Object.entries(breakdown).forEach(([type, data]) => {
      const durations = data.durations;
      result[type] = {
        count: data.count,
        avgDuration:
          durations.reduce((sum, d) => sum + d, 0) / durations.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
      };
    });

    return result;
  }

  private getQueryType(query: string): string {
    const lowerQuery = query.toLowerCase().trim();

    if (lowerQuery.includes("select")) return "SELECT";
    if (lowerQuery.includes("insert")) return "INSERT";
    if (lowerQuery.includes("update")) return "UPDATE";
    if (lowerQuery.includes("delete")) return "DELETE";
    if (lowerQuery.includes("join")) return "JOIN";
    if (lowerQuery.includes("conversation")) return "CONVERSATION_QUERY";
    if (lowerQuery.includes("vehicle") || lowerQuery.includes("inventory"))
      return "INVENTORY_QUERY";
    if (lowerQuery.includes("dealership")) return "DEALERSHIP_QUERY";

    return "OTHER";
  }

  private generateRecommendations(metrics: QueryMetrics[]): string[] {
    const recommendations: string[] = [];

    // Check for slow queries
    const slowQueries = metrics.filter((m) => m.duration > 1000); // > 1 second
    if (slowQueries.length > 0) {
      recommendations.push(
        `Found ${slowQueries.length} queries taking over 1 second. Consider adding indexes or optimizing these queries.`,
      );
    }

    // Check average query time
    const avgTime =
      metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    if (avgTime > 500) {
      recommendations.push(
        `Average query time is ${avgTime.toFixed(2)}ms. Consider database optimization.`,
      );
    }

    // Check for repeated slow queries
    const queryFrequency: Record<string, number> = {};
    metrics.forEach((m) => {
      if (m.duration > 500) {
        queryFrequency[m.query] = (queryFrequency[m.query] || 0) + 1;
      }
    });

    Object.entries(queryFrequency).forEach(([query, count]) => {
      if (count > 5) {
        recommendations.push(
          `Query "${query}" executed ${count} times with high latency. Consider caching or optimization.`,
        );
      }
    });

    // Memory usage recommendations
    const maxMemory = Math.max(...this.memorySnapshots.map((m) => m.heapUsed));
    const maxMemoryMB = maxMemory / 1024 / 1024;

    if (maxMemoryMB > 500) {
      recommendations.push(
        `Peak memory usage was ${maxMemoryMB.toFixed(2)}MB. Monitor for memory leaks.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Database performance looks good! No major issues detected.",
      );
    }

    return recommendations;
  }

  private saveReport(report: PerformanceReport): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `db-performance-report-${timestamp}.json`;
    const filepath = path.join(__dirname, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`📊 Performance report saved to: ${filepath}`);
    } catch (error) {
      console.error("Failed to save performance report:", error);
    }
  }

  private printSummary(report: PerformanceReport): void {
    console.log("\n📊 DATABASE PERFORMANCE SUMMARY");
    console.log("================================");
    console.log(
      `Test Duration: ${((report.testEndTime.getTime() - report.testStartTime.getTime()) / 1000).toFixed(2)}s`,
    );
    console.log(`Total Queries: ${report.totalQueries}`);
    console.log(`Average Query Time: ${report.averageQueryTime.toFixed(2)}ms`);
    console.log(`Error Queries: ${report.errorQueries.length}`);

    console.log("\n🐌 SLOWEST QUERIES:");
    report.slowestQueries.slice(0, 5).forEach((query, index) => {
      console.log(
        `${index + 1}. ${query.query} - ${query.duration.toFixed(2)}ms`,
      );
    });

    console.log("\n⚡ FASTEST QUERIES:");
    report.fastestQueries.slice(0, 3).forEach((query, index) => {
      console.log(
        `${index + 1}. ${query.query} - ${query.duration.toFixed(2)}ms`,
      );
    });

    console.log("\n📈 QUERY TYPE BREAKDOWN:");
    Object.entries(report.queryTypeBreakdown).forEach(([type, stats]) => {
      console.log(
        `${type}: ${stats.count} queries, avg ${stats.avgDuration.toFixed(2)}ms`,
      );
    });

    console.log("\n💡 RECOMMENDATIONS:");
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    console.log("\n================================\n");
  }
}

export default DatabasePerformanceMonitor;
