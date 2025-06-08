import * as jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import logger from "../utils/logger";
import { db } from "../db";
import { sql } from "drizzle-orm";
import type { StringValue } from "ms";

// Type augmentations are handled globally

export interface JWTPayload {
  userId: string;
  dealershipId: number;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for token tracking
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  token?: string;
}

export class JWTAuthService {
  private static instance: JWTAuthService;
  private currentSecretVersion: number = 1;
  private secrets: Map<number, string> = new Map();

  private constructor() {
    this.initializeSecrets();
  }

  static getInstance(): JWTAuthService {
    if (!JWTAuthService.instance) {
      JWTAuthService.instance = new JWTAuthService();
    }
    return JWTAuthService.instance;
  }

  /**
   * Initialize JWT secrets with rotation support
   */
  private initializeSecrets(): void {
    // Primary secret (current)
    const primarySecret = process.env.JWT_SECRET || this.generateSecret();
    this.secrets.set(1, primarySecret);

    // Previous secret for rotation (if exists)
    const previousSecret = process.env.JWT_PREVIOUS_SECRET;
    if (previousSecret) {
      this.secrets.set(0, previousSecret);
    }

    // Load secret version from environment or database
    const versionFromEnv = process.env.JWT_SECRET_VERSION;
    if (versionFromEnv) {
      this.currentSecretVersion = parseInt(versionFromEnv);
    }

    logger.info("JWT secrets initialized", {
      currentVersion: this.currentSecretVersion,
      secretCount: this.secrets.size,
    });
  }

  /**
   * Generate a new JWT secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(64).toString("hex");
  }

  /**
   * Generate JWT token
   */
  generateToken(
    payload: Omit<JWTPayload, "iat" | "exp" | "jti">,
    expiresIn: StringValue = "24h",
  ): string {
    try {
      const jti = require("crypto").randomUUID();
      const secret = this.secrets.get(this.currentSecretVersion);

      if (!secret) {
        throw new Error("JWT secret not available");
      }

      const tokenPayload: JWTPayload = {
        ...payload,
        jti,
      };

      const signOptions: jwt.SignOptions = {
        expiresIn: expiresIn,
        issuer: "rylie-ai",
        audience: "rylie-dashboard",
        algorithm: "HS256",
      };

      const token = jwt.sign(tokenPayload, secret, signOptions);

      // Store token info for tracking/revocation
      this.storeTokenInfo(jti, payload.userId, payload.dealershipId, expiresIn);

      logger.info("JWT token generated", {
        userId: payload.userId,
        dealershipId: payload.dealershipId,
        role: payload.role,
        jti,
        expiresIn,
      });

      return token;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to generate JWT token", err, payload);
      throw err;
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      // Decode header to get secret version
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === "string") {
        throw new Error("Invalid token format");
      }

      const secretVersion =
        (decoded.header as any).ver || this.currentSecretVersion;
      const secret = this.secrets.get(secretVersion);

      if (!secret) {
        throw new Error(`JWT secret version ${secretVersion} not available`);
      }

      // Verify token with appropriate secret
      const payload = jwt.verify(token, secret, {
        issuer: "rylie-ai",
        audience: "rylie-dashboard",
        algorithms: ["HS256"],
      }) as JWTPayload;

      // Additional validation
      if (!payload.userId || !payload.dealershipId || !payload.role) {
        throw new Error("Invalid token payload");
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn("JWT verification failed", {
          error: error.message,
          tokenPreview: token.substring(0, 20) + "...",
        });
        throw new Error("Invalid or expired token");
      }

      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to verify JWT token", err);
      throw err;
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(oldToken: string): Promise<string> {
    try {
      const payload = this.verifyToken(oldToken);

      // Check if token is eligible for refresh (not expired too long ago)
      const now = Math.floor(Date.now() / 1000);
      const gracePeriod = 5 * 60; // 5 minutes grace period

      if (payload.exp && now - payload.exp > gracePeriod) {
        throw new Error("Token too old to refresh");
      }

      // Revoke old token
      if (payload.jti) {
        await this.revokeToken(payload.jti);
      }

      // Generate new token
      const newPayload = {
        userId: payload.userId,
        dealershipId: payload.dealershipId,
        role: payload.role,
        permissions: payload.permissions,
      };

      return this.generateToken(newPayload);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to refresh JWT token", err);
      throw err;
    }
  }

  /**
   * Revoke JWT token
   */
  async revokeToken(jti: string): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE jwt_tokens
        SET revoked_at = NOW(), active = false
        WHERE jti = ${jti}
      `);

      logger.info("JWT token revoked", { jti });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to revoke JWT token", err, { jti });
      throw err;
    }
  }

  /**
   * Check if token is revoked
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT active FROM jwt_tokens
        WHERE jti = ${jti}
      `);

