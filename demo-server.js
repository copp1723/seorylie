#!/usr/bin/env node

/**
 * Ultra-simple demo server in CommonJS
 * No module conflicts, minimal dependencies
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static('dist'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: 'demo'
  });
});

// API status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'operational',
    version: '1.0.0',
    services: {
      frontend: 'serving',
      api: 'ready'
    }
  });
});

// Serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎉 Demo Server Running!\n');
  console.log(`📍 Local:    http://localhost:${PORT}`);
  console.log(`📍 Network:  http://0.0.0.0:${PORT}`);
  console.log(`📍 Health:   http://localhost:${PORT}/health\n`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Error:', error);
});