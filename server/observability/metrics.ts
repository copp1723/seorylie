/**
 * Prometheus Metrics Configuration
 * 
 * Configures metrics collection for the AI agent platform, with focus on:
 * - Sandbox token usage and rate limiting
 * - Tool execution latency (P95)
 * - OpenAI API cost tracking
 * - Request counts and error rates
 * 
 * These metrics are exposed via /metrics endpoint for Prometheus scraping
 * and visualized in Grafana dashboards.
 */

import promClient from 'prom-client';
import promBundle from 'express-prom-bundle';
import { Express, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Initialize the Prometheus registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
promClient.collectDefaultMetrics({ register });

// Define custom metrics

// Histograms - for measuring latencies (P95)
const toolExecutionDuration = new promClient.Histogram({
  name: 'tool_execution_duration_seconds',
  help: 'Duration of tool execution in seconds',
  labelNames: ['tool_name', 'sandbox_id', 'status'],
  buckets: promClient.exponentialBuckets(0.05, 1.5, 10), // Start at 50ms, factor 1.5, 10 buckets
  registers: [register]
});

const agentExecutionDuration = new promClient.Histogram({
  name: 'agent_execution_duration_seconds',
  help: 'Duration of agent execution in seconds',
  labelNames: ['agent_type', 'sandbox_id', 'status'],
  buckets: promClient.exponentialBuckets(0.1, 2, 10), // Start at 100ms, factor 2, 10 buckets
  registers: [register]
});

const openaiRequestDuration = new promClient.Histogram({
  name: 'openai_request_duration_seconds',
  help: 'Duration of OpenAI API requests in seconds',
  labelNames: ['operation_type', 'model', 'status'],
  buckets: promClient.exponentialBuckets(0.1, 2, 10), // Start at 100ms, factor 2, 10 buckets
  registers: [register]
});

// Counters - for counting events
const tokenUsageCounter = new promClient.Counter({
  name: 'token_usage_total',
  help: 'Total number of tokens used',
  labelNames: ['sandbox_id', 'operation_type', 'session_id'],
  registers: [register]
});

const openaiCostCounter = new promClient.Counter({
  name: 'openai_cost_usd_total',
  help: 'Total OpenAI API cost in USD',
  labelNames: ['sandbox_id', 'model', 'operation_type'],
  registers: [register]
});

const rateLimitCounter = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['sandbox_id', 'limit_type', 'session_id'],
  registers: [register]
});

const errorCounter = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['sandbox_id', 'error_type', 'component'],
  registers: [register]
});

const toolExecutionCounter = new promClient.Counter({
  name: 'tool_executions_total',
  help: 'Total number of tool executions',
  labelNames: ['tool_name', 'sandbox_id', 'status'],
  registers: [register]
});

// Gauges - for current values
const sandboxTokenUsageGauge = new promClient.Gauge({
  name: 'sandbox_token_usage_current',
  help: 'Current token usage per sandbox',
  labelNames: ['sandbox_id', 'period'],
  registers: [register]
});

const sandboxCostGauge = new promClient.Gauge({
  name: 'sandbox_cost_usd_current',
  help: 'Current cost in USD per sandbox',
  labelNames: ['sandbox_id', 'period'],
  registers: [register]
});

const activeSessionsGauge = new promClient.Gauge({
  name: 'active_sessions_current',
  help: 'Current number of active sessions',
  labelNames: ['sandbox_id'],
  registers: [register]
});

const activeSandboxesGauge = new promClient.Gauge({
  name: 'active_sandboxes_current',
  help: 'Current number of active sandboxes',
  registers: [register]
});

/**
 * Helper functions for updating metrics
 */

/**
 * Record tool execution with duration and status
 */
export function recordToolExecution(
  toolName: string, 
  sandboxId: number | string, 
  durationSeconds: number, 
  status: 'success' | 'error'
) {
  const sandboxIdStr = String(sandboxId);
  toolExecutionDuration.labels(toolName, sandboxIdStr, status).observe(durationSeconds);
  toolExecutionCounter.labels(toolName, sandboxIdStr, status).inc();
}

/**
 * Record agent execution with duration and status
 */
export function recordAgentExecution(
  agentType: string, 
  sandboxId: number | string, 
  durationSeconds: number, 
  status: 'success' | 'error'
) {
  const sandboxIdStr = String(sandboxId);
  agentExecutionDuration.labels(agentType, sandboxIdStr, status).observe(durationSeconds);
}

/**
 * Record OpenAI API request with duration, cost, and token usage
 */
