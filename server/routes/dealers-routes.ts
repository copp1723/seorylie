import { Router } from 'express';
import { requireRole } from '../utils/permissions';
import { tenants, users } from '../models/schema';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql } from 'drizzle-orm';
import logger from '../utils/logger';

interface JWTPayload {
  userId: string;
  tenantId: string;
  role: 'super' | 'agency' | 'dealer';
}

interface CreateDealerBody {
  name: string;
  email: string;
  contactName?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  parentAgencyId?: string; // only needed for super admins
  brand?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
}

const router = Router();

/**
 * GET /api/dealers
 * List all dealers under the authenticated agency
 */
router.get('/', requireRole(['agency', 'super']), async (req, res) => {
  try {
    const auth = req.user as JWTPayload;
    
    // Build query based on role
    let query;
    if (auth.role === 'super') {
      // Super admins can see all dealers, optionally filtered by agency
      const agencyId = req.query.agencyId as string;
      query = agencyId 
        ? db.select().from(tenants).where(eq(tenants.parentId, agencyId))
        : db.select().from(tenants).where(sql`${tenants.parentId} IS NOT NULL`);
    } else {
      // Agency admins can only see their dealers
      query = db.select().from(tenants).where(eq(tenants.parentId, auth.tenantId));
    }

    const dealers = await query;
    
    res.json({
      success: true,
      data: dealers
    });
  } catch (err) {
    logger.error('Failed to fetch dealers', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dealers' });
  }
});

/**
 * GET /api/dealers/:id
 * Get a specific dealer by ID
 */
router.get('/:id', requireRole(['agency', 'super']), async (req, res) => {
  try {
    const { id } = req.params;
    const auth = req.user as JWTPayload;
    
    // Build query based on role
    let query;
    if (auth.role === 'super') {
      query = db.select().from(tenants).where(eq(tenants.id, id));
    } else {
      // Agency admins can only see their dealers
      query = db.select().from(tenants).where(
        and(
          eq(tenants.id, id),
          eq(tenants.parentId, auth.tenantId)
        )
      );
    }

    const dealer = await query.limit(1);
    
    if (!dealer.length) {
      return res.status(404).json({ success: false, error: 'Dealer not found' });
    }
    
    res.json({
      success: true,
      data: dealer[0]
    });
  } catch (err) {
    logger.error('Failed to fetch dealer', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dealer' });
  }
});

/**
 * POST /api/dealers
 * Agency admins create a new dealer tenant beneath their agency.
 * Body: { name: string; email: string; contactName?: string, ... }
 */
router.post('/', requireRole(['agency', 'super']), async (req, res) => {
  try {
    const body = req.body as CreateDealerBody;
    const { name, email } = body;
    
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'name and email required' 
      });
    }

    const auth = req.user as JWTPayload;
    const parentAgencyId = auth.role === 'agency' 
      ? auth.tenantId 
      : body.parentAgencyId || null;

    if (!parentAgencyId) {
      return res.status(400).json({ 
        success: false, 
        error: 'parentAgencyId required for super role' 
      });
    }

    // ensure agency exists
    const agencyRow = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, parentAgencyId))
      .limit(1);

    if (!agencyRow.length) {
      return res.status(404).json({ 
        success: false, 
        error: 'parent agency not found' 
      });
    }

    // create dealer tenant
    const dealerId = uuidv4();
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Prepare brand data
    const brand = {
      ...body.brand || {},
      name: name // Store name in brand for white-labeling
    };
    
    await db.insert(tenants).values({
      id: dealerId,
      name,
      slug,
      parentId: parentAgencyId,
      brand,
    });

    // create dealer admin user (role dealer)
    const [dealerUser] = await db
      .insert(users)
      .values({
        email,
        name: body.contactName || name,
        role: 'dealer',
        tenantId: dealerId,
        isActive: true,
      })
      .returning();

    // TODO: send invite email
    logger.info('Dealer invite email would be sent', { email, dealerId });

    res.status(201).json({
      success: true,
      data: {
        tenantId: dealerId,
        userId: dealerUser.id,
        name,
        slug,
        parentAgencyId
      },
    });
  } catch (err) {
    logger.error('Failed to create dealer', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create dealer' 
    });
  }
});

/**
 * PUT /api/dealers/:id
 * Update dealer information
 */
router.put('/:id', requireRole(['agency', 'super']), async (req, res) => {
  try {
    const { id } = req.params;
    const auth = req.user as JWTPayload;
    
    // Check if dealer exists and belongs to the agency
    let query;
    if (auth.role === 'super') {
      query = db.select().from(tenants).where(eq(tenants.id, id));
    } else {
      query = db.select().from(tenants).where(
        and(
          eq(tenants.id, id),
          eq(tenants.parentId, auth.tenantId)
        )
      );
    }
    
    const dealer = await query.limit(1);
    
    if (!dealer.length) {
      return res.status(404).json({ 
        success: false, 
        error: 'Dealer not found or you do not have permission to update it' 
      });
    }
    
    // Extract updatable fields
    const { 
      name, 
      brand,
      isActive
    } = req.body;
    
    // Update dealer
    const [updatedDealer] = await db.update(tenants)
      .set({
        name: name || undefined,
        brand: brand ? { ...dealer[0].brand, ...brand } : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, id))
      .returning();
    
    res.json({
      success: true,
      data: updatedDealer
    });
  } catch (err) {
    logger.error('Failed to update dealer', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update dealer' 
    });
  }
});

export default router;
