/**
 * API Authentication Middleware
 * Provides API key validation for external API access
 */

import { Request, Response, NextFunction } from "express";
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

      // For now, accept any API key for testing
      // TODO: Implement proper validation against database
      if (!apiKey.startsWith("cleanrylie_")) {
        return res.status(401).json({
          error: "invalid_api_key",
          message: "Invalid API key format",
        });
      }

      // Add mock client info to request
      req.apiClient = {
        clientId: "test_client",
        clientName: "Test Client",
        dealershipId: 1,
        scopes: ["*"],
      };

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
