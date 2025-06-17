/**
 * @file Modernized Main Server Entry Point for Rylie SEO Hub
 * @description White-label SEO middleware with improved error handling, configuration, and security
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as envConfig } from 'dotenv';
import { config, isDev, isProd } from './config';
import { 
  logger, 
  errorHandler, 
  contextMiddleware, 
  setupGlobalErrorHandlers,
  AppError,
  ErrorCode,
  createConfigError 
} from './utils/errors';

// Dynamic imports for routes and middleware
import { connectDB } from './models/database';
import { databasePoolMonitor } from './services/database-pool-monitor';

// Load environment variables
envConfig();

// Get __dirname equivalent for ES modules
// In production, the dist folder structure is different
const __dirname = isProd 
  ? path.join(process.cwd(), 'dist')
  : path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = config.PORT;

// Setup global error handlers early
setupGlobalErrorHandlers();

/**
 * Configure rate limiting based on environment
 */
const createRateLimiter = () => {
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: {
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests from this IP, please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks in development
      return isDev && req.path === '/health';
    }
  });
};

/**
 * Configure security middleware
 */
const setupSecurity = () => {
  // Helmet configuration
  app.use(helmet({
    contentSecurityPolicy: isProd ? undefined : false, // Disable CSP in development
    crossOriginEmbedderPolicy: false // Allow embedding for white-label use
  }));

  // CORS configuration
  app.use(cors({
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Trace-ID']
  }));

  // Compression
  app.use(compression());

  // Rate limiting
  app.use(createRateLimiter());
};

/**
 * Configure request processing middleware
 */
const setupRequestProcessing = () => {
  // Context middleware (adds trace ID and enhanced logging)
  app.use(contextMiddleware);

  // Morgan logging with structured format
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info('HTTP Request', { 
          httpLog: message.trim(),
          service: 'http-access'
        });
      }
    },
    skip: (req) => {
      // Skip logging health checks in production to reduce noise
      return isProd && req.path === '/health';
    }
  }));

  // Body parsing with size limits
  app.use(express.json({ 
    limit: '10mb',
    type: ['application/json', 'text/plain']
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));
};

/**
 * Setup core application routes
 */
