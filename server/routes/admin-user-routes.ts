import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import logger from '../utils/logger';
import { users, dealerships, magicLinkInvitations } from '../../shared/enhanced-schema';
import { eq, and, ne, or, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hash } from 'bcrypt';
import { sendEmail } from '../services/email-service';

const router = Router();

// Schema for validating user requests
const userSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  name: z.string().optional(),
  role: z.enum(['super_admin', 'dealership_admin', 'manager', 'user']),
  dealership_id: z.number().nullable(),
  is_verified: z.boolean().optional(),
});

// Schema for validating user update requests
const userUpdateSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }).optional(),
  email: z.string().email({ message: "Please enter a valid email address." }).optional(),
  name: z.string().optional(),
  role: z.enum(['super_admin', 'dealership_admin', 'manager', 'user']).optional(),
  dealership_id: z.number().nullable().optional(),
  is_verified: z.boolean().optional(),
});

// Schema for validating invitation requests
const invitationSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  role: z.enum(['dealership_admin', 'manager', 'user']),
  dealership_id: z.number().nullable(),
});

/**
 * Middleware to ensure only super admins can access admin routes
 */
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.user || req.session.user.role !== 'super_admin') {
    logger.warn('Unauthorized access attempt to admin routes', {
      userId: req.session?.user?.id,
      userRole: req.session?.user?.role,
      path: req.path,
    });

    return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
  }

  next();
};

// Apply admin-only middleware to all routes in this router
router.use(adminOnly);

/**
 * Get all users
 * GET /api/admin/users
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      role: users.role,
      dealership_id: users.dealership_id,
      is_verified: users.is_verified,
      created_at: users.created_at,
      last_login: users.last_login,
    })
    .from(users)
    .orderBy(users.username);

    res.json({ users: allUsers });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Get a specific user by ID
 * GET /api/admin/users/:id
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const userResult = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      role: users.role,
      dealership_id: users.dealership_id,
      is_verified: users.is_verified,
      created_at: users.created_at,
      last_login: users.last_login,
    })
    .from(users)
    .where(eq(users.id, userId));

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user has a dealership, get dealership details
    let dealershipDetails = null;
    if (userResult[0].dealership_id !== null) {
      const dealershipResult = await db.select({
        id: dealerships.id,
        name: dealerships.name,
        subdomain: dealerships.subdomain,
      })
      .from(dealerships)
      .where(eq(dealerships.id, userResult[0].dealership_id));

      if (dealershipResult.length > 0) {
        dealershipDetails = dealershipResult[0];
      }
    }

    res.json({
      user: userResult[0],
      dealership: dealershipDetails
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * Create a new user
 * POST /api/admin/users
 */
