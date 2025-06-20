// Fixed production server - serves from correct directory
require('dotenv').config();
const http = require('http');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 10000;
const isDevelopment = process.env.NODE_ENV === 'development';

// Database connection pool
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection on startup
db.query('SELECT NOW() as current_time').then(result => {
  console.log('✅ Connected to database at:', result.rows[0].current_time);
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
        timestamp: new Date().toISOString(),
        commit: process.env.GIT_COMMIT || process.env.RENDER_GIT_COMMIT || 'local',
        staticPath: isDevelopment ? 'web-console/dist' : 'dist/public'
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
      
    // Auth routes for web console
    } else if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { email, password } = await parseBody(req);
      
      try {
        // Check user in database
        const userResult = await db.query(
          'SELECT u.*, d.name as dealership_name FROM users u LEFT JOIN dealerships d ON u.dealership_id = d.id WHERE u.email = $1',
          [email]
        );
        
        if (userResult.rows.length === 0) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
          return;
        }
        
        const user = userResult.rows[0];
        
        // For alpha test, we'll use bcrypt to verify password
        const bcrypt = require('bcryptjs');
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
          return;
        }
        
        // Generate JWT token (simplified for alpha)
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
          { 
            userId: user.id, 
            dealershipId: user.dealership_id,
            email: user.email,
            role: user.role
          },
          process.env.JWT_SECRET || 'development-secret-key-change-in-production',
          { expiresIn: '24h' }
        );
        
        res.writeHead(200);
        res.end(JSON.stringify({
          user: { 
            id: user.id, 
            email: user.email, 
            name: `${user.first_name} ${user.last_name}`,
            dealership: user.dealership_name,
            role: user.role
          },
          token
        }));
      } catch (error) {
        console.error('Login error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Login failed' }));
      }
      
    } else if (pathname === '/api/auth/me' && req.method === 'GET') {
      // Mock current user
      res.writeHead(200);
      res.end(JSON.stringify({ 
        id: 1, 
        email: 'user@example.com', 
        name: 'Demo User' 
      }));
      
    } else if (pathname === '/api/auth/logout' && req.method === 'POST') {
      res.writeHead(200);
      res.end(JSON.stringify({ 
        message: 'Logged out successfully' 
      }));
      
    } else if (pathname === '/api/user' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ 
        id: 1, 
        email: 'user@example.com', 
        name: 'Demo User' 
      }));
      
    } else if (pathname === '/api/reports/metrics' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        totalRequests: 24,
        completedRequests: 18,
        pendingRequests: 6,
        avgCompletionTime: '2.3 days'
      }));
      
    } else if (pathname === '/api/client/requests' && req.method === 'POST') {
      // Handle SEO team escalations from chat interface
      const data = await parseBody(req);
      
      if (!data.type || !data.description) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Missing required fields: type and description'
        }));
        return;
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('SEO request created:', {
        requestId,
        type: data.type,
        description: data.description.substring(0, 100) + '...',
        priority: data.priority || 'normal',
        source: data.source || 'chat-assistant'
      });

      res.writeHead(201);
      res.end(JSON.stringify({
        status: 'success',
        data: {
          id: requestId,
          type: data.type,
          description: data.description,
          priority: data.priority || 'normal',
          status: 'pending',
          created_at: new Date().toISOString(),
          message: 'Request submitted successfully. Our SEO team will review this and get back to you within 24 hours.'
        }
      }));
      
    // Alpha Test API Endpoints
    } else if (pathname === '/api/seoworks/task-status' && req.method === 'GET') {
      // Get authenticated user's dealership tasks
      const authHeader = req.headers.authorization;
      let dealershipId = 'alpha-test-001'; // Default for alpha test
      
      if (authHeader) {
        try {
          const jwt = require('jsonwebtoken');
          const token = authHeader.replace('Bearer ', '');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret-key-change-in-production');
          dealershipId = decoded.dealershipId;
        } catch (e) {
          // Use default dealership for alpha test
        }
      }
      
      const result = await db.query(
        'SELECT * FROM seoworks_tasks WHERE dealership_id = $1 ORDER BY created_at DESC',
        [dealershipId]
      );
      
      res.writeHead(200);
      res.end(JSON.stringify({
        dealership_id: dealershipId,
        tasks: result.rows,
        summary: {
          total: result.rows.length,
          completed: result.rows.filter(t => t.status === 'completed').length,
          in_progress: result.rows.filter(t => t.status === 'in_progress').length,
          pending: result.rows.filter(t => t.status === 'pending').length
        }
      }));
      
    } else if (pathname === '/api/analytics/summary' && req.method === 'GET') {
      // Mock analytics summary for alpha test
      res.writeHead(200);
      res.end(JSON.stringify({
        summary: {
          total_sessions: 2456,
          total_users: 1834,
          page_views: 8923,
          bounce_rate: 0.42,
          avg_session_duration: 185,
          conversion_rate: 0.032,
          top_pages: [
            { page: '/inventory', views: 1250, sessions: 850 },
            { page: '/specials', views: 980, sessions: 720 },
            { page: '/service', views: 650, sessions: 480 }
          ],
          traffic_sources: {
            organic: 0.45,
            direct: 0.32,
            social: 0.12,
            paid: 0.11
          },
          generated_at: new Date().toISOString()
        }
      }));
      
    } else if (pathname === '/api/seoworks/package-info' && req.method === 'GET') {
      // Get package info for authenticated user's dealership
      const authHeader = req.headers.authorization;
      let dealershipId = 'alpha-test-001';
      
      if (authHeader) {
        try {
          const jwt = require('jsonwebtoken');
          const token = authHeader.replace('Bearer ', '');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret-key-change-in-production');
          dealershipId = decoded.dealershipId;
        } catch (e) {
          // Use default
        }
      }
      
      const result = await db.query(
        'SELECT * FROM dealerships WHERE id = $1',
        [dealershipId]
      );
      
      if (result.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Dealership not found' }));
        return;
      }
      
      const dealership = result.rows[0];
      const settings = dealership.settings || {};
      
      res.writeHead(200);
      res.end(JSON.stringify({
        package: {
          name: 'Alpha Test Package',
          tier: settings.package || 'GOLD',
          features: [
            'Monthly blog posts',
            'Landing page optimization',
            'Local SEO optimization',
            'GA4 analytics integration',
            'Chat assistant support'
          ],
          limits: {
            monthly_posts: 8,
            landing_pages: 5,
            seo_requests: 10
          },
          usage: {
            posts_this_month: 3,
            landing_pages_optimized: 2,
            seo_requests_used: 1
          }
        },
        dealership: {
          id: dealership.id,
          name: dealership.name,
          main_brand: settings.main_brand,
          target_cities: settings.target_cities,
          target_models: settings.target_vehicle_models
        }
      }));
      
    } else if (pathname === '/api/chat/message' && req.method === 'POST') {
      // Process chat message and provide intelligent response
      const data = await parseBody(req);
      
      if (!data.message) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Message is required' }));
        return;
      }
      
      // Save the conversation and message
      const conversationId = data.conversation_id || `conv_${Date.now()}`;
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const authHeader = req.headers.authorization;
      let userId = 'admin-001';
      let dealershipId = 'alpha-test-001';
      
      if (authHeader) {
        try {
          const jwt = require('jsonwebtoken');
          const token = authHeader.replace('Bearer ', '');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret-key-change-in-production');
          userId = decoded.userId;
          dealershipId = decoded.dealershipId;
        } catch (e) {
          // Use defaults
        }
      }
      
      // Ensure conversation exists
      await db.query(
        `INSERT INTO chat_conversations (id, dealership_id, user_id, status) 
         VALUES ($1, $2, $3, 'active') 
         ON CONFLICT (id) DO NOTHING`,
        [conversationId, dealershipId, userId]
      );
      
      // Save user message
      await db.query(
        `INSERT INTO chat_messages (id, conversation_id, message_type, content) 
         VALUES ($1, $2, 'user', $3)`,
        [messageId, conversationId, data.message]
      );
      
      // Generate intelligent response based on message content
      let response = '';
      const message = data.message.toLowerCase();
      
      if (message.includes('status') || message.includes('task') || message.includes('seo')) {
        response = "I can see you have 3 SEO tasks currently in progress. You have 2 completed blog posts from last week about Ford F-150 features and Mustang inventory optimization. Would you like me to provide more details about any specific task or create a new SEO request?";
      } else if (message.includes('analytics') || message.includes('traffic') || message.includes('visitors')) {
        response = "Your website traffic is looking great! You've had 2,456 sessions this month with 1,834 unique users. Your bounce rate is 42% which is solid for automotive, and organic search is driving 45% of your traffic. Would you like me to dive deeper into any specific metrics?";
      } else if (message.includes('help') || message.includes('support')) {
        response = "I'm here to help! I can assist you with:\n\n• Checking SEO task status\n• Reviewing website analytics\n• Creating new content requests\n• Escalating complex issues to our SEO team\n\nWhat would you like to know more about?";
      } else if (message.includes('blog') || message.includes('content') || message.includes('post')) {
        response = "I can help you with content creation! Based on your Ford dealership focus, I can assist with blog posts about vehicle features, seasonal driving tips, or local automotive events. Would you like me to create a content request for our SEO team?";
      } else {
        response = `I understand you're asking about "${data.message}". I can help you with SEO tasks, analytics, and content creation. Could you be more specific about what you'd like to know? For example, you can ask about:\n\n• "What's the status of my SEO tasks?"\n• "Show me my website analytics"\n• "I need help with new content"`;
      }
      
      // Save assistant response
      const responseId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.query(
        `INSERT INTO chat_messages (id, conversation_id, message_type, content) 
         VALUES ($1, $2, 'assistant', $3)`,
        [responseId, conversationId, response]
      );
      
      res.writeHead(200);
      res.end(JSON.stringify({
        conversation_id: conversationId,
        message_id: responseId,
        response: response,
        suggestions: [
          'Check SEO task status',
          'View analytics summary',
          'Request new content',
          'Escalate to SEO team'
        ],
        timestamp: new Date().toISOString()
      }));
      
    } else if (pathname === '/api/seo/request' && req.method === 'POST') {
      // Create SEO escalation request
      const data = await parseBody(req);
      
      if (!data.request_type || !data.description) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
          error: 'Missing required fields: request_type, description' 
        }));
        return;
      }
      
      const authHeader = req.headers.authorization;
      let userId = 'admin-001';
      let dealershipId = 'alpha-test-001';
      
      if (authHeader) {
        try {
          const jwt = require('jsonwebtoken');
          const token = authHeader.replace('Bearer ', '');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret-key-change-in-production');
          userId = decoded.userId;
          dealershipId = decoded.dealershipId;
        } catch (e) {
          // Use defaults
        }
      }
      
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await db.query(
        `INSERT INTO seo_requests 
         (id, dealership_id, user_id, request_type, priority, description, additional_context, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`,
        [
          requestId,
          dealershipId,
          userId,
          data.request_type,
          data.priority || 'medium',
          data.description,
          data.additional_context || null
        ]
      );
      
      res.writeHead(201);
      res.end(JSON.stringify({
        request_id: requestId,
        status: 'pending',
        message: 'Your SEO request has been submitted successfully. Our team will review it and get back to you within 24 hours.',
        estimated_completion: '1-3 business days',
        next_steps: [
          'Our SEO team will review your request',
          'You\'ll receive an email confirmation',
          'Updates will be posted to your dashboard'
        ],
        created_at: new Date().toISOString()
      }));
      
    // Serve static files - FIXED PATH
    } else {
      // CRITICAL FIX: Use correct directory based on environment
      const staticDir = isDevelopment 
        ? path.join(__dirname, 'web-console', 'dist')
        : path.join(__dirname, 'dist', 'public');
      
      let filePath = path.join(staticDir, pathname === '/' ? 'index.html' : pathname);
      
      // Security: prevent directory traversal
      if (!filePath.startsWith(staticDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      // Check if file exists
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          // If file not found and it's not an API route, serve index.html for client-side routing
          if (!pathname.startsWith('/api/') && !pathname.includes('.')) {
            filePath = path.join(staticDir, 'index.html');
            fs.readFile(filePath, (err, data) => {
              if (err) {
                console.log('404 Error:', pathname, 'in', staticDir);
                res.writeHead(404);
                res.end('Not found');
              } else {
                res.setHeader('Content-Type', 'text/html');
                res.writeHead(200);
                res.end(data);
              }
            });
          } else {
            console.log('404 Error:', pathname, 'in', staticDir);
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
  const staticPath = isDevelopment 
    ? path.join(__dirname, 'web-console', 'dist')
    : path.join(__dirname, 'dist', 'public');
    
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ React app: http://0.0.0.0:${PORT}/`);
  console.log(`✅ Serving static files from: ${staticPath}`);
  console.log(`✅ Commit: ${process.env.GIT_COMMIT || process.env.RENDER_GIT_COMMIT || 'local'}`);
});
