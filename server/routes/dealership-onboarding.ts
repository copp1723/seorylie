import express from 'express';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { generateApiKey } from '../utils/auth.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Validation schemas
const createDealershipSchema = z.object({
  // Basic info
  name: z.string().min(1).max(255),
  subdomain: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/),
  
  // Contact info
  contact_email: z.string().email(),
  contact_phone: z.string().regex(/^\+?1?\d{10,14}$/),
  website_url: z.string().url().optional(),
  
  // Address
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.string().default('US')
  }),
  
  // Configuration
  timezone: z.string().default('America/New_York'),
  operation_mode: z.enum(['rylie_ai', 'direct_agent']).default('rylie_ai'),
  
  // Admin user
  admin: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().optional()
  }),
  
  // Optional integrations
  integrations: z.object({
    ga4_property_id: z.string().optional(),
    ga4_measurement_id: z.string().optional(),
    sendgrid_api_key: z.string().optional(),
    purecars_api_key: z.string().optional()
  }).optional()
});

// Check subdomain availability
router.post('/check-subdomain', async (req, res) => {
  try {
    const { subdomain } = req.body;
    
    if (!subdomain || !subdomain.match(/^[a-z0-9-]+$/)) {
      return res.status(400).json({
        available: false,
        error: 'Invalid subdomain format'
      });
    }
    
    const result = await pool.query(
      'SELECT id FROM dealerships WHERE subdomain = $1',
      [subdomain]
    );
    
    res.json({
      available: result.rows.length === 0,
      subdomain
    });
    
  } catch (error) {
    logger.error('Error checking subdomain', { error });
    res.status(500).json({
      error: 'Failed to check subdomain availability'
    });
  }
});

