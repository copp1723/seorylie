/**
 * Main Routes Configuration
 *
 * This file contains the main API routes for the CleanRylie application
 */

import { Router } from 'express';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'cleanrylie-api'
  });
});

// API status endpoint
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Placeholder for future routes
router.get('/', (req, res) => {
  res.json({
    message: 'CleanRylie API',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/status'
    ]
  });
});

export default router;
