import { config } from 'dotenv';
// Load environment variables first
config();

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { setupWebSocketServer } from './ws-server';
import logger from './logger';
import { setupRoutes } from './routes';
import { checkDatabaseConnection } from './db';
import { initMetrics } from './observability/metrics';
// import { setupTracing } from './observability/tracing'; // Disabled - missing dependencies
import { initializeRedis } from './lib/redis';
import adfRoutes from './routes/adf-routes';
import adminRoutes from './routes/admin-routes';
// import authRoutes from './routes/auth-routes'; // Commented out - auth service not implemented
import conversationLogsRoutes from './routes/conversation-logs-routes';
// import agentSquadRoutes from './routes/agent-squad-routes'; // Commented out - missing dependencies
import adfConversationRoutes from './routes/adf-conversation-routes';
import sendgridRoutes from './routes/sendgrid-webhook-routes';
// TODO: Re-enable when trace services are available
// import traceRoutes from './routes/trace-routes';
// import { traceCorrelation } from './services/trace-correlation';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Setup observability
initMetrics(app);
// setupTracing(); // Disabled - missing dependencies

// Trust proxy for Render deployment (fixes X-Forwarded-For header issues)
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TODO: Re-enable when trace correlation service is available
// Add trace correlation middleware (before other routes)
// if (traceCorrelation.isEnabled()) {
//   app.use(traceCorrelation.middleware());
//   logger.info('Trace correlation middleware enabled');
// }

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files - serve from dist/public where Vite builds the frontend
app.use(express.static(path.join(__dirname, '../dist/public')));

// API routes
// app.use('/api/auth', authRoutes); // Commented out - auth service not implemented
app.use('/api/admin', adminRoutes);
app.use('/api/adf', adfRoutes);
app.use('/api/conversations', conversationLogsRoutes);
// app.use('/api/agent-squad', agentSquadRoutes); // Commented out - missing dependencies
app.use('/api/adf/conversations', adfConversationRoutes);
// TODO: Re-enable when trace services are available
// app.use('/api/trace', traceRoutes);
// app.use('/api/agents', agentOrchestrationRoutes);

// SendGrid webhook routes (safe to enable - doesn't affect existing system)
app.use('/api/sendgrid', sendgridRoutes);

// Add basic test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Kunes RV Dealership Server Running!', 
    timestamp: new Date().toISOString(),
    status: 'ok',
    sessionInvalidated: true // Force session invalidation deployment
  });
});

// Health check endpoint for session invalidation
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sessionInvalidated: true,
    message: 'All sessions invalidated - users must re-authenticate'
  });
});

// Setup additional routes
setupRoutes(app);

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server
// setupWebSocketServer(server); // Commented out for now

// Start server
async function startServer() {
  try {
    // Check database connection
    await checkDatabaseConnection();
    
    // Initialize Redis
    logger.info('Initializing Redis connection');
    await initializeRedis();
    
    // Start HTTP server
    server.listen(PORT, HOST, () => {
      logger.info(`Server running on http://${HOST}:${PORT}`);
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Failed to start server', { error: error.message, stack: error.stack });
    } else {
      logger.error('Failed to start server with unknown error', { error });
    }
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Start the server
startServer();

export { app, server };
