/**
 * Authentication Service
 *
 * Centralized authentication and authorization service that handles user authentication,
 * JWT token management, session management, and role-based access control.
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { BaseService, ServiceConfig, ServiceHealth } from "./base-service";
import { db } from "../db";
import { users, sessions, magicLinkInvitations } from "../../shared/schema";
import { eq, and, gt } from "drizzle-orm";
import logger from "../utils/logger";
import { CustomError } from "../utils/error-handler";
import { configManager } from "../config/config-manager";

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  dealershipId?: number;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
  role?: string;
  dealershipId?: number;
}

export interface MagicLinkData {
  email: string;
  redirectUrl?: string;
  expiresIn?: number;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}

export class AuthService extends BaseService {
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private bcryptRounds: number;
  private magicLinkExpiresIn: number;

  constructor(config: ServiceConfig) {
    super({
      ...config,
      dependencies: ["database"],
    });

    // Initialize configuration
    const authConfig = configManager.getSection("auth");
    this.jwtSecret = authConfig.jwtSecret;
    this.jwtExpiresIn = authConfig.jwtExpiresIn;
    this.bcryptRounds = authConfig.bcryptRounds;
    this.magicLinkExpiresIn = authConfig.magicLinkExpiresIn;
  }

  protected async onInitialize(): Promise<void> {
    logger.info("Auth Service initializing...");

    // Validate JWT secret
    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      throw new CustomError(
        "JWT secret must be at least 32 characters long",
        500,
        { code: "INVALID_JWT_SECRET" },
      );
    }

    logger.info("Auth Service initialized");
  }

  protected async onShutdown(): Promise<void> {
    logger.info("Auth Service shutting down...");
    // Cleanup active sessions if needed
  }

  protected async checkDependencyHealth(
    dependency: string,
  ): Promise<ServiceHealth> {
    if (dependency === "database") {
      try {
        await db.select().from(users).limit(1);
        return {
          status: "healthy",
          lastCheck: new Date(),
          uptime: 0,
          dependencies: {},
        };
      } catch (error) {
        return {
          status: "unhealthy",
          lastCheck: new Date(),
          uptime: 0,
          dependencies: {},
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      status: "healthy",
      lastCheck: new Date(),
      uptime: 0,
      dependencies: {},
    };
  }

  /**
   * Authenticate user with email and password
   */
  async login(
    credentials: LoginCredentials,
  ): Promise<{ user: User; tokens: AuthTokens; session: SessionData }> {
    return this.executeWithMetrics(async () => {
      const { email, password } = credentials;

      // Find user by email
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!userResult[0]) {
        throw new CustomError("Invalid email or password", 401, {
          code: "INVALID_CREDENTIALS",
        });
      }

      const user = userResult[0];

      // Check if user is active
      if (!user.is_active) {
        throw new CustomError("Account is deactivated", 401, {
          code: "ACCOUNT_DEACTIVATED",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        throw new CustomError("Invalid email or password", 401, {
          code: "INVALID_CREDENTIALS",
        });
      }

      // Update last login
      await db
        .update(users)
        .set({ last_login_at: new Date() })
        .where(eq(users.id, user.id));

      // Generate tokens
      const tokens = await this.generateTokens(user.id);

      // Create session
      const session = await this.createSession(user.id);

      // Return user data (without password)
      const userData: User = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        dealershipId: user.dealership_id,
        isActive: user.is_active,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };

      logger.info("User logged in successfully", {
        userId: user.id,
        email: user.email,
        sessionId: session.sessionId,
      });

      return { user: userData, tokens, session };
    }, "login");
  }

  /**
   * Register a new user
   */
  async register(
    data: RegisterData,
  ): Promise<{ user: User; tokens: AuthTokens; session: SessionData }> {
    return this.executeWithMetrics(async () => {
      const { email, password, name, role = "user", dealershipId } = data;

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser[0]) {
        throw new CustomError("User with this email already exists", 409, {
          code: "USER_ALREADY_EXISTS",
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.bcryptRounds);

      // Create user
      const userId = uuidv4();
      const now = new Date();

      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name,
        role,
        dealership_id: dealershipId,
        is_active: true,
        created_at: now,
        updated_at: now,
      });

      // Generate tokens
      const tokens = await this.generateTokens(userId);

      // Create session
      const session = await this.createSession(userId);

      // Return user data
      const userData: User = {
        id: userId,
        email: email.toLowerCase(),
        name,
        role,
        dealershipId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      logger.info("User registered successfully", {
        userId,
        email: email.toLowerCase(),
        role,
      });

      return { user: userData, tokens, session };
    }, "register");
  }

  /**
   * Generate magic link for passwordless authentication
   */
  async generateMagicLink(data: MagicLinkData): Promise<string> {
    return this.executeWithMetrics(async () => {
      const { email, redirectUrl, expiresIn = this.magicLinkExpiresIn } = data;

      // Check if user exists
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!userResult[0]) {
        throw new CustomError("User not found", 404, {
          code: "USER_NOT_FOUND",
        });
      }

      const user = userResult[0];

      // Generate magic link token
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Store magic link
      await db.insert(magicLinkInvitations).values({
        id: uuidv4(),
        user_id: user.id,
        token,
        expires_at: expiresAt,
        redirect_url: redirectUrl,
        used: false,
        created_at: new Date(),
      });

      logger.info("Magic link generated", {
        userId: user.id,
        email: user.email,
        expiresAt,
      });

      return token;
    }, "generateMagicLink");
  }

  /**
   * Authenticate user with magic link token
   */
  async authenticateWithMagicLink(
    token: string,
  ): Promise<{ user: User; tokens: AuthTokens; session: SessionData }> {
    return this.executeWithMetrics(async () => {
      // Find magic link
      const linkResult = await db
        .select()
        .from(magicLinkInvitations)
        .where(
          and(
            eq(magicLinkInvitations.token, token),
            eq(magicLinkInvitations.used, false),
            gt(magicLinkInvitations.expires_at, new Date()),
          ),
        )
        .limit(1);

      if (!linkResult[0]) {
        throw new CustomError("Invalid or expired magic link", 401, {
          code: "INVALID_MAGIC_LINK",
        });
      }

      const link = linkResult[0];

      // Mark magic link as used
      await db
        .update(magicLinkInvitations)
        .set({ used: true, used_at: new Date() })
        .where(eq(magicLinkInvitations.id, link.id));

      // Get user
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, link.user_id))
        .limit(1);

      if (!userResult[0] || !userResult[0].is_active) {
        throw new CustomError("User not found or inactive", 401, {
          code: "USER_INACTIVE",
        });
      }

      const user = userResult[0];

      // Update last login
      await db
        .update(users)
        .set({ last_login_at: new Date() })
        .where(eq(users.id, user.id));

      // Generate tokens
      const tokens = await this.generateTokens(user.id);

      // Create session
      const session = await this.createSession(user.id);

      // Return user data
      const userData: User = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        dealershipId: user.dealership_id,
        isActive: user.is_active,
        lastLoginAt: new Date(),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };

      logger.info("User authenticated with magic link", {
        userId: user.id,
        email: user.email,
        sessionId: session.sessionId,
      });

      return { user: userData, tokens, session };
    }, "authenticateWithMagicLink");
  }

  /**
   * Verify JWT token and return user data
   */
  async verifyToken(token: string): Promise<User> {
    return this.executeWithMetrics(async () => {
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;

        // Get user from database
        const userResult = await db
          .select()
          .from(users)
          .where(eq(users.id, decoded.userId))
          .limit(1);

        if (!userResult[0] || !userResult[0].is_active) {
          throw new CustomError("User not found or inactive", 401, {
            code: "USER_INACTIVE",
          });
        }

        const user = userResult[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          dealershipId: user.dealership_id,
          isActive: user.is_active,
          lastLoginAt: user.last_login_at,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        };
      } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
          throw new CustomError("Invalid token", 401, {
            code: "INVALID_TOKEN",
          });
        }
        throw error;
      }
    }, "verifyToken");
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionId: string): Promise<void> {
    return this.executeWithMetrics(async () => {
      await db
        .update(sessions)
        .set({ is_active: false, ended_at: new Date() })
        .where(eq(sessions.id, sessionId));

      logger.info("User logged out", { sessionId });
    }, "logout");
  }

  /**
   * Generate JWT tokens for user
   */
  private async generateTokens(userId: string): Promise<AuthTokens> {
    const payload = { userId, type: "access" };
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });

    // For now, refresh token is the same as access token with longer expiry
    const refreshToken = jwt.sign(
      { ...payload, type: "refresh" },
      this.jwtSecret,
      { expiresIn: "7d" },
    );

    // Calculate expiry time in seconds
    const decoded = jwt.decode(accessToken) as any;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Create user session
   */
  private async createSession(userId: string): Promise<SessionData> {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(sessions).values({
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
      is_active: true,
      created_at: new Date(),
    });

    return {
      userId,
      sessionId,
      expiresAt,
    };
  }
}

// Create and export singleton instance with lazy initialization
let _authService: AuthService | null = null;

export const authService = {
  get instance(): AuthService {
    if (!_authService) {
      _authService = new AuthService({
        name: "AuthService",
        version: "1.0.0",
      });
    }
    return _authService;
  },

  // Proxy methods for backward compatibility
  authenticate: (...args: any[]) => authService.instance.authenticate(...args),
  generateSession: (...args: any[]) =>
    authService.instance.generateSession(...args),
  validateSession: (...args: any[]) =>
    authService.instance.validateSession(...args),
  revokeSession: (...args: any[]) =>
    authService.instance.revokeSession(...args),
  hashPassword: (...args: any[]) => authService.instance.hashPassword(...args),
  verifyPassword: (...args: any[]) =>
    authService.instance.verifyPassword(...args),
  generateJWT: (...args: any[]) => authService.instance.generateJWT(...args),
  verifyJWT: (...args: any[]) => authService.instance.verifyJWT(...args),
  createMagicLink: (...args: any[]) =>
    authService.instance.createMagicLink(...args),
  verifyMagicLink: (...args: any[]) =>
    authService.instance.verifyMagicLink(...args),
};
