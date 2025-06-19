// server/utils/permissions.ts
// Lightweight helpers for role-based access and tenant scoping.

import type { Request, Response, NextFunction } from "express";
import { JWTPayload } from "../middleware/jwt-auth";

export function hasRole(user: JWTPayload | undefined, roles: string[]): boolean {
  return !!user && roles.includes(user.role);
}

export function sameTenant(a?: JWTPayload, b?: JWTPayload): boolean {
  return !!a && !!b && a.tenantId === b.tenantId;
}

// Express middleware ---------------------------------------------------------

export const requireRole = (roles: string[]) => (
  req: Request, res: Response, next: NextFunction,
) => {
  const user = (req as any).user as JWTPayload | undefined;
  if (!hasRole(user, roles)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  return next();
};

export const requireSameTenant = () => (
  req: Request, res: Response, next: NextFunction,
) => {
  const user = (req as any).user as JWTPayload | undefined;
  const targetTenantId = req.params.tenantId || req.body.tenantId;
  if (user?.tenantId !== targetTenantId && user?.role !== "super") {
    return res.status(403).json({ success: false, error: "Cross-tenant access denied" });
  }
  return next();
};