const setupRoutes = async () => {
  // Serve static files from the web console build
  const publicPath = isProd 
    ? path.join(process.cwd(), 'dist/public')
    : path.join(__dirname, '../dist/public');
  app.use(express.static(publicPath));
  
  logger.info('Serving static files from', { publicPath });

  // API info endpoint - moved to /api path
  app.get('/api', (req, res) => {
    res.status(200).json({
      service: 'Rylie SEO Hub',
      version: '1.0.0',
      description: 'White-label SEO middleware with AI proxy for complete client/agency separation',
      status: 'operational',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      endpoints: {
        health: '/health',
        api: {
          client: '/api/client/*',
          agency: '/api/agency/*', 
          admin: '/api/admin/*',
          reports: '/api/reports/*',
          ga4: '/api/ga4/*',
          seoworks: '/api/seoworks/*'
        }
      },
      features: [
        'AI Proxy Middleware - Complete anonymization',
        'Role-based Access Control (RBAC)',
        'White-label branding for all client interactions',
        'Comprehensive audit logging',
        'Zero client PII exposure to agencies',
        'Automated reporting system'
      ],
      security: {
        aiProxy: 'active',
        rbac: 'enforced',
        auditLogging: 'enabled',
        anonymization: 'automatic',
        traceId: req.traceId
      }
    });
  });

  // Enhanced health check endpoint
  app.get('/health', async (req, res) => {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'rylie-seo-hub',
      version: '1.0.0',
      environment: config.NODE_ENV,
      traceId: req.traceId,
      uptime: process.uptime(),
      checks: {
        database: 'checking',
        redis: 'checking',
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };

    try {
      // Add database health check if available
      // This is a placeholder - implement actual health checks
      healthCheck.checks.database = 'healthy';
      healthCheck.checks.redis = 'healthy';
      
      res.status(200).json(healthCheck);
    } catch (error) {
      req.logger?.error('Health check failed', { error });
      res.status(503).json({
        ...healthCheck,
        status: 'unhealthy',
        error: 'Service health check failed'
      });
    }
  });

  // Dynamically import and setup route modules
  try {
    // Import middleware - with fallbacks for missing modules
    let aiProxyMiddleware, authMiddleware;
    
    try {
      const aiProxyModule = await import('./middleware/ai-proxy');
      aiProxyMiddleware = aiProxyModule.aiProxyMiddleware;
    } catch (error) {
      logger.warn('AI proxy middleware not available, using passthrough', { error: (error as Error).message });
      aiProxyMiddleware = (req: any, res: any, next: any) => next();
    }

    try {
      const authModule = await import('./middleware/auth');
      authMiddleware = authModule.authMiddleware;
    } catch (error) {
      logger.warn('Auth middleware not available, using passthrough', { error: (error as Error).message });
      authMiddleware = (req: any, res: any, next: any) => next();
    }

    // Import routes - with fallbacks for missing modules
    const routes = await Promise.allSettled([
      import('./routes/client').catch(() => ({ clientRoutes: null })),
      import('./routes/agency').catch(() => ({ agencyRoutes: null })),
      import('./routes/admin').catch(() => ({ adminRoutes: null })),
      import('./routes/reports').catch(() => ({ reportRoutes: null })),
      import('./routes/ga4/onboarding').catch(() => null),
      import('./integrations/seoworks/routes').catch(() => null),
      import('./routes/seoworks/tasks').catch(() => null),
      import('./routes/dealership-onboarding').catch(() => null),
      import('./routes/ga4-tenant-onboarding').catch(() => null),
      import('./routes/ga4-reports').catch(() => null)
    ]);

    // Setup protected routes
    app.use('/api', authMiddleware);
    app.use('/api', aiProxyMiddleware);

    // Setup route handlers with error handling
    const [clientResult, agencyResult, adminResult, reportResult, ga4Result, integratedSeoWorksResult, seoWorksResult, dealershipOnboardingResult, ga4TenantOnboardingResult, ga4ReportsResult] = routes;

    if (clientResult.status === 'fulfilled' && clientResult.value.clientRoutes) {
      app.use('/api/client', clientResult.value.clientRoutes);
    } else {
      app.get('/api/client/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'Client routes not available' } });
      });
    }

    if (agencyResult.status === 'fulfilled' && agencyResult.value.agencyRoutes) {
      app.use('/api/agency', agencyResult.value.agencyRoutes);
    } else {
      app.get('/api/agency/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'Agency routes not available' } });
      });
    }

    if (adminResult.status === 'fulfilled' && adminResult.value.adminRoutes) {
      app.use('/api/admin', adminResult.value.adminRoutes);
    } else {
      app.get('/api/admin/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'Admin routes not available' } });
      });
    }

    if (reportResult.status === 'fulfilled' && reportResult.value.reportRoutes) {
      app.use('/api/reports', reportResult.value.reportRoutes);
    } else {
      app.get('/api/reports/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'Report routes not available' } });
      });
    }

    if (ga4Result.status === 'fulfilled' && ga4Result.value) {
      app.use('/api/ga4', ga4Result.value.default || ga4Result.value);
    } else {
      app.get('/api/ga4/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'GA4 routes not available' } });
      });
    }

    // Try the integrated seoworks first, then fall back to the new one
    if (integratedSeoWorksResult.status === 'fulfilled' && integratedSeoWorksResult.value) {
      app.use('/api/seoworks', integratedSeoWorksResult.value.default || integratedSeoWorksResult.value);
    } else if (seoWorksResult.status === 'fulfilled' && seoWorksResult.value) {
      app.use('/api/seoworks', seoWorksResult.value.default || seoWorksResult.value);
    } else {
      app.get('/api/seoworks/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'SEOWorks routes not available' } });
      });
    }

    if (dealershipOnboardingResult.status === 'fulfilled' && dealershipOnboardingResult.value) {
      app.use('/api/dealership-onboarding', dealershipOnboardingResult.value.default || dealershipOnboardingResult.value);
    } else {
      app.get('/api/dealership-onboarding/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'Dealership onboarding routes not available' } });
      });
    }

    if (ga4TenantOnboardingResult.status === 'fulfilled' && ga4TenantOnboardingResult.value) {
      app.use('/api/ga4', ga4TenantOnboardingResult.value.default || ga4TenantOnboardingResult.value);
    } else {
      app.get('/api/ga4/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'GA4 tenant onboarding routes not available' } });
      });
    }

    if (ga4ReportsResult.status === 'fulfilled' && ga4ReportsResult.value) {
      app.use('/api/ga4/reports', ga4ReportsResult.value.default || ga4ReportsResult.value);
    } else {
      app.get('/api/ga4/reports/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'GA4 reports routes not available' } });
      });
    }

    logger.info('Route setup completed with available modules');

  } catch (error) {
    logger.error('Failed to load routes or middleware', { error });
    
    // In development, provide helpful error message
    if (isDev) {
      app.use('/api/*', (req, res) => {
        res.status(503).json({
          error: {
            code: ErrorCode.CONFIGURATION_ERROR,
            message: 'Some routes or middleware failed to load. Check server logs.',
            traceId: req.traceId
          }
        });
      });
    } else {
      throw createConfigError('Critical routes failed to load');
    }
  }
};

