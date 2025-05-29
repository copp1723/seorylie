/**
 * Main server entry point
 * 
 * This file initializes the Express server, sets up middleware, routes,
 * and starts the server listening on the configured port.
 */

// Import required modules
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { promBundle } from 'express-prom-bundle';
import { sql } from 'drizzle-orm';
import { initTracing } from './observability/tracing';
import { metricsMiddleware } from './observability/metrics';

// Import routes
import authRoutes from './routes/auth-routes';
import promptTestRoutes from './routes/prompt-test';
import simplePromptTestRoutes from './routes/simple-prompt-test';
import conversationLogsRoutes from './routes/conversation-logs-routes';
import monitoringRoutes from './routes/monitoring-routes';
import agentSquadRoutes from './routes/agent-squad-routes';
import agentOrchestrationRoutes from './routes/agent-orchestration-routes';
import sandboxRoutes from './routes/sandbox-routes';
import toolsRoutes from './routes/tools-routes';
import adsRoutes from './routes/ads-routes';

// Import middleware
import { errorHandler } from './utils/error-handler';
import { authenticate } from './middleware/authentication';
import { rateLimiter } from './middleware/rate-limit';
import { validateRequest } from './middleware/validation';

// Import services
import { logger } from './utils/logger';
import { WebSocketService } from './services/websocket-service';
import { OrchestratorService } from './services/orchestrator';
import { ToolRegistryService } from './services/tool-registry';
import { analyticsClient } from './services/analytics-client';

// Import database
import { db } from './db';

// Initialize tracing
initTracing();

// Load environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ 
  server: httpServer,
  path: '/ws'
});

// Initialize services
const webSocketService = new WebSocketService(wss);
const toolRegistryService = new ToolRegistryService(webSocketService);
const orchestratorService = new OrchestratorService(webSocketService, toolRegistryService);

// Configure middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(metricsMiddleware);
app.use(promBundle({ includeMethod: true, includePath: true }));

// Configure session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files in production
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: process.env.npm_package_version });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/prompt-test', promptTestRoutes);
app.use('/api/simple-prompt-test', simplePromptTestRoutes);
app.use('/api/conversation-logs', authenticate, conversationLogsRoutes);
app.use('/api/agent-squad', authenticate, agentSquadRoutes);
app.use('/api/agents', authenticate, agentOrchestrationRoutes);
app.use('/api/sandboxes', authenticate, sandboxRoutes);
app.use('/api/tools', authenticate, toolsRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/metrics', authenticate, monitoringRoutes);

// Error handling middleware
app.use(errorHandler);

// Serve the React app for any other requests in production
if (NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Start the server
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  logger.info(`WebSocket server running at ws://localhost:${PORT}/ws`);
  
  // Initialize database and check connection
  db.execute(sql`SELECT 1`)
    .then(() => {
      logger.info('Database connection successful');
    })
    .catch((err) => {
      logger.error('Database connection failed', { error: err.message });
    });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, httpServer, wss };
