import { config } from 'dotenv';
// Load environment variables first
config();

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { setupWebSocketServer } from './websocket';
import logger from './logger';
import { setupRoutes } from './routes';
import { checkDatabaseConnection } from './db';
import { initMetrics } from './observability/metrics';
// import { setupTracing } from './observability/tracing'; // Disabled - missing dependencies
import { initializeRedis } from './lib/redis';
import { closeDatabaseConnections } from './db';
import adfRoutes from './routes/adf-routes';
import adminRoutes from './routes/admin-routes';
import authRoutes from './routes/auth-routes';
import conversationLogsRoutes from './routes/conversation-logs-routes';
// import agentSquadRoutes from './routes/agent-squad-routes'; // Commented out - missing dependencies
import adfConversationRoutes from './routes/adf-conversation-routes';
import sendgridRoutes from './routes/sendgrid-webhook-routes';
// TODO: Re-enable when trace services are available
// import traceRoutes from './routes/trace-routes';
// import { traceCorrelation } from './services/trace-correlation';

import { SERVER_CONFIG, validateRequiredEnvVars } from './config/constants';

// Validate required environment variables
validateRequiredEnvVars();

// Initialize Express app
const app = express();
const { PORT, HOST } = SERVER_CONFIG;

// Setup observability
initMetrics(app);
// setupTracing(); // Disabled - missing dependencies

// Security middleware - configure helmet to allow local assets
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "images.unsplash.com"],
      connectSrc: ["'self'", "https:"],
    },
  },
}));

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
  secret: SERVER_CONFIG.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: SERVER_CONFIG.NODE_ENV === 'production',
    maxAge: SERVER_CONFIG.SESSION_MAX_AGE
  }
}));

// Static files - serve from dist/public where Vite builds the frontend
// In production (bundled), __dirname is /app/dist, so we need ./public
// In development, __dirname is /app/server, so we need ../dist/public
const publicPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../dist/public');

logger.info(`Static files serving from: ${publicPath}`);
logger.info(`__dirname: ${__dirname}`);
logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);

app.use(express.static(publicPath));

// API routes
logger.info('Setting up API routes...');
app.use('/api/auth', authRoutes);
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

// Add a test API route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working', timestamp: new Date().toISOString() });
});

// Add user endpoint that frontend is calling
app.get('/api/user', (req, res) => {
  // For now, return a mock user since authentication isn't fully set up
  const mockUser = {
    id: 1,
    email: 'demo@example.com',
    name: 'Demo User',
    role: 'admin',
    dealership_id: 1,
    isAuthenticated: true
  };
  
  res.json(mockUser);
});

logger.info('API routes configured');

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Add basic test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Kunes RV Dealership Server Running!', 
    timestamp: new Date().toISOString(),
    status: 'ok'
  });
});

// Setup additional routes
setupRoutes(app);

// Catch-all route for SPA (but not API routes)
app.get('*', (req, res) => {
  // Don't serve SPA for API routes
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
    return;
  }
  
  const indexPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'public/index.html')
    : path.join(__dirname, '../dist/public/index.html');
  res.sendFile(indexPath);
});

// Create HTTP server
const server = createServer(app);

// Start server
async function startServer() {
  try {
    // Check database connection
    await checkDatabaseConnection();

    // Setup WebSocket server with observability
    logger.info('Setting up WebSocket server...');
    try {
      await setupWebSocketServer(server);
      logger.info('WebSocket server setup completed');
    } catch (error) {
      logger.error('Failed to setup WebSocket server:', error);
      // Continue without WebSocket - non-critical for basic functionality
    }

    // Initialize Redis (non-blocking - will use fallback if Redis unavailable)
    logger.info('Initializing Redis connection');
    try {
      await initializeRedis();
    } catch (redisError) {
      logger.warn('Redis initialization failed, continuing with fallback', {
        error: redisError instanceof Error ? redisError.message : String(redisError)
      });
    }

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

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close database connections
    await closeDatabaseConnections();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
}

// Register graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();

export { app, server };
