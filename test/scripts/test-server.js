#!/usr/bin/env node

const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  res.json({ 
    message: 'Test Server Running!', 
    timestamp: new Date().toISOString() 
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
});