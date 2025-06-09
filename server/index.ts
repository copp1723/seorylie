/**
 * @file Main server entry point for Rylie SEO Hub
 * @description White-label SEO middleware with AI proxy for client-agency separation
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import winston from 'winston';
import { connectDB } from './models/database';

// Import our core middleware and routes
import { aiProxyMiddleware } from './middleware/ai-proxy';
import { authMiddleware } from './middleware/auth';
import { clientRoutes } from './routes/client';
import { agencyRoutes } from './routes/agency';
import { adminRoutes } from './routes/admin';
import { reportRoutes } from './routes/reports';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rylie-seo-hub' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(compression());
app.use(limiter);

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'rylie-seo-hub',
    version: '1.0.0'
  });
});

// Authentication middleware (for protected routes)
app.use('/api', authMiddleware);

// AI Proxy middleware - CRITICAL: All client/agency interactions must go through this
app.use('/api', aiProxyMiddleware);

// Route handlers
app.use('/api/client', clientRoutes);
app.use('/api/agency', agencyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server with optional database connection
const startServer = async () => {
  try {
    // Try to connect to database (optional for development)
    try {
      await connectDB();
      logger.info('💾 Database connection established');
    } catch (dbError) {
      logger.warn('💾 Database connection failed - running without database', {
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
      logger.info('🚑 For full functionality, please set up PostgreSQL and create the database');
    }
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀 Rylie SEO Hub server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔒 AI Proxy middleware active - ensuring client/agency separation`);
      logger.info(`🎯 Server operational - ready for client/agency interactions`);
      logger.info(`🔗 Test the API at: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;