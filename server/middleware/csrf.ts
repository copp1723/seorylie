/**
 * CSRF Protection Middleware
 *
 * This middleware provides Cross-Site Request Forgery protection
 * for sensitive routes that modify data.
 * 
 * Updated to use modern implementation instead of deprecated csurf package
 */

import type { Request, Response, NextFunction } from "express";
import { 
  csrfProtection as modernCsrfProtection, 
  setCsrfToken,
  handleCsrfError as modernHandleCsrfError,
  sendCsrfToken as modernSendCsrfToken 
} from "./csrf-modern";

// Export the modern CSRF protection middleware
export const csrfProtection = modernCsrfProtection({
  cookieName: "_csrf",
  headerName: "x-csrf-token",
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
});

// Export the error handler
export const handleCsrfError = modernHandleCsrfError;

// Helper function to generate CSRF token for the client
export const sendCsrfToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Use the modern implementation
  const token = (req as any).csrfToken?.();
  if (token) {
    res.cookie("XSRF-TOKEN", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
  }
  next();
};

// Export the setCsrfToken middleware for initial token generation
export { setCsrfToken };