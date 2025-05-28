/**
 * Service for user management and invitations
 */
import { db } from '../db';
import { users } from '../../shared/schema';
import { dealerships } from '../../shared/enhanced-schema';
import { eq, and, gte } from 'drizzle-orm';
import { sendEmail } from './email-service';
import { randomBytes } from 'crypto';

// Temporary interfaces until schema-extensions is fixed
interface UserInvitation {
  id: number;
  email: string;
  role: string;
  dealershipId: number;
  invitedBy: number;
  token: string;
  expiresAt: Date;
  status: string;
}

interface AuditLog {
  id: number;
  userId?: number;
  dealershipId?: number;
  action: string;
  resourceType?: string;
  resourceId?: number;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

// Temporary table objects
const userInvitations = {
  id: 'id',
  email: 'email',
  role: 'role',
  dealershipId: 'dealershipId',
  invitedBy: 'invitedBy',
  token: 'token',
  expiresAt: 'expiresAt',
  status: 'status'
};

const auditLogs = {
  id: 'id',
  userId: 'userId',
  dealershipId: 'dealershipId',
  action: 'action',
  resourceType: 'resourceType',
  resourceId: 'resourceId',
  details: 'details',
  ipAddress: 'ipAddress',
  createdAt: 'createdAt'
};

/**
 * Create a user invitation
 */
export async function createUserInvitation({
  email,
  role,
  dealershipId,
  invitedBy
}: {
  email: string;
  role: string;
  dealershipId: number;
  invitedBy: number;
}) {
  // Generate a secure token
  const token = randomBytes(32).toString('hex');

  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Create invitation record
  const [invitation] = await db.insert(userInvitations).values({
    email,
    role,
    dealershipId,
    invitedBy,
    token,
    expiresAt,
    status: 'pending'
  }).returning();

  // Log the action
  await logAuditEvent({
    userId: invitedBy,
    dealershipId,
    action: 'create_invitation',
    resourceType: 'user_invitation',
    resourceId: invitation.id,
    details: { email, role }
  });

  // Send invitation email
  const inviteUrl = `${process.env.APP_URL}/accept-invitation?token=${token}`;

  // Get inviter's name
  const [inviter] = await db.select().from(users).where(eq(users.id, invitedBy));
  if (!inviter) {
    throw new Error('Inviter user not found');
  }
  const inviterName = inviter.name || 'A dealership administrator';

  // Get dealership name
  const [dealership] = await db.select().from(dealerships).where(eq(dealerships.id, dealershipId));
  if (!dealership) {
    throw new Error('Dealership not found');
  }
  const dealershipName = dealership.name || 'our dealership';

  await sendEmail({
    to: email,
    subject: `Invitation to join ${dealershipName} on Rylie AI`,
    text: `
      ${inviterName} has invited you to join ${dealershipName} on Rylie AI.

      Click the link below to accept the invitation and create your account:
      ${inviteUrl}

      This invitation will expire in 7 days.
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0;">
        <h2 style="color: #1a73e8;">You've been invited to join Rylie AI</h2>
        <p>${inviterName} has invited you to join <strong>${dealershipName}</strong> on Rylie AI.</p>
        <p>Click the button below to accept the invitation and create your account:</p>
        <p style="margin: 30px 0;">
          <a href="${inviteUrl}" style="background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Accept Invitation</a>
        </p>
        <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
      </div>
    `
  });

  return invitation;
}

/**
 * Verify and accept a user invitation
 */
export async function acceptUserInvitation(token: string, userData: {
  name: string;
  password: string;
}) {
  // Find the invitation
  const [invitation] = await db.select().from(userInvitations)
    .where(and(
      eq(userInvitations.token, token),
      eq(userInvitations.status, 'pending'),
      gte(userInvitations.expiresAt, new Date())
    ));

  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }

  // Create the user
  const [user] = await db.insert(users).values({
    email: invitation.email,
    name: userData.name,
    password: await hashPassword(userData.password),
    role: invitation.role,
    dealership_id: invitation.dealershipId,
    is_verified: true
  }).returning();

  // Update invitation status
  await db.update(userInvitations)
    .set({
      status: 'accepted',
      updatedAt: new Date()
    })
    .where(eq(userInvitations.id, invitation.id));

  // Log the action
  await logAuditEvent({
    userId: user.id,
    dealershipId: invitation.dealershipId,
    action: 'accept_invitation',
    resourceType: 'user',
    resourceId: user.id,
    details: { invitationId: invitation.id }
  });

  return user;
}

/**
 * Get pending invitations for a dealership
 */
export async function getPendingInvitations(dealershipId: number) {
  return db.select().from(userInvitations)
    .where(and(
      eq(userInvitations.dealershipId, dealershipId),
      eq(userInvitations.status, 'pending')
    ));
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(invitationId: number, cancelledBy: number) {
  const [invitation] = await db.update(userInvitations)
    .set({
      status: 'cancelled',
      updatedAt: new Date()
    })
    .where(eq(userInvitations.id, invitationId))
    .returning();

  if (invitation) {
    // Log the action
    await logAuditEvent({
      userId: cancelledBy,
      dealershipId: invitation.dealershipId,
      action: 'cancel_invitation',
      resourceType: 'user_invitation',
      resourceId: invitation.id,
      details: { email: invitation.email }
    });
  }

  return invitation;
}

/**
 * Log an audit event
 */
export async function logAuditEvent({
  userId,
  dealershipId,
  action,
  resourceType,
  resourceId,
  details,
  ipAddress
}: {
  userId?: number;
  dealershipId?: number;
  action: string;
  resourceType?: string;
  resourceId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
}) {
  return db.insert(auditLogs).values({
    userId,
    dealershipId,
    action,
    resourceType,
    resourceId,
    details: details || {},
    ipAddress
  });
}

/**
 * Get audit logs for a dealership
 */
export async function getAuditLogs(dealershipId: number, limit: number = 100) {
  return db.select().from(auditLogs)
    .where(eq(auditLogs.dealershipId, dealershipId))
    .orderBy(auditLogs.createdAt)
    .limit(limit);
}

/**
 * Helper function to hash passwords
 */
async function hashPassword(password: string): Promise<string> {
  // In a real implementation, use bcrypt or similar
  // This is a placeholder
  return `hashed_${password}`;
}