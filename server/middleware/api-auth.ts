/**
 * API Authentication Middleware
 * Provides API key validation for external API access
 */

import { Request, Response, NextFunction } from "express";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db, apiKeys } from "../db";
import logger from "../utils/logger";

export function apiAuth(requiredScope?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.header("X-API-Key");

      if (!apiKey) {
        return res.status(401).json({
          error: "missing_api_key",
          message: "API key is required (X-API-Key header)",
        });
      }

      // Look up API key in database
      const record = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.key, apiKey),
          eq(apiKeys.isActive, true),
          or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date())),
        ),
      });

      if (!record) {
        return res.status(401).json({
          error: "invalid_api_key",
          message: "API key not found or inactive",
        });
      }

      // Populate request context
      req.apiClient = {
        clientId: `apikey_${record.id}`,
        clientName: record.name,
        dealershipId: record.dealershipId,
        scopes: record.permissions || [],
      };

      if (
        requiredScope &&
        !req.apiClient.scopes.includes(requiredScope) &&
        !req.apiClient.scopes.includes("*")
      ) {
        return res.status(403).json({
          error: "insufficient_scope",
          message: "API key lacks required permissions",
        });
      }

      // Update last used timestamp
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, record.id));

      logger.info("API access", {
        clientId: req.apiClient.clientId,
        endpoint: req.originalUrl,
      });

      next();
    } catch (error) {
      logger.error("API authentication error", { error });
      res.status(500).json({
        error: "internal_error",
        message: "Internal server error during authentication",
      });
    }
  };
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      apiClient?: {
        clientId?: string;
        clientName?: string;
        dealershipId?: number;
        scopes?: string[];
      };
    }
  }
}

export default apiAuth;
