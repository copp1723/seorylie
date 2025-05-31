/**
 * OpenTelemetry Tracing Configuration
 * 
 * Configures distributed tracing with OpenTelemetry for the platform.
 * Supports both Jaeger and Grafana Tempo as trace backends.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor, BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
// import { JaegerExporter } from '@opentelemetry/exporter-jaeger'; // Temporarily disabled - missing dependency
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { WsInstrumentation } from '@opentelemetry/instrumentation-ws';
import { AlwaysOnSampler, AlwaysOffSampler, ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { Span, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import * as packageJson from '../../package.json';

// Configure OpenTelemetry logging
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Environment configuration
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'cleanrylie-api';
const SERVICE_NAMESPACE = process.env.OTEL_SERVICE_NAMESPACE || 'ai-platform';
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || packageJson.version;

// Tracing endpoints
const JAEGER_ENDPOINT = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';
const TEMPO_ENDPOINT = process.env.TEMPO_ENDPOINT || 'http://localhost:4318/v1/traces';
const TEMPO_HEADERS = process.env.TEMPO_HEADERS ? JSON.parse(process.env.TEMPO_HEADERS) : {};
const TEMPO_AUTH_TOKEN = process.env.TEMPO_AUTH_TOKEN || '';

// Sampling configuration
const SAMPLING_RATIO = process.env.OTEL_SAMPLING_RATIO 
  ? parseFloat(process.env.OTEL_SAMPLING_RATIO) 
  : (ENVIRONMENT === 'production' ? 0.1 : 1.0); // 10% in prod, 100% in dev

/**
 * Initialize OpenTelemetry tracing
 */
export function initTracing() {
  // Configure resource with service information
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: SERVICE_NAMESPACE,
    [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
  });

  // Configure exporters
  // const jaegerExporter = new JaegerExporter({
  //   endpoint: JAEGER_ENDPOINT,
  // }); // Temporarily disabled - missing dependency

  // Configure Tempo OTLP exporter with authentication
  const tempoExporter = new OTLPTraceExporter({
    url: TEMPO_ENDPOINT,
    headers: {
      ...TEMPO_HEADERS,
      ...(TEMPO_AUTH_TOKEN ? { Authorization: `Bearer ${TEMPO_AUTH_TOKEN}` } : {})
    },
    concurrencyLimit: 10, // Limit concurrent requests
  });

  // Configure sampling strategy
  const sampler = new ParentBasedSampler({
    root: ENVIRONMENT === 'test' 
      ? new AlwaysOffSampler() // No sampling in tests
      : new TraceIdRatioBasedSampler(SAMPLING_RATIO)
  });

  // Create SDK with both Jaeger and Tempo exporters
  const sdk = new NodeSDK({
    resource,
    sampler,
    spanProcessors: [
      // Use simple processor in development for immediate feedback
      ...(ENVIRONMENT === 'development' 
        ? [new SimpleSpanProcessor(new ConsoleSpanExporter())] 
        : []),
      // Use batch processors for production performance
      // new BatchSpanProcessor(jaegerExporter, {
      //   maxExportBatchSize: 100,
      //   scheduledDelayMillis: 500,
      //   maxQueueSize: 2000,
      // }), // Temporarily disabled - missing dependency
      new BatchSpanProcessor(tempoExporter, {
        maxExportBatchSize: 100,
        scheduledDelayMillis: 500,
        maxQueueSize: 2000,
        exportTimeoutMillis: 30000,
      }),
    ],
    instrumentations: [
      // Auto-instrument common Node.js modules
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable high-volume file system instrumentation
        },
      }),
      // Add specific instrumentations with custom config
      new ExpressInstrumentation({
        ignoreLayersType: [
          'middleware', // Reduce noise from middleware spans
          'request_handler',
        ],
      }),
      new HttpInstrumentation({
        ignoreIncomingPaths: [
          '/health',
          '/metrics',
          '/favicon.ico',
        ],
      }),
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
        captureParameters: ENVIRONMENT !== 'production', // Don't capture query params in prod
      }),
      new RedisInstrumentation(),
      new WsInstrumentation({
        traceReconnect: false, // Don't trace reconnection events
      }),
    ],
    // Use W3C trace context for interoperability
    propagator: new W3CTraceContextPropagator(),
  });

  // Start the SDK
  sdk.start()
    .then(() => {
      diag.info(`OpenTelemetry tracing initialized for ${SERVICE_NAME} (${ENVIRONMENT})`);
      diag.info(`Sampling ratio: ${SAMPLING_RATIO * 100}%`);
      
      // Register shutdown handler
      process.on('SIGTERM', () => {
        sdk.shutdown()
          .then(() => diag.info('OpenTelemetry SDK shut down'))
          .catch((error) => diag.error('Error shutting down OpenTelemetry SDK', error))
          .finally(() => process.exit(0));
      });
    })
    .catch((error) => {
      diag.error('Error initializing OpenTelemetry', error);
    });

  return sdk;
}

