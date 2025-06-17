// Server with database integration
const http = require('http');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;

// Database client
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Connect to database on startup
db.connect().then(() => {
  console.log('✅ Connected to database');
}).catch(err => {
  console.error('❌ Database connection failed:', err.message);
});

// Helper to parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
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
  try {
    if (req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ 
        status: 'ok', 
        port: PORT,
        database: db._connected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      }));
      
    } else if (req.url === '/') {
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'Rylie SEO API with Database',
        port: PORT,
        endpoints: {
          health: '/health',
          chat: '/chat',
          ga4_properties: '/api/ga4/properties',
          seoworks_webhook: '/api/seoworks/webhook',
          seoworks_tasks: '/api/seoworks/tasks',
          dealership_onboard: '/api/dealerships/onboard'
        }
      }));
      
    } else if (req.url === '/api/ga4/properties' && req.method === 'GET') {
      // Get all GA4 properties from database
      const result = await db.query(
        'SELECT * FROM ga4_properties WHERE is_active = true ORDER BY created_at DESC'
      );
      
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'GA4 Properties',
        count: result.rows.length,
        properties: result.rows
      }));
      
    } else if (req.url === '/api/ga4/properties' && req.method === 'POST') {
      // Create new GA4 property
      const data = await parseBody(req);
      
      if (!data.property_id || !data.dealership_id) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
          error: 'Missing required fields: property_id, dealership_id' 
        }));
        return;
      }
      
      const result = await db.query(
        `INSERT INTO ga4_properties 
         (dealership_id, property_id, property_name, measurement_id, website_url) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [
          data.dealership_id,
          data.property_id,
          data.property_name || null,
          data.measurement_id || null,
          data.website_url || null
        ]
      );
      
      res.writeHead(201);
      res.end(JSON.stringify({ 
        message: 'GA4 Property created',
        property: result.rows[0]
      }));
      
    } else if (req.url === '/api/seoworks/webhook' && req.method === 'POST') {
      // Save webhook data to database
      const data = await parseBody(req);
      console.log('SEOWerks webhook received:', data);
      
      // Insert into database
      const result = await db.query(
        `INSERT INTO seoworks_tasks 
         (external_id, task_type, status, data, completion_date) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (external_id) 
         DO UPDATE SET 
           status = EXCLUDED.status,
           data = EXCLUDED.data,
           completion_date = EXCLUDED.completion_date,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          data.id || `webhook-${Date.now()}`,
          data.task_type || 'unknown',
          data.status || 'pending',
          JSON.stringify(data),
          data.completion_date || null
        ]
      );
      
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'Webhook processed and saved',
        task_id: result.rows[0].id,
        external_id: result.rows[0].external_id
      }));
      
    } else if (req.url === '/api/seoworks/tasks' && req.method === 'GET') {
      // Get all SEOWerks tasks
      const result = await db.query(
        'SELECT * FROM seoworks_tasks ORDER BY created_at DESC LIMIT 100'
      );
      
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'SEOWerks Tasks',
        count: result.rows.length,
        tasks: result.rows
      }));
      
    } else if (req.url === '/api/dealerships/onboard' && req.method === 'POST') {
      const data = await parseBody(req);
      
      // For now, just acknowledge - in future this would create dealership records
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'Dealership onboarding initiated',
        data: data,
        next_steps: [
          'Create dealership record',
          'Set up GA4 properties',
          'Configure SEO settings'
        ]
      }));
      
    } else if (req.url === '/chat') {
      // Serve chat interface
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
    
  } catch (error) {
    console.error('Error handling request:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message
    }));
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    db.end().then(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server with database running on port ${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Chat interface: http://0.0.0.0:${PORT}/chat`);
});