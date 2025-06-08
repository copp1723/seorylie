/**
 * Feature Flag API Routes
 *
 * Admin endpoints for managing feature flags
 *
 * @file server/routes/feature-flags.ts
 */

import { Router, Request, Response } from "express";
import {
  featureFlags,
  FeatureFlag,
  FeatureFlagConfig,
} from "../services/feature-flags.js";
import { adminFeatureFlagMiddleware } from "../middleware/feature-flags.js";
import { z } from "zod";

const router = Router();

// Apply admin middleware to all feature flag management routes
router.use(adminFeatureFlagMiddleware);

// Validation schemas
const toggleFlagSchema = z.object({
  enabled: z.boolean(),
});

const createFlagSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9-]+$/,
      "Flag name must contain only lowercase letters, numbers, and hyphens",
    ),
  enabled: z.boolean().default(false),
  description: z.string().min(1),
  deprecated: z.boolean().optional(),
  deprecationDate: z.string().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  environments: z.array(z.string()).optional(),
});

const updateConfigSchema = z.object({
  flags: z.record(
    z.object({
      name: z.string(),
      enabled: z.boolean(),
      description: z.string(),
      deprecated: z.boolean().optional(),
      deprecationDate: z.string().optional(),
      rolloutPercentage: z.number().min(0).max(100).optional(),
      environments: z.array(z.string()).optional(),
    }),
  ),
  version: z.string(),
  lastUpdated: z.string(),
});

/**
 * GET /api/admin/feature-flags
 * Get all feature flags configuration
 */
router.get("/", (req: Request, res: Response) => {
  try {
    const config = featureFlags.getConfiguration();
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch feature flags",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/admin/feature-flags/status
 * Get current status of all feature flags for this environment
 */
router.get("/status", (req: Request, res: Response) => {
  try {
    const allFlags = featureFlags.getAllFlags();
    res.json({
      success: true,
      data: {
        environment: process.env.NODE_ENV || "development",
        flags: allFlags,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch feature flag status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/admin/feature-flags/:flagName/toggle
 * Toggle a specific feature flag
 */
router.post("/:flagName/toggle", (req: Request, res: Response) => {
  try {
    const { flagName } = req.params;
    const { enabled } = toggleFlagSchema.parse(req.body);

    const success = featureFlags.toggleFlag(flagName, enabled);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Feature flag not found",
        message: `Feature flag '${flagName}' does not exist`,
      });
    }

    res.json({
      success: true,
      message: `Feature flag '${flagName}' ${enabled ? "enabled" : "disabled"}`,
      data: {
        flagName,
        enabled,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to toggle feature flag",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/admin/feature-flags
 * Create a new feature flag
 */
router.post("/", (req: Request, res: Response) => {
  try {
    const flagData = createFlagSchema.parse(req.body);

    // Check if flag already exists
    const config = featureFlags.getConfiguration();
    if (config.flags[flagData.name]) {
      return res.status(409).json({
        success: false,
        error: "Feature flag already exists",
        message: `Feature flag '${flagData.name}' already exists`,
      });
    }

    featureFlags.addFlag(flagData as FeatureFlag);

    res.status(201).json({
      success: true,
      message: `Feature flag '${flagData.name}' created successfully`,
      data: flagData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create feature flag",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/admin/feature-flags
 * Update entire feature flags configuration
 */
router.put("/", (req: Request, res: Response) => {
  try {
    const newConfig = updateConfigSchema.parse(req.body);

    featureFlags.updateConfiguration(newConfig as FeatureFlagConfig);

    res.json({
      success: true,
      message: "Feature flags configuration updated successfully",
      data: newConfig,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid configuration data",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update configuration",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/admin/feature-flags/:flagName/deprecate
 * Mark a feature flag as deprecated
 */
router.post("/:flagName/deprecate", (req: Request, res: Response) => {
  try {
    const { flagName } = req.params;
    const { deprecationDate } = req.body;

    const success = featureFlags.deprecateFlag(flagName, deprecationDate);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Feature flag not found",
        message: `Feature flag '${flagName}' does not exist`,
      });
    }

    res.json({
      success: true,
      message: `Feature flag '${flagName}' marked as deprecated`,
      data: {
        flagName,
        deprecated: true,
        deprecationDate: deprecationDate || new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to deprecate feature flag",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /api/admin/feature-flags/cleanup
 * Clean up deprecated feature flags older than specified days
 */
router.delete("/cleanup", (req: Request, res: Response) => {
  try {
    const daysOld = parseInt(req.query.days as string) || 30;
    const removedFlags = featureFlags.cleanupDeprecatedFlags(daysOld);

    res.json({
      success: true,
      message: `Cleaned up ${removedFlags.length} deprecated feature flags`,
      data: {
        removedFlags,
        daysOld,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to cleanup deprecated flags",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/admin/feature-flags/:flagName/check
 * Check if a specific feature flag is enabled (for testing)
 */
router.get("/:flagName/check", (req: Request, res: Response) => {
  try {
    const { flagName } = req.params;
    const userId = req.query.userId as string;

    const isEnabled = featureFlags.isEnabled(flagName, userId);

    res.json({
      success: true,
      data: {
        flagName,
        enabled: isEnabled,
        userId: userId || null,
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to check feature flag",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
