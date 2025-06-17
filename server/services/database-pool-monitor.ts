import { client } from "../db";
import logger from "../utils/logger";
import { monitoringService } from "./monitoring";
import EventEmitter from "events";

interface PoolMetrics {
  active: number;
  idle: number;
  waiting: number;
  total: number;
  maxConnections: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
  avgQueryTime: number;
  slowQueries: number;
}

interface QueryMetrics {
  startTime: number;
  duration?: number;
  query?: string;
  error?: Error;
}

class DatabasePoolMonitor extends EventEmitter {
  private metrics: PoolMetrics = {
    active: 0,
    idle: 0,
    waiting: 0,
    total: 0,
    maxConnections: parseInt(process.env.DB_POOL_MAX || "20"),
    errors: 0,
    avgQueryTime: 0,
    slowQueries: 0,
  };

  private queryMetrics: QueryMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private slowQueryThreshold = 1000; // 1 second
  private maxQueryMetricsSize = 1000;

  constructor() {
    super();
    this.setupMetrics();
  }

  /**
   * Start monitoring the database pool
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Monitor pool status every 10 seconds
    this.monitoringInterval = setInterval(() => {
      this.updatePoolMetrics();
    }, 10000);

    // Perform health checks every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Hook into postgres client for query monitoring
    this.hookIntoClient();

    logger.info("Database pool monitoring started");
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info("Database pool monitoring stopped");
  }

  /**
   * Setup Prometheus metrics
   */
  private setupMetrics(): void {
    // Connection pool metrics
    monitoringService.registerGauge(
      "db_pool_connections_active",
      "Number of active database connections",
      []
    );

    monitoringService.registerGauge(
      "db_pool_connections_idle",
      "Number of idle database connections",
      []
    );

    monitoringService.registerGauge(
      "db_pool_connections_waiting",
      "Number of waiting database connections",
      []
    );

    monitoringService.registerGauge(
      "db_pool_connections_total",
      "Total number of database connections",
      []
    );

    // Query performance metrics
    monitoringService.registerHistogram(
      "db_query_duration_seconds",
      "Database query duration in seconds",
      ["query_type"],
      [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10]
    );

    monitoringService.registerCounter(
      "db_pool_errors_total",
      "Total number of database pool errors",
      ["error_type"]
    );

    monitoringService.registerCounter(
      "db_slow_queries_total",
      "Total number of slow queries",
      []
    );
  }

  /**
   * Hook into the postgres client to monitor queries
   */
  private hookIntoClient(): void {
    // Note: postgres.js doesn't expose direct pool stats, so we estimate based on query patterns
    // In production, consider using pg-pool or similar for better visibility
    
    // Track query execution through a proxy or middleware pattern
    logger.debug("Database query monitoring initialized");
  }

  /**
   * Update pool metrics
   */
  private async updatePoolMetrics(): Promise<void> {
    try {
      // Try to get connection stats from database
      const stats = await this.getConnectionStats();
      
      if (stats) {
        this.metrics.active = stats.active;
        this.metrics.idle = stats.idle;
        this.metrics.total = stats.total;
        
        // Update Prometheus metrics
        monitoringService.setGauge("db_pool_connections_active", stats.active, []);
        monitoringService.setGauge("db_pool_connections_idle", stats.idle, []);
        monitoringService.setGauge("db_pool_connections_total", stats.total, []);
      }

      // Calculate average query time
      if (this.queryMetrics.length > 0) {
        const totalTime = this.queryMetrics
          .filter(m => m.duration)
          .reduce((sum, m) => sum + (m.duration || 0), 0);
        this.metrics.avgQueryTime = totalTime / this.queryMetrics.length;
      }

      // Check for pool exhaustion
      if (this.metrics.active >= this.metrics.maxConnections * 0.8) {
        this.emit("poolWarning", {
          message: "Database pool is nearing capacity",
          usage: (this.metrics.active / this.metrics.maxConnections) * 100,
        });
      }

      // Clean up old query metrics
      if (this.queryMetrics.length > this.maxQueryMetricsSize) {
        this.queryMetrics = this.queryMetrics.slice(-this.maxQueryMetricsSize / 2);
      }

    } catch (error) {
      logger.error("Error updating pool metrics", { error });
      this.metrics.errors++;
      monitoringService.incrementCounter("db_pool_errors_total", 1, ["metrics_update"]);
    }
  }

