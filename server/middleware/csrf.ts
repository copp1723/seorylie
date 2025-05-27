/**
 * CSRF Protection Middleware
 * 
 * This middleware provides Cross-Site Request Forgery protection
 * for sensitive routes that modify data.
 */

import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';

// Initialize CSRF protection middleware
export const csrfProtection = csrf({ 
  cookie: {
    key: '_csrf',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Error handler for CSRF token validation failures
export const handleCsrfError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  // Handle CSRF token validation errors
  const isApiRequest = req.path.startsWith('/api/');
  if (isApiRequest) {
    return res.status(403).json({
      message: 'Invalid or expired security token. Please refresh the page and try again.',
      code: 'CSRF_ERROR'
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

// Helper function to generate CSRF token for the client
export const sendCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  res.cookie('XSRF-TOKEN', req.csrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  next();
};