/**
 * Service for scheduling and managing follow-ups
 */
import { db } from '../db';
import { followUps } from '../../shared/schema-extensions';
import { users } from '../../shared/enhanced-schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { sendEmail } from './email-service';
import * as schedule from 'node-schedule';

// Store scheduled jobs in memory
const scheduledJobs: Record<string, schedule.Job> = {};

/**
 * Schedule a follow-up for a lead
 */
export async function scheduleFollowUp({
  conversationId,
  dealershipId,
  customerName,
  customerContact,
  assignedTo,
  scheduledTime,
  notes
}: {
  conversationId: number;
  dealershipId: number;
  customerName: string;
  customerContact?: string;
  assignedTo: number;
  scheduledTime: Date;
  notes?: string;
}) {
  // Store follow-up in database
  const [followUp] = await db.insert(followUps).values({
    conversationId,
    dealershipId,
    customerName,
    customerContact: customerContact || '',
    assignedTo,
    scheduledTime,
    notes,
    status: 'scheduled'
  }).returning();

  // Schedule reminder job
  scheduleReminderJob(followUp);

  return followUp;
}

/**
 * Schedule the reminder job for a follow-up
 */
function scheduleReminderJob(followUp: typeof followUps.$inferSelect) {
  const jobId = `followup-${followUp.id}`;

  // Cancel existing job if it exists
  if (scheduledJobs[jobId]) {
    scheduledJobs[jobId].cancel();
  }

  // Schedule new job
  scheduledJobs[jobId] = schedule.scheduleJob(followUp.scheduledTime, async () => {
    await sendFollowUpReminder(followUp.id);
  });
}

/**
 * Send a reminder email for a follow-up
 */
async function sendFollowUpReminder(followUpId: number) {
  try {
    // Get follow-up details
    const [followUp] = await db.select().from(followUps)
      .where(eq(followUps.id, followUpId));

    if (!followUp || followUp.status !== 'scheduled') {
      return false;
    }

    // Get user email
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, followUp.assignedTo));

    if (!user?.email) {
      console.error(`Cannot send follow-up reminder: User ${followUp.assignedTo} has no email`);
      return false;
    }

    // Send reminder email
    const success = await sendEmail(process.env.SENDGRID_API_KEY, {
      to: user.email,
      subject: `Follow-up Reminder: ${followUp.customerName}`,
      text: `This is a reminder to follow up with ${followUp.customerName} (${followUp.customerContact}).\n\nNotes: ${followUp.notes || 'No notes provided'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0;">
          <h2 style="color: #1a73e8;">Follow-up Reminder</h2>
          <p><strong>Customer:</strong> ${followUp.customerName}</p>
          <p><strong>Contact:</strong> ${followUp.customerContact || 'Not provided'}</p>
          <p><strong>Notes:</strong> ${followUp.notes || 'No notes provided'}</p>
          <p><a href="/conversations/${followUp.conversationId}" style="background-color: #1a73e8; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">View Conversation</a></p>
        </div>
      `
    });

    if (success) {
      // Update status
      await db.update(followUps)
        .set({
          status: 'reminded',
          updatedAt: new Date()
        })
        .where(eq(followUps.id, followUp.id));

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error sending follow-up reminder:', error);
    return false;
  }
}

/**
 * Get follow-ups for a user
 */
export async function getUserFollowUps(userId: number, status?: string) {
  const query = db.select().from(followUps)
    .where(eq(followUps.assignedTo, userId));

  if (status) {
    query.where(eq(followUps.status, status));
  }

  return query.orderBy(followUps.scheduledTime);
}

/**
 * Get follow-ups for a dealership
 */
export async function getDealershipFollowUps(
  dealershipId: number,
  status?: string,
  dateRange?: { start: Date; end: Date }
) {
  let query = db.select().from(followUps)
    .where(eq(followUps.dealershipId, dealershipId));

  if (status) {
    query = query.where(eq(followUps.status, status));
  }

  if (dateRange) {
    query = query.where(and(
      gte(followUps.scheduledTime, dateRange.start),
      lte(followUps.scheduledTime, dateRange.end)
    ));
  }

  return query.orderBy(followUps.scheduledTime);
}

/**
 * Mark a follow-up as completed
 */
export async function completeFollowUp(followUpId: number, notes?: string) {
  const [updatedFollowUp] = await db.update(followUps)
    .set({
      status: 'completed',
      completedAt: new Date(),
      notes: notes ? `${followUps.notes || ''}\n\nCompletion notes: ${notes}` : followUps.notes,
      updatedAt: new Date()
    })
    .where(eq(followUps.id, followUpId))
    .returning();

  // Cancel scheduled job if it exists
  const jobId = `followup-${followUpId}`;
  if (scheduledJobs[jobId]) {
    scheduledJobs[jobId].cancel();
    delete scheduledJobs[jobId];
  }

  return updatedFollowUp;
}

/**
 * Cancel a follow-up
 */
export async function cancelFollowUp(followUpId: number, reason?: string) {
  const [updatedFollowUp] = await db.update(followUps)
    .set({
      status: 'cancelled',
      notes: reason ? `${followUps.notes || ''}\n\nCancellation reason: ${reason}` : followUps.notes,
      updatedAt: new Date()
    })
    .where(eq(followUps.id, followUpId))
    .returning();

  // Cancel scheduled job if it exists
  const jobId = `followup-${followUpId}`;
  if (scheduledJobs[jobId]) {
    scheduledJobs[jobId].cancel();
    delete scheduledJobs[jobId];
  }

  return updatedFollowUp;
}

/**
 * Initialize follow-up scheduler by loading all scheduled follow-ups from database
 */
export async function initializeFollowUpScheduler() {
  try {
    const pendingFollowUps = await db.select().from(followUps)
      .where(and(
        eq(followUps.status, 'scheduled'),
        gte(followUps.scheduledTime, new Date())
      ));

    console.log(`Scheduling ${pendingFollowUps.length} pending follow-ups`);

    for (const followUp of pendingFollowUps) {
      scheduleReminderJob(followUp);
    }

    return true;
  } catch (error) {
    console.error('Error initializing follow-up scheduler:', error);
    return false;
  }
}