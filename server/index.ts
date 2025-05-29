import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { db } from './db';
import { logger } from './utils/logger';
import { setupWebSocketServer } from './ws-server';
import { WebSocketService } from './services/websocket-service';
import { ToolRegistryService } from './services/tool-registry';
import { OrchestratorService } from './services/orchestrator';
import { crossServiceAgent } from './services/cross-service-agent';
import { analyticsClient } from './services/analytics-client';
import { AgentSquad } from './services/agentSquad';

// Import routes
import authRoutes from './routes/auth-routes';
import promptTestRoutes from './routes/prompt-test';
import monitoringRoutes from './routes/monitoring-routes';
import agentOrchestrationRoutes from './routes/agent-orchestration-routes';
import sandboxRoutes from './routes/sandbox-routes';
import toolsRoutes from './routes/tools-routes';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Initialize WebSocket service
const webSocketService = new WebSocketService(wss);

// Initialize Tool Registry Service
const toolRegistryService = new ToolRegistryService(db, webSocketService);

// Initialize Orchestrator Service
const orchestratorService = new OrchestratorService(db, webSocketService, toolRegistryService);

// Initialize Agent Squad
const agentSquad = new AgentSquad(db, webSocketService, toolRegistryService);

// Setup WebSocket server
setupWebSocketServer(server, wss, webSocketService, orchestratorService);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/prompt-test', promptTestRoutes);
app.use('/api/agents', agentOrchestrationRoutes);
app.use('/api/sandboxes', sandboxRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/metrics', monitoringRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: process.env.npm_package_version });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server initialized`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
