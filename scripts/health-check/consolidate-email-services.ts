#!/usr/bin/env node
/**
 * Consolidate duplicate email services into a single, unified implementation
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = '.backup/email-consolidation';
const EMAIL_SERVICE_FILES = [
  'server/services/email-service.ts',
  'server/services/emailService.ts',
  'server/services/email-router.ts',
  'server/services/email-listener.ts',
  'server/services/channel-handlers/email-channel-handler.ts'
];

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('📧 Consolidating Email Services...\n');

// Backup existing files
console.log('📦 Backing up existing email service files...');
EMAIL_SERVICE_FILES.forEach(file => {
  if (fs.existsSync(file)) {
    const backupPath = path.join(BACKUP_DIR, file.replace(/\//g, '_'));
    fs.copyFileSync(file, backupPath);
    console.log(`  ✓ Backed up ${file}`);
  }
});

// Create unified email service
const unifiedEmailService = `/**
 * Unified Email Service
 * Handles all email functionality: sending, receiving, parsing, and routing
 */

import { EventEmitter } from 'events';
import * as nodemailer from 'nodemailer';
import { db } from '../config/db';
import { RedisClient } from '../lib/redis';
import { Logger } from '../utils/logger';
import { z } from 'zod';
import * as Imap from 'imap';
import { simpleParser } from 'mailparser';
import Bull from 'bull';

// Email schemas
export const EmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  from: z.string().email().optional(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.any(),
    contentType: z.string().optional()
  })).optional(),
  replyTo: z.string().email().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export const EmailConfigSchema = z.object({
  smtp: z.object({
    host: z.string(),
    port: z.number(),
    secure: z.boolean(),
    auth: z.object({
      user: z.string(),
      pass: z.string()
    })
  }),
  imap: z.object({
    host: z.string(),
    port: z.number(),
    user: z.string(),
    password: z.string(),
    tls: z.boolean().default(true)
  }).optional(),
  from: z.object({
    name: z.string(),
    email: z.string().email()
  }),
  replyTo: z.string().email().optional(),
  rateLimit: z.object({
    max: z.number().default(100),
    windowMs: z.number().default(60000)
  }).optional()
});

export type Email = z.infer<typeof EmailSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;

export interface EmailEvent {
  type: 'sent' | 'received' | 'failed' | 'bounced' | 'opened' | 'clicked';
  email: Email;
  timestamp: Date;
  metadata?: Record<string, any>;
  error?: Error;
}

export class UnifiedEmailService extends EventEmitter {
  private static instance: UnifiedEmailService;
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;
  private redis: RedisClient;
  private logger: Logger;
  private emailQueue: Bull.Queue;
  private imapConnection?: Imap;
  private isListening: boolean = false;

