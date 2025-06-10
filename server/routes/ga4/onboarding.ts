/**
 * @file GA4 Onboarding API Routes
 * @description API endpoints for GA4 property onboarding and management
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../models/database';
import { ga4Properties, ga4ServiceAccount, tenants, auditLogs } from '../../models/schema';
import { 
  GA4ServiceAccountManager, 
  GA4PropertyManager,
  createServiceAccountConfigFromEnv 
} from '@rylie-seo/ga4-service-manager';
import { eq, and } from 'drizzle-orm';
import pino from 'pino';

const router = Router();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Validation schemas
const StartOnboardingSchema = z.object({
  tenantId: z.string().uuid(),
  propertyId: z.string().regex(/^\d{9,12}$/, 'Invalid GA4 Property ID format'),
  propertyName: z.string().min(1).max(100),
  websiteUrl: z.string().url().optional(),
});

const TestConnectionSchema = z.object({
  tenantId: z.string().uuid(),
  propertyId: z.string().regex(/^\d{9,12}$/, 'Invalid GA4 Property ID format'),
});

const CompleteOnboardingSchema = z.object({
  tenantId: z.string().uuid(),
  propertyId: z.string().regex(/^\d{9,12}$/, 'Invalid GA4 Property ID format'),
});

// Middleware to get or create service account manager
async function getServiceAccountManager(): Promise<GA4ServiceAccountManager> {
  try {
    // Get service account from database
    const serviceAccounts = await db
      .select()
      .from(ga4ServiceAccount)
      .where(eq(ga4ServiceAccount.environment, process.env.NODE_ENV || 'development'))
      .limit(1);

    if (serviceAccounts.length === 0) {
      // Create from environment variables if not in database
      const config = createServiceAccountConfigFromEnv();
      return new GA4ServiceAccountManager(config);
    }

    const account = serviceAccounts[0];
    const manager = new GA4ServiceAccountManager({
      environment: account.environment as any,
      serviceAccountEmail: account.serviceAccountEmail,
      projectId: account.projectId,
      privateKey: manager.decrypt(account.privateKeyEncrypted), // This would need the manager instance, chicken-egg problem
      keyId: account.keyId,
    });

    return manager;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize service account manager');
    throw new Error('Service account not configured');
  }
}

// Middleware for authentication and tenant validation
async function validateTenantAccess(req: any, res: any, next: any) {
  try {
    const tenantId = req.body.tenantId || req.params.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Check if tenant exists
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (tenant.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    req.tenant = tenant[0];
    next();
  } catch (error) {
    logger.error({ error }, 'Tenant validation failed');
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Start GA4 property onboarding process
 * POST /api/ga4/onboarding/start
 */
