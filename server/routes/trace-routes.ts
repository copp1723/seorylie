import express, { Request, Response } from 'express';
import { traceCorrelation } from '../services/trace-correlation';
import logger from '../utils/logger';

const router = express.Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  const isEnabled = traceCorrelation.isEnabled();
  const hasTempoUrl = !!process.env.GRAFANA_TEMPO_URL;
  
  res.json({
    success: true,
    status: isEnabled ? 'enabled' : 'disabled',
    config: {
      enabled: isEnabled,
      tempoUrlConfigured: hasTempoUrl,
      serviceName: process.env.TRACE_SERVICE_NAME || 'cleanrylie-app',
      etlTracingEnabled: process.env.TRACE_ETL_ENABLED === 'true',
      websocketTracingEnabled: process.env.TRACE_WEBSOCKET_ENABLED === 'true'
    }
  });
});

// Get trace statistics
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = traceCorrelation.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error retrieving trace statistics', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trace statistics'
    });
  }
});

// Generate Grafana Tempo URL for a trace ID
router.get('/tempo-url/:traceId', (req: Request, res: Response) => {
  const { traceId } = req.params;
  
  if (!traceId) {
    return res.status(400).json({
      success: false,
      message: 'Trace ID is required'
    });
  }
  
  const tempoUrl = traceCorrelation.getTempoUrl(traceId);
  
  if (!tempoUrl) {
    return res.status(404).json({
      success: false,
      message: 'Grafana Tempo URL not configured or trace correlation disabled'
    });
  }
  
  res.json({
    success: true,
    traceId,
    tempoUrl
  });
});

// Test endpoint to generate a sample trace (development only)
router.post('/test', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      message: 'Test endpoint not available in production'
    });
  }

  if (!traceCorrelation.isEnabled()) {
    return res.status(503).json({
      success: false,
      message: 'Trace correlation is not enabled'
    });
  }

  try {
    // Create a test trace
    const traceContext = traceCorrelation.createTraceContext({
      name: 'test-trace',
      attributes: {
        test: true,
        source: 'api-test',
        timestamp: new Date().toISOString()
      }
    });

    // Create a child span
    const childSpan = traceCorrelation.createSpan({
      name: 'test-child-span',
      parentTraceId: traceContext.traceId,
      parentSpanId: traceContext.spanId,
      attributes: {
        operation: 'test-operation'
      }
    });

    // Log with trace context
    logger.info('Test trace generated', {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId
    });

    // Complete the child span
    setTimeout(() => {
      traceCorrelation.completeSpan(childSpan.spanId);
      traceCorrelation.completeSpan(traceContext.spanId);
    }, 100);

    res.json({
      success: true,
      trace: {
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
        tempoUrl: traceCorrelation.getTempoUrl(traceContext.traceId)
      }
    });
  } catch (error) {
    logger.error('Error generating test trace', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate test trace'
    });
  }
});

// Get current request's trace context
router.get('/current', (req: Request, res: Response) => {
  const traceContext = (req as any).traceContext;
  
  res.json({
    success: true,
    hasTraceContext: !!traceContext,
    traceContext: traceContext || null,
    tempoUrl: traceContext ? traceCorrelation.getTempoUrl(traceContext.traceId) : null
  });
});

export default router;
