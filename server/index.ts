import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
// import { setupWebSocketServer } from './ws-server'; // Commented out - function not exported
import logger from './logger';
import { setupRoutes } from './routes';
// import { checkDatabaseConnection } from './db'; // Function doesn't exist
import { setupMetrics } from './observability/metrics';
// import { setupTracing } from './observability/tracing'; // Temporarily disabled due to missing dependencies
import adfRoutes from './routes/adf-routes';
import adminRoutes from './routes/admin-routes';
// import authRoutes from './routes/auth-routes'; // Commented out - auth service not implemented
import conversationLogsRoutes from './routes/conversation-logs-routes';
import agentSquadRoutes from './routes/agent-squad-routes';
import adfConversationRoutes from './routes/adf-conversation-routes';
import { initializeRedis } from './lib/redis';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup observability
setupMetrics(app);
// setupTracing(); // Temporarily disabled due to missing dependencies

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Static files
app.use(express.static(path.join(__dirname, '../dist/public')));

// API routes
// app.use('/api/auth', authRoutes); // Commented out - auth service not implemented
app.use('/api/admin', adminRoutes);
app.use('/api/adf', adfRoutes);
app.use('/api/conversations', conversationLogsRoutes);
app.use('/api/agent-squad', agentSquadRoutes);
app.use('/api/adf/conversations', adfConversationRoutes);

// Setup additional routes
setupRoutes(app);

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server
// setupWebSocketServer(server); // Commented out - function not available

// Start server
async function startServer() {
  try {
    // Check database connection (simplified)
    logger.info('Skipping database connection check - function not implemented');

    // Initialize Redis
    logger.info('Skipping Redis initialization for development');
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
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
