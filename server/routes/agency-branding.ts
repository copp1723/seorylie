import express from 'express';
import { pool } from '../config/database'; // Using Render PostgreSQL connection pool
import { logger } from '../utils/errors';
import { authenticateRequest } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/agency/branding/:agencyId
 * Get branding for a specific agency
 */
router.get('/branding/:agencyId', authenticateRequest, async (req, res) => {
  try {
    const { agencyId } = req.params;
    const userId = req.user.id;
    
    // Check if user has access to this agency
    const accessQuery = `
      SELECT agency_id 
      FROM user_agencies 
      WHERE user_id = $1 AND agency_id = $2
    `;
    const accessResult = await pool.query(accessQuery, [userId, agencyId]);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this agency' });
    }

    // Fetch branding data
    const brandingQuery = `
      SELECT * FROM agency_branding 
      WHERE agency_id = $1
    `;
    const brandingResult = await pool.query(brandingQuery, [agencyId]);

    if (brandingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Branding not found' });
    }

    const branding = brandingResult.rows[0];

    // Add cache headers for performance
    res.set({
      'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      'ETag': `"${Date.parse(branding.updated_at || branding.created_at)}"`,
    });

    res.json(branding);
  } catch (error) {
    logger.error('Agency branding fetch error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/agency/branding/subdomain/:subdomain
 * Get branding by subdomain (public endpoint for white-label detection)
 */
router.get('/branding/subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;

    const query = `
      SELECT * FROM agency_branding 
      WHERE subdomain = $1
    `;
    const result = await pool.query(query, [subdomain]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branding not found' });
    }

    const branding = result.rows[0];

    // Add aggressive caching for public branding
    res.set({
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'ETag': `"${Date.parse(branding.updated_at || branding.created_at)}"`,
    });

    res.json(branding);
  } catch (error) {
    logger.error('Subdomain branding fetch error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/agency/branding/:agencyId
 * Update agency branding
 */
router.put('/branding/:agencyId', authenticateRequest, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { agencyId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Verify user has admin access to agency
    const accessQuery = `
      SELECT role FROM user_agencies 
      WHERE user_id = $1 AND agency_id = $2
    `;
    const accessResult = await client.query(accessQuery, [userId, agencyId]);

    if (accessResult.rows.length === 0 || !['owner', 'admin'].includes(accessResult.rows[0].role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Validate color formats
    const colorFields = ['primary_color', 'secondary_color', 'accent_color'];
    for (const field of colorFields) {
      if (updates[field] && !/^#[0-9A-F]{6}$/i.test(updates[field])) {
        return res.status(400).json({ error: `Invalid color format for ${field}` });
      }
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (key !== 'agency_id' && key !== 'created_at') { // Exclude non-updatable fields
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    // Add updated_at
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date().toISOString());
    paramCount++;

    // Add agency_id for WHERE clause
    values.push(agencyId);

    const updateQuery = `
      UPDATE agency_branding 
      SET ${updateFields.join(', ')}
      WHERE agency_id = $${paramCount}
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branding not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Agency branding update error', { error });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/agency/branding/:agencyId/logo
 * Upload agency logo
 */
router.post('/branding/:agencyId/logo', authenticateRequest, async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { file } = req.body; // Base64 encoded file
    const userId = req.user.id;

    // Verify admin access
    const accessQuery = `
      SELECT role FROM user_agencies 
      WHERE user_id = $1 AND agency_id = $2
    `;
    const accessResult = await pool.query(accessQuery, [userId, agencyId]);

    if (accessResult.rows.length === 0 || !['owner', 'admin'].includes(accessResult.rows[0].role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // In production, upload to S3 or cloud storage
    // For now, return a mock URL
    const logoUrl = `/assets/agencies/${agencyId}/logo.png`;

    // Update branding with new logo URL
    const updateQuery = `
      UPDATE agency_branding 
      SET logo_url = $1, updated_at = $2
      WHERE agency_id = $3
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [
      logoUrl,
      new Date().toISOString(),
      agencyId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branding not found' });
    }

    res.json({ logoUrl, branding: result.rows[0] });
  } catch (error) {
    logger.error('Agency logo upload error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/agency/:agencyId/preview
 * Get a preview of the agency's branding applied
 */
router.get('/:agencyId/preview', authenticateRequest, async (req, res) => {
  try {
    const { agencyId } = req.params;

    // Generate preview HTML with branding applied
    const query = `
      SELECT * FROM agency_branding 
      WHERE agency_id = $1
    `;
    const result = await pool.query(query, [agencyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branding not found' });
    }

    const branding = result.rows[0];

    const previewHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>${branding.company_name} - Preview</title>
  <style>
    :root {
      --brand-primary: ${branding.primary_color};
      --brand-secondary: ${branding.secondary_color};
      --brand-accent: ${branding.accent_color || '#10b981'};
      --brand-font: ${branding.font_family};
    }
    body {
      font-family: var(--brand-font), sans-serif;
      margin: 0;
      padding: 20px;
      background-color: ${branding.theme === 'dark' ? '#1a1a1a' : '#ffffff'};
      color: ${branding.theme === 'dark' ? '#ffffff' : '#000000'};
    }
    .header {
      background-color: var(--brand-primary);
      color: white;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    .logo {
      max-height: 60px;
      margin-bottom: 10px;
    }
    .content {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: ${branding.theme === 'dark' ? '#2a2a2a' : '#f5f5f5'};
      border-radius: 8px;
    }
    .button {
      background-color: var(--brand-secondary);
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin: 5px;
    }
    .accent {
      color: var(--brand-accent);
    }
    ${branding.custom_css || ''}
  </style>
</head>
<body>
  <div class="header">
    ${branding.logo_url ? `<img src="${branding.logo_url}" alt="${branding.company_name}" class="logo" />` : ''}
    <h1>${branding.company_name}</h1>
    ${branding.tagline ? `<p>${branding.tagline}</p>` : ''}
  </div>
  <div class="content">
    <h2>Welcome to Your SEO Dashboard</h2>
    <p>This is a preview of how your white-labeled platform will look.</p>
    <div>
      <button class="button">Primary Action</button>
      <button class="button" style="background-color: var(--brand-accent)">Secondary Action</button>
    </div>
    <p class="accent">Accent color text example</p>
    <p>Support: ${branding.support_email || 'support@example.com'} | ${branding.support_phone || '1-800-SEO-HELP'}</p>
  </div>
</body>
</html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(previewHtml);
  } catch (error) {
    logger.error('Agency preview error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/agency/performance/stats
 * Get performance statistics for branding cache
 */
router.get('/performance/stats', authenticateRequest, async (req, res) => {
  try {
    // In production, these would come from a performance monitoring service
    const stats = {
      cacheHitRate: 0.85,
      avgLoadTime: 45, // milliseconds
      brandingRequests: {
        total: 10000,
        cached: 8500,
        fresh: 1500
      },
      lastUpdated: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    logger.error('Performance stats error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as agencyBrandingRoutes };
export default router;
