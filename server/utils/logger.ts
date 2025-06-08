import winston from "winston";
import path from "path";
import { sanitizeObjectForLogging } from "./phone-masking";
import type { TraceContext } from "../services/trace-correlation";

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), "logs");

// Configure winston logger with custom format
const winstonLogger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "auth-service" },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) =>
            `${timestamp} ${level}: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
            }`,
        ),
      ),
    }),
  ],
});

// In production, add file-based logging
if (process.env.NODE_ENV === "production") {
  winstonLogger.add(
    new winston.transports.File({
      filename: path.join(logsDir, "application.log"),
      level: "info",
    }),
  );

  winstonLogger.add(
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
    }),
  );
}

// Helper function to add trace context to log metadata
function addTraceContext(
  context: unknown,
  traceContext?: TraceContext,
): unknown {
  if (!traceContext) return context;

  const traceInfo = {
    traceId: traceContext.traceId,
    spanId: traceContext.spanId,
    ...(traceContext.parentSpanId && {
      parentSpanId: traceContext.parentSpanId,
    }),
  };

  if (!context) return traceInfo;

  if (typeof context === "object" && context !== null) {
    return { ...context, trace: traceInfo };
  }

  return { data: context, trace: traceInfo };
}

// Helper functions to log with context and automatic phone number masking
const loggerInstance = {
  info: (message: string, context?: unknown, traceContext?: TraceContext) => {
    const contextWithTrace = addTraceContext(context, traceContext);
    winstonLogger.info(
      message,
      contextWithTrace
        ? sanitizeObjectForLogging(contextWithTrace)
        : contextWithTrace,
    );
  },

  warn: (message: string, context?: unknown, traceContext?: TraceContext) => {
    const contextWithTrace = addTraceContext(context, traceContext);
    winstonLogger.warn(
      message,
      contextWithTrace
        ? sanitizeObjectForLogging(contextWithTrace)
        : contextWithTrace,
    );
  },

  error: (
    message: string,
    error?: unknown,
    context?: unknown,
    traceContext?: TraceContext,
  ) => {
    if (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const contextWithTrace = addTraceContext(context, traceContext);
      const sanitizedContext = contextWithTrace
        ? sanitizeObjectForLogging(contextWithTrace)
        : {};
      winstonLogger.error(`${message}: ${err.message}`, {
        ...(typeof sanitizedContext === "object" && sanitizedContext !== null
          ? sanitizedContext
          : {}),
        stack: err.stack,
      });
    } else {
      const contextWithTrace = addTraceContext(context, traceContext);
      winstonLogger.error(
        message,
        contextWithTrace
          ? sanitizeObjectForLogging(contextWithTrace)
          : contextWithTrace,
      );
    }
  },

  debug: (message: string, context?: unknown, traceContext?: TraceContext) => {
    const contextWithTrace = addTraceContext(context, traceContext);
    winstonLogger.debug(
      message,
      contextWithTrace
        ? sanitizeObjectForLogging(contextWithTrace)
        : contextWithTrace,
    );
  },

  // Additional methods for specific use cases
  sms: (message: string, context?: unknown, traceContext?: TraceContext) => {
    // Special logging for SMS operations with enhanced masking
    const contextWithTrace = addTraceContext(context, traceContext);
    const sanitizedContext = contextWithTrace
      ? sanitizeObjectForLogging(contextWithTrace, {
          visibleDigits: 0, // Don't show any digits for SMS logs
          maskCharacter: "*",
        })
      : contextWithTrace;

    winstonLogger.info(`[SMS] ${message}`, sanitizedContext);
  },

  security: (
    message: string,
    context?: unknown,
    traceContext?: TraceContext,
  ) => {
    // Security-related logging with maximum sanitization
    const contextWithTrace = addTraceContext(context, traceContext);
    const sanitizedContext = contextWithTrace
      ? sanitizeObjectForLogging(contextWithTrace, {
          visibleDigits: 0,
          maskCharacter: "X",
        })
      : contextWithTrace;

    winstonLogger.warn(`[SECURITY] ${message}`, sanitizedContext);
  },

  // Helper method to create a logger with bound trace context
  withTraceContext: (traceContext: TraceContext) => ({
    info: (message: string, context?: unknown) => {
      const contextWithTrace = addTraceContext(context, traceContext);
      winstonLogger.info(
        message,
        contextWithTrace
          ? sanitizeObjectForLogging(contextWithTrace)
          : contextWithTrace,
      );
    },
    warn: (message: string, context?: unknown) => {
      const contextWithTrace = addTraceContext(context, traceContext);
      winstonLogger.warn(
        message,
        contextWithTrace
          ? sanitizeObjectForLogging(contextWithTrace)
          : contextWithTrace,
      );
    },
    error: (message: string, error?: unknown, context?: unknown) => {
      if (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const contextWithTrace = addTraceContext(context, traceContext);
        const sanitizedContext = contextWithTrace
          ? sanitizeObjectForLogging(contextWithTrace)
          : {};
        winstonLogger.error(`${message}: ${err.message}`, {
          ...(typeof sanitizedContext === "object" && sanitizedContext !== null
            ? sanitizedContext
            : {}),
          stack: err.stack,
        });
      } else {
        const contextWithTrace = addTraceContext(context, traceContext);
        winstonLogger.error(
          message,
          contextWithTrace
            ? sanitizeObjectForLogging(contextWithTrace)
            : contextWithTrace,
        );
      }
    },
    debug: (message: string, context?: unknown) => {
      const contextWithTrace = addTraceContext(context, traceContext);
      winstonLogger.debug(
        message,
        contextWithTrace
          ? sanitizeObjectForLogging(contextWithTrace)
          : contextWithTrace,
      );
    },
  }),
};

// Export both default and named exports for compatibility
export default loggerInstance;
export const logger = loggerInstance;