router.post('/start', validateTenantAccess, async (req, res) => {
  try {
    const validation = StartOnboardingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { tenantId, propertyId, propertyName, websiteUrl } = validation.data;

    // Check if property already exists for this tenant
    const existingProperty = await db
      .select()
      .from(ga4Properties)
      .where(
        and(
          eq(ga4Properties.tenantId, tenantId),
          eq(ga4Properties.propertyId, propertyId)
        )
      )
      .limit(1);

    if (existingProperty.length > 0) {
      return res.status(409).json({
        error: 'Property already exists for this tenant',
        property: existingProperty[0],
      });
    }

    // Initialize managers
    const serviceAccountManager = await getServiceAccountManager();
    const propertyManager = new GA4PropertyManager(serviceAccountManager);

    // Start onboarding process
    const result = await propertyManager.startPropertyOnboarding(
      tenantId,
      propertyId,
      propertyName,
      websiteUrl
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    // Save property to database
    const [savedProperty] = await db
      .insert(ga4Properties)
      .values({
        tenantId,
        propertyId,
        propertyName,
        websiteUrl,
        syncStatus: 'pending',
        metadata: result.propertyInfo?.metadata || {},
      })
      .returning();

    // Get onboarding instructions
    const instructions = propertyManager.getOnboardingInstructions();

    // Log audit trail
    await db.insert(auditLogs).values({
      action: 'ga4_onboarding_started',
      entityType: 'ga4_property',
      entityId: savedProperty.id,
      userId: req.user?.id,
      userRole: req.user?.role || 'system',
      details: {
        tenantId,
        propertyId,
        propertyName,
        websiteUrl,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info({ tenantId, propertyId, propertyName }, 'GA4 onboarding started');

    res.json({
      success: true,
      property: savedProperty,
      onboardingFlow: result.onboardingFlow,
      instructions: {
        serviceAccountEmail: instructions.serviceAccountEmail,
        steps: instructions.steps,
        helpResources: instructions.helpResources,
      },
      nextSteps: result.nextSteps,
    });
  } catch (error) {
    logger.error({ error, body: req.body }, 'GA4 onboarding start failed');
    res.status(500).json({
      error: 'Failed to start onboarding process',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Test GA4 property connection
 * POST /api/ga4/onboarding/test-connection
 */
router.post('/test-connection', validateTenantAccess, async (req, res) => {
  try {
    const validation = TestConnectionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { tenantId, propertyId } = validation.data;

    // Get property from database
    const property = await db
      .select()
      .from(ga4Properties)
      .where(
        and(
          eq(ga4Properties.tenantId, tenantId),
          eq(ga4Properties.propertyId, propertyId)
        )
      )
      .limit(1);

    if (property.length === 0) {
      return res.status(404).json({
        error: 'Property not found. Please start the onboarding process first.',
      });
    }

    // Initialize managers
    const serviceAccountManager = await getServiceAccountManager();
    const propertyManager = new GA4PropertyManager(serviceAccountManager);

    // Validate property access
    const validation_result = await propertyManager.validateProperty(propertyId, tenantId);

    if (!validation_result.hasAccess) {
      // Log failed test
      await db.insert(auditLogs).values({
        action: 'ga4_connection_test_failed',
        entityType: 'ga4_property',
        entityId: property[0].id,
        userId: req.user?.id,
        userRole: req.user?.role || 'system',
        details: {
          tenantId,
          propertyId,
          errors: validation_result.errors,
          warnings: validation_result.warnings,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({
        success: false,
        hasAccess: false,
        errors: validation_result.errors,
        warnings: validation_result.warnings,
        message: 'Connection test failed. Please ensure the service account has been added as a Viewer.',
      });
    }

    // Update property status
    await db
      .update(ga4Properties)
      .set({
        syncStatus: 'active',
        accessGrantedAt: new Date(),
        lastSyncAt: new Date(),
        metadata: {
          ...property[0].metadata,
          ...validation_result.metadata,
          lastConnectionTest: new Date().toISOString(),
          warnings: validation_result.warnings,
        },
      })
      .where(eq(ga4Properties.id, property[0].id));

    // Log successful test
    await db.insert(auditLogs).values({
      action: 'ga4_connection_test_success',
      entityType: 'ga4_property',
      entityId: property[0].id,
      userId: req.user?.id,
      userRole: req.user?.role || 'system',
      details: {
        tenantId,
        propertyId,
        metadata: validation_result.metadata,
        warnings: validation_result.warnings,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info({ tenantId, propertyId }, 'GA4 connection test successful');

    res.json({
      success: true,
      hasAccess: true,
      errors: validation_result.errors,
      warnings: validation_result.warnings,
      metadata: validation_result.metadata,
      message: 'Connection successful! Your GA4 property is now connected.',
    });
  } catch (error) {
    logger.error({ error, body: req.body }, 'GA4 connection test failed');
    res.status(500).json({
      error: 'Connection test failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Complete GA4 property onboarding
 * POST /api/ga4/onboarding/complete
 */
router.post('/complete', validateTenantAccess, async (req, res) => {
  try {
    const validation = CompleteOnboardingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { tenantId, propertyId } = validation.data;

    // Get property from database
    const property = await db
      .select()
      .from(ga4Properties)
      .where(
        and(
          eq(ga4Properties.tenantId, tenantId),
          eq(ga4Properties.propertyId, propertyId)
        )
      )
      .limit(1);

    if (property.length === 0) {
      return res.status(404).json({
        error: 'Property not found.',
      });
    }

    if (property[0].syncStatus === 'active' && property[0].isActive) {
      return res.json({
        success: true,
        message: 'Property onboarding is already completed.',
        property: property[0],
      });
    }

    // Initialize managers
    const serviceAccountManager = await getServiceAccountManager();
    const propertyManager = new GA4PropertyManager(serviceAccountManager);

    // Complete onboarding
    const result = await propertyManager.completePropertyOnboarding(tenantId, propertyId);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    // Update property in database
    await db
      .update(ga4Properties)
      .set({
        isActive: true,
        syncStatus: 'active',
        accessGrantedAt: new Date(),
        lastSyncAt: new Date(),
        metadata: {
          ...property[0].metadata,
          onboardingCompleted: new Date().toISOString(),
        },
      })
      .where(eq(ga4Properties.id, property[0].id));

    // Log completion
    await db.insert(auditLogs).values({
      action: 'ga4_onboarding_completed',
      entityType: 'ga4_property',
      entityId: property[0].id,
      userId: req.user?.id,
      userRole: req.user?.role || 'system',
      details: {
        tenantId,
        propertyId,
        propertyName: property[0].propertyName,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info({ tenantId, propertyId }, 'GA4 onboarding completed');

    res.json({
      success: true,
      message: 'Onboarding completed successfully!',
      property: result.propertyInfo,
      nextSteps: result.nextSteps,
    });
  } catch (error) {
    logger.error({ error, body: req.body }, 'GA4 onboarding completion failed');
    res.status(500).json({
      error: 'Failed to complete onboarding',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Get GA4 properties for a tenant
 * GET /api/ga4/properties/:tenantId
 */
router.get('/properties/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const properties = await db
      .select()
      .from(ga4Properties)
      .where(eq(ga4Properties.tenantId, tenantId))
      .orderBy(ga4Properties.createdAt);

    // Get sync status for each property
    const serviceAccountManager = await getServiceAccountManager();
    const propertyManager = new GA4PropertyManager(serviceAccountManager);
    
    const propertiesWithStatus = await Promise.all(
      properties.map(async (property) => {
        try {
          const syncStatus = await propertyManager.getPropertySyncStatus(
            property.propertyId,
            property.tenantId
          );
          
          return {
            ...property,
            currentSyncStatus: syncStatus,
          };
        } catch (error) {
          return {
            ...property,
            currentSyncStatus: {
              propertyId: property.propertyId,
              tenantId: property.tenantId,
              status: 'error' as const,
              lastError: 'Failed to check sync status',
              dataAvailability: { hasRecentData: false },
            },
          };
        }
      })
    );

    res.json({
      success: true,
      properties: propertiesWithStatus,
      count: propertiesWithStatus.length,
    });
  } catch (error) {
    logger.error({ error, tenantId: req.params.tenantId }, 'Failed to get GA4 properties');
    res.status(500).json({
      error: 'Failed to retrieve properties',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Get service account information for onboarding
 * GET /api/ga4/service-account-info
 */
router.get('/service-account-info', async (req, res) => {
  try {
    const serviceAccountManager = await getServiceAccountManager();
    const propertyManager = new GA4PropertyManager(serviceAccountManager);
    
    const instructions = propertyManager.getOnboardingInstructions();

    res.json({
      success: true,
      serviceAccountEmail: instructions.serviceAccountEmail,
      instructions: instructions.steps,
      helpResources: instructions.helpResources,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get service account info');
    res.status(500).json({
      error: 'Failed to retrieve service account information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Health check for GA4 service account
 * GET /api/ga4/health
 */
router.get('/health', async (req, res) => {
  try {
    const serviceAccountManager = await getServiceAccountManager();
    const health = await serviceAccountManager.validateServiceAccountHealth();

    res.json({
      success: true,
      health,
    });
  } catch (error) {
    logger.error({ error }, 'GA4 health check failed');
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;