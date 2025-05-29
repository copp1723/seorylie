/**
 * OpenTelemetry Tracing Configuration
 * 
 * Configures distributed tracing for the AI agent platform, with focus on:
 * - HTTP request monitoring
 * - Database operations
 * - Sandbox operations
 * - Tool calls and token usage
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { trace, context, SpanStatusCode, SpanKind, Span, Tracer } from '@opentelemetry/api';
import { logger } from '../utils/logger';

// Environment configuration
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const SERVICE_NAME = process.env.SERVICE_NAME || 'cleanrylie';
const SERVICE_VERSION = process.env.npm_package_version || '0.0.0';
const JAEGER_HOST = process.env.JAEGER_HOST || 'localhost';
const JAEGER_PORT = parseInt(process.env.JAEGER_PORT || '14268', 10);
const ENABLE_CONSOLE_EXPORTER = process.env.ENABLE_CONSOLE_EXPORTER === 'true' || ENVIRONMENT === 'development';
const ENABLE_JAEGER_EXPORTER = process.env.ENABLE_JAEGER_EXPORTER === 'true' || ENVIRONMENT === 'production';

// Custom span attribute keys
export const SPAN_ATTRIBUTES = {
  SANDBOX_ID: 'ai.sandbox.id',
  SESSION_ID: 'ai.sandbox.session_id',
  TOOL_NAME: 'ai.tool.name',
  TOOL_VERSION: 'ai.tool.version',
  TOKEN_USAGE: 'ai.tokens.used',
  TOKEN_LIMIT: 'ai.tokens.limit',
  AGENT_ID: 'ai.agent.id',
  AGENT_TYPE: 'ai.agent.type',
  OPERATION_TYPE: 'ai.operation.type',
  COST: 'ai.cost.usd',
  ERROR_TYPE: 'ai.error.type',
  ERROR_MESSAGE: 'ai.error.message',
  LATENCY_MS: 'ai.latency.ms',
  PROMPT_TOKENS: 'ai.tokens.prompt',
  COMPLETION_TOKENS: 'ai.tokens.completion'
};

// Custom span names
export const SPAN_NAMES = {
  SANDBOX_CREATE: 'sandbox.create',
  SANDBOX_DELETE: 'sandbox.delete',
  SANDBOX_EXECUTE: 'sandbox.execute',
  TOOL_EXECUTE: 'tool.execute',
  TOKEN_CHECK: 'tokens.check',
  TOKEN_UPDATE: 'tokens.update',
  AGENT_EXECUTE: 'agent.execute',
  OPENAI_REQUEST: 'openai.request',
  DATABASE_OPERATION: 'db.operation',
  WEBSOCKET_MESSAGE: 'ws.message'
};

// Global tracer instance
let tracer: Tracer;

/**
 * Initialize OpenTelemetry tracing
 */
export function initTracing() {
  try {
    logger.info('Initializing OpenTelemetry tracing...');

    // Create a resource that identifies your service
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
        [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
      })
    );

    // Configure exporters
    const spanProcessors = [];

    // Console exporter for development
    if (ENABLE_CONSOLE_EXPORTER) {
      spanProcessors.push(
        new SimpleSpanProcessor(new ConsoleSpanExporter())
      );
      logger.info('Console span exporter enabled');
    }

    // Jaeger exporter for production
    if (ENABLE_JAEGER_EXPORTER) {
      const jaegerExporter = new JaegerExporter({
        endpoint: `http://${JAEGER_HOST}:${JAEGER_PORT}/api/traces`,
      });
      spanProcessors.push(
        new BatchSpanProcessor(jaegerExporter)
      );
      logger.info(`Jaeger exporter enabled: ${JAEGER_HOST}:${JAEGER_PORT}`);
    }

    // Create and register the SDK
    const sdk = new NodeSDK({
      resource,
      spanProcessors,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Enable all auto-instrumentations with specific configurations
          '@opentelemetry/instrumentation-fs': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
          '@opentelemetry/instrumentation-pg-pool': { enabled: true },
          '@opentelemetry/instrumentation-redis': { enabled: true },
          '@opentelemetry/instrumentation-ws': { enabled: true },
        }),
      ],
    });

    // Initialize the SDK and register with the OpenTelemetry API
    sdk.start();
    logger.info('OpenTelemetry tracing initialized successfully');

    // Get the global tracer
    tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

    // Handle shutdown gracefully
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down tracing...');
      sdk.shutdown()
        .then(() => logger.info('Tracing terminated'))
        .catch(error => logger.error('Error shutting down tracing', error));
    });

    return sdk;
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry tracing', error);
    // Continue without tracing rather than crashing the application
    return null;
  }
}

