import { randomBytes, createHash } from 'crypto';
import db from '../db';
import { eq, and, gte } from 'drizzle-orm';
import logger from '../utils/logger';
import { magicLinkInvitations, users } from '@shared/schema';
import { sendEmail } from './email-service';

/**
 * Generate a secure random token for magic link authentication
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token for secure storage
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Send a magic link invitation email
 * 
 * @param email - The recipient's email address
 * @param baseUrl - The base URL for constructing the magic link
 * @param options - Additional options for the invitation
 * @returns Object with success status and error message if applicable
 */
export async function sendInvitation(
  email: string,
  baseUrl: string,
  options: {
    invitedBy?: string;
    dealershipId?: number;
    role?: string;
    expirationHours?: number;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate a token
    const token = generateToken();
    const hashedToken = hashToken(token);
    
    // Set expiration (default 24 hours)
    const expirationHours = options.expirationHours || 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const userExists = existingUser.length > 0;
    
    // Save the invitation in the database
    await db.insert(magicLinkInvitations).values({
      email,
      token: hashedToken,
      expiresAt,
      invitedBy: options.invitedBy,
      dealershipId: options.dealershipId,
      role: options.role || 'user',
      used: false,
      createdAt: new Date(),
    });
    
    // Construct the magic link URL
    const magicLinkUrl = `${baseUrl}/verify-magic-link?token=${token}&email=${encodeURIComponent(email)}`;
    
    // Prepare email content
    const subject = userExists 
      ? 'Your Magic Link to Sign In' 
      : 'Invitation to Join the Platform';
      
    const htmlContent = userExists
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your Sign In Link</h2>
          <p>Click the button below to sign in to your account. This link will expire in ${expirationHours} hours.</p>
          <div style="margin: 30px 0;">
            <a href="${magicLinkUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Sign In Now</a>
          </div>
          <p>If you didn't request this link, you can safely ignore this email.</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've Been Invited!</h2>
          <p>You've been invited to join the platform. Click the button below to create your account and get started.</p>
          <div style="margin: 30px 0;">
            <a href="${magicLinkUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
          </div>
          <p>This invitation will expire in ${expirationHours} hours.</p>
        </div>
      `;
    
    const textContent = userExists
      ? `Your Sign In Link: Click the following link to sign in to your account. This link will expire in ${expirationHours} hours: ${magicLinkUrl}`
      : `You've Been Invited! You've been invited to join the platform. Click the following link to create your account: ${magicLinkUrl}. This invitation will expire in ${expirationHours} hours.`;
    
    // Send the email
    const emailResult = await sendEmail({
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
    });
    
    if (!emailResult.success) {
      logger.error('Failed to send magic link email', { 
        error: emailResult.error,
        email 
      });
      return { success: false, error: 'Failed to send email. Please try again later.' };
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error creating magic link invitation', error);
    return { success: false, error: 'Failed to create invitation. Please try again later.' };
  }
}

/**
 * Verify a magic link token
 * 
 * @param email - The user's email address
 * @param token - The token from the magic link
 * @returns Object with success status, user ID, and expiration time if successful
 */
export async function verifyMagicLinkToken(
  email: string,
  token: string
): Promise<{ 
  success: boolean; 
  error?: string;
  userId?: number;
  expiresAt?: Date;
}> {
  try {
    const hashedToken = hashToken(token);
    const now = new Date();
    
    // Find the invitation
    const invitation = await db.select()
      .from(magicLinkInvitations)
      .where(
        and(
          eq(magicLinkInvitations.email, email),
          eq(magicLinkInvitations.token, hashedToken),
          eq(magicLinkInvitations.used, false),
          gte(magicLinkInvitations.expiresAt, now)
        )
      )
      .limit(1);
    
    if (!invitation[0]) {
      return { 
        success: false, 
        error: 'Invalid or expired magic link.' 
      };
    }
    
    const validInvitation = invitation[0];
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    let userId: number;
    
    // If user doesn't exist, create a new user
    if (!existingUser[0]) {
      const newUser = await db.insert(users).values({
        email,
        role: validInvitation.role || 'user',
        dealership_id: validInvitation.dealershipId || null,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning({ id: users.id });
      
      userId = newUser[0].id;
    } else {
      userId = existingUser[0].id;
    }
    
    // Mark the invitation as used
    await db.update(magicLinkInvitations)
      .set({ 
        used: true,
        usedAt: now 
      })
      .where(eq(magicLinkInvitations.id, validInvitation.id));
    
    return { 
      success: true,
      userId,
      expiresAt: validInvitation.expiresAt
    };
  } catch (error) {
    logger.error('Error verifying magic link token', error);
    return { 
      success: false, 
      error: 'Error verifying magic link. Please try again.' 
    };
  }
}