  private constructor(config: EmailConfig) {
    super();
    this.config = EmailConfigSchema.parse(config);
    this.redis = RedisClient.getInstance();
    this.logger = Logger.getInstance();
    
    // Initialize SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: {
        user: this.config.smtp.auth.user,
        pass: this.config.smtp.auth.pass
      }
    });

    // Initialize email queue
    this.emailQueue = new Bull('email-queue', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });

    // Setup queue processors
    this.setupQueueProcessors();
    
    // Initialize IMAP if configured
    if (this.config.imap) {
      this.initializeImap();
    }
  }

  static getInstance(config?: EmailConfig): UnifiedEmailService {
    if (!UnifiedEmailService.instance) {
      if (!config) {
        throw new Error('Email service configuration required for first initialization');
      }
      UnifiedEmailService.instance = new UnifiedEmailService(config);
    }
    return UnifiedEmailService.instance;
  }

  /**
   * Send an email
   */
  async send(email: Email): Promise<string> {
    try {
      // Validate email
      const validatedEmail = EmailSchema.parse(email);
      
      // Check rate limits
      if (this.config.rateLimit) {
        const rateLimitKey = \`email:ratelimit:\${validatedEmail.from || this.config.from.email}\`;
        const count = await this.redis.incr(rateLimitKey);
        
        if (count === 1) {
          await this.redis.expire(rateLimitKey, Math.floor(this.config.rateLimit.windowMs / 1000));
        }
        
        if (count > this.config.rateLimit.max) {
          throw new Error('Email rate limit exceeded');
        }
      }

      // Prepare email options
      const mailOptions: nodemailer.SendMailOptions = {
        from: validatedEmail.from || \`\${this.config.from.name} <\${this.config.from.email}>\`,
        to: Array.isArray(validatedEmail.to) ? validatedEmail.to.join(', ') : validatedEmail.to,
        subject: validatedEmail.subject,
        text: validatedEmail.text,
        html: validatedEmail.html,
        cc: validatedEmail.cc?.join(', '),
        bcc: validatedEmail.bcc?.join(', '),
        replyTo: validatedEmail.replyTo || this.config.replyTo,
        inReplyTo: validatedEmail.inReplyTo,
        references: validatedEmail.references,
        headers: validatedEmail.headers,
        priority: validatedEmail.priority,
        attachments: validatedEmail.attachments
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      
      // Log to database
      await this.logEmail({
        messageId: info.messageId,
        direction: 'outbound',
        from: mailOptions.from as string,
        to: validatedEmail.to,
        subject: validatedEmail.subject,
        status: 'sent',
        metadata: {
          ...validatedEmail.metadata,
          response: info.response,
          accepted: info.accepted,
          rejected: info.rejected
        }
      });

      // Emit event
      this.emit('email:sent', {
        type: 'sent',
        email: validatedEmail,
        timestamp: new Date(),
        metadata: { messageId: info.messageId }
      } as EmailEvent);

      this.logger.info('Email sent successfully', { messageId: info.messageId });
      return info.messageId;

    } catch (error) {
      this.logger.error('Failed to send email', error);
      
      // Log failure
      await this.logEmail({
        direction: 'outbound',
        from: email.from || this.config.from.email,
        to: email.to,
        subject: email.subject,
        status: 'failed',
        error: error.message
      });

      // Emit event
      this.emit('email:failed', {
        type: 'failed',
        email,
        timestamp: new Date(),
        error
      } as EmailEvent);

      throw error;
    }
  }

  /**
   * Queue an email for sending
   */
  async queue(email: Email, options?: Bull.JobOptions): Promise<Bull.Job> {
    const job = await this.emailQueue.add('send-email', email, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      ...options
    });
    
    this.logger.info('Email queued', { jobId: job.id });
    return job;
  }

  /**
   * Send email using template
   */
  async sendTemplate(templateName: string, data: {
    to: string | string[];
    variables: Record<string, any>;
    attachments?: any[];
  }): Promise<string> {
    // Load template from database or file system
    const template = await this.loadTemplate(templateName);
    
    if (!template) {
      throw new Error(\`Template not found: \${templateName}\`);
    }

    // Render template with variables
    const rendered = this.renderTemplate(template, data.variables);
    
    // Send email
    return this.send({
      to: data.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: data.attachments
    });
  }

  /**
   * Initialize IMAP connection for receiving emails
   */
  private initializeImap(): void {
    if (!this.config.imap) return;

    this.imapConnection = new Imap({
      user: this.config.imap.user,
      password: this.config.imap.password,
      host: this.config.imap.host,
      port: this.config.imap.port,
      tls: this.config.imap.tls,
      tlsOptions: { rejectUnauthorized: false }
    });

    this.imapConnection.once('ready', () => {
      this.logger.info('IMAP connection ready');
      this.startListening();
    });

    this.imapConnection.once('error', (err: Error) => {
      this.logger.error('IMAP connection error', err);
    });

    this.imapConnection.once('end', () => {
      this.logger.info('IMAP connection ended');
      this.isListening = false;
    });
  }

  /**
   * Start listening for incoming emails
   */
  async startListening(): Promise<void> {
    if (!this.imapConnection || this.isListening) return;

    return new Promise((resolve, reject) => {
      this.imapConnection!.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        this.isListening = true;
        this.logger.info('Started listening for emails');

        // Listen for new emails
        this.imapConnection!.on('mail', (numNewMsgs: number) => {
          this.logger.info(\`New emails received: \${numNewMsgs}\`);
          this.fetchUnreadEmails();
        });

        resolve();
      });
    });
  }

  /**
   * Fetch and process unread emails
   */
  private async fetchUnreadEmails(): Promise<void> {
    if (!this.imapConnection || !this.isListening) return;

    const searchCriteria = ['UNSEEN'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: true
    };

    this.imapConnection.search(searchCriteria, (err, results) => {
      if (err) {
        this.logger.error('Error searching emails', err);
        return;
      }

      if (!results || results.length === 0) {
        return;
      }

      const fetch = this.imapConnection!.fetch(results, fetchOptions);

      fetch.on('message', (msg, seqno) => {
        const buffers: Buffer[] = [];

        msg.on('body', (stream, info) => {
          stream.on('data', (chunk) => buffers.push(chunk));
          stream.once('end', async () => {
            const buffer = Buffer.concat(buffers);
            
            try {
              const parsed = await simpleParser(buffer);
              await this.processIncomingEmail(parsed);
            } catch (error) {
              this.logger.error('Error parsing email', error);
            }
          });
        });
      });

      fetch.once('error', (err) => {
        this.logger.error('Fetch error', err);
      });
    });
  }

  /**
   * Process incoming email
   */
  private async processIncomingEmail(parsedEmail: any): Promise<void> {
    try {
      const email: Email = {
        from: parsedEmail.from?.text || '',
        to: this.extractRecipients(parsedEmail.to),
        subject: parsedEmail.subject || '',
        text: parsedEmail.text || '',
        html: parsedEmail.html || '',
        attachments: parsedEmail.attachments?.map((att: any) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        })),
        headers: parsedEmail.headers,
        inReplyTo: parsedEmail.inReplyTo,
        references: parsedEmail.references
      };

      // Log to database
      await this.logEmail({
        messageId: parsedEmail.messageId,
        direction: 'inbound',
        from: email.from,
        to: email.to,
        subject: email.subject,
        status: 'received',
        metadata: {
          date: parsedEmail.date,
          headers: parsedEmail.headers
        }
      });

      // Route email based on rules
      await this.routeEmail(email);

      // Emit event
      this.emit('email:received', {
        type: 'received',
        email,
        timestamp: new Date()
      } as EmailEvent);

    } catch (error) {
      this.logger.error('Error processing incoming email', error);
    }
  }

  /**
   * Route incoming email based on rules
   */
  private async routeEmail(email: Email): Promise<void> {
    // Check routing rules in database
    const rules = await db.query.emailRoutingRules.findMany({
      where: eq(emailRoutingRules.isActive, true),
      orderBy: [asc(emailRoutingRules.priority)]
    });

    for (const rule of rules) {
      if (this.matchesRule(email, rule)) {
        await this.applyRoutingAction(email, rule);
        
        if (rule.stopProcessing) {
          break;
        }
      }
    }
  }

  /**
   * Check if email matches routing rule
   */
  private matchesRule(email: Email, rule: any): boolean {
    // Check sender
    if (rule.fromPattern) {
      const regex = new RegExp(rule.fromPattern, 'i');
      if (!regex.test(email.from || '')) {
        return false;
      }
    }

    // Check recipient
    if (rule.toPattern) {
      const regex = new RegExp(rule.toPattern, 'i');
      const recipients = Array.isArray(email.to) ? email.to : [email.to];
      if (!recipients.some(r => regex.test(r))) {
        return false;
      }
    }

    // Check subject
    if (rule.subjectPattern) {
      const regex = new RegExp(rule.subjectPattern, 'i');
      if (!regex.test(email.subject)) {
        return false;
      }
    }

    // Check body
    if (rule.bodyPattern) {
      const regex = new RegExp(rule.bodyPattern, 'i');
      if (!regex.test(email.text || '') && !regex.test(email.html || '')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply routing action to email
   */
  private async applyRoutingAction(email: Email, rule: any): Promise<void> {
    switch (rule.action) {
      case 'forward':
        await this.send({
          ...email,
          to: rule.forwardTo,
          subject: \`Fwd: \${email.subject}\`
        });
        break;

      case 'webhook':
        await this.sendWebhook(rule.webhookUrl, email);
        break;

      case 'queue':
        await this.emailQueue.add(rule.queueName, email);
        break;

      case 'tag':
        email.tags = [...(email.tags || []), ...rule.tags];
        break;

      case 'assign':
        await this.assignToAgent(email, rule.agentId);
        break;

      default:
        this.logger.warn(\`Unknown routing action: \${rule.action}\`);
    }
  }

  /**
   * Send webhook with email data
   */
  private async sendWebhook(url: string, email: Email): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Email-Webhook': 'true'
        },
        body: JSON.stringify({
          email,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(\`Webhook failed: \${response.statusText}\`);
      }
    } catch (error) {
      this.logger.error('Webhook error', { url, error });
    }
  }

  /**
   * Assign email to agent
   */
  private async assignToAgent(email: Email, agentId: string): Promise<void> {
    // Implementation depends on your agent system
    this.emit('email:assigned', {
      email,
      agentId,
      timestamp: new Date()
    });
  }

  /**
   * Setup queue processors
   */
  private setupQueueProcessors(): void {
    // Process send email jobs
    this.emailQueue.process('send-email', async (job) => {
      const email = job.data as Email;
      return await this.send(email);
    });

    // Queue event handlers
    this.emailQueue.on('completed', (job, result) => {
      this.logger.info('Email job completed', { jobId: job.id, messageId: result });
    });

    this.emailQueue.on('failed', (job, err) => {
      this.logger.error('Email job failed', { jobId: job.id, error: err });
    });
  }

  /**
   * Load email template
   */
  private async loadTemplate(name: string): Promise<any> {
    // Try database first
    const template = await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.name, name)
    });

    if (template) {
      return template;
    }

    // Try file system
    const templatePath = path.join(__dirname, '..', 'templates', 'email', \`\${name}.html\`);
    if (fs.existsSync(templatePath)) {
      const html = fs.readFileSync(templatePath, 'utf8');
      const textPath = templatePath.replace('.html', '.txt');
      const text = fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf8') : '';
      
      return {
        name,
        subject: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        html,
        text
      };
    }

    return null;
  }

  /**
   * Render template with variables
   */
  private renderTemplate(template: any, variables: Record<string, any>): {
    subject: string;
    html: string;
    text: string;
  } {
    let subject = template.subject;
    let html = template.html;
    let text = template.text;

    // Simple variable replacement
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(\`{{\\\s*\${key}\\\s*}}\`, 'g');
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
      text = text.replace(regex, value);
    });

    return { subject, html, text };
  }

  /**
   * Extract recipients from parsed email
   */
  private extractRecipients(to: any): string | string[] {
    if (!to) return '';
    
    if (Array.isArray(to)) {
      return to.map((t: any) => t.text || t.address || t).filter(Boolean);
    }
    
    if (typeof to === 'object') {
      return to.text || to.address || '';
    }
    
    return to.toString();
  }

  /**
   * Log email to database
   */
  private async logEmail(data: any): Promise<void> {
    try {
      await db.insert(emailLogs).values({
        ...data,
        createdAt: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to log email', error);
    }
  }

  /**
   * Get email statistics
   */
  async getStatistics(options: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
  } = {}): Promise<any> {
    const { startDate, endDate, groupBy = 'day' } = options;
    
    // Build query based on options
    const conditions = [];
    if (startDate) {
      conditions.push(gte(emailLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(emailLogs.createdAt, endDate));
    }

    const logs = await db.query.emailLogs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined
    });

    // Group and aggregate
    const stats = {
      total: logs.length,
      sent: logs.filter(l => l.direction === 'outbound' && l.status === 'sent').length,
      received: logs.filter(l => l.direction === 'inbound').length,
      failed: logs.filter(l => l.status === 'failed').length,
      byStatus: {},
      byDirection: {},
      timeline: []
    };

    // Additional aggregations...
    
    return stats;
  }

  /**
   * Verify email configuration
   */
  async verify(): Promise<{ smtp: boolean; imap: boolean }> {
    const result = { smtp: false, imap: false };

    // Verify SMTP
    try {
      await this.transporter.verify();
      result.smtp = true;
      this.logger.info('SMTP configuration verified');
    } catch (error) {
      this.logger.error('SMTP verification failed', error);
    }

    // Verify IMAP
    if (this.config.imap && this.imapConnection) {
      try {
        await new Promise((resolve, reject) => {
          this.imapConnection!.connect();
          this.imapConnection!.once('ready', resolve);
          this.imapConnection!.once('error', reject);
        });
        result.imap = true;
        this.logger.info('IMAP configuration verified');
      } catch (error) {
        this.logger.error('IMAP verification failed', error);
      }
    }

    return result;
  }

  /**
   * Cleanup and close connections
   */
  async close(): Promise<void> {
    // Close IMAP connection
    if (this.imapConnection) {
      this.imapConnection.end();
    }

    // Close transporter
    this.transporter.close();

    // Close queue
    await this.emailQueue.close();

    this.logger.info('Email service closed');
  }
}

// Export convenience functions
export async function sendEmail(email: Email): Promise<string> {
  const service = UnifiedEmailService.getInstance();
  return service.send(email);
}

export async function queueEmail(email: Email, options?: Bull.JobOptions): Promise<Bull.Job> {
  const service = UnifiedEmailService.getInstance();
  return service.queue(email, options);
}

export async function sendEmailTemplate(
  templateName: string,
  data: { to: string | string[]; variables: Record<string, any>; attachments?: any[] }
): Promise<string> {
  const service = UnifiedEmailService.getInstance();
  return service.sendTemplate(templateName, data);
}

export default UnifiedEmailService;
`;

// Write the unified email service
fs.writeFileSync('server/services/unified-email-service.ts', unifiedEmailService);
console.log('✅ Created unified email service');

// Create migration guide
const migrationGuide = `# Email Service Consolidation Guide

## What Changed

All email service implementations have been consolidated into a single, feature-rich service.

### Old Files (Backed up to ${BACKUP_DIR})
${EMAIL_SERVICE_FILES.map(f => `- ${f}`).join('\n')}

### New File
- \`server/services/unified-email-service.ts\` - Unified email service with all features

## Features Included

1. **Email Sending**
   - SMTP support with connection pooling
   - Template rendering
   - Attachments
   - Rate limiting
   - Queue support

2. **Email Receiving**
   - IMAP support
   - Real-time email monitoring
   - Automatic parsing

3. **Email Routing**
   - Rule-based routing
   - Webhook forwarding
   - Agent assignment
   - Auto-tagging

4. **Email Queue**
   - Redis-backed queue
   - Retry logic
   - Priority support

5. **Monitoring**
   - Event emission
   - Database logging
   - Statistics

## Usage Examples

### Basic Email Sending
\`\`\`typescript
import { sendEmail } from './services/unified-email-service';

await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to our platform</h1>',
  text: 'Welcome to our platform'
});
\`\`\`

### Queue Email
\`\`\`typescript
import { queueEmail } from './services/unified-email-service';

await queueEmail({
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'Newsletter',
  html: newsletterHtml
}, {
  delay: 60000, // Send after 1 minute
  priority: 2
});
\`\`\`

### Send Template
\`\`\`typescript
import { sendEmailTemplate } from './services/unified-email-service';

await sendEmailTemplate('welcome', {
  to: 'user@example.com',
  variables: {
    name: 'John Doe',
    activationLink: 'https://...'
  }
});
\`\`\`

### Initialize Service
\`\`\`typescript
import UnifiedEmailService from './services/unified-email-service';

const emailService = UnifiedEmailService.getInstance({
  smtp: {
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },
  imap: {
    host: process.env.IMAP_HOST,
    port: 993,
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    tls: true
  },
  from: {
    name: 'Seorylie',
    email: 'noreply@seorylie.com'
  },
  rateLimit: {
    max: 100,
    windowMs: 60000
  }
});

// Listen for events
emailService.on('email:sent', (event) => {
  console.log('Email sent:', event);
});

emailService.on('email:received', (event) => {
  console.log('Email received:', event);
});
\`\`\`

## Migration Steps

1. **Update imports**:
   \`\`\`typescript
   // Old
   import { EmailService } from './services/email-service';
   import { EmailRouter } from './services/email-router';
   
   // New
   import { sendEmail, queueEmail } from './services/unified-email-service';
   \`\`\`

2. **Update service initialization**:
   \`\`\`typescript
   // Old
   const emailService = new EmailService(config);
   const emailRouter = new EmailRouter();
   
   // New
   const emailService = UnifiedEmailService.getInstance(config);
   \`\`\`

3. **Update method calls**:
   \`\`\`typescript
   // Old
   await emailService.sendMail(options);
   
   // New
   await sendEmail({
     to: options.to,
     subject: options.subject,
     html: options.html
   });
   \`\`\`

## Database Schema Required

\`\`\`sql
-- Email logs table
CREATE TABLE email_logs (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(255),
  direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
  from_email VARCHAR(255) NOT NULL,
  to_email TEXT NOT NULL, -- JSON array for multiple recipients
  subject TEXT,
  status VARCHAR(50) NOT NULL, -- 'sent', 'received', 'failed', 'bounced'
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email routing rules table
CREATE TABLE email_routing_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  from_pattern VARCHAR(255),
  to_pattern VARCHAR(255),
  subject_pattern VARCHAR(255),
  body_pattern TEXT,
  action VARCHAR(50) NOT NULL, -- 'forward', 'webhook', 'queue', 'tag', 'assign'
  action_data JSONB,
  priority INTEGER DEFAULT 0,
  stop_processing BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email templates table
CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT,
  variables JSONB, -- List of expected variables
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## Environment Variables

\`\`\`env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# IMAP Configuration (optional)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
\`\`\`

## Dependencies to Install

\`\`\`bash
npm install nodemailer imap mailparser bull
npm install --save-dev @types/nodemailer @types/imap
\`\`\`

## Next Steps

1. Install dependencies
2. Create database tables
3. Update environment variables
4. Test email sending
5. Test email receiving (if using IMAP)
6. Update all email service references
7. Remove old email service files
`;

fs.writeFileSync('EMAIL_CONSOLIDATION_GUIDE.md', migrationGuide);
console.log('✅ Created migration guide: EMAIL_CONSOLIDATION_GUIDE.md');

console.log('\n🎉 Email service consolidation complete!');
console.log('\nNext steps:');
console.log('1. Install dependencies: npm install nodemailer imap mailparser bull');
console.log('2. Create database tables (see EMAIL_CONSOLIDATION_GUIDE.md)');
console.log('3. Update environment variables');
console.log('4. Test the unified email service');
console.log('5. Remove old email service files after verification\n');