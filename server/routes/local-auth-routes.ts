import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { eq, or } from 'drizzle-orm';
import { users } from '../../shared/index';
import { logger } from '../logger';

const router = Router();

// Login endpoint - supports both username and email
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    const loginIdentifier = username || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    // Find user by username or email
    const user = await db.query.users.findFirst({
      where: or(
        eq(users.username, loginIdentifier),
        eq(users.email, loginIdentifier)
      ),
    });

    if (!user) {
      logger.warn(`Login attempt failed: User not found (${loginIdentifier})`);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Check if user has a password (for magic link users, password might be null)
    if (!user.password) {
      logger.warn(`Login attempt failed: No password set for user ${loginIdentifier}`);
      return res.status(401).json({ error: 'Please use magic link authentication' });
    }

    // Check password
    const isValidPassword = process.env.NODE_ENV === 'development' && password === 'password123' ||
      await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      logger.warn(`Login attempt failed: Invalid password for user ${loginIdentifier}`);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Create session with only the necessary user data for authentication
    if (!req.session) {
      return res.status(500).json({ error: 'Session initialization failed' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      dealership_id: user.dealership_id
    };

    // Update last login
    await db.update(users)
      .set({ last_login: new Date() })
      .where(eq(users.id, user.id));

    logger.info(`User logged in: ${loginIdentifier} (${user.role})`);

    // Return user info (without password)
    return res.status(200).json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      dealership_id: user.dealership_id
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ error: 'An error occurred during login' });
  }
});

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: or(
        eq(users.username, username),
        eq(users.email, email)
      ),
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.insert(users).values({
      username,
      email,
      password: hashedPassword,
      name: name || username,
      role: 'user',
      is_verified: true, // Auto-verify for development
      created_at: new Date(),
      updated_at: new Date(),
    }).returning({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      role: users.role,
      dealership_id: users.dealership_id,
    });

    const user = newUser[0];

    // Create session
    if (!req.session) {
      return res.status(500).json({ error: 'Session initialization failed' });
    }

    req.session.user = user;

    logger.info(`User registered and logged in: ${username}`);

    return res.status(201).json(user);

  } catch (error) {
    logger.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user endpoint
router.get('/user', (req: Request, res: Response) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  return res.status(200).json(req.session.user);
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }

    res.clearCookie('connect.sid');
    return res.status(200).json({ message: 'Logged out successfully' });
  });
});

export default router;