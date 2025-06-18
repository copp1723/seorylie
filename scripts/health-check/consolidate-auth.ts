#!/usr/bin/env node
/**
 * Consolidate multiple authentication implementations into a unified system
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = '.backup/auth-consolidation';
const AUTH_FILES = {
  middleware: [
    'server/middleware/auth.ts',
    'server/middleware/unified-auth.ts',
    'server/middleware/jwt-auth.ts',
    'server/middleware/_archived/authentication.ts',
    'server/middleware/_archived/api-auth.ts'
  ],
  services: [
    'server/services/auth-service.ts',
    'server/services/magic-link-auth.ts'
  ]
};

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('🔐 Consolidating Authentication Systems...\n');

// Backup existing files
console.log('📦 Backing up existing auth files...');
[...AUTH_FILES.middleware, ...AUTH_FILES.services].forEach(file => {
  if (fs.existsSync(file)) {
    const backupPath = path.join(BACKUP_DIR, file.replace(/\//g, '_'));
    fs.copyFileSync(file, backupPath);
    console.log(`  ✓ Backed up ${file}`);
  }
});

// Create unified authentication middleware
const unifiedAuthMiddleware = `/**
 * Unified Authentication Middleware
 * Supports multiple authentication strategies with consistent interface
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/unified-auth-service';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    agencyId?: string;
    dealershipId?: string;
    permissions?: string[];
  };
  session?: {
    id: string;
    expiresAt: Date;
  };
}

// Authentication strategies
export enum AuthStrategy {
  JWT = 'jwt',
  SESSION = 'session',
  API_KEY = 'api_key',
  MAGIC_LINK = 'magic_link',
  BASIC = 'basic'
}

// Main authentication middleware factory
export function authenticate(options: {
  strategies?: AuthStrategy[];
  required?: boolean;
  roles?: string[];
  permissions?: string[];
} = {}) {
  const {
    strategies = [AuthStrategy.JWT, AuthStrategy.SESSION],
    required = true,
    roles = [],
    permissions = []
  } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authService = AuthService.getInstance();
    let authenticated = false;
    let user = null;

    // Try each strategy in order
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case AuthStrategy.JWT:
            user = await authService.authenticateJWT(req);
            break;
          case AuthStrategy.SESSION:
            user = await authService.authenticateSession(req);
            break;
          case AuthStrategy.API_KEY:
            user = await authService.authenticateApiKey(req);
            break;
          case AuthStrategy.MAGIC_LINK:
            user = await authService.authenticateMagicLink(req);
            break;
          case AuthStrategy.BASIC:
            user = await authService.authenticateBasic(req);
            break;
        }

        if (user) {
          authenticated = true;
          req.user = user;
          break;
        }
      } catch (error) {
        // Log error but continue to next strategy
        console.error(\`Auth strategy \${strategy} failed:\`, error);
      }
    }

    // Check if authentication is required
    if (required && !authenticated) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide valid authentication credentials'
      });
    }

    // Check role requirements
    if (authenticated && roles.length > 0) {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You do not have the required role for this action'
        });
      }
    }

    // Check permission requirements
    if (authenticated && permissions.length > 0) {
      const userPermissions = req.user.permissions || [];
      const hasPermission = permissions.some(p => userPermissions.includes(p));
      
      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You do not have the required permissions for this action'
        });
      }
    }

    next();
  };
}

// Convenience middleware for common scenarios
export const requireAuth = authenticate({ required: true });
export const optionalAuth = authenticate({ required: false });
export const requireAdmin = authenticate({ required: true, roles: ['admin'] });
export const requireAgency = authenticate({ required: true, roles: ['agency', 'admin'] });
export const apiKeyAuth = authenticate({ strategies: [AuthStrategy.API_KEY], required: true });

// Rate limiting for auth endpoints
import rateLimit from 'express-rate-limit';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export default authenticate;
`;

// Create unified auth service
const unifiedAuthService = `/**
 * Unified Authentication Service
 * Handles all authentication strategies in one place
 */