/**
 * Create a span for sandbox operations
 */
export function createSandboxSpan(name: string, sandboxId: number, userId?: number) {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(name);
  
  span.setAttribute('sandbox.id', sandboxId);
  if (userId) {
    span.setAttribute('user.id', userId);
  }
  span.setAttribute('service.name', SERVICE_NAME);
  
  return span;
}

/**
 * Create a span for tool execution
 */
export function createToolSpan(name: string, toolName: string, sandboxId: number, params?: Record<string, any>) {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(`tool:${toolName}`);
  
  span.setAttribute('tool.name', toolName);
  span.setAttribute('sandbox.id', sandboxId);
  span.setAttribute('service.name', SERVICE_NAME);
  
  if (params) {
    // Add safe parameters as attributes (avoid sensitive data)
    Object.entries(params).forEach(([key, value]) => {
      // Skip sensitive parameters
      if (['password', 'token', 'secret', 'key', 'credential'].some(s => key.toLowerCase().includes(s))) {
        return;
      }
      
      // Add string representation of param (limit length)
      const stringValue = typeof value === 'object' 
        ? JSON.stringify(value).substring(0, 1000) 
        : String(value).substring(0, 1000);
      
      span.setAttribute(`tool.param.${key}`, stringValue);
    });
  }
  
  return span;
}

/**
 * Create a span for agent execution
 */
export function createAgentSpan(name: string, agentId: string, sandboxId: number, userId?: number) {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(`agent:${name}`);
  
  span.setAttribute('agent.id', agentId);
  span.setAttribute('agent.name', name);
  span.setAttribute('sandbox.id', sandboxId);
  if (userId) {
    span.setAttribute('user.id', userId);
  }
  span.setAttribute('service.name', SERVICE_NAME);
  
  return span;
}

/**
 * Create a span for cross-service operations
 */
export function createCrossServiceSpan(name: string, targetService: string, operationType: string) {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(`${targetService}:${name}`);
  
  span.setAttribute('target.service', targetService);
  span.setAttribute('operation.type', operationType);
  span.setAttribute('service.name', SERVICE_NAME);
  
  return span;
}

/**
 * Track token usage in a span
 */
export function trackTokenUsage(span: Span, inputTokens: number, outputTokens: number, model?: string) {
  span.setAttribute('tokens.input', inputTokens);
  span.setAttribute('tokens.output', outputTokens);
  span.setAttribute('tokens.total', inputTokens + outputTokens);
  
  if (model) {
    span.setAttribute('llm.model', model);
  }
}

/**
 * Record error in a span
 */
export function recordSpanError(span: Span, error: Error) {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message
  });
}

/**
 * Execute a function within the context of a span
 */
export async function withSpan<T>(
  spanName: string, 
  fn: (span: Span) => Promise<T>, 
  options?: { 
    attributes?: Record<string, string | number | boolean>,
    parent?: Span
  }
): Promise<T> {
  const tracer = trace.getTracer(SERVICE_NAME);
  const span = tracer.startSpan(spanName, {}, options?.parent ? trace.setSpan(context.active(), options.parent) : undefined);
  
  // Add attributes if provided
  if (options?.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
  
  try {
    const result = await fn(span);
    span.end();
    return result;
  } catch (error) {
    recordSpanError(span, error as Error);
    span.end();
    throw error;
  }
}

export default {
  initTracing,
  createSandboxSpan,
  createToolSpan,
  createAgentSpan,
  createCrossServiceSpan,
  trackTokenUsage,
  recordSpanError,
  withSpan
};