router.post('/users', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = userSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid user data',
        details: validationResult.error.format()
      });
    }

    const userData = validationResult.data;

    // Check if username or email is already taken
    const existingUser = await db.select({ id: users.id })
      .from(users)
      .where(
        or(
          eq(users.username, userData.username),
          eq(users.email, userData.email)
        )
      );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Username or email is already taken' });
    }

    // If dealership_id is provided, check if it exists
    if (userData.dealership_id !== null) {
      const existingDealership = await db.select({ id: dealerships.id })
        .from(dealerships)
        .where(eq(dealerships.id, userData.dealership_id));

      if (existingDealership.length === 0) {
        return res.status(400).json({ error: 'Dealership not found' });
      }
    }

    // Generate a random password
    const tempPassword = randomBytes(8).toString('hex');
    const passwordHash = await hash(tempPassword, 10);

    // Create new user
    const newUser = await db.insert(users).values({
      ...userData,
      password_hash: passwordHash,
      is_verified: userData.is_verified || false,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning();

    logger.info('New user created', {
      userId: newUser[0].id,
      username: newUser[0].username,
      role: newUser[0].role,
      dealership_id: newUser[0].dealership_id,
      createdBy: req.session.user.id
    });

    // Send email with temporary password if email service is configured
    try {
      await sendEmail({
        to: userData.email,
        subject: 'Your New Account on RylieAI',
        text: `Hello ${userData.name || userData.username},\n\nAn account has been created for you on RylieAI. Please use the following credentials to log in:\n\nUsername: ${userData.username}\nTemporary Password: ${tempPassword}\n\nYou will be prompted to change your password after your first login.\n\nRegards,\nThe RylieAI Team`,
        html: `
          <h2>Welcome to RylieAI</h2>
          <p>Hello ${userData.name || userData.username},</p>
          <p>An account has been created for you on RylieAI. Please use the following credentials to log in:</p>
          <p><strong>Username:</strong> ${userData.username}<br>
          <strong>Temporary Password:</strong> ${tempPassword}</p>
          <p>You will be prompted to change your password after your first login.</p>
          <p>Regards,<br>The RylieAI Team</p>
        `
      });

      logger.info('Welcome email sent to new user', {
        userId: newUser[0].id,
        email: userData.email
      });
    } catch (emailError) {
      logger.warn('Failed to send welcome email to new user', {
        userId: newUser[0].id,
        email: userData.email,
        error: emailError
      });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser[0].id,
        username: newUser[0].username,
        email: newUser[0].email,
        name: newUser[0].name,
        role: newUser[0].role,
        dealership_id: newUser[0].dealership_id,
        is_verified: newUser[0].is_verified,
        created_at: newUser[0].created_at,
      },
      tempPassword // Only include this in development mode
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * Update a user
 * PUT /api/admin/users/:id
 */
router.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Validate request body
    const validationResult = userUpdateSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid user data',
        details: validationResult.error.format()
      });
    }

    const userData = validationResult.data;

    // Check if user exists
    const existingUser = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));

    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If username is provided, check if it's already taken by another user
    if (userData.username) {
      const existingUsername = await db.select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.username, userData.username),
          ne(users.id, userId)
        ));

      if (existingUsername.length > 0) {
        return res.status(400).json({ error: 'Username is already taken by another user' });
      }
    }

    // If email is provided, check if it's already taken by another user
    if (userData.email) {
      const existingEmail = await db.select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.email, userData.email),
          ne(users.id, userId)
        ));

      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Email is already taken by another user' });
      }
    }

    // If dealership_id is provided, check if it exists
    if (userData.dealership_id !== undefined && userData.dealership_id !== null) {
      const existingDealership = await db.select({ id: dealerships.id })
        .from(dealerships)
        .where(eq(dealerships.id, userData.dealership_id));

      if (existingDealership.length === 0) {
        return res.status(400).json({ error: 'Dealership not found' });
      }
    }

    // Update user
    const updatedUser = await db.update(users)
      .set({
        ...userData,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    logger.info('User updated', {
      userId,
      updatedBy: req.session.user.id,
      changes: Object.keys(userData).join(', ')
    });

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser[0].id,
        username: updatedUser[0].username,
        email: updatedUser[0].email,
        name: updatedUser[0].name,
        role: updatedUser[0].role,
        dealership_id: updatedUser[0].dealership_id,
        is_verified: updatedUser[0].is_verified,
        created_at: updatedUser[0].created_at,
        updated_at: updatedUser[0].updated_at,
      }
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * Delete a user
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const existingUser = await db.select({
      id: users.id,
      username: users.username,
      email: users.email
    })
    .from(users)
    .where(eq(users.id, userId));

    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deletion of the current user
    if (userId === req.session.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Delete the user
    await db.delete(users).where(eq(users.id, userId));

    logger.info('User deleted', {
      userId,
      username: existingUser[0].username,
      email: existingUser[0].email,
      deletedBy: req.session.user.id
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * Reset user password
 * POST /api/admin/users/:id/reset-password
 */
router.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const existingUser = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name
    })
    .from(users)
    .where(eq(users.id, userId));

    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a random password
    const tempPassword = randomBytes(8).toString('hex');
    const passwordHash = await hash(tempPassword, 10);

    // Update user password
    await db.update(users)
      .set({
        password_hash: passwordHash,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('User password reset', {
      userId,
      resetBy: req.session.user.id
    });

    // Send email with temporary password if email service is configured
    try {
      await sendEmail({
        to: existingUser[0].email,
        subject: 'Your Password Has Been Reset',
        text: `Hello ${existingUser[0].name || existingUser[0].username},\n\nYour password has been reset by an administrator. Please use the following temporary password to log in:\n\nTemporary Password: ${tempPassword}\n\nYou will be prompted to change your password after your next login.\n\nRegards,\nThe RylieAI Team`,
        html: `
          <h2>Password Reset</h2>
          <p>Hello ${existingUser[0].name || existingUser[0].username},</p>
          <p>Your password has been reset by an administrator. Please use the following temporary password to log in:</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p>You will be prompted to change your password after your next login.</p>
          <p>Regards,<br>The RylieAI Team</p>
        `
      });

      logger.info('Password reset email sent', {
        userId,
        email: existingUser[0].email
      });
    } catch (emailError) {
      logger.warn('Failed to send password reset email', {
        userId,
        email: existingUser[0].email,
        error: emailError
      });
    }

    res.json({
      message: 'User password reset successfully',
      tempPassword // Only include this in development mode
    });
  } catch (error) {
    logger.error('Error resetting user password:', error);
    res.status(500).json({ error: 'Failed to reset user password' });
  }
});

/**
 * Create a new invitation
 * POST /api/admin/invitations
 */
router.post('/invitations', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = invitationSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid invitation data',
        details: validationResult.error.format()
      });
    }

    const invitationData = validationResult.data;

    // Check if email already exists as a user
    const existingUser = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, invitationData.email));

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await db.select({ id: magicLinkInvitations.id })
      .from(magicLinkInvitations)
      .where(and(
        eq(magicLinkInvitations.email, invitationData.email),
        eq(magicLinkInvitations.status, 'pending')
      ));

    if (existingInvitation.length > 0) {
      return res.status(400).json({ error: 'There is already a pending invitation for this email' });
    }

    // If dealership_id is provided, check if it exists
    if (invitationData.dealership_id !== null) {
      const existingDealership = await db.select({ id: dealerships.id })
        .from(dealerships)
        .where(eq(dealerships.id, invitationData.dealership_id));

      if (existingDealership.length === 0) {
        return res.status(400).json({ error: 'Dealership not found' });
      }
    }

    // Generate a unique token
    const token = randomBytes(32).toString('hex');

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create new invitation
    const newInvitation = await db.insert(magicLinkInvitations).values({
      email: invitationData.email,
      role: invitationData.role,
      dealership_id: invitationData.dealership_id,
      token,
      status: 'pending',
      invited_by: req.session.user.id,
      expires_at: expiresAt,
      created_at: new Date(),
    }).returning();

    logger.info('New invitation created', {
      invitationId: newInvitation[0].id,
      email: invitationData.email,
      role: invitationData.role,
      dealership_id: invitationData.dealership_id,
      createdBy: req.session.user.id
    });

    // Get dealership name if applicable
    let dealershipName = 'RylieAI';
    if (invitationData.dealership_id !== null) {
      const dealershipResult = await db.select({ name: dealerships.name })
        .from(dealerships)
        .where(eq(dealerships.id, invitationData.dealership_id));

      if (dealershipResult.length > 0) {
        dealershipName = dealershipResult[0].name;
      }
    }

    // Send invitation email if email service is configured
    try {
      const inviteUrl = `${process.env.APP_URL || 'http://localhost:5000'}/magic-link?token=${token}`;

      await sendEmail({
        to: invitationData.email,
        subject: `Invitation to Join ${dealershipName} on RylieAI`,
        text: `Hello,\n\nYou have been invited to join ${dealershipName} on RylieAI. Please click the link below to accept the invitation and create your account:\n\n${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nRegards,\nThe RylieAI Team`,
        html: `
          <h2>Invitation to Join ${dealershipName}</h2>
          <p>Hello,</p>
          <p>You have been invited to join ${dealershipName} on RylieAI. Please click the button below to accept the invitation and create your account:</p>
          <p style="margin: 20px 0;">
            <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
          </p>
          <p>Or copy and paste this URL into your browser:</p>
          <p>${inviteUrl}</p>
          <p>This invitation will expire in 7 days.</p>
          <p>Regards,<br>The RylieAI Team</p>
        `
      });

      logger.info('Invitation email sent', {
        invitationId: newInvitation[0].id,
        email: invitationData.email
      });
    } catch (emailError) {
      logger.warn('Failed to send invitation email', {
        invitationId: newInvitation[0].id,
        email: invitationData.email,
        error: emailError
      });
    }

    res.status(201).json({
      message: 'Invitation created and sent successfully',
      invitation: {
        id: newInvitation[0].id,
        email: newInvitation[0].email,
        role: newInvitation[0].role,
        dealership_id: newInvitation[0].dealership_id,
        status: newInvitation[0].status,
        expires_at: newInvitation[0].expires_at,
        created_at: newInvitation[0].created_at,
      }
    });
  } catch (error) {
    logger.error('Error creating invitation:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

/**
 * Get all invitations
 * GET /api/admin/invitations
 */
router.get('/invitations', async (req: Request, res: Response) => {
  try {
    const allInvitations = await db.select({
      id: magicLinkInvitations.id,
      email: magicLinkInvitations.email,
      role: magicLinkInvitations.role,
      dealership_id: magicLinkInvitations.dealership_id,
      status: magicLinkInvitations.status,
      invited_by: magicLinkInvitations.invited_by,
      expires_at: magicLinkInvitations.expires_at,
      created_at: magicLinkInvitations.created_at,
    })
    .from(magicLinkInvitations)
    .orderBy(magicLinkInvitations.created_at);

    // Get dealership names for all invitations with a dealership_id
    const dealershipIds = allInvitations
      .filter(inv => inv.dealership_id !== null)
      .map(inv => inv.dealership_id);

    const dealershipMap = new Map();

    if (dealershipIds.length > 0) {
      const dealershipResults = await db.select({
        id: dealerships.id,
        name: dealerships.name,
      })
      .from(dealerships)
      .where(inArray(dealerships.id, dealershipIds));

      dealershipResults.forEach(d => {
        dealershipMap.set(d.id, d.name);
      });
    }

    // Get inviter names
    const inviterIds = allInvitations
      .filter(inv => inv.invited_by !== null)
      .map(inv => inv.invited_by);

    const inviterMap = new Map();

    if (inviterIds.length > 0) {
      const inviterResults = await db.select({
        id: users.id,
        name: users.name,
        username: users.username,
      })
      .from(users)
      .where(inArray(users.id, inviterIds));

      inviterResults.forEach(u => {
        inviterMap.set(u.id, u.name || u.username);
      });
    }

    // Enrich invitations with dealership and inviter names
    const enrichedInvitations = allInvitations.map(inv => ({
      ...inv,
      dealership_name: inv.dealership_id !== null ? dealershipMap.get(inv.dealership_id) : null,
      invited_by_name: inv.invited_by !== null ? inviterMap.get(inv.invited_by) : null,
    }));

    res.json({ invitations: enrichedInvitations });
  } catch (error) {
    logger.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

/**
 * Delete an invitation
 * DELETE /api/admin/invitations/:id
 */
router.delete('/invitations/:id', async (req: Request, res: Response) => {
  try {
    const invitationId = parseInt(req.params.id);

    if (isNaN(invitationId)) {
      return res.status(400).json({ error: 'Invalid invitation ID' });
    }

    // Check if invitation exists
    const existingInvitation = await db.select({
      id: magicLinkInvitations.id,
      email: magicLinkInvitations.email
    })
    .from(magicLinkInvitations)
    .where(eq(magicLinkInvitations.id, invitationId));

    if (existingInvitation.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Delete the invitation
    await db.delete(magicLinkInvitations).where(eq(magicLinkInvitations.id, invitationId));

    logger.info('Invitation deleted', {
      invitationId,
      email: existingInvitation[0].email,
      deletedBy: req.session.user.id
    });

    res.json({ message: 'Invitation deleted successfully' });
  } catch (error) {
    logger.error('Error deleting invitation:', error);
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

/**
 * Resend an invitation
 * POST /api/admin/invitations/:id/resend
 */
router.post('/invitations/:id/resend', async (req: Request, res: Response) => {
  try {
    const invitationId = parseInt(req.params.id);

    if (isNaN(invitationId)) {
      return res.status(400).json({ error: 'Invalid invitation ID' });
    }

    // Check if invitation exists
    const existingInvitation = await db.select()
      .from(magicLinkInvitations)
      .where(eq(magicLinkInvitations.id, invitationId));

    if (existingInvitation.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = existingInvitation[0];

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation is not pending' });
    }

    // Reset expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update invitation
    const updatedInvitation = await db.update(magicLinkInvitations)
      .set({
        expires_at: expiresAt,
      })
      .where(eq(magicLinkInvitations.id, invitationId))
      .returning();

    logger.info('Invitation updated for resend', {
      invitationId,
      email: invitation.email,
      updatedBy: req.session.user.id
    });

    // Get dealership name if applicable
    let dealershipName = 'RylieAI';
    if (invitation.dealership_id !== null) {
      const dealershipResult = await db.select({ name: dealerships.name })
        .from(dealerships)
        .where(eq(dealerships.id, invitation.dealership_id));

      if (dealershipResult.length > 0) {
        dealershipName = dealershipResult[0].name;
      }
    }

    // Send invitation email if email service is configured
    try {
      const inviteUrl = `${process.env.APP_URL || 'http://localhost:5000'}/magic-link?token=${invitation.token}`;

      await sendEmail({
        to: invitation.email,
        subject: `Invitation to Join ${dealershipName} on RylieAI (Reminder)`,
        text: `Hello,\n\nThis is a reminder that you have been invited to join ${dealershipName} on RylieAI. Please click the link below to accept the invitation and create your account:\n\n${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nRegards,\nThe RylieAI Team`,
        html: `
          <h2>Invitation to Join ${dealershipName} (Reminder)</h2>
          <p>Hello,</p>
          <p>This is a reminder that you have been invited to join ${dealershipName} on RylieAI. Please click the button below to accept the invitation and create your account:</p>
          <p style="margin: 20px 0;">
            <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
          </p>
          <p>Or copy and paste this URL into your browser:</p>
          <p>${inviteUrl}</p>
          <p>This invitation will expire in 7 days.</p>
          <p>Regards,<br>The RylieAI Team</p>
        `
      });

      logger.info('Invitation email resent', {
        invitationId,
        email: invitation.email
      });
    } catch (emailError) {
      logger.warn('Failed to resend invitation email', {
        invitationId,
        email: invitation.email,
        error: emailError
      });
    }

    res.json({
      message: 'Invitation resent successfully',
      invitation: {
        id: updatedInvitation[0].id,
        email: updatedInvitation[0].email,
        role: updatedInvitation[0].role,
        dealership_id: updatedInvitation[0].dealership_id,
        status: updatedInvitation[0].status,
        expires_at: updatedInvitation[0].expires_at,
      }
    });
  } catch (error) {
    logger.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

export default router;