export function recordOpenAIRequest(
  operationType: string, 
  model: string, 
  durationSeconds: number, 
  costUsd: number, 
  status: 'success' | 'error',
  sandboxId?: number | string
) {
  openaiRequestDuration.labels(operationType, model, status).observe(durationSeconds);
  
  if (sandboxId && costUsd > 0) {
    const sandboxIdStr = String(sandboxId);
    openaiCostCounter.labels(sandboxIdStr, model, operationType).inc(costUsd);
  }
}

/**
 * Record token usage for a sandbox
 */
export function recordTokenUsage(
  sandboxId: number | string, 
  operationType: string, 
  tokensUsed: number, 
  sessionId?: string
) {
  const sandboxIdStr = String(sandboxId);
  const sessionIdStr = sessionId || 'unknown';
  
  tokenUsageCounter.labels(sandboxIdStr, operationType, sessionIdStr).inc(tokensUsed);
  
  // Estimate cost based on token usage (simplified calculation)
  // In a real implementation, you would use the actual model and pricing
  const estimatedCost = tokensUsed * 0.000002; // $0.002 per 1000 tokens
  openaiCostCounter.labels(sandboxIdStr, 'gpt-4', operationType).inc(estimatedCost);
}

/**
 * Update current sandbox token usage gauges
 */
export function updateSandboxTokenUsage(
  sandboxId: number | string, 
  hourlyUsage: number, 
  dailyUsage: number
) {
  const sandboxIdStr = String(sandboxId);
  sandboxTokenUsageGauge.labels(sandboxIdStr, 'hourly').set(hourlyUsage);
  sandboxTokenUsageGauge.labels(sandboxIdStr, 'daily').set(dailyUsage);
  
  // Update cost gauges based on token usage
  const hourlyEstimatedCost = hourlyUsage * 0.000002; // $0.002 per 1000 tokens
  const dailyEstimatedCost = dailyUsage * 0.000002; // $0.002 per 1000 tokens
  
  sandboxCostGauge.labels(sandboxIdStr, 'hourly').set(hourlyEstimatedCost);
  sandboxCostGauge.labels(sandboxIdStr, 'daily').set(dailyEstimatedCost);
}

/**
 * Record a rate limit hit
 */
export function recordRateLimit(
  sandboxId: number | string, 
  limitType: 'hourly' | 'daily', 
  sessionId?: string
) {
  const sandboxIdStr = String(sandboxId);
  const sessionIdStr = sessionId || 'unknown';
  
  rateLimitCounter.labels(sandboxIdStr, limitType, sessionIdStr).inc();
  errorCounter.labels(sandboxIdStr, 'rate_limit_exceeded', 'orchestrator').inc();
}

/**
 * Record an error
 */
export function recordError(
  errorType: string, 
  component: string, 
  sandboxId?: number | string
) {
  const sandboxIdStr = sandboxId ? String(sandboxId) : 'unknown';
  errorCounter.labels(sandboxIdStr, errorType, component).inc();
}

/**
 * Update active sessions count for a sandbox
 */
export function updateActiveSessions(sandboxId: number | string, count: number) {
  const sandboxIdStr = String(sandboxId);
  activeSessionsGauge.labels(sandboxIdStr).set(count);
}

/**
 * Update active sandboxes count
 */
export function updateActiveSandboxes(count: number) {
  activeSandboxesGauge.set(count);
}

/**
 * Create Express middleware for metrics collection
 */
export function createMetricsMiddleware() {
  return promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    includeUp: true,
    customLabels: { app: 'cleanrylie' },
    promClient: { collectDefaultMetrics: {} },
    metricsPath: '/metrics',
    promRegistry: register
  });
}

/**
 * Create a metrics endpoint handler
 */
export function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  register.metrics().then(metrics => res.end(metrics));
}

/**
 * Initialize metrics collection for the application
 */
export function initMetrics(app: Express) {
  try {
    logger.info('Initializing Prometheus metrics collection...');
    
    // Apply metrics middleware
    app.use(createMetricsMiddleware());
    
    // Add metrics endpoint
    app.get('/metrics', metricsHandler);
    
    // Initialize active sandboxes gauge
    updateActiveSandboxes(0);
    
    logger.info('Prometheus metrics initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Prometheus metrics', error);
  }
}

export default {
  register,
  recordToolExecution,
  recordAgentExecution,
  recordOpenAIRequest,
  recordTokenUsage,
  updateSandboxTokenUsage,
  recordRateLimit,
  recordError,
  updateActiveSessions,
  updateActiveSandboxes,
  initMetrics,
  metricsHandler,
  createMetricsMiddleware
};
