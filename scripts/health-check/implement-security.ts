#!/usr/bin/env node
/**
 * Implement production-ready security patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

class SecurityImplementation {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async implementSecurityPatterns(): Promise<void> {
    console.log('🔒 Implementing security patterns...\n');
    
    await this.createSecurityMiddleware();
    await this.createAuthenticationSystem();
    await this.createRateLimiting();
    await this.createInputValidation();
    await this.createSecurityHeaders();
    await this.createAuditLogging();
    await this.createEncryption();
    
    console.log('\n✅ Security patterns implemented!');
    console.log('\n📋 Required packages:');
    console.log('npm install helmet cors express-rate-limit bcrypt jsonwebtoken');
    console.log('npm install express-validator express-mongo-sanitize xss');
    console.log('npm install @types/bcrypt @types/jsonwebtoken --save-dev');
  }

  private async createSecurityMiddleware(): Promise<void> {
    const securityDir = path.join(this.rootDir, 'server/security');
    await this.ensureDir(securityDir);
    
    // Main security configuration
    const securityConfig = `import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import { Express } from 'express';

export interface SecurityConfig {
  cors: {
    origins: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
}

export const defaultSecurityConfig: SecurityConfig = {
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    expiresIn: '7d'
  }
};

export function applySecurityMiddleware(app: Express, config: SecurityConfig = defaultSecurityConfig): void {
  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration
  app.use(cors({
    origin: config.cors.origins,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-ID', 'X-Trace-ID'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.'
        }
      });
    }
  });

  app.use('/api/', limiter);

  // Data sanitization against NoSQL query injection
  app.use(mongoSanitize());

  // Data sanitization against XSS
  app.use(xss());

  // Prevent parameter pollution
  app.use((req, res, next) => {
    // Clean up query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (Array.isArray(req.query[key])) {
          req.query[key] = (req.query[key] as string[])[0];
        }
      });
    }
    next();
  });
}
`;
    
    await writeFile(path.join(securityDir, 'index.ts'), securityConfig);
  }

  private async createAuthenticationSystem(): Promise<void> {
    const authDir = path.join(this.rootDir, 'server/security/auth');
    await this.ensureDir(authDir);
    
    // JWT service
    const jwtService = `import jwt from 'jsonwebtoken';
import { Request } from 'express';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
}

export class JWTService {
  private secret: string;
  private expiresIn: string;

  constructor(secret: string, expiresIn: string = '7d') {
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'seorylie-api',
      audience: 'seorylie-client'
    });
  }

  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'seorylie-api',
        audience: 'seorylie-client'
      }) as TokenPayload;
      
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  refreshToken(token: string): string {
    const payload = this.verifyToken(token);
    
    // Remove iat and exp from payload
    const { iat, exp, ...newPayload } = payload as any;
    
    return this.generateToken(newPayload);
  }

  extractTokenFromRequest(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check for token in cookies
    if (req.cookies?.token) {
      return req.cookies.token;
    }
    
    return null;
  }
}

export const jwtService = new JWTService(
  process.env.JWT_SECRET || 'change-this-secret',
  process.env.JWT_EXPIRES_IN || '7d'
);
`;
    
    await writeFile(path.join(authDir, 'jwt.service.ts'), jwtService);
    
    // Auth middleware
    const authMiddleware = `import { Request, Response, NextFunction } from 'express';
import { jwtService } from './jwt.service';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    tenantId?: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const token = jwtService.extractTokenFromRequest(req);
    
    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided'
        }
      });
    }
    
    const payload = jwtService.verifyToken(token);
    req.user = payload;
    
    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token'
      }
    });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
    
    next();
  };
}

export function requireTenant(req: AuthRequest, res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'] as string || req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'TENANT_REQUIRED',
        message: 'Tenant ID is required'
      }
    });
  }
  
  (req as any).tenantId = tenantId;
  next();
}
`;
    
    await writeFile(path.join(authDir, 'auth.middleware.ts'), authMiddleware);
    
    // Password hashing
    const passwordService = `import bcrypt from 'bcrypt';

export class PasswordService {
  private saltRounds: number;

  constructor(saltRounds: number = 10) {
    this.saltRounds = saltRounds;
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const passwordService = new PasswordService();
`;
    
    await writeFile(path.join(authDir, 'password.service.ts'), passwordService);
  }

  private async createRateLimiting(): Promise<void> {
    const rateLimitDir = path.join(this.rootDir, 'server/security/rate-limit');
    await this.ensureDir(rateLimitDir);
    
    const advancedRateLimiter = `import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

export class RateLimitManager {
  private redisClient?: any;

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.redisClient = createClient({ url: redisUrl });
      this.redisClient.connect().catch(console.error);
    }
  }

  createLimiter(config: RateLimitConfig): RateLimitRequestHandler {
    const store = this.redisClient
      ? new RedisStore({
          client: this.redisClient,
          prefix: 'rate-limit:'
        })
      : undefined;

    return rateLimit({
      ...config,
      store,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: res.getHeader('Retry-After')
          }
        });
      }
    });
  }

  // Different limiters for different endpoints
  public readonly limiters = {
    // Strict limit for auth endpoints
    auth: this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      skipSuccessfulRequests: false
    }),

    // Standard API limit
    api: this.createLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100
    }),

    // Relaxed limit for read operations
    read: this.createLimiter({
      windowMs: 15 * 60 * 1000,
      max: 1000
    }),

    // Strict limit for write operations
    write: this.createLimiter({
      windowMs: 15 * 60 * 1000,
      max: 50
    }),

    // Per-user limiting
    perUser: this.createLimiter({
      windowMs: 15 * 60 * 1000,
      max: 500,
      keyGenerator: (req) => req.user?.userId || req.ip
    })
  };
}

export const rateLimitManager = new RateLimitManager(process.env.REDIS_URL);
`;
    
    await writeFile(path.join(rateLimitDir, 'index.ts'), advancedRateLimiter);
  }

  private async createInputValidation(): Promise<void> {
    const validationDir = path.join(this.rootDir, 'server/security/validation');
    await this.ensureDir(validationDir);
    
    const validationMiddleware = `import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

export class ValidationService {
  // Sanitize HTML content
  sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target']
    });
  }

  // Sanitize user input
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove any potential script tags or SQL injection attempts
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[';]|--/g, '');
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }

  // Create validation middleware from Zod schema
  validateRequest(schema: ZodSchema) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Validate request data
        const validated = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params
        });
        
        // Sanitize validated data
        req.body = this.sanitizeInput(validated.body || {});
        req.query = this.sanitizeInput(validated.query || {});
        req.params = this.sanitizeInput(validated.params || {});
        
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
              }))
            }
          });
        }
        
        next(error);
      }
    };
  }

  // Common validation schemas
  schemas = {
    // UUID validation
    uuid: z.string().uuid(),
    
    // Email validation
    email: z.string().email().toLowerCase(),
    
    // Password validation
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number')
      .regex(/[!@#$%^&*]/, 'Password must contain a special character'),
    
    // Pagination
    pagination: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      sort: z.string().optional(),
      order: z.enum(['asc', 'desc']).default('desc')
    }),
    
    // Date range
    dateRange: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime()
    }).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
      message: 'Start date must be before end date'
    })
  };
}

export const validationService = new ValidationService();

// SQL injection prevention
export function preventSQLInjection(value: string): string {
  // Basic SQL injection prevention
  return value
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/script/gi, '');
}

// File upload validation
export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export function validateFileUpload(options: FileValidationOptions = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'No file was uploaded'
        }
      });
    }

    const files = Array.isArray(req.files) ? req.files : [req.files];
    
    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: \`File size exceeds maximum allowed size of \${maxSize / 1024 / 1024}MB\`
          }
        });
      }

      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_FILE_TYPE',
            message: \`File type \${file.mimetype} is not allowed\`
          }
        });
      }

      // Check file extension
      const ext = path.extname(file.name).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_FILE_EXTENSION',
            message: \`File extension \${ext} is not allowed\`
          }
        });
      }
    }

    next();
  };
}
`;
    
    await writeFile(path.join(validationDir, 'index.ts'), validationMiddleware);
  }

  private async createSecurityHeaders(): Promise<void> {
    const headersPath = path.join(this.rootDir, 'server/security/headers.ts');
    
    const headersConfig = `import { Request, Response, NextFunction } from 'express';

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
}

export function noCacheHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  next();
}

export function apiSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // API-specific security headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent caching of sensitive data
  if (req.path.includes('/auth') || req.path.includes('/user')) {
    noCacheHeaders(req, res, () => {});
  }
  
  next();
}
`;
    
    await writeFile(headersPath, headersConfig);
  }

  private async createAuditLogging(): Promise<void> {
    const auditDir = path.join(this.rootDir, 'server/security/audit');
    await this.ensureDir(auditDir);
    
    const auditLogger = `import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/auth.middleware';

export interface AuditLog {
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip: string;
  userAgent: string;
  method: string;
  path: string;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private sensitiveFields = [
    'password',
    'token',
    'secret',
    'credit_card',
    'ssn',
    'api_key'
  ];

  async log(auditLog: AuditLog): Promise<void> {
    // In production, this would write to a secure audit log storage
    // For now, we'll use console.log with structured data
    console.log(JSON.stringify({
      ...auditLog,
      service: 'seorylie-api',
      environment: process.env.NODE_ENV
    }));
    
    // TODO: Implement actual audit log storage (e.g., to database or external service)
  }

  redactSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const redacted = Array.isArray(data) ? [...data] : { ...data };
    
    for (const key in redacted) {
      if (this.sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = this.redactSensitiveData(redacted[key]);
      }
    }
    
    return redacted;
  }

  middleware() {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Capture response data
      const originalSend = res.send;
      let responseData: any;
      
      res.send = function(data: any) {
        responseData = data;
        return originalSend.call(this, data);
      };
      
      // Log after response
      res.on('finish', async () => {
        const auditLog: AuditLog = {
          timestamp: new Date(),
          userId: req.user?.userId,
          userEmail: req.user?.email,
          action: this.determineAction(req.method, req.path),
          resource: this.extractResource(req.path),
          resourceId: req.params.id,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime: Date.now() - startTime,
          metadata: {
            query: this.redactSensitiveData(req.query),
            body: this.redactSensitiveData(req.body),
            params: this.redactSensitiveData(req.params)
          }
        };
        
        if (res.statusCode >= 400) {
          try {
            const errorData = JSON.parse(responseData);
            auditLog.error = errorData.error?.message || 'Unknown error';
          } catch {
            auditLog.error = 'Unknown error';
          }
        }
        
        await this.log(auditLog);
      });
      
      next();
    };
  }

  private determineAction(method: string, path: string): string {
    const actions: Record<string, string> = {
      GET: 'READ',
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE'
    };
    
    // Special cases
    if (path.includes('/login')) return 'LOGIN';
    if (path.includes('/logout')) return 'LOGOUT';
    if (path.includes('/register')) return 'REGISTER';
    
    return actions[method] || 'UNKNOWN';
  }

  private extractResource(path: string): string {
    const parts = path.split('/').filter(Boolean);
    
    // Skip 'api' prefix if present
    if (parts[0] === 'api') {
      parts.shift();
    }
    
    return parts[0] || 'unknown';
  }
}

export const auditLogger = new AuditLogger();

// Compliance-specific audit logging
export function complianceAudit(action: string, metadata?: any) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const auditLog: AuditLog = {
      timestamp: new Date(),
      userId: req.user?.userId,
      userEmail: req.user?.email,
      action,
      resource: 'compliance',
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      method: req.method,
      path: req.path,
      metadata: {
        ...metadata,
        compliance: true
      }
    };
    
    await auditLogger.log(auditLog);
    next();
  };
}
`;
    
    await writeFile(path.join(auditDir, 'index.ts'), auditLogger);
  }

  private async createEncryption(): Promise<void> {
    const encryptionPath = path.join(this.rootDir, 'server/security/encryption.ts');
    
    const encryptionService = `import crypto from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private tagLength = 16; // 128 bits
  private saltLength = 64; // 512 bits
  private iterations = 100000;
  
  private masterKey: Buffer;

  constructor(masterKey?: string) {
    this.masterKey = masterKey 
      ? Buffer.from(masterKey, 'hex')
      : this.generateKey();
  }

  generateKey(): Buffer {
    return crypto.randomBytes(this.keyLength);
  }

  deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha256');
  }

  encrypt(text: string, key?: Buffer): { encrypted: string; iv: string; tag: string } {
    const actualKey = key || this.masterKey;
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, actualKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encrypted: string, iv: string, tag: string, key?: Buffer): string {
    const actualKey = key || this.masterKey;
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      actualKey,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Encrypt sensitive fields in an object
  encryptObject(obj: any, fieldsToEncrypt: string[]): any {
    const encrypted = { ...obj };
    
    for (const field of fieldsToEncrypt) {
      if (obj[field]) {
        const { encrypted: enc, iv, tag } = this.encrypt(String(obj[field]));
        encrypted[field] = {
          encrypted: enc,
          iv,
          tag
        };
      }
    }
    
    return encrypted;
  }

  // Decrypt sensitive fields in an object
  decryptObject(obj: any, fieldsToDecrypt: string[]): any {
    const decrypted = { ...obj };
    
    for (const field of fieldsToDecrypt) {
      if (obj[field] && typeof obj[field] === 'object' && obj[field].encrypted) {
        decrypted[field] = this.decrypt(
          obj[field].encrypted,
          obj[field].iv,
          obj[field].tag
        );
      }
    }
    
    return decrypted;
  }

  // Hash data (one-way)
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate secure random tokens
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Time-constant string comparison to prevent timing attacks
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService(process.env.ENCRYPTION_KEY);

// Middleware for encrypting/decrypting sensitive response data
export function encryptResponse(fieldsToEncrypt: string[]) {
  return (req: any, res: any, next: any) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      if (data && typeof data === 'object') {
        data = encryptionService.encryptObject(data, fieldsToEncrypt);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}
`;
    
    await writeFile(encryptionPath, encryptionService);
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}

// Run the implementation
const security = new SecurityImplementation(path.join(__dirname, '../..'));
security.implementSecurityPatterns().catch(console.error);
