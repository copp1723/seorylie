// Minimal server for Render deployment with API endpoints
const http = require('http');

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Route handling
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'ok', 
      port: PORT,
      timestamp: new Date().toISOString()
    }));
  } else if (req.url === '/') {
    // Simple landing page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rylie SEO</title>
        <style>
          body { font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          h1 { color: #3b82f6; }
          .links { margin-top: 30px; }
          .links a { 
            display: inline-block; 
            margin: 10px; 
            padding: 15px 30px; 
            background: #3b82f6; 
            color: white; 
            text-decoration: none; 
            border-radius: 8px;
          }
          .links a:hover { background: #2563eb; }
        </style>
      </head>
      <body>
        <h1>🚀 Welcome to Rylie SEO</h1>
        <p>Your AI-powered SEO assistant and project management platform.</p>
        <div class="links">
          <a href="/chat">Chat Assistant</a>
          <a href="/dashboard">Admin Dashboard</a>
          <a href="/api">API Documentation</a>
        </div>
      </body>
      </html>
    `);
  } else if (req.url === '/api/ga4/properties' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      message: 'GA4 Properties endpoint ready',
      properties: []
    }));
  } else if (req.url === '/api/ga4/properties' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'GA4 Property created',
        data: JSON.parse(body || '{}')
      }));
    });
  } else if (req.url === '/api/seoworks/webhook' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('SEOWerks webhook received:', body);
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'Webhook received',
        status: 'processed'
      }));
    });
  } else if (req.url === '/api/dealerships/onboard' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'Dealership onboarding initiated',
        data: JSON.parse(body || '{}')
      }));
    });
  } else if (req.url === '/chat') {
    // Serve the chat interface
    const fs = require('fs');
    const path = require('path');
    fs.readFile(path.join(__dirname, 'chat.html'), 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading chat interface');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ 
      error: 'Not found',
      path: req.url
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
});