      if (!result || result.length === 0) {
        return true; // Token not found, consider revoked
      }

      return !result[0].active;
    } catch (error) {
      logger.error("Failed to check token revocation status", error, { jti });
      return true; // Fail safe - consider revoked if we can't check
    }
  }

  /**
   * Rotate JWT secrets
   */
  async rotateSecrets(): Promise<void> {
    try {
      const newSecret = this.generateSecret();
      const newVersion = this.currentSecretVersion + 1;

      // Keep previous secret for existing tokens
      this.secrets.set(
        this.currentSecretVersion,
        this.secrets.get(this.currentSecretVersion)!,
      );

      // Add new secret
      this.secrets.set(newVersion, newSecret);

      // Update current version
      this.currentSecretVersion = newVersion;

      // Clean up old secrets (keep only current and previous)
      for (const [version] of this.secrets) {
        if (version < newVersion - 1) {
          this.secrets.delete(version);
        }
      }

      logger.info("JWT secrets rotated", {
        newVersion,
        secretCount: this.secrets.size,
      });

      // In production, this would update environment variables or secret store
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to rotate JWT secrets", err);
      throw err;
    }
  }

  /**
   * Store token information for tracking
   */
  private async storeTokenInfo(
    jti: string,
    userId: string,
    dealershipId: number,
    expiresIn: StringValue,
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      const duration = this.parseExpiresIn(expiresIn);
      expiresAt.setSeconds(expiresAt.getSeconds() + duration);

      await db.execute(sql`
        INSERT INTO jwt_tokens (jti, user_id, dealership_id, issued_at, expires_at, active)
        VALUES (${jti}, ${userId}, ${dealershipId}, NOW(), ${expiresAt}, true)
      `);
    } catch (error) {
      // Log error but don't throw - token generation should still succeed
      logger.error("Failed to store token info", error, { jti, userId });
    }
  }

  /**
   * Parse expiresIn string to seconds
   */
  private parseExpiresIn(expiresIn: StringValue): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 60 * 60;
      case "d":
        return value * 24 * 60 * 60;
      default:
        return 24 * 60 * 60; // Default to 24 hours
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await db.execute(sql`
        DELETE FROM jwt_tokens
        WHERE expires_at < NOW() - INTERVAL '7 days'
      `);

      logger.info("Cleaned up expired JWT tokens", {
        deletedCount: result.length || 0,
      });
    } catch (error) {
      logger.error("Failed to cleanup expired tokens", error);
    }
  }
}

/**
 * JWT Authentication Middleware
 */
export const jwtAuthMiddleware = (required: boolean = true) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.substring(7)
          : null;

      if (!token) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: "Authentication token required",
          });
        }
        return next();
      }

      const jwtService = JWTAuthService.getInstance();
      const payload = jwtService.verifyToken(token);

      // Check if token is revoked
      if (payload.jti && (await jwtService.isTokenRevoked(payload.jti))) {
        return res.status(401).json({
          success: false,
          error: "Token has been revoked",
        });
      }

      // Attach user info to request
      req.user = {
        ...payload,
        id: payload.userId || payload.id || "unknown",
      };
      req.token = token;

      // Set agent ID header for agent dashboard routes
      if (payload.role === "agent" || payload.role === "supervisor") {
        req.headers["x-agent-id"] = payload.userId;
      }

      next();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("JWT authentication failed", err, {
        path: req.path,
        method: req.method,
      });

      if (required) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired authentication token",
        });
      }

      next();
    }
  };
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `Permission '${permission}' required`,
      });
    }

    next();
  };
};

// Export singleton instance
export const jwtAuthService = JWTAuthService.getInstance();
