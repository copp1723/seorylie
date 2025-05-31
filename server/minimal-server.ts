#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import express from 'express';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Kunes RV Dealership Platform', 
    timestamp: new Date().toISOString(),
    status: 'running',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'available',
      api: 'running'
    }
  });
});

// Environment info endpoint
app.get('/api/env-status', (req, res) => {
  res.json({
    database: !!process.env.DATABASE_URL,
    openai: !!process.env.OPENAI_API_KEY,
    sendgrid: process.env.SENDGRID_API_KEY !== 'optional-for-now',
    jwt: !!process.env.JWT_SECRET,
    session: !!process.env.SESSION_SECRET
  });
});

// Kunes dealerships info endpoint
app.get('/api/kunes/status', (req, res) => {
  res.json({
    message: 'Kunes RV Setup Ready',
    locations: 11,
    scripts: {
      setup: 'npm run setup:kunes',
      dryrun: 'npm run setup:kunes:dryrun', 
      test: 'npm run test:kunes'
    },
    next_steps: [
      'Run setup:kunes to deploy dealerships',
      'Configure SendGrid API key for emails',
      'Set up Twilio for SMS (optional)',
      'Access admin dashboard for management'
    ]
  });
});

// Static files (if dist exists)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Simple SPA fallback
app.get('*', (req, res) => {
  res.json({
    message: 'Kunes RV Admin Dashboard',
    note: 'Frontend build required for full UI',
    api_endpoints: {
      health: '/api/health',
      environment: '/api/env-status', 
      kunes: '/api/kunes/status'
    }
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Kunes RV Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Environment: http://localhost:${PORT}/api/env-status`);
  console.log(`🏢 Kunes Status: http://localhost:${PORT}/api/kunes/status`);
});

export { app };