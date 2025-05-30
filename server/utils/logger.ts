import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { sanitizeObjectForLogging } from './phone-masking';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Configure logger with custom format
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-service' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) =>
            `${timestamp} ${level}: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`
        )
      )
    }),
  ]
});

// In production, add file-based logging
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    })
  );

  logger.add(
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    })
  );
}

// Helper functions to log with context and automatic phone number masking
export default {
  info: (message: string, context?: unknown) => {
    logger.info(message, context ? sanitizeObjectForLogging(context) : context);
  },

  warn: (message: string, context?: unknown) => {
    logger.warn(message, context ? sanitizeObjectForLogging(context) : context);
  },

  error: (message: string, error?: unknown, context?: unknown) => {
    if (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const sanitizedContext = context ? sanitizeObjectForLogging(context) : {};
      logger.error(`${message}: ${err.message}`, {
        ...(typeof sanitizedContext === 'object' && sanitizedContext !== null ? sanitizedContext : {}),
        stack: err.stack
      });
    } else {
      logger.error(message, context ? sanitizeObjectForLogging(context) : context);
    }
  },

  debug: (message: string, context?: unknown) => {
    logger.debug(message, context ? sanitizeObjectForLogging(context) : context);
  },

  // Additional methods for specific use cases
  sms: (message: string, context?: unknown) => {
    // Special logging for SMS operations with enhanced masking
    const sanitizedContext = context ? sanitizeObjectForLogging(context, {
      visibleDigits: 0, // Don't show any digits for SMS logs
      maskCharacter: '*'
    }) : context;

    logger.info(`[SMS] ${message}`, sanitizedContext);
  },

  security: (message: string, context?: unknown) => {
    // Security-related logging with maximum sanitization
    const sanitizedContext = context ? sanitizeObjectForLogging(context, {
      visibleDigits: 0,
      maskCharacter: 'X'
    }) : context;

    logger.warn(`[SECURITY] ${message}`, sanitizedContext);
  }
};