/**
 * Get the global tracer instance
 */
export function getTracer(): Tracer {
  if (!tracer) {
    logger.warn('Tracer requested before initialization, initializing now');
    initTracing();
  }
  return tracer;
}

/**
 * Create a custom span for sandbox operations
 */
export function createSandboxSpan(name: string, sandboxId: number, sessionId?: string) {
  const span = getTracer().startSpan(name, {
    kind: SpanKind.INTERNAL,
    attributes: {
      [SPAN_ATTRIBUTES.SANDBOX_ID]: sandboxId,
    },
  });
  
  if (sessionId) {
    span.setAttribute(SPAN_ATTRIBUTES.SESSION_ID, sessionId);
  }
  
  return span;
}

/**
 * Create a custom span for tool execution
 */
export function createToolSpan(toolName: string, sandboxId: number, sessionId: string) {
  return getTracer().startSpan(SPAN_NAMES.TOOL_EXECUTE, {
    kind: SpanKind.INTERNAL,
    attributes: {
      [SPAN_ATTRIBUTES.TOOL_NAME]: toolName,
      [SPAN_ATTRIBUTES.SANDBOX_ID]: sandboxId,
      [SPAN_ATTRIBUTES.SESSION_ID]: sessionId,
    },
  });
}

/**
 * Create a custom span for agent execution
 */
export function createAgentSpan(agentId: string, agentType: string, sandboxId: number) {
  return getTracer().startSpan(SPAN_NAMES.AGENT_EXECUTE, {
    kind: SpanKind.INTERNAL,
    attributes: {
      [SPAN_ATTRIBUTES.AGENT_ID]: agentId,
      [SPAN_ATTRIBUTES.AGENT_TYPE]: agentType,
      [SPAN_ATTRIBUTES.SANDBOX_ID]: sandboxId,
    },
  });
}

/**
 * Create a custom span for OpenAI API requests
 */
export function createOpenAISpan(operationType: string) {
  return getTracer().startSpan(SPAN_NAMES.OPENAI_REQUEST, {
    kind: SpanKind.CLIENT,
    attributes: {
      [SPAN_ATTRIBUTES.OPERATION_TYPE]: operationType,
    },
  });
}

/**
 * Record token usage in a span
 */
export function recordTokenUsage(span: Span, tokensUsed: number, promptTokens?: number, completionTokens?: number) {
  span.setAttribute(SPAN_ATTRIBUTES.TOKEN_USAGE, tokensUsed);
  
  if (promptTokens !== undefined) {
    span.setAttribute(SPAN_ATTRIBUTES.PROMPT_TOKENS, promptTokens);
  }
  
  if (completionTokens !== undefined) {
    span.setAttribute(SPAN_ATTRIBUTES.COMPLETION_TOKENS, completionTokens);
  }
  
  // Estimate cost based on token usage (simplified calculation)
  // In a real implementation, you would use the actual model and pricing
  const estimatedCost = tokensUsed * 0.000002; // $0.002 per 1000 tokens
  span.setAttribute(SPAN_ATTRIBUTES.COST, estimatedCost);
  
  return span;
}

/**
 * Record error in a span
 */
export function recordError(span: Span, error: Error) {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
  
  span.setAttribute(SPAN_ATTRIBUTES.ERROR_TYPE, error.name);
  span.setAttribute(SPAN_ATTRIBUTES.ERROR_MESSAGE, error.message);
  
  span.recordException(error);
  
  return span;
}

/**
 * Execute a function within a custom span
 */
export async function withSpan<T>(
  name: string, 
  fn: (span: Span) => Promise<T>, 
  attributes: Record<string, any> = {}
): Promise<T> {
  const span = getTracer().startSpan(name);
  
  // Set all provided attributes
  Object.entries(attributes).forEach(([key, value]) => {
    span.setAttribute(key, value);
  });
  
  try {
    const result = await fn(span);
    span.end();
    return result;
  } catch (error) {
    recordError(span, error as Error);
    span.end();
    throw error;
  }
}

export default {
  initTracing,
  getTracer,
  createSandboxSpan,
  createToolSpan,
  createAgentSpan,
  createOpenAISpan,
  recordTokenUsage,
  recordError,
  withSpan,
  SPAN_ATTRIBUTES,
  SPAN_NAMES,
};