// Create new dealership with admin user
router.post('/create', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const validation = createDealershipSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.format()
      });
    }
    
    const data = validation.data;
    
    // Start transaction
    await client.query('BEGIN');
    
    // Check subdomain availability again
    const subdomainCheck = await client.query(
      'SELECT id FROM dealerships WHERE subdomain = $1',
      [data.subdomain]
    );
    
    if (subdomainCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Subdomain already taken'
      });
    }
    
    // Create dealership
    const dealershipResult = await client.query(
      `INSERT INTO dealerships (
        id, name, subdomain, contact_email, contact_phone, website_url,
        address, timezone, operation_mode, settings, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
      ) RETURNING *`,
      [
        uuidv4(),
        data.name,
        data.subdomain,
        data.contact_email,
        data.contact_phone,
        data.website_url || null,
        JSON.stringify(data.address),
        data.timezone,
        data.operation_mode,
        JSON.stringify({
          integrations: data.integrations || {},
          ai_config: {
            ai_personality: 'Professional and friendly automotive sales assistant',
            response_delay_ms: 1500,
            escalation_triggers: ['speak to human', 'talk to someone', 'real person']
          },
          agent_config: {
            enabled_channels: ['chat', 'sms', 'email'],
            auto_assignment: true,
            working_hours: {
              timezone: data.timezone,
              schedule: {
                monday: { start: '09:00', end: '17:00', enabled: true },
                tuesday: { start: '09:00', end: '17:00', enabled: true },
                wednesday: { start: '09:00', end: '17:00', enabled: true },
                thursday: { start: '09:00', end: '17:00', enabled: true },
                friday: { start: '09:00', end: '17:00', enabled: true },
                saturday: { start: '10:00', end: '16:00', enabled: true },
                sunday: { start: '00:00', end: '00:00', enabled: false }
              }
            }
          }
        })
      ]
    );
    
    const dealership = dealershipResult.rows[0];
    
    // Hash admin password
    const hashedPassword = await bcrypt.hash(data.admin.password, 10);
    
    // Create admin user
    const userResult = await client.query(
      `INSERT INTO users (
        id, email, password, first_name, last_name, phone,
        role, dealership_id, is_active, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, true, NOW()
      ) RETURNING id, email, first_name, last_name, role`,
      [
        uuidv4(),
        data.admin.email,
        hashedPassword,
        data.admin.first_name,
        data.admin.last_name,
        data.admin.phone || null,
        'admin',
        dealership.id
      ]
    );
    
    const adminUser = userResult.rows[0];
    
    // Generate API key
    const apiKey = generateApiKey();
    const hashedApiKey = await bcrypt.hash(apiKey, 10);
    
    await client.query(
      `INSERT INTO api_keys (
        id, dealership_id, key_hash, name, created_by, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW()
      )`,
      [
        uuidv4(),
        dealership.id,
        hashedApiKey,
        'Primary API Key',
        adminUser.id
      ]
    );
    
    // Create initial GA4 integration if provided
    if (data.integrations?.ga4_property_id) {
      await client.query(
        `INSERT INTO dealership_integrations (
          id, dealership_id, integration_type, config, is_active, created_at
        ) VALUES (
          $1, $2, 'ga4', $3, true, NOW()
        )`,
        [
          uuidv4(),
          dealership.id,
          JSON.stringify({
            property_id: data.integrations.ga4_property_id,
            measurement_id: data.integrations.ga4_measurement_id
          })
        ]
      );
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info('Dealership created successfully', {
      dealershipId: dealership.id,
      subdomain: dealership.subdomain
    });
    
    res.json({
      success: true,
      dealership: {
        id: dealership.id,
        name: dealership.name,
        subdomain: dealership.subdomain,
        url: `https://${dealership.subdomain}.seorylie.com`
      },
      admin: adminUser,
      apiKey: apiKey, // Only return this once!
      nextSteps: [
        'Configure DNS for subdomain',
        'Set up email integration',
        'Add inventory feed',
        'Configure chat widget'
      ]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating dealership', { error });
    res.status(500).json({
      error: 'Failed to create dealership',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Get onboarding progress
router.get('/progress/:dealershipId', async (req, res) => {
  try {
    const { dealershipId } = req.params;
    
    // Check various setup steps
    const checks = await Promise.all([
      // Basic setup
      pool.query('SELECT id, name, subdomain FROM dealerships WHERE id = $1', [dealershipId]),
      
      // Users
      pool.query('SELECT COUNT(*) as user_count FROM users WHERE dealership_id = $1', [dealershipId]),
      
      // API keys
      pool.query('SELECT COUNT(*) as api_key_count FROM api_keys WHERE dealership_id = $1', [dealershipId]),
      
      // Integrations
      pool.query(
        'SELECT integration_type FROM dealership_integrations WHERE dealership_id = $1 AND is_active = true',
        [dealershipId]
      ),
      
      // Chat widget customization
      pool.query(
        'SELECT settings->\'chat_widget\' as chat_widget FROM dealerships WHERE id = $1',
        [dealershipId]
      )
    ]);
    
    const dealership = checks[0].rows[0];
    if (!dealership) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    const userCount = parseInt(checks[1].rows[0].user_count);
    const apiKeyCount = parseInt(checks[2].rows[0].api_key_count);
    const integrations = checks[3].rows.map(r => r.integration_type);
    const hasChatWidget = !!checks[4].rows[0]?.chat_widget;
    
    const progress = {
      dealership: {
        id: dealership.id,
        name: dealership.name,
        subdomain: dealership.subdomain
      },
      steps: {
        basic_setup: true,
        admin_user: userCount > 0,
        api_key: apiKeyCount > 0,
        dns_configured: false, // Would need external check
        email_integration: integrations.includes('email'),
        ga4_integration: integrations.includes('ga4'),
        inventory_feed: integrations.includes('inventory'),
        chat_widget: hasChatWidget,
        test_conversation: false // Would need to check conversations table
      },
      completionPercentage: 0
    };
    
    // Calculate completion percentage
    const totalSteps = Object.keys(progress.steps).length;
    const completedSteps = Object.values(progress.steps).filter(v => v).length;
    progress.completionPercentage = Math.round((completedSteps / totalSteps) * 100);
    
    res.json(progress);
    
  } catch (error) {
    logger.error('Error getting onboarding progress', { error });
    res.status(500).json({
      error: 'Failed to get onboarding progress'
    });
  }
});

// Update dealership settings
router.patch('/settings/:dealershipId', async (req, res) => {
  try {
    const { dealershipId } = req.params;
    const updates = req.body;
    
    // Get current settings
    const result = await pool.query(
      'SELECT settings FROM dealerships WHERE id = $1',
      [dealershipId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    const currentSettings = result.rows[0].settings || {};
    const newSettings = { ...currentSettings, ...updates };
    
    // Update settings
    await pool.query(
      'UPDATE dealerships SET settings = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(newSettings), dealershipId]
    );
    
    res.json({
      success: true,
      settings: newSettings
    });
    
  } catch (error) {
    logger.error('Error updating dealership settings', { error });
    res.status(500).json({
      error: 'Failed to update settings'
    });
  }
});

// List all dealerships (admin only)
router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    let query = `
      SELECT 
        d.id, d.name, d.subdomain, d.contact_email, 
        d.operation_mode, d.created_at,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT c.id) as conversation_count
      FROM dealerships d
      LEFT JOIN users u ON u.dealership_id = d.id
      LEFT JOIN conversations c ON c.dealership_id = d.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (d.name ILIKE $${params.length} OR d.subdomain ILIKE $${params.length})`;
    }
    
    query += `
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM dealerships WHERE 1=1';
    const countParams: any[] = [];
    
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (name ILIKE $${countParams.length} OR subdomain ILIKE $${countParams.length})`;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      dealerships: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
    
  } catch (error) {
    logger.error('Error listing dealerships', { error });
    res.status(500).json({
      error: 'Failed to list dealerships'
    });
  }
});

export default router;