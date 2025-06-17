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
    res.writeHead(200);
    res.end(JSON.stringify({ 
      message: 'Rylie SEO API',
      port: PORT,
      endpoints: {
        health: '/health',
        ga4_properties: '/api/ga4/properties',
        seoworks_webhook: '/api/seoworks/webhook',
        dealership_onboard: '/api/dealerships/onboard'
      }
    }));
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