/**
 * Main server entry point
 */
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { config } from 'dotenv';
import { authenticateJWT } from './middleware/jwt-auth';
import { setupRoutes } from './routes';
import { initializeWebSocketServer, WebSocketService } from './services/websocket-service';
import { logger } from './utils/logger';
import { db } from './db';
import { setupViteServer } from './vite';
import { setupCache } from './utils/cache';
import { setupRateLimiter } from './middleware/rate-limit';
import { setupTieredRateLimiter } from './middleware/tiered-rate-limit';
import { authenticateSession } from './middleware/authentication';
import { setupCSRF } from './middleware/csrf';
import { errorHandler } from './utils/error-handler';
import { OrchestratorService } from './services/orchestrator';
import { ToolRegistryService } from './services/tool-registry';
import { setupMetrics } from './observability/metrics';
import { setupTracing } from './observability/tracing';
import agentSquadRoutes from './routes/agent-squad-routes';
import agentOrchestrationRoutes from './routes/agent-orchestration-routes';
import sandboxRoutes from './routes/sandbox-routes';
import toolsRoutes from './routes/tools-routes';
import adsRoutes from './routes/ads-routes';
import monitoringRoutes from './routes/monitoring-routes';

// Load environment variables
config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup observability
setupTracing();
setupMetrics(app);

// Setup middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionConfig: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Use session middleware
app.use(session(sessionConfig));

// Setup cache if Redis is available
setupCache();

// Setup rate limiters
setupRateLimiter(app);
setupTieredRateLimiter(app);

// Setup CSRF protection
setupCSRF(app);

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
const webSocketService = initializeWebSocketServer(wss);

// Create Tool Registry service
const toolRegistryService = new ToolRegistryService(webSocketService);

// Create Orchestrator service
const orchestratorService = new OrchestratorService(toolRegistryService);

// Setup routes
setupRoutes(app);

// Add agent squad routes
app.use('/api/agent-squad', authenticateSession, agentSquadRoutes);

// Add agent orchestration routes
app.use('/api/agents', authenticateJWT, agentOrchestrationRoutes);

// Add sandbox routes
app.use('/api/sandboxes', authenticateJWT, sandboxRoutes);

// Add tools routes
app.use('/api/tools', authenticateJWT, toolsRoutes);

// Add Google Ads API routes
app.use('/api/ads', adsRoutes);

// Add monitoring routes
app.use('/api/metrics', monitoringRoutes);

// Error handling middleware
app.use(errorHandler);

// Setup Vite in development
if (process.env.NODE_ENV === 'development') {
  setupViteServer(app);
} else {
  // Serve static files in production
  app.use(express.static(path.join(__dirname, '../client')));
  
  // Handle client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  
  // Perform database checks
  db.query('SELECT NOW()').then(() => {
    logger.info('Database connection successful');
  }).catch(err => {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  });
});

export { app, server, webSocketService, toolRegistryService, orchestratorService };
