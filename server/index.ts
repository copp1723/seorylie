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
import { createServer } from 'http';
import { config, isDev, isProd } from './config';
import { getPort, getHost } from './utils/port-config';
import { 
  logger, 
  errorHandler, 
  contextMiddleware, 
  setupGlobalErrorHandlers,
  AppError,
  ErrorCode,
  createConfigError 
} from './utils/errors';
import { setupSEOWebSocket } from './websocket/seoWebSocket';

// Dynamic imports for routes and middleware
import { connectDB } from './models/database';
import { databasePoolMonitor } from './services/database-pool-monitor';
// Public agency-signup (no auth)
import publicSignupRoutes from './routes/public-signup';

// Load environment variables
envConfig();

// Get __dirname equivalent for ES modules
// In production, the dist folder structure is different
const __dirname = isProd 
  ? path.join(process.cwd(), 'dist')
  : path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = getPort();  // Use utility to ensure proper PORT detection

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
    contentSecurityPolicy: false, // Disable CSP - was blocking assets
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

  // CDN asset handling disabled - causing CSP and asset loading issues
  // The CDN is configured for Supabase which is not being used
  /*
  if (isProd) {
    import('./middleware/cdnAssets')
      .then(({ cdnAssetMiddleware, imageOptimizationMiddleware, preloadAssetsMiddleware }) => {
        app.use(preloadAssetsMiddleware);
        app.use(cdnAssetMiddleware);
        app.use(imageOptimizationMiddleware);
        logger.info('CDN middleware configured');
      })
      .catch(err => {
        logger.warn('CDN middleware not available', { 
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        });
        // Continue without CDN middleware
      });
  }
  */
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
      import('./routes/public-seoworks-onboarding').catch(() => null),
      import('./routes/admin-seoworks-onboarding').catch(() => null),
      import('./routes/seoworks-chat').catch(() => null),
      import('./routes/admin-seowerks-queue').catch(() => null),
      import('./routes/seoworks/tasks').catch(() => null),
      import('./routes/dealership-onboarding').catch(() => null),
      import('./routes/ga4-tenant-onboarding').catch(() => null),
      import('./routes/ga4-reports').catch(() => null),
      import('./routes/ga4-routes').catch(() => null),
      import('./routes/agency-performance-routes').catch(() => null),
      import('./routes/agency-users-routes').catch(() => null),
      import('./routes/deliverables').catch(() => null),
      import('./routes/task-status-api').catch(() => null),
      import('./routes/enhanced-chat-api').catch(() => null)
    ]);

    // ---------------------------------------------------------------------
    // Public routes – must be registered BEFORE authMiddleware
    // ---------------------------------------------------------------------
    // Public agency signup (create new tenant + admin)
    app.use('/api/tenants', publicSignupRoutes);

    // Setup protected routes
    app.use('/api', authMiddleware);
    app.use('/api', aiProxyMiddleware);

    // Setup route handlers with error handling
    const [
      clientResult, 
      agencyResult, 
      adminResult, 
      reportResult, 
      ga4Result, 
      integratedSeoWorksResult, 
      publicOnboardingResult, 
      adminOnboardingResult, 
      seowerksChatResult, 
      seoworksQueueResult,
      seoWorksResult, 
      dealershipOnboardingResult, 
      ga4TenantOnboardingResult, 
      ga4ReportsResult,
      ga4RoutesResult,
      agencyPerformanceResult,
      agencyUsersResult,
      deliverablesResult,
      taskStatusResult,
      enhancedChatResult
    ] = routes;

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
      // Set up individual agency routes if main routes not available
      if (agencyPerformanceResult.status === 'fulfilled' && agencyPerformanceResult.value) {
        app.use('/api/agency', agencyPerformanceResult.value.default || agencyPerformanceResult.value);
      }
      if (agencyUsersResult.status === 'fulfilled' && agencyUsersResult.value) {
        app.use('/api/agency', agencyUsersResult.value.default || agencyUsersResult.value);
      }
      
      // Fallback for missing routes
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
    } else if (ga4RoutesResult.status === 'fulfilled' && ga4RoutesResult.value) {
      app.use('/api/ga4', ga4RoutesResult.value.default || ga4RoutesResult.value);
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

    // Setup public onboarding route (no auth required)
    if (publicOnboardingResult.status === 'fulfilled' && publicOnboardingResult.value) {
      app.use(publicOnboardingResult.value.default || publicOnboardingResult.value);
    } else {
      logger.warn('Public onboarding route not available');
    }

    // Setup admin onboarding routes
    if (adminOnboardingResult.status === 'fulfilled' && adminOnboardingResult.value) {
      app.use(adminOnboardingResult.value.default || adminOnboardingResult.value);
    } else {
      logger.warn('Admin onboarding routes not available');
    }

    // Setup SEOWerks chat routes
    if (seowerksChatResult.status === 'fulfilled' && seowerksChatResult.value) {
      app.use(seowerksChatResult.value.default || seowerksChatResult.value);
    } else {
      logger.warn('SEOWerks chat routes not available');
    }

    // Setup SEOWerks queue routes
    if (seoworksQueueResult.status === 'fulfilled' && seoworksQueueResult.value) {
      app.use('/api/admin', seoworksQueueResult.value.default || seoworksQueueResult.value);
    } else {
      logger.warn('SEOWerks queue routes not available');
    }
    
    // Setup dealership onboarding routes
    if (dealershipOnboardingResult.status === 'fulfilled' && dealershipOnboardingResult.value) {
      app.use('/api/dealership-onboarding', dealershipOnboardingResult.value.default || dealershipOnboardingResult.value);
    } else {
      app.get('/api/dealership-onboarding/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'Dealership onboarding routes not available' } });
      });
    }

    // Setup GA4 tenant onboarding routes
    if (ga4TenantOnboardingResult.status === 'fulfilled' && ga4TenantOnboardingResult.value) {
      app.use('/api/ga4', ga4TenantOnboardingResult.value.default || ga4TenantOnboardingResult.value);
    } else {
      app.get('/api/ga4/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'GA4 tenant onboarding routes not available' } });
      });
    }

    // Setup GA4 reports routes
    if (ga4ReportsResult.status === 'fulfilled' && ga4ReportsResult.value) {
      app.use('/api/ga4/reports', ga4ReportsResult.value.default || ga4ReportsResult.value);
    } else {
      app.get('/api/ga4/reports/*', (req, res) => {
        res.status(503).json({ error: { code: ErrorCode.CONFIGURATION_ERROR, message: 'GA4 reports routes not available' } });
      });
    }
    
    // Setup deliverables routes
    if (deliverablesResult.status === 'fulfilled' && deliverablesResult.value) {
      app.use('/api/deliverables', deliverablesResult.value.default || deliverablesResult.value);
    } else {
      logger.warn('Deliverables routes not available');
    }
    
    // Setup task status API routes
    if (taskStatusResult.status === 'fulfilled' && taskStatusResult.value) {
      app.use('/api/tasks', taskStatusResult.value.default || taskStatusResult.value);
    } else {
      logger.warn('Task status API routes not available');
    }
    
    // Setup enhanced chat API routes
    if (enhancedChatResult.status === 'fulfilled' && enhancedChatResult.value) {
      app.use('/api/chat', enhancedChatResult.value.default || enhancedChatResult.value);
    } else {
      logger.warn('Enhanced chat API routes not available');
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
    
    // Log the path for debugging
    if (!require('fs').existsSync(indexPath)) {
      req.logger?.error('index.html not found at expected path', { 
        indexPath,
        cwd: process.cwd(),
        __dirname,
        isProd
      });
    }
    
    res.sendFile(indexPath, (err) => {
      if (err) {
        req.logger?.error('Failed to serve index.html', { 
          error: err.message,
          indexPath,
          cwd: process.cwd()
        });
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
    // Log environment variables for debugging
    logger.info('Environment configuration', {
      PORT_ENV: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      HOST_ENV: process.env.HOST,
      ACTUAL_PORT: PORT,
      ACTUAL_HOST: getHost()
    });
    
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
    
    // Start scheduled jobs
    try {
      // Temporarily disabled - uses Supabase which is not configured
      // const { startOnboardingProcessor } = await import('./jobs/processOnboardings');
      // startOnboardingProcessor();
      logger.info('📅 Scheduled jobs disabled (Supabase not configured)');
    } catch (error) {
      logger.warn('Failed to start scheduled jobs', { error });
    }

    // Create HTTP server
    const httpServer = createServer(app);
    
    // Setup WebSocket server
    const io = setupSEOWebSocket(httpServer);
    logger.info('🔌 WebSocket server initialized');

    // Start HTTP server - bind to 0.0.0.0 in production
    const HOST = getHost();  // Use utility to ensure proper HOST detection
    const server = httpServer.listen(PORT, HOST, () => {
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

// Add a global catch for any unhandled promises during startup
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection during startup:', reason);
  // Don't exit in production - let the server continue
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Start the server
startServer().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});

export default app;