  /**
   * Get connection statistics from database
   */
  private async getConnectionStats(): Promise<{ active: number; idle: number; total: number } | null> {
    try {
      // Skip if client is not available
      if (!client) {
        return null;
      }

      // Query pg_stat_activity for connection info
      const result = await client`
        SELECT 
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle,
          COUNT(*) as total
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      return result[0] as { active: number; idle: number; total: number };
    } catch (error) {
      logger.debug("Could not query pg_stat_activity", { error });
      return null;
    }
  }

  /**
   * Perform health check on the connection pool
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // Skip health check if client is not available
      if (!client) {
        logger.debug("Database client not available, skipping health check");
        return;
      }

      // Simple query to test pool health
      await client`SELECT 1 as health_check`;
      
      const duration = Date.now() - startTime;
      
      // Record the health check as a query metric
      monitoringService.observeHistogram(
        "db_query_duration_seconds",
        duration / 1000,
        ["health_check"]
      );

      // Check if pool is responsive
      if (duration > 5000) {
        this.emit("poolUnhealthy", {
          message: "Database pool is slow to respond",
          responseTime: duration,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.metrics.errors++;
      this.metrics.lastError = errorMessage;
      this.metrics.lastErrorTime = Date.now();
      
      monitoringService.incrementCounter("db_pool_errors_total", 1, ["health_check"]);
      
      logger.error("Database pool health check failed", {
        error: errorMessage,
        duration: Date.now() - startTime,
      });

      // Emit unhealthy event
      this.emit("poolUnhealthy", {
        message: "Database pool health check failed",
        error: errorMessage,
      });

      // If multiple failures, suggest recovery
      if (this.metrics.errors > 3) {
        this.emit("poolCritical", {
          message: "Multiple database pool failures detected",
          errors: this.metrics.errors,
          lastError: errorMessage,
        });
      }
    }
  }

  /**
   * Record a query execution
   */
  recordQuery(query: string, duration: number, error?: Error): void {
    const metric: QueryMetrics = {
      startTime: Date.now() - duration,
      duration,
      query: query.substring(0, 100), // Truncate for storage
      error,
    };

    this.queryMetrics.push(metric);

    // Track slow queries
    if (duration > this.slowQueryThreshold) {
      this.metrics.slowQueries++;
      monitoringService.incrementCounter("db_slow_queries_total", 1, []);
      
      logger.warn("Slow query detected", {
        query: query.substring(0, 200),
        duration: `${duration}ms`,
      });
    }

    // Record in histogram
    const queryType = this.extractQueryType(query);
    monitoringService.observeHistogram(
      "db_query_duration_seconds",
      duration / 1000,
      [queryType]
    );

    if (error) {
      this.metrics.errors++;
      monitoringService.incrementCounter("db_pool_errors_total", 1, ["query_error"]);
    }
  }

  /**
   * Extract query type for metrics
   */
  private extractQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();
    
    if (normalizedQuery.startsWith("SELECT")) return "select";
    if (normalizedQuery.startsWith("INSERT")) return "insert";
    if (normalizedQuery.startsWith("UPDATE")) return "update";
    if (normalizedQuery.startsWith("DELETE")) return "delete";
    if (normalizedQuery.startsWith("CREATE")) return "ddl";
    if (normalizedQuery.startsWith("ALTER")) return "ddl";
    if (normalizedQuery.startsWith("DROP")) return "ddl";
    
    return "other";
  }

  /**
   * Get current metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Attempt to recover from pool issues
   */
  async attemptRecovery(): Promise<boolean> {
    logger.info("Attempting database pool recovery");

    try {
      // Force close idle connections by running a vacuum
      await client`SELECT pg_terminate_backend(pid) 
                   FROM pg_stat_activity 
                   WHERE state = 'idle' 
                   AND state_change < current_timestamp - INTERVAL '5 minutes'`;

      // Reset error count after successful recovery
      this.metrics.errors = 0;
      
      logger.info("Database pool recovery successful");
      return true;
    } catch (error) {
      logger.error("Database pool recovery failed", { error });
      return false;
    }
  }
}

// Export singleton instance
export const databasePoolMonitor = new DatabasePoolMonitor();