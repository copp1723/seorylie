import express from 'express';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Initialize GA4 client with service account
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: process.env.GA4_KEY_FILE_PATH || './server/config/ga4-service-account-key.json'
});

// Validation schemas
const addPropertySchema = z.object({
  property_id: z.string().regex(/^\d+$/),
  property_name: z.string().optional(),
  measurement_id: z.string().regex(/^G-[A-Z0-9]+$/).optional(),
  website_url: z.string().url().optional()
});

const testConnectionSchema = z.object({
  property_id: z.string().regex(/^\d+$/)
});

/**
 * Add a GA4 property for the current tenant
 * POST /api/ga4/properties
 */
router.post('/properties', async (req, res) => {
  try {
    const validation = addPropertySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.format()
      });
    }

    const { property_id, property_name, measurement_id, website_url } = validation.data;
    const dealershipId = req.session?.dealershipId || req.body.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    // Check if property already exists for this dealership
    const existing = await pool.query(
      'SELECT id FROM ga4_properties WHERE dealership_id = $1 AND property_id = $2',
      [dealershipId, property_id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Property already exists for this dealership' 
      });
    }

    // Insert new property
    const result = await pool.query(
      `INSERT INTO ga4_properties (
        dealership_id, property_id, property_name, measurement_id, 
        website_url, sync_status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *`,
      [dealershipId, property_id, property_name, measurement_id, website_url]
    );

    const property = result.rows[0];

    logger.info('GA4 property added', {
      dealershipId,
      propertyId: property_id
    });

    res.json({
      success: true,
      property,
      nextSteps: [
        'Grant viewer access to service account',
        'Test connection to verify access'
      ]
    });

  } catch (error) {
    logger.error('Error adding GA4 property', { error });
    res.status(500).json({ error: 'Failed to add property' });
  }
});

/**
 * Test connection to a GA4 property
 * POST /api/ga4/properties/test-connection
 */
router.post('/properties/test-connection', async (req, res) => {
  try {
    const validation = testConnectionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.format()
      });
    }

    const { property_id } = validation.data;
    const dealershipId = req.session?.dealershipId || req.body.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    // Verify property belongs to dealership
    const propertyCheck = await pool.query(
      'SELECT id FROM ga4_properties WHERE dealership_id = $1 AND property_id = $2',
      [dealershipId, property_id]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found for this dealership' });
    }

    // Test GA4 API connection
    try {
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${property_id}`,
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }]
      });

      // Connection successful - update status
      await pool.query(
        `UPDATE ga4_properties 
         SET sync_status = 'active', 
             access_granted_at = NOW(),
             last_sync_at = NOW(),
             last_error = NULL
         WHERE dealership_id = $1 AND property_id = $2`,
        [dealershipId, property_id]
      );

      res.json({
        success: true,
        message: 'Successfully connected to GA4 property',
        testData: {
          activeUsersToday: response.rows?.[0]?.metricValues?.[0]?.value || '0'
        }
      });

    } catch (gaError: any) {
      // Handle specific GA4 errors
      let errorMessage = 'Unknown error';
      let errorDetails = {};

      if (gaError.code === 7) {
        errorMessage = 'Permission denied. Please add the service account as a viewer.';
        errorDetails = {
          serviceAccountEmail: 'seo-ga4-service@onekeel-seo.iam.gserviceaccount.com',
          instructions: 'Go to GA4 Admin > Property Access Management > Add users'
        };
      } else if (gaError.code === 3) {
        errorMessage = 'Invalid property ID or configuration issue.';
      } else {
        errorMessage = gaError.message || 'Failed to connect to GA4';
      }

      // Update status with error
      await pool.query(
        `UPDATE ga4_properties 
         SET sync_status = 'error',
             last_error = $3
         WHERE dealership_id = $1 AND property_id = $2`,
        [dealershipId, property_id, errorMessage]
      );

      res.status(400).json({
        error: errorMessage,
        details: errorDetails,
        code: gaError.code
      });
    }

  } catch (error) {
    logger.error('Error testing GA4 connection', { error });
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

/**
 * List all GA4 properties for current tenant
 * GET /api/ga4/properties
 */
router.get('/properties', async (req, res) => {
  try {
    const dealershipId = req.session?.dealershipId || req.query.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    const result = await pool.query(
      `SELECT * FROM ga4_properties 
       WHERE dealership_id = $1 
       ORDER BY created_at DESC`,
      [dealershipId]
    );

    res.json({
      properties: result.rows,
      serviceAccount: {
        email: 'seo-ga4-service@onekeel-seo.iam.gserviceaccount.com',
        instructions: 'Add this email as a viewer to each GA4 property'
      }
    });

  } catch (error) {
    logger.error('Error listing GA4 properties', { error });
    res.status(500).json({ error: 'Failed to list properties' });
  }
});

/**
 * Update GA4 property status
 * PATCH /api/ga4/properties/:propertyId
 */
router.patch('/properties/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { is_active, property_name, measurement_id, website_url } = req.body;
    const dealershipId = req.session?.dealershipId || req.body.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (is_active !== undefined) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
    }

    if (property_name) {
      paramCount++;
      updates.push(`property_name = $${paramCount}`);
      values.push(property_name);
    }

    if (measurement_id) {
      paramCount++;
      updates.push(`measurement_id = $${paramCount}`);
      values.push(measurement_id);
    }

    if (website_url) {
      paramCount++;
      updates.push(`website_url = $${paramCount}`);
      values.push(website_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    paramCount++;
    updates.push(`updated_at = NOW()`);

    // Add WHERE clause params
    values.push(dealershipId, propertyId);

    const query = `
      UPDATE ga4_properties 
      SET ${updates.join(', ')}
      WHERE dealership_id = $${paramCount + 1} AND property_id = $${paramCount + 2}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({
      success: true,
      property: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating GA4 property', { error });
    res.status(500).json({ error: 'Failed to update property' });
  }
});

/**
 * Delete GA4 property
 * DELETE /api/ga4/properties/:propertyId
 */
router.delete('/properties/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const dealershipId = req.session?.dealershipId || req.body.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    const result = await pool.query(
      'DELETE FROM ga4_properties WHERE dealership_id = $1 AND property_id = $2 RETURNING id',
      [dealershipId, propertyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({
      success: true,
      message: 'Property removed successfully'
    });

  } catch (error) {
    logger.error('Error deleting GA4 property', { error });
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

/**
 * Get onboarding instructions
 * GET /api/ga4/onboarding-instructions
 */
router.get('/onboarding-instructions', async (req, res) => {
  res.json({
    instructions: {
      step1: {
        title: 'Find Your GA4 Property ID',
        steps: [
          'Go to Google Analytics (analytics.google.com)',
          'Click Admin (gear icon)',
          'Under Property column, click "Property Settings"',
          'Copy the Property ID (numbers only, e.g., 320759942)'
        ]
      },
      step2: {
        title: 'Grant Access to Service Account',
        steps: [
          'In Admin, click "Property Access Management"',
          'Click the "+" button to add users',
          'Enter email: seo-ga4-service@onekeel-seo.iam.gserviceaccount.com',
          'Set role to "Viewer"',
          'Click "Add"'
        ]
      },
      step3: {
        title: 'Add Property in Rylie SEO',
        steps: [
          'Enter your Property ID',
          'Optionally add Property Name and Measurement ID',
          'Click "Add Property"',
          'Click "Test Connection" to verify access'
        ]
      }
    },
    serviceAccountEmail: 'seo-ga4-service@onekeel-seo.iam.gserviceaccount.com',
    videoTutorial: 'https://support.google.com/analytics/answer/9304153'
  });
});

export default router;