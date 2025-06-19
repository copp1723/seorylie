// Production server with database integration and static file serving
const http = require('http');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const url = require('url');

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

// Helper function to get MIME type
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'font/eot'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  // Parse URL
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Set CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  // Route handling
  try {
    // API Routes
    if (pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        status: 'ok', 
        port: PORT,
        database: db._connected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      }));
      
    } else if (pathname === '/api') {
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'Rylie SEO API with Database',
        port: PORT,
        endpoints: {
          health: '/health',
          ga4_properties: '/api/ga4/properties',
          seoworks_webhook: '/api/seoworks/webhook',
          seoworks_tasks: '/api/seoworks/tasks',
          seoworks_weekly_rollup: '/api/seoworks/weekly-rollup',
          dealership_onboard: '/api/dealerships/onboard'
        }
      }));
      
    } else if (pathname === '/api/ga4/properties' && req.method === 'GET') {
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
      
    } else if (pathname === '/api/ga4/properties' && req.method === 'POST') {
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
      
    } else if (pathname === '/api/seoworks/webhook' && req.method === 'POST') {
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
      
    } else if (pathname === '/api/seoworks/tasks' && req.method === 'GET') {
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
      
    } else if (pathname === '/api/seoworks/weekly-rollup' && req.method === 'GET') {
      // Get weekly rollup of SEOWerks tasks
      const result = await db.query(`
        WITH weekly_stats AS (
          SELECT 
            DATE_TRUNC('week', created_at) as week_start,
            task_type,
            status,
            COUNT(*) as task_count,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
            COUNT(CASE WHEN completion_date IS NOT NULL THEN 1 END) as with_completion_date,
            AVG(
              CASE 
                WHEN completion_date IS NOT NULL AND created_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (completion_date - created_at))/3600 
              END
            ) as avg_completion_hours
          FROM seoworks_tasks
          WHERE created_at >= CURRENT_DATE - INTERVAL '4 weeks'
          GROUP BY DATE_TRUNC('week', created_at), task_type, status
        ),
        summary AS (
          SELECT 
            week_start,
            SUM(task_count) as total_tasks,
            SUM(completed_count) as total_completed,
            AVG(avg_completion_hours) as avg_completion_time
          FROM weekly_stats
          GROUP BY week_start
          ORDER BY week_start DESC
        )
        SELECT 
          to_char(week_start, 'YYYY-MM-DD') as week,
          total_tasks,
          total_completed,
          ROUND(avg_completion_time::numeric, 2) as avg_hours_to_complete,
          ROUND((total_completed::numeric / NULLIF(total_tasks, 0) * 100), 1) as completion_rate
        FROM summary
      `);
      
      // Get task type breakdown for current week
      const typeBreakdown = await db.query(`
        SELECT 
          task_type,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
        FROM seoworks_tasks
        WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
        GROUP BY task_type
        ORDER BY count DESC
      `);
      
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'SEOWerks Weekly Rollup',
        weekly_summary: result.rows,
        current_week_breakdown: typeBreakdown.rows,
        generated_at: new Date().toISOString()
      }));
      
    } else if (pathname === '/api/dealerships/onboard' && req.method === 'POST') {
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
      
    // Handle GA4 routes
    } else if (pathname === '/api/ga4/realtime' && req.method === 'GET') {
      // Mock realtime data for now
      res.writeHead(200);
      res.end(JSON.stringify({ 
        activeUsers: 42,
        usersByDevice: [
          { device: 'desktop', users: 24 },
          { device: 'mobile', users: 15 },
          { device: 'tablet', users: 3 }
        ],
        usersByCountry: [
          { country: 'United States', users: 35 },
          { country: 'Canada', users: 5 },
          { country: 'United Kingdom', users: 2 }
        ]
      }));
      
    } else if (pathname === '/api/ga4/geographic' && req.method === 'GET') {
      // Mock geographic data for now
      res.writeHead(200);
      res.end(JSON.stringify({ 
        data: [
          { country: 'United States', sessions: 1250, revenue: 15000 },
          { country: 'Canada', sessions: 320, revenue: 3800 },
          { country: 'United Kingdom', sessions: 180, revenue: 2100 }
        ]
      }));
      
    } else if (pathname === '/api/ga4/metrics' && req.method === 'GET') {
      // Mock metrics data for now
      res.writeHead(200);
      res.end(JSON.stringify({ 
        pageViews: 5234,
        sessions: 1876,
        users: 1432,
        bounceRate: 0.42,
        avgSessionDuration: 185,
        conversionRate: 0.032
      }));
      
    // Serve static files
    } else {
      // Try to serve static files from dist/public
      let filePath = path.join(__dirname, 'dist', 'public', pathname === '/' ? 'index.html' : pathname);
      
      // Security: prevent directory traversal
      if (!filePath.startsWith(path.join(__dirname, 'dist', 'public'))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      // Check if file exists
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          // If file not found and it's not an API route, serve index.html for client-side routing
          if (!pathname.startsWith('/api/') && !pathname.includes('.')) {
            filePath = path.join(__dirname, 'dist', 'public', 'index.html');
            fs.readFile(filePath, (err, data) => {
              if (err) {
                console.log('404 Error:', pathname);
                res.writeHead(404);
                res.end('Not found');
              } else {
                res.setHeader('Content-Type', 'text/html');
                res.writeHead(200);
                res.end(data);
              }
            });
          } else {
            console.log('404 Error:', pathname);
            res.writeHead(404);
            res.end('Not found');
          }
        } else {
          // Serve the file
          fs.readFile(filePath, (err, data) => {
            if (err) {
              console.error('Error reading file:', err);
              res.writeHead(500);
              res.end('Internal server error');
            } else {
              const mimeType = getMimeType(filePath);
              res.setHeader('Content-Type', mimeType);
              res.writeHead(200);
              res.end(data);
            }
          });
        }
      });
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
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ React app: http://0.0.0.0:${PORT}/`);
  console.log(`✅ Serving static files from: ${path.join(__dirname, 'dist', 'public')}`);
});