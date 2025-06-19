import { Router } from 'express';
import { tenants, users } from '../models/schema';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { jwtAuthService } from '../middleware/jwt-auth';
import { hash } from 'bcryptjs';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/tenants  (public agency signup)
 * Body: { name, email, password, branding?: { companyName, primaryColor, secondaryColor, logoUrl } }
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, password, branding } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email, password required' });
    }

    // Basic email uniqueness check
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(users.email.eq(email))
      .limit(1);

    if (existingUser.length) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    // Create agency tenant
    const tenantId = uuidv4();
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.insert(tenants).values({
      id: tenantId,
      name,
      slug,
      brand: branding || { companyName: name },
    });

    // Create admin user for agency
    const hashed = await hash(password, 10);
    const [admin] = await db
      .insert(users)
      .values({
        email,
        name,
        role: 'agency',
        tenantId,
        isActive: true,
        passwordHash: hashed as any, // field exists in schema? adjust accordingly
      })
      .returning();

    // Generate JWT token
    const token = jwtAuthService.generateToken({
      userId: String(admin.id ?? admin.email),
      tenantId,
      role: 'agency',
      permissions: [],
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: admin.id,
          email: admin.email,
          role: 'agency',
          tenantId,
        },
      },
    });
  } catch (err) {
    logger.error('Agency signup failed', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/**
 * PATCH /api/tenants/:id/branding  (agency update branding)
 * Body: { companyName?, primaryColor?, secondaryColor?, logoUrl? }
 */
router.patch('/:id/branding', async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, primaryColor, secondaryColor, logoUrl } = req.body;

    const updates: any = {};
    if (companyName || primaryColor || secondaryColor || logoUrl) {
      updates.brand = {
        ...(req.body.brand || {}),
        companyName,
        primaryColor,
        secondaryColor,
        logoUrl,
      };
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, error: 'No branding fields provided' });
    }

    const [updated] = await db.update(tenants).set(updates).where(tenants.id.eq(id)).returning();

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('Update branding failed', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;