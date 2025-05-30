import express, { Express } from 'express';
import { createServer } from 'http';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import csrf from 'csurf';
import logger from './utils/logger';
import { db } from './db';

// Import route modules
import promptRoutes from './routes/prompt-testing-routes';
import localAuthRoutes from './routes/local-auth-routes';
import magicLinkRoutes from './routes/magic-link';
import adminRoutes from './routes/admin-routes';
import adminUserRoutes from './routes/admin-user-routes';
import escalationRoutes from './routes/escalation-routes';
import leadManagementRoutes from './routes/lead-management-routes';
import userManagementRoutes from './routes/user-management-routes';
import customerInsightsRoutes from './routes/customer-insights-routes';
import inventoryRoutes from './routes/inventory-routes';
import predictionRoutes from './routes/prediction-routes';
import sendgridWebhook from './routes/webhooks/sendgrid';
import emailRoutes from './routes/email-routes';
import { tenantContextMiddleware } from './middleware/tenant-context';
import WebSocketChatServer from './ws-server';

// Check database connection
async function checkDatabaseConnection() {
  try {
    await db.execute('SELECT NOW()');
    console.log('PostgreSQL connection test successful');
    return true;
  } catch (error) {
    console.error('PostgreSQL connection test failed:', error);
    return false;
  }
}

export async function registerRoutes(app: Express) {
  // Check database connection before proceeding
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    logger.warn('Database connection failed - some features may not work properly');
    // Don't exit - allow server to start for frontend testing
  }

  // Configure session store
  const connectionString = process.env.DATABASE_URL;
  const isSupabase = connectionString?.includes('supabase.co');

  let sessionStore;

  if (dbConnected) {
    try {
      const pgPool = new Pool({
        connectionString: connectionString,
        ssl: (process.env.NODE_ENV === 'production' || isSupabase) ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
      });

      const PgSessionStore = connectPgSimple(session);
      logger.info('Initializing PostgreSQL session store');

      sessionStore = new PgSessionStore({
        pool: pgPool,
        tableName: 'sessions',
        createTableIfMissing: true,
      });

      logger.info('PostgreSQL session store initialized successfully');
    } catch (error) {
      logger.warn('Failed to initialize PostgreSQL session store, using memory store', error);
      sessionStore = undefined; // Will use default memory store
    }
  } else {
    logger.info('Using memory session store due to database connection issues');
    sessionStore = undefined; // Will use default memory store
  }

  // Configure session middleware
  const sessionConfig: any = {
    secret: process.env.SESSION_SECRET || 'rylie-secure-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: 'lax',
    },
  };

  if (sessionStore) {
    sessionConfig.store = sessionStore;
  }

  app.use(session(sessionConfig));

  // Add CSRF protection
  const csrfProtection = csrf({ cookie: false });

  // Apply CSRF protection to all routes except those that need to be exempt
  app.use((req, res, next) => {
    // List of routes that should be exempt from CSRF protection
    const exemptRoutes = [
      '/api/magic-link/verify',
      '/api/inbound',
      '/api/webhook',
      '/api/metrics',
      '/api/health',
      '/api/login',
      '/api/logout',
      '/api/user',
      '/api/prompt-test',
      '/webhooks/sendgrid', // Add SendGrid webhook to exemptions
      '/api/email/status'   // Add email status endpoint to exemptions
    ];

    // Check if the current route should be exempt
    const isExempt = exemptRoutes.some(route => req.path.startsWith(route));

    if (isExempt) {
      next();
    } else {
      csrfProtection(req, res, next);
    }
  });

  // Add CSRF token endpoint
  app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // Add tenant context middleware for multi-tenancy
  app.use(tenantContextMiddleware);

  // Register route modules
  app.use('/api/prompt-testing', promptRoutes);
  app.use('/api/prompt-test', promptRoutes);

  // Authentication routes
  app.use('/api', localAuthRoutes);
  app.use('/api/magic-link', magicLinkRoutes);

  // Email routes (ADF-05)
  app.use('/api/email', emailRoutes);
  
  // Admin routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin', adminUserRoutes);

  // New feature routes
  app.use('/api', escalationRoutes);
  app.use('/api', leadManagementRoutes);
  app.use('/api', userManagementRoutes);
  app.use('/api', customerInsightsRoutes);
  app.use('/api', inventoryRoutes);
  app.use('/api/predictions', predictionRoutes);

  // Webhook routes
  app.use('/webhooks', sendgridWebhook);

  // Create and return HTTP server
  const server = createServer(app);

  // Initialize WebSocket server
  try {
    const wsServer = new WebSocketChatServer();
    wsServer.initialize(server);
    logger.info('WebSocket chat server initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize WebSocket server:', error);
  }

  return server;
}
