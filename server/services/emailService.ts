/**
 * Email Service
 * Handles all email notifications for the RylieSEO platform
 */

import sgMail from '@sendgrid/mail';
import { getDB } from '../models/database';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('SendGrid API key not configured - emails will not be sent');
}

// Email templates
const TEMPLATES = {
  ONBOARDING_CONFIRMATION: 'd-1234567890', // Replace with actual SendGrid template ID
  TASK_COMPLETED: 'd-2345678901',
  DELIVERABLE_READY: 'd-3456789012',
  WEEKLY_DIGEST: 'd-4567890123'
};

// From email addresses
const FROM_EMAILS = {
  NOREPLY: 'noreply@rylieseo.com',
  SUPPORT: 'support@rylieseo.com',
  NOTIFICATIONS: 'notifications@rylieseo.com'
};

interface OnboardingEmailData {
  dealershipEmail: string;
  dealershipName: string;
  contactName: string;
  package: string;
  submissionId: string;
  tasksCreated: number;
}

interface TaskCompletedEmailData {
  agencyEmail: string;
  agencyName: string;
  dealershipName: string;
  taskType: string;
  taskTitle: string;
  completedBy: string;
  deliverableUrl?: string;
}

interface DeliverableReadyEmailData {
  agencyEmails: string[];
  agencyName: string;
  dealershipName: string;
  deliverableType: string;
  fileName: string;
  downloadUrl: string;
}

/**
 * Send onboarding confirmation emails
 */
export async function sendOnboardingEmails(data: OnboardingEmailData): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.log('Email service not configured - skipping onboarding emails');
    return;
  }

  try {
    // Email to dealership
    const dealershipEmail = {
      to: data.dealershipEmail,
      from: FROM_EMAILS.NOREPLY,
      subject: `Welcome to SEOWerks - ${data.dealershipName}`,
      html: `
        <h2>Welcome to SEOWerks!</h2>
        <p>Dear ${data.contactName},</p>
        <p>Thank you for choosing SEOWerks for your automotive SEO needs. We've received your onboarding submission and are excited to help ${data.dealershipName} dominate local search results.</p>
        
        <h3>Your Package: ${data.package}</h3>
        <p>Based on your ${data.package} package selection, we've created ${data.tasksCreated} initial tasks to kickstart your SEO journey:</p>
        
        ${data.package === 'PLATINUM' ? `
          <ul>
            <li>9 Landing Pages per month</li>
            <li>12 Blog Posts per month</li>
            <li>20 Google Business Profile posts per month</li>
            <li>20 SEO improvements per month</li>
          </ul>
        ` : data.package === 'GOLD' ? `
          <ul>
            <li>5 Landing Pages per month</li>
            <li>6 Blog Posts per month</li>
            <li>12 Google Business Profile posts per month</li>
            <li>10 SEO improvements per month</li>
          </ul>
        ` : `
          <ul>
            <li>3 Landing Pages per month</li>
            <li>3 Blog Posts per month</li>
            <li>8 Google Business Profile posts per month</li>
            <li>8 SEO improvements per month</li>
          </ul>
        `}
        
        <h3>What Happens Next?</h3>
        <ol>
          <li>Our SEO team will review your submission within 24 hours</li>
          <li>We'll begin working on your initial tasks immediately</li>
          <li>You'll receive login credentials to track progress</li>
          <li>Expect to see initial improvements within 30-60 days</li>
        </ol>
        
        <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
        
        <p>Best regards,<br>The SEOWerks Team</p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          Submission ID: ${data.submissionId}<br>
          This email was sent to ${data.dealershipEmail} because you signed up for SEOWerks services.
        </p>
      `,
      // Use SendGrid template if configured
      // templateId: TEMPLATES.ONBOARDING_CONFIRMATION,
      // dynamicTemplateData: data
    };

    await sgMail.send(dealershipEmail);
    console.log(`Onboarding confirmation sent to ${data.dealershipEmail}`);

    // Email to SEOWerks team
    const teamEmail = {
      to: 'team@seowerks.ai', // Replace with actual team email
      from: FROM_EMAILS.NOTIFICATIONS,
      subject: `New Onboarding: ${data.dealershipName} (${data.package})`,
      html: `
        <h2>New Dealership Onboarding</h2>
        <p><strong>Dealership:</strong> ${data.dealershipName}</p>
        <p><strong>Package:</strong> ${data.package}</p>
        <p><strong>Contact:</strong> ${data.contactName} (${data.dealershipEmail})</p>
        <p><strong>Tasks Created:</strong> ${data.tasksCreated}</p>
        <p><strong>Submission ID:</strong> ${data.submissionId}</p>
        
        <p><a href="https://rylieseo.com/admin/seowerks-queue">View in Queue</a></p>
      `
    };

    await sgMail.send(teamEmail);
    console.log('Team notification sent for new onboarding');

    // Log email activity (using database directly)
    const db = getDB();
    // TODO: Implement activity logging with Drizzle ORM
    console.log('Email activity logged:', {
      action: 'email_sent',
      entity_type: 'onboarding',
      entity_id: data.submissionId,
      recipient: data.dealershipEmail,
      dealership: data.dealershipName
    });

  } catch (error) {
    console.error('Failed to send onboarding emails:', error);
    throw error;
  }
}

