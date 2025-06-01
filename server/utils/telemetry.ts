/**
 * Telemetry Utilities for WebSocket and Distributed Tracing
 * 
 * This module provides utility functions for OpenTelemetry tracing
 * specifically designed for WebSocket operations and cross-service communication.
 */

import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

// Service name for telemetry
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'cleanrylie-websocket';

/**
 * Generate a unique trace ID for correlation
 */
export function generateTraceId(): string {
  return uuidv4();
}

/**
 * Create a span for WebSocket operations
 */
export function createWebSocketSpan(
  operationName: string,
  connectionId?: string,
  attributes?: Record<string, string | number | boolean>
): Span {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(`websocket:${operationName}`);
  
  // Add default attributes
  span.setAttributes({
    'service.name': SERVICE_NAME,
    'operation.type': 'websocket',
    'websocket.operation': operationName,
    ...attributes
  });

  // Add connection ID if provided
  if (connectionId) {
    span.setAttribute('websocket.connection.id', connectionId);
  }

  return span;
}

/**
 * Create a span for message processing
 */
export function createMessageSpan(
  messageType: string,
  connectionId: string,
  messageSize?: number,
  attributes?: Record<string, string | number | boolean>
): Span {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(`websocket:message:${messageType}`);
  
  span.setAttributes({
    'service.name': SERVICE_NAME,
    'operation.type': 'websocket_message',
    'websocket.message.type': messageType,
    'websocket.connection.id': connectionId,
    ...attributes
  });

  if (messageSize !== undefined) {
    span.setAttribute('websocket.message.size_bytes', messageSize);
  }

  return span;
}

/**
 * Create a span for connection lifecycle events
 */
export function createConnectionSpan(
  event: 'connect' | 'disconnect' | 'health_check' | 'cleanup',
  connectionId: string,
  attributes?: Record<string, string | number | boolean>
): Span {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(`websocket:connection:${event}`);
  
  span.setAttributes({
    'service.name': SERVICE_NAME,
    'operation.type': 'websocket_connection',
    'websocket.connection.event': event,
    'websocket.connection.id': connectionId,
    ...attributes
  });

  return span;
}

/**
 * Add error information to a span
 */
export function addSpanError(span: Span, error: Error, errorType?: string): void {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message
  });

  if (errorType) {
    span.setAttribute('error.type', errorType);
  }

  span.setAttribute('error.name', error.name);
  span.setAttribute('error.message', error.message);
}

/**
 * Add success status to a span
 */
export function addSpanSuccess(span: Span, message?: string): void {
  span.setStatus({
    code: SpanStatusCode.OK,
    message: message || 'Operation completed successfully'
  });
}

/**
 * Execute a function within a traced context
 */
export async function traceAsyncOperation<T>(
  operationName: string,
  operation: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(operationName);
  
  if (attributes) {
    span.setAttributes(attributes);
  }

  try {
    const result = await operation(span);
    addSpanSuccess(span);
    return result;
  } catch (error) {
    addSpanError(span, error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Execute a synchronous function within a traced context
 */
export function traceSyncOperation<T>(
  operationName: string,
  operation: (span: Span) => T,
  attributes?: Record<string, string | number | boolean>
): T {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(operationName);
  
  if (attributes) {
    span.setAttributes(attributes);
  }

  try {
    const result = operation(span);
    addSpanSuccess(span);
    return result;
  } catch (error) {
    addSpanError(span, error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Create a timer for measuring operation duration
 */
export function createTimer(): () => number {
  const start = process.hrtime.bigint();
  
  return () => {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e9; // Convert to seconds
  };
}

/**
 * Add timing information to a span
 */
export function addTimingToSpan(span: Span, durationSeconds: number, operationType?: string): void {
  span.setAttribute('duration.seconds', durationSeconds);
  span.setAttribute('duration.milliseconds', durationSeconds * 1000);
  
  if (operationType) {
    span.setAttribute('operation.duration_type', operationType);
  }
}

/**
 * Create a correlation ID for tracking requests across services
 */
export function createCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Extract trace context from HTTP headers
 */
export function extractTraceContext(headers: Record<string, string | string[] | undefined>): any {
  try {
    // Extract W3C trace context headers
    const traceParent = headers['traceparent'];
    const traceState = headers['tracestate'];
    
    if (traceParent) {
      return {
        traceParent: Array.isArray(traceParent) ? traceParent[0] : traceParent,
        traceState: Array.isArray(traceState) ? traceState[0] : traceState
      };
    }
    
    return null;
  } catch (error) {
    logger.warn('Failed to extract trace context from headers:', error);
    return null;
  }
}

/**
 * Inject trace context into HTTP headers
 */
export function injectTraceContext(headers: Record<string, string>, span?: Span): Record<string, string> {
  try {
    const activeSpan = span || trace.getActiveSpan();
    if (!activeSpan) {
      return headers;
    }

    // This is a simplified injection - in a real implementation,
    // you would use the OpenTelemetry propagator API
    const spanContext = activeSpan.spanContext();
    if (spanContext) {
      headers['x-trace-id'] = spanContext.traceId;
      headers['x-span-id'] = spanContext.spanId;
    }

    return headers;
  } catch (error) {
    logger.warn('Failed to inject trace context into headers:', error);
    return headers;
  }
}

/**
 * Create a child span from parent context
 */
export function createChildSpan(
  operationName: string,
  parentSpan?: Span,
  attributes?: Record<string, string | number | boolean>
): Span {
  const tracer = trace.getTracer(SERVICE_NAME);
  
  const span = parentSpan
    ? tracer.startSpan(operationName, {}, trace.setSpan(context.active(), parentSpan))
    : tracer.startSpan(operationName);
  
  if (attributes) {
    span.setAttributes(attributes);
  }

  return span;
}

/**
 * Log trace information for debugging
 */
export function logTraceInfo(span: Span, message: string, additionalData?: Record<string, any>): void {
  const spanContext = span.spanContext();
  
  logger.debug(message, {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    ...additionalData
  });
}

/**
 * Create baggage for cross-service context propagation
 */
export function createBaggage(key: string, value: string): void {
  try {
    // In a real implementation, you would use the OpenTelemetry baggage API
    // For now, we'll add it as a span attribute
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute(`baggage.${key}`, value);
    }
  } catch (error) {
    logger.warn('Failed to create baggage:', error);
  }
}

export default {
  generateTraceId,
  createWebSocketSpan,
  createMessageSpan,
  createConnectionSpan,
  addSpanError,
  addSpanSuccess,
  traceAsyncOperation,
  traceSyncOperation,
  createTimer,
  addTimingToSpan,
  createCorrelationId,
  extractTraceContext,
  injectTraceContext,
  createChildSpan,
  logTraceInfo,
  createBaggage
};