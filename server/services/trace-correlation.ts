import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  startTime: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes?: Record<string, string | number | boolean>;
  status: "active" | "completed" | "error";
}

class TraceCorrelationService {
  private enabled: boolean;
  private serviceName: string;
  private tempoUrl?: string;
  private activeSpans: Map<string, TraceSpan> = new Map();
  private traceStats = {
    totalTraces: 0,
    activeTraces: 0,
    completedTraces: 0,
    errorTraces: 0,
  };

  constructor() {
    this.enabled = process.env.ENABLE_TRACE_CORRELATION === "true";
    this.serviceName = process.env.TRACE_SERVICE_NAME || "cleanrylie-app";
    this.tempoUrl = process.env.GRAFANA_TEMPO_URL;

    if (this.enabled) {
      logger.info("Trace correlation service initialized", {
        serviceName: this.serviceName,
        tempoConfigured: !!this.tempoUrl,
      });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  generateTraceId(): string {
    return uuidv4().replace(/-/g, "");
  }

  generateSpanId(): string {
    return uuidv4().replace(/-/g, "").substring(0, 16);
  }

  createTraceContext(
    options: {
      name?: string;
      parentTraceId?: string;
      parentSpanId?: string;
      attributes?: Record<string, string | number | boolean>;
      serviceName?: string;
    } = {},
  ): TraceContext {
    if (!this.enabled) {
      throw new Error("Trace correlation is not enabled");
    }

    const traceId = options.parentTraceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const serviceName = options.serviceName || this.serviceName;

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      serviceName,
      startTime: Date.now(),
      attributes: options.attributes,
    };

    // Create and track the span
    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId: options.parentSpanId,
      name: options.name || "unknown",
      startTime: Date.now(),
      attributes: options.attributes,
      status: "active",
    };

    this.activeSpans.set(spanId, span);
    this.traceStats.totalTraces++;
    this.traceStats.activeTraces++;

    return context;
  }

  createSpan(options: {
    name: string;
    parentTraceId: string;
    parentSpanId?: string;
    attributes?: Record<string, string | number | boolean>;
  }): TraceSpan {
    if (!this.enabled) {
      throw new Error("Trace correlation is not enabled");
    }

    const spanId = this.generateSpanId();
    const span: TraceSpan = {
      spanId,
      traceId: options.parentTraceId,
      parentSpanId: options.parentSpanId,
      name: options.name,
      startTime: Date.now(),
      attributes: options.attributes,
      status: "active",
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  completeSpan(spanId: string, error?: Error): void {
    if (!this.enabled) return;

    const span = this.activeSpans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.status = error ? "error" : "completed";

      if (error) {
        span.attributes = {
          ...span.attributes,
          "error.message": error.message,
          "error.name": error.name,
        };
        this.traceStats.errorTraces++;
      } else {
        this.traceStats.completedTraces++;
      }

      this.traceStats.activeTraces--;
      this.activeSpans.delete(spanId);
    }
  }

  getTempoUrl(traceId: string): string | null {
    if (!this.tempoUrl || !this.enabled) {
      return null;
    }

    return `${this.tempoUrl}/trace/${traceId}`;
  }

  getTraceInfo(traceId: string): any {
    if (!this.enabled) return null;

    // In a real implementation, this would fetch from a trace storage system
    // For now, return basic info
    return {
      traceId,
      serviceName: this.serviceName,
      tempoUrl: this.getTempoUrl(traceId),
      timestamp: new Date().toISOString(),
    };
  }

  getStats() {
    return {
      ...this.traceStats,
      enabled: this.enabled,
      serviceName: this.serviceName,
      activeSpansCount: this.activeSpans.size,
    };
  }

  // Middleware to add trace context to requests
  middleware() {
    return (req: any, res: any, next: any) => {
      if (!this.enabled) {
        return next();
      }

      try {
        // Check for existing trace ID in headers
        const existingTraceId =
          req.headers["x-trace-id"] || req.headers["traceparent"];

        // Create trace context
        const traceContext = this.createTraceContext({
          name: `${req.method} ${req.path}`,
          parentTraceId: existingTraceId,
          attributes: {
            "http.method": req.method,
            "http.url": req.url,
            "http.user_agent": req.headers["user-agent"] || "unknown",
          },
        });

        // Attach to request
        req.traceContext = traceContext;

        // Add trace ID to response headers
        res.setHeader("x-trace-id", traceContext.traceId);

        // Complete span when response finishes
        res.on("finish", () => {
          this.completeSpan(traceContext.spanId);
        });

        next();
      } catch (error) {
        logger.error("Error in trace correlation middleware", error);
        next();
      }
    };
  }
}

// Create singleton instance
export const traceCorrelation = new TraceCorrelationService();
export default traceCorrelation;