/**
 * Send task completed notification
 */
export async function sendTaskCompletedEmail(data: TaskCompletedEmailData): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.log('Email service not configured - skipping task completed email');
    return;
  }

  try {
    const email = {
      to: data.agencyEmail,
      from: FROM_EMAILS.NOTIFICATIONS,
      subject: `Task Completed: ${data.taskTitle}`,
      html: `
        <h2>Task Completed</h2>
        <p>Great news! A task for ${data.dealershipName} has been completed.</p>
        
        <h3>Task Details:</h3>
        <ul>
          <li><strong>Type:</strong> ${data.taskType}</li>
          <li><strong>Title:</strong> ${data.taskTitle}</li>
          <li><strong>Completed by:</strong> ${data.completedBy}</li>
          <li><strong>Dealership:</strong> ${data.dealershipName}</li>
        </ul>
        
        ${data.deliverableUrl ? `
          <p><strong>Deliverable is ready for download:</strong></p>
          <p><a href="${data.deliverableUrl}" style="display: inline-block; padding: 10px 20px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Download Deliverable</a></p>
        ` : `
          <p>The deliverable is being processed and will be available soon.</p>
        `}
        
        <p>Log in to your dashboard to view more details.</p>
        
        <p>Best regards,<br>The RylieSEO Team</p>
      `
    };

    await sgMail.send(email);
    console.log(`Task completed email sent to ${data.agencyEmail}`);

  } catch (error) {
    console.error('Failed to send task completed email:', error);
    throw error;
  }
}

/**
 * Send deliverable ready notification
 */
export async function sendDeliverableReadyEmail(data: DeliverableReadyEmailData): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.log('Email service not configured - skipping deliverable ready email');
    return;
  }

  try {
    const email = {
      to: data.agencyEmails,
      from: FROM_EMAILS.NOTIFICATIONS,
      subject: `Deliverable Ready: ${data.fileName}`,
      html: `
        <h2>Your Deliverable is Ready!</h2>
        <p>A new deliverable for ${data.dealershipName} is ready for download.</p>
        
        <h3>Deliverable Details:</h3>
        <ul>
          <li><strong>Type:</strong> ${data.deliverableType}</li>
          <li><strong>File:</strong> ${data.fileName}</li>
          <li><strong>Dealership:</strong> ${data.dealershipName}</li>
        </ul>
        
        <p><a href="${data.downloadUrl}" style="display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Now</a></p>
        
        <p><em>This download link will expire in 7 days for security reasons.</em></p>
        
        <p>You can also access all your deliverables from your dashboard.</p>
        
        <p>Best regards,<br>The ${data.agencyName} Team</p>
      `
    };

    await sgMail.send(email);
    console.log(`Deliverable ready email sent to ${data.agencyEmails.length} recipients`);

  } catch (error) {
    console.error('Failed to send deliverable ready email:', error);
    throw error;
  }
}

/**
 * Send weekly performance digest
 */
export async function sendWeeklyDigest(
  agencyId: string,
  recipients: string[],
  metrics: any
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.log('Email service not configured - skipping weekly digest');
    return;
  }

  try {
    // Format metrics for email
    const email = {
      to: recipients,
      from: FROM_EMAILS.NOTIFICATIONS,
      subject: `Weekly SEO Performance Report - ${new Date().toLocaleDateString()}`,
      html: `
        <h2>Weekly Performance Summary</h2>
        <p>Here's how your dealerships performed this week:</p>
        
        <h3>Key Metrics:</h3>
        <table style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Traffic</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${metrics.totalTraffic || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Organic Sessions</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${metrics.organicSessions || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Conversions</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${metrics.conversions || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Tasks Completed</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${metrics.tasksCompleted || 0}</td>
          </tr>
        </table>
        
        <h3>Work Completed This Week:</h3>
        <ul>
          <li>${metrics.pagesCreated || 0} landing pages created</li>
          <li>${metrics.blogsPublished || 0} blog posts published</li>
          <li>${metrics.gbpPosts || 0} Google Business Profile posts</li>
          <li>${metrics.improvements || 0} SEO improvements</li>
        </ul>
        
        <p><a href="https://rylieseo.com/analytics" style="display: inline-block; padding: 10px 20px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">View Full Report</a></p>
        
        <p>Have questions about your performance? Reply to this email and our team will help.</p>
        
        <p>Best regards,<br>The RylieSEO Team</p>
      `
    };

    await sgMail.send(email);
    console.log(`Weekly digest sent to ${recipients.length} recipients`);

  } catch (error) {
    console.error('Failed to send weekly digest:', error);
    throw error;
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(testEmail: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.error('SendGrid API key not configured');
    return false;
  }

  try {
    const msg = {
      to: testEmail,
      from: FROM_EMAILS.NOREPLY,
      subject: 'RylieSEO Email Test',
      text: 'This is a test email from RylieSEO to verify email configuration.',
      html: '<p>This is a test email from <strong>RylieSEO</strong> to verify email configuration.</p>'
    };

    await sgMail.send(msg);
    console.log(`Test email sent successfully to ${testEmail}`);
    return true;
  } catch (error) {
    console.error('Email test failed:', error);
    return false;
  }
}

// Export aliases for backward compatibility
export const sendTaskCompletionEmail = sendTaskCompletedEmail;