import { Request } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { RedisClient } from '../lib/redis';
import crypto from 'crypto';

export class AuthService {
  private static instance: AuthService;
  private redis: RedisClient;
  
  private constructor() {
    this.redis = RedisClient.getInstance();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // JWT Authentication
  async authenticateJWT(req: Request): Promise<any> {
    const token = this.extractToken(req);
    if (!token) return null;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      
      // Check if token is blacklisted
      const isBlacklisted = await this.redis.get(\`blacklist:\${token}\`);
      if (isBlacklisted) return null;

      // Get user from database
      const user = await db.query.users.findFirst({
        where: eq(users.id, decoded.userId)
      });

      if (!user || !user.isActive) return null;

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        agencyId: user.agencyId,
        dealershipId: user.dealershipId,
        permissions: await this.getUserPermissions(user.id)
      };
    } catch (error) {
      return null;
    }
  }

  // Session Authentication
  async authenticateSession(req: Request): Promise<any> {
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
    if (!sessionId) return null;

    const session = await this.redis.get(\`session:\${sessionId}\`);
    if (!session) return null;

    const sessionData = JSON.parse(session);
    if (new Date(sessionData.expiresAt) < new Date()) {
      await this.redis.del(\`session:\${sessionId}\`);
      return null;
    }

    return sessionData.user;
  }

  // API Key Authentication
  async authenticateApiKey(req: Request): Promise<any> {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) return null;

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const apiKeyRecord = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      )
    });

    if (!apiKeyRecord) return null;

    // Update last used
    await db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id));

    return {
      id: apiKeyRecord.userId,
      email: apiKeyRecord.userEmail,
      role: 'api',
      permissions: apiKeyRecord.permissions
    };
  }

  // Magic Link Authentication
  async authenticateMagicLink(req: Request): Promise<any> {
    const token = req.query.token as string || req.body.token;
    if (!token) return null;

    const magicLink = await this.redis.get(\`magic:\${token}\`);
    if (!magicLink) return null;

    const linkData = JSON.parse(magicLink);
    if (new Date(linkData.expiresAt) < new Date()) {
      await this.redis.del(\`magic:\${token}\`);
      return null;
    }

    // Delete one-time token
    await this.redis.del(\`magic:\${token}\`);

    // Create session
    const user = await db.query.users.findFirst({
      where: eq(users.email, linkData.email)
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
      dealershipId: user.dealershipId
    };
  }

  // Basic Authentication
  async authenticateBasic(req: Request): Promise<any> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) return null;

    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [email, password] = credentials.split(':');

    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
      dealershipId: user.dealershipId
    };
  }

  // Helper methods
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return req.cookies?.token || null;
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    // Implementation depends on your permission system
    const permissions = await db.query.userPermissions.findMany({
      where: eq(userPermissions.userId, userId)
    });
    return permissions.map(p => p.permission);
  }

  // Token generation methods
  generateJWT(userId: string, expiresIn: string = '24h'): string {
    return jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn }
    );
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: '7d' }
    );
  }

  async generateMagicLink(email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.redis.setex(
      \`magic:\${token}\`,
      900, // 15 minutes in seconds
      JSON.stringify({ email, expiresAt })
    );

    return token;
  }

  async generateApiKey(userId: string, permissions: string[]): Promise<string> {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    await db.insert(apiKeys).values({
      userId,
      userEmail: user.email,
      keyHash,
      permissions,
      isActive: true,
      createdAt: new Date()
    });

    return apiKey;
  }

  // Session management
  async createSession(userId: string): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    await this.redis.setex(
      \`session:\${sessionId}\`,
      86400, // 24 hours in seconds
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          agencyId: user.agencyId,
          dealershipId: user.dealershipId
        },
        expiresAt
      })
    );

    return sessionId;
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.redis.del(\`session:\${sessionId}\`);
  }

  async blacklistToken(token: string, expiresIn: number = 86400): Promise<void> {
    await this.redis.setex(\`blacklist:\${token}\`, expiresIn, '1');
  }
}

export default AuthService;
`;

// Create auth routes
const authRoutes = `/**
 * Unified Authentication Routes
 */

import { Router, Request, Response } from 'express';
import { AuthService } from '../services/unified-auth-service';
import { authenticate, authRateLimit } from '../middleware/unified-auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const authService = AuthService.getInstance();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const magicLinkSchema = z.object({
  email: z.string().email()
});

const refreshTokenSchema = z.object({
  refreshToken: z.string()
});

// Login with email/password
router.post('/login', 
  authRateLimit,
  validateRequest(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      const user = await authService.authenticateBasic({
        headers: {
          authorization: \`Basic \${Buffer.from(\`\${email}:\${password}\`).toString('base64')}\`
        }
      } as any);

      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      const accessToken = authService.generateJWT(user.id);
      const refreshToken = authService.generateRefreshToken(user.id);
      const sessionId = await authService.createSession(user.id);

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json({
        user,
        accessToken,
        refreshToken,
        sessionId
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Request magic link
router.post('/magic-link',
  authRateLimit,
  validateRequest(magicLinkSchema),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      const token = await authService.generateMagicLink(email);
      
      // In production, send email with link
      // For now, return token (remove in production!)
      const magicLink = \`\${process.env.APP_URL}/auth/verify?token=\${token}\`;
      
      // TODO: Send email
      console.log('Magic link:', magicLink);
      
      res.json({
        message: 'Magic link sent to your email',
        // Remove in production:
        ...(process.env.NODE_ENV === 'development' && { magicLink })
      });
    } catch (error) {
      console.error('Magic link error:', error);
      res.status(500).json({ error: 'Failed to send magic link' });
    }
  }
);

// Verify magic link
router.get('/verify',
  async (req: Request, res: Response) => {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).json({ error: 'Token required' });
      }

      const user = await authService.authenticateMagicLink({ 
        query: { token } 
      } as any);

      if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const accessToken = authService.generateJWT(user.id);
      const sessionId = await authService.createSession(user.id);

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      // Redirect to dashboard or return tokens
      res.redirect('/dashboard');
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  }
);

// Refresh token
router.post('/refresh',
  validateRequest(refreshTokenSchema),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET || 'refresh-secret'
      );
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      const accessToken = authService.generateJWT(decoded.userId);
      
      res.json({ accessToken });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
);

// Logout
router.post('/logout',
  authenticate({ required: false }),
  async (req: any, res: Response) => {
    try {
      // Blacklist JWT if present
      const token = req.headers.authorization?.substring(7);
      if (token) {
        await authService.blacklistToken(token);
      }

      // Destroy session if present
      const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
      if (sessionId) {
        await authService.destroySession(sessionId);
      }

      res.clearCookie('sessionId');
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
);

// Get current user
router.get('/me',
  authenticate({ required: true }),
  async (req: any, res: Response) => {
    res.json({ user: req.user });
  }
);

// Generate API key (admin only)
router.post('/api-keys',
  authenticate({ required: true, roles: ['admin'] }),
  async (req: any, res: Response) => {
    try {
      const { permissions = [] } = req.body;
      
      const apiKey = await authService.generateApiKey(
        req.user.id,
        permissions
      );
      
      res.json({
        apiKey,
        message: 'Save this key securely, it cannot be retrieved again'
      });
    } catch (error) {
      console.error('API key generation error:', error);
      res.status(500).json({ error: 'Failed to generate API key' });
    }
  }
);

export default router;
`;

// Write the files
fs.mkdirSync('server/middleware', { recursive: true });
fs.mkdirSync('server/services', { recursive: true });
fs.mkdirSync('server/routes', { recursive: true });

fs.writeFileSync('server/middleware/unified-auth.ts', unifiedAuthMiddleware);
console.log('✅ Created unified auth middleware');

fs.writeFileSync('server/services/unified-auth-service.ts', unifiedAuthService);
console.log('✅ Created unified auth service');

fs.writeFileSync('server/routes/auth.ts', authRoutes);
console.log('✅ Created unified auth routes');

// Create migration guide
const migrationGuide = `# Authentication Consolidation Guide

## What Changed

All authentication implementations have been consolidated into a unified system that supports multiple strategies.

### Old Files (Backed up to ${BACKUP_DIR})
${[...AUTH_FILES.middleware, ...AUTH_FILES.services].map(f => `- ${f}`).join('\n')}

### New Files
- \`server/middleware/unified-auth.ts\` - Unified auth middleware
- \`server/services/unified-auth-service.ts\` - Unified auth service
- \`server/routes/auth.ts\` - Unified auth routes

## Authentication Strategies Supported

1. **JWT** - Bearer token authentication
2. **Session** - Cookie/Redis-based sessions
3. **API Key** - Header-based API key authentication
4. **Magic Link** - Email-based passwordless authentication
5. **Basic** - Basic authentication for simple use cases

## Usage Examples

### Require Authentication
\`\`\`typescript
import { authenticate, requireAuth } from './middleware/unified-auth';

// Require any authentication
router.get('/protected', requireAuth, handler);

// Require specific role
router.get('/admin', authenticate({ roles: ['admin'] }), handler);

// Require specific permissions
router.get('/reports', authenticate({ permissions: ['view_reports'] }), handler);

// Use specific strategies
router.get('/api', authenticate({ strategies: ['api_key'] }), handler);
\`\`\`

### Optional Authentication
\`\`\`typescript
import { optionalAuth } from './middleware/unified-auth';

router.get('/public', optionalAuth, (req, res) => {
  if (req.user) {
    // User is authenticated
  } else {
    // User is not authenticated
  }
});
\`\`\`

## Migration Steps

1. **Update imports** in all route files:
   \`\`\`typescript
   // Old
   import { authMiddleware } from './middleware/auth';
   
   // New
   import { authenticate } from './middleware/unified-auth';
   \`\`\`

2. **Update middleware usage**:
   \`\`\`typescript
   // Old
   router.use(authMiddleware);
   
   // New
   router.use(authenticate());
   \`\`\`

3. **Update auth service calls**:
   \`\`\`typescript
   // Old
   import { AuthService } from './services/auth-service';
   const authService = new AuthService();
   
   // New
   import { AuthService } from './services/unified-auth-service';
   const authService = AuthService.getInstance();
   \`\`\`

## Environment Variables Required

- \`JWT_SECRET\` - Secret for JWT signing
- \`JWT_REFRESH_SECRET\` - Secret for refresh tokens
- \`REDIS_URL\` - Redis connection URL for sessions
- \`APP_URL\` - Application URL for magic links

## Security Improvements

1. Rate limiting on auth endpoints
2. Token blacklisting for logout
3. Session management with Redis
4. Secure cookie settings
5. Permission-based access control

## Next Steps

1. Test all authentication flows
2. Update client-side auth handling
3. Migrate existing user sessions
4. Remove old auth files after verification
`;

fs.writeFileSync('AUTH_CONSOLIDATION_GUIDE.md', migrationGuide);
console.log('✅ Created migration guide: AUTH_CONSOLIDATION_GUIDE.md');

console.log('\n🎉 Authentication consolidation complete!');
console.log('\nNext steps:');
console.log('1. Install required dependencies: npm install jsonwebtoken bcryptjs express-rate-limit');
console.log('2. Update route files to use new auth middleware');
console.log('3. Test all authentication flows');
console.log('4. Remove old auth files after verification\n');