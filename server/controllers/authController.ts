import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../shared/index';
import logger from '../utils/logger';
import bcrypt from 'bcrypt';

// Real authentication controller
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      logger.warn(`Login attempt failed: User not found (${username})`);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Use bcrypt to verify password
    const isValidPassword = await bcrypt.compare(password, user.password || '');

    if (!isValidPassword) {
      logger.warn(`Login attempt failed: Invalid password for user ${username}`);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Create session
    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.username || '', // use username since name property doesn't exist
      email: user.email || '',
      role: user.role || 'user',
      dealership_id: user.dealershipId
    };

    logger.info(`User logged in: ${username} (${user.role || 'user'})`);

    // Return user info (without password)
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.username || '',
        email: user.email || '',
        role: user.role || 'user',
        dealership_id: user.dealershipId
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ error: 'An error occurred during login' });
  }
};

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, name } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create new user
    const newUser = await db.insert(users).values({
      username,
      email: email || '',
      password: password, // In production, hash this with bcrypt
      // name: name || username,  // Remove this line, since User type does not have 'name'
      role: 'user',
      dealershipId: null
    }).returning();

    // Create session
    req.session.user = {
      id: newUser[0].id,
      username: newUser[0].username,
      name: newUser[0].username || '', // Use username as name since there is no name property
      email: newUser[0].email || '',
      role: newUser[0].role || 'user',
      dealership_id: newUser[0].dealershipId
    };

    logger.info(`User registered: ${username}`);

    return res.status(201).json({
      success: true,
      user: {
        id: newUser[0].id,
        username: newUser[0].username,
        name: newUser[0].username || '', // Use username as name since there is no name property
        email: newUser[0].email || '',
        role: newUser[0].role || 'user',
        dealership_id: newUser[0].dealershipId
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    return res.status(500).json({ error: 'An error occurred during registration' });
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  try {
    if (!req.session) {
      return res.status(200).json({ success: true, message: 'Already logged out' });
    }

    req.session.destroy((err) => {
      if (err) {
        logger.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }

      res.clearCookie('connect.sid');
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    });
  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({ error: 'An error occurred during logout' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    return res.status(200).json({
      success: true,
      user: req.session.user
    });
  } catch (error) {
    logger.error('Get user error:', error);
    return res.status(500).json({ error: 'An error occurred while fetching user data' });
  }
};