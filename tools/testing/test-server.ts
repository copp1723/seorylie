#!/usr/bin/env tsx

import express from 'express';

const app = express();
const port = 3001; // Use different port to avoid conflicts

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Test server is running!' 
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'CleanRylie Test Server',
    health: '/health',
    admin: 'Frontend not available, API only'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Test server running on http://localhost:${port}`);
  console.log(`🔍 Health check: http://localhost:${port}/health`);
  console.log('✅ Server is responding and ready for testing');
});