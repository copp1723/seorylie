import { Router } from 'express';
import { tenants, users } from '../models/schema';
import { db } from '../db';
import { requireRole } from '../utils/permissions';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/admin/tenants -> list all tenants (super only)
router.get('/', requireRole(['super']), async (req, res) => {
  try {
    const rows = await db.select().from(tenants);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tenants' });
  }
});

// GET /api/admin/tenants/:id -> get specific tenant
router.get('/:id', requireRole(['super']), async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    
    if (!tenant.length) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    
    res.json({ success: true, data: tenant[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tenant' });
  }
});

// POST /api/admin/tenants -> create new tenant
router.post('/', requireRole(['super']), async (req, res) => {
  try {
    const { name, slug, parentId, brand } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    
    const [tenant] = await db.insert(tenants).values({
      id: uuidv4(),
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      parentId,
      brand: brand || {},
      isActive: true
    }).returning();
    
    res.status(201).json({ success: true, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create tenant' });
  }
});

// PUT /api/admin/tenants/:id -> update tenant
router.put('/:id', requireRole(['super']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, parentId, brand, isActive } = req.body;
    
    const [updated] = await db.update(tenants)
      .set({
        name,
        slug,
        parentId,
        brand,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, id))
      .returning();
      
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update tenant' });
  }
});

// DELETE /api/admin/tenants/:id -> delete tenant
router.delete('/:id', requireRole(['super']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if tenant has users
    const tenantUsers = await db.select().from(users).where(eq(users.tenantId, id)).limit(1);
    if (tenantUsers.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete tenant with active users' 
      });
    }
    
    const deleted = await db.delete(tenants).where(eq(tenants.id, id)).returning();
    
    if (!deleted.length) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    
    res.json({ success: true, message: 'Tenant deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete tenant' });
  }
});

export default router;
