/**
 * Modern CSRF Protection Middleware
 * 
 * Replaces deprecated csurf package with a secure custom implementation
 * using double-submit cookie pattern
 */

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

interface CsrfOptions {
  cookieName?: string;
  headerName?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  httpOnly?: boolean;
  maxAge?: number;
}

const defaultOptions: CsrfOptions = {
  cookieName: "_csrf",
  headerName: "x-csrf-token",
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  httpOnly: true,
  maxAge: 3600000, // 1 hour
};

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * CSRF protection middleware factory
 */
export function csrfProtection(options: CsrfOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Get token from cookie
    const cookieToken = req.cookies[config.cookieName!];
    
    // Get token from header or body
    const headerToken = req.headers[config.headerName!] as string || 
                       req.body?._csrf || 
                       req.query?._csrf;

    // Validate tokens match
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      const err: any = new Error("Invalid CSRF token");
      err.code = "EBADCSRFTOKEN";
      return next(err);
    }

    next();
  };
}

/**
 * Middleware to set CSRF token cookie
 */
export function setCsrfToken(options: CsrfOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if token already exists
    let token = req.cookies[config.cookieName!];
    
    if (!token) {
      // Generate new token
      token = generateCsrfToken();
      
      // Set cookie
      res.cookie(config.cookieName!, token, {
        httpOnly: config.httpOnly,
        secure: config.secure,
        sameSite: config.sameSite,
        maxAge: config.maxAge,
      });
    }

    // Make token available to templates
    res.locals.csrfToken = token;
    
    // Add convenience method to request
    (req as any).csrfToken = () => token;

    next();
  };
}

/**
 * Error handler for CSRF token validation failures
 */
export const handleCsrfError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err.code !== "EBADCSRFTOKEN") {
    return next(err);
  }

  // Handle CSRF token validation errors
  const isApiRequest = req.path.startsWith("/api/");
  if (isApiRequest) {
    return res.status(403).json({
      message:
        "Invalid or expired security token. Please refresh the page and try again.",
      code: "CSRF_ERROR",
    });
  } else {
    // For non-API routes, redirect to a friendly error page
    return res.status(403).send(`
      <html>
        <head><title>Security Error</title></head>
        <body>
          <h1>Security Error</h1>
          <p>Invalid or expired security token. Please <a href="/">return to the homepage</a> and try again.</p>
        </body>
      </html>
    `);
  }
};

/**
 * Helper to send CSRF token to client (for SPAs)
 */
export const sendCsrfToken = (
  req: Request,
  res: Response,
) => {
  const token = (req as any).csrfToken?.() || generateCsrfToken();
  
  // Send token in response
  res.json({ csrfToken: token });
};