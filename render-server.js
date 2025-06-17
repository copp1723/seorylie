const express = require('express');
const app = express();

// CRITICAL: Use Render's PORT environment variable
const PORT = parseInt(process.env.PORT || '10000', 10);
const HOST = '0.0.0.0'; // MUST be 0.0.0.0 for Render

// Middleware
app.use(express.json());

// Health check endpoint - Render needs this
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    host: HOST
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Rylie SEO API - Render Deployment',
    status: 'running',
    port: PORT
  });
});

// GA4 endpoints
app.get('/api/ga4/properties', (req, res) => {
  res.json({ 
    message: 'GA4 Properties endpoint',
    status: 'ready'
  });
});

app.post('/api/ga4/properties', (req, res) => {
  res.json({ 
    message: 'GA4 Property created',
    data: req.body
  });
});

// SEOWerks endpoints
app.post('/api/seoworks/webhook', (req, res) => {
  console.log('SEOWerks webhook received:', req.body);
  res.json({ 
    message: 'Webhook received',
    status: 'processed'
  });
});

// Dealership endpoints
app.post('/api/dealerships/onboard', (req, res) => {
  res.json({ 
    message: 'Dealership onboarding',
    data: req.body
  });
});

// CRITICAL: Bind to 0.0.0.0 for Render
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`✅ Health check available at http://${HOST}:${PORT}/health`);
  console.log(`✅ Process ID: ${process.pid}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});