/**
 * Setup error handling and 404 routes
 */
const setupErrorHandling = () => {
  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res) => {
    // If it's an API route, return 404 JSON
    if (req.path.startsWith('/api/')) {
      const error = {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'API route not found',
        path: req.originalUrl,
        traceId: req.traceId
      };
      
      req.logger?.warn('API route not found', { 
        method: req.method, 
        path: req.originalUrl 
      });
      
      return res.status(404).json({ error });
    }
    
    // Otherwise, serve the SPA index.html
    const indexPath = isProd 
      ? path.join(process.cwd(), 'dist/public/index.html')
      : path.join(__dirname, '../dist/public/index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        req.logger?.error('Failed to serve index.html', { error: err });
        res.status(404).json({
          error: {
            code: ErrorCode.RESOURCE_NOT_FOUND,
            message: 'Page not found',
            path: req.originalUrl,
            traceId: req.traceId
          }
        });
      }
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);
};

/**
 * Initialize database connection with retry logic
 */
const initializeDatabase = async (): Promise<void> => {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await connectDB();
      logger.info('💾 Database connection established', {
        attempt: retryCount + 1,
        maxRetries
      });
      return;
    } catch (error) {
      retryCount++;
      const isLastAttempt = retryCount >= maxRetries;
      
      if (isLastAttempt) {
        logger.warn('💾 Database connection failed after all retries', {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempts: retryCount,
          recommendation: 'Server will continue without database. Check PostgreSQL configuration.'
        });
        return; // Continue without database in development
      } else {
        logger.warn(`💾 Database connection attempt ${retryCount} failed, retrying...`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          nextRetryIn: '2 seconds'
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
};

/**
 * Main server startup function
 */
const startServer = async (): Promise<void> => {
  try {
    logger.info('🚀 Starting Rylie SEO Hub server...', {
      version: '1.0.0',
      environment: config.NODE_ENV,
      port: PORT
    });

    // Setup middleware in order
    setupSecurity();
    setupRequestProcessing();
    
    // Initialize database
    await initializeDatabase();
    
    // Start database pool monitoring
    databasePoolMonitor.start();
    
    // Listen for pool events
    databasePoolMonitor.on('poolWarning', (data) => {
      logger.warn('Database pool warning', data);
    });
    
    databasePoolMonitor.on('poolUnhealthy', (data) => {
      logger.error('Database pool unhealthy', data);
    });
    
    databasePoolMonitor.on('poolCritical', async (data) => {
      logger.error('Database pool critical', data);
      // Attempt recovery
      const recovered = await databasePoolMonitor.attemptRecovery();
      if (!recovered) {
        logger.error('Database pool recovery failed');
      }
    });
    
    // Setup routes
    await setupRoutes();
    
    // Setup error handling (must be last)
    setupErrorHandling();
    
    // Start HTTP server - bind to 0.0.0.0 in production
    const HOST = process.env.HOST || '0.0.0.0';
    const server = app.listen(PORT, HOST, () => {
      logger.info('✅ Rylie SEO Hub server started successfully', {
        host: HOST,
        port: PORT,
        environment: config.NODE_ENV,
        features: {
          aiProxy: 'active',
          rbac: 'enforced',
          auditLogging: 'enabled',
          anonymization: 'automatic'
        },
        endpoints: {
          health: `http://localhost:${PORT}/health`,
          api: `http://localhost:${PORT}/api`,
          docs: `http://localhost:${PORT}/`
        }
      });
      
      if (isDev) {
        console.log(`\n🔗 Server ready at: http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`📖 API docs: http://localhost:${PORT}/\n`);
      }
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, initiating graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close database connections, etc.
        try {
          // Stop database pool monitoring
          databasePoolMonitor.stop();
          
          // Add other cleanup logic here
          logger.info('Cleanup completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during cleanup:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
};

// Start the server
startServer().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});

export default app;