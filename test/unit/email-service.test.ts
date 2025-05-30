/**
 * Email Service - Unit Tests
 * 
 * Tests for the Email Service which handles:
 * - Multi-provider support (SendGrid/MailHog)
 * - Template rendering with Handlebars
 * - Email delivery tracking
 * - Error handling and retry logic
 * - Rate limiting
 * - Metrics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EmailService, EmailOptions } from '../../server/services/email-service';
import eventBus from '../../server/services/event-bus';
import { prometheusMetrics } from '../../server/services/prometheus-metrics';
import logger from '../../server/utils/logger';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';

// Mock dependencies
vi.mock('@sendgrid/mail', () => {
  return {
    default: {
      setApiKey: vi.fn(),
      send: vi.fn().mockResolvedValue([
        {
          statusCode: 202,
          headers: {},
          body: {}
        },
        {}
      ])
    }
  };
});

vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({
        sendMail: vi.fn().mockResolvedValue({
          messageId: 'mock-message-id',
          envelope: {},
          accepted: ['recipient@example.com']
        })
      })
    }
  };
});

vi.mock('../../server/db', () => {
  return {
    default: {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        { id: 1, providerMessageId: 'mock-message-id', deliveryStatus: 'sent' }
      ]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue()
    }
  };
});

vi.mock('../../server/services/event-bus', () => {
  return {
    default: {
      emit: vi.fn()
    }
  };
});

vi.mock('../../server/services/prometheus-metrics', () => {
  return {
    prometheusMetrics: {
      incrementLeadsProcessed: vi.fn(),
      recordAiResponseLatency: vi.fn(),
      incrementHandoverTriggers: vi.fn(),
      incrementHandoverEmailSent: vi.fn()
    }
  };
});

vi.mock('../../server/utils/logger', () => {
  return {
    default: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }
  };
});

vi.mock('fs', () => {
  const mockTemplates = {
    'test-template.html': '<html><body>Hello {{name}}! Your vehicle is {{vehicle}}.</body></html>',
    'test-template.txt': 'Hello {{name}}! Your vehicle is {{vehicle}}.',
    'invalid-template.html': '<html><body>Hello {{name! Your vehicle is {{vehicle}}.</body></html>',
    'adf-response.html': '<html><body>Thank you for your interest in {{vehicleMake}} {{vehicleModel}}!</body></html>',
    'adf-response.txt': 'Thank you for your interest in {{vehicleMake}} {{vehicleModel}}!'
  };
  
  return {
    promises: {
      readFile: vi.fn().mockImplementation((filePath) => {
        const basename = path.basename(filePath);
        if (mockTemplates[basename]) {
          return Promise.resolve(mockTemplates[basename]);
        }
        return Promise.reject(new Error(`File not found: ${filePath}`));
      }),
      access: vi.fn().mockResolvedValue(true)
    }
  };
});

describe('EmailService', () => {
  let emailService: EmailService;
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Default to SendGrid provider for most tests
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.SENDGRID_API_KEY = 'SG.test-api-key';
    process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
    
    // Create email service instance
    emailService = new EmailService();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('Provider Configuration', () => {
    it('should initialize with SendGrid provider when configured', () => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      process.env.SENDGRID_API_KEY = 'SG.test-api-key';
      
      emailService = new EmailService();
      
      expect(emailService['provider']).toBe('sendgrid');
      expect(emailService['sendgrid']).toBeDefined();
    });
    
    it('should initialize with MailHog provider when configured', () => {
      process.env.EMAIL_PROVIDER = 'mailhog';
      process.env.MAILHOG_HOST = 'localhost';
      process.env.MAILHOG_PORT = '1025';
      
      emailService = new EmailService();
      
      expect(emailService['provider']).toBe('mailhog');
      expect(emailService['smtpTransport']).toBeDefined();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'localhost',
        port: 1025,
        secure: false,
        ignoreTLS: true
      });
    });
    
    it('should fall back to SMTP provider if no specific provider is configured', () => {
      process.env.EMAIL_PROVIDER = undefined;
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      
      emailService = new EmailService();
      
      expect(emailService['provider']).toBe('smtp');
      expect(emailService['smtpTransport']).toBeDefined();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user',
          pass: 'pass'
        }
      });
    });
    
    it('should throw error if no email provider configuration is found', () => {
      process.env.EMAIL_PROVIDER = undefined;
      process.env.SMTP_HOST = undefined;
      
      expect(() => new EmailService()).toThrow('No email provider configuration found');
    });
  });
  
  describe('Template Rendering', () => {
    it('should load and render HTML template correctly', async () => {
      const renderedHtml = await emailService.renderTemplate('test-template.html', {
        name: 'John',
        vehicle: 'Honda Accord'
      });
      
      expect(renderedHtml).toBe('<html><body>Hello John! Your vehicle is Honda Accord.</body></html>');
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test-template.html'),
        'utf8'
      );
    });
    
    it('should load and render text template correctly', async () => {
      const renderedText = await emailService.renderTemplate('test-template.txt', {
        name: 'John',
        vehicle: 'Honda Accord'
      });
      
      expect(renderedText).toBe('Hello John! Your vehicle is Honda Accord.');
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test-template.txt'),
        'utf8'
      );
    });
    
    it('should handle missing template files gracefully', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('File not found'));
      
      await expect(emailService.renderTemplate('non-existent-template.html', {}))
        .rejects.toThrow('Failed to load email template');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load email template'),
        expect.any(Object)
      );
    });
    
    it('should handle invalid Handlebars syntax in templates', async () => {
      await expect(emailService.renderTemplate('invalid-template.html', {
        name: 'John',
        vehicle: 'Honda Accord'
      })).rejects.toThrow('Failed to render email template');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to render email template'),
        expect.any(Object)
      );
    });
    
    it('should cache templates for performance', async () => {
      // First call should read from file
      await emailService.renderTemplate('test-template.html', { name: 'John', vehicle: 'Honda Accord' });
      
      // Second call should use cache
      await emailService.renderTemplate('test-template.html', { name: 'Jane', vehicle: 'Toyota Camry' });
      
      // File should only be read once
      expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Email Sending - SendGrid', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      emailService = new EmailService();
    });
    
    it('should send email via SendGrid successfully', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };
      
      const result = await emailService.send(options);
      
      expect(result).toEqual({ messageId: expect.any(String) });
      expect(sendgrid.send).toHaveBeenCalledWith({
        to: 'recipient@example.com',
        from: 'test@example.com', // From env
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Email sent via SendGrid'),
        expect.any(Object)
      );
    });
    
    it('should use custom from address when provided', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        from: 'custom@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      await emailService.send(options);
      
      expect(sendgrid.send).toHaveBeenCalledWith(expect.objectContaining({
        from: 'custom@example.com'
      }));
    });
    
    it('should handle SendGrid API errors gracefully', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      vi.mocked(sendgrid.send).mockRejectedValueOnce(new Error('SendGrid API error'));
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      await expect(emailService.send(options)).rejects.toThrow('Failed to send email via SendGrid');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SendGrid API error'),
        expect.any(Object)
      );
    });
    
    it('should track email delivery in database when adfLeadId is provided', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123
      };
      
      await emailService.send(options);
      
      expect(emailService['db'].insert).toHaveBeenCalled();
      expect(emailService['db'].insert().values).toHaveBeenCalledWith(expect.objectContaining({
        adfLeadId: 123,
        recipientEmail: 'recipient@example.com',
        emailSubject: 'Test Email',
        emailProvider: 'sendgrid',
        deliveryStatus: 'sent'
      }));
    });
    
    it('should emit email.sent event after successful sending', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123
      };
      
      await emailService.send(options);
      
      expect(eventBus.emit).toHaveBeenCalledWith('email.sent', expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Test Email',
        adfLeadId: 123,
        messageId: expect.any(String)
      }));
    });
    
    it('should track metrics for email sending', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123,
        dealershipId: 456
      };
      
      await emailService.send(options);
      
      expect(prometheusMetrics.incrementLeadsProcessed).toHaveBeenCalledWith(expect.objectContaining({
        dealership_id: 456,
        status: 'email_sent'
      }));
    });
  });
  
  describe('Email Sending - MailHog (Development)', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'mailhog';
      process.env.MAILHOG_HOST = 'localhost';
      process.env.MAILHOG_PORT = '1025';
      emailService = new EmailService();
    });
    
    it('should send email via MailHog SMTP successfully', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };
      
      const result = await emailService.send(options);
      
      expect(result).toEqual({ messageId: 'mock-message-id' });
      expect(emailService['smtpTransport'].sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      }));
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Email sent via SMTP'),
        expect.any(Object)
      );
    });
    
    it('should handle SMTP transport errors gracefully', async () => {
      vi.mocked(emailService['smtpTransport'].sendMail).mockRejectedValueOnce(new Error('SMTP error'));
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      await expect(emailService.send(options)).rejects.toThrow('Failed to send email via SMTP');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SMTP error'),
        expect.any(Object)
      );
    });
    
    it('should still track email delivery in database with MailHog', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123
      };
      
      await emailService.send(options);
      
      expect(emailService['db'].insert).toHaveBeenCalled();
      expect(emailService['db'].insert().values).toHaveBeenCalledWith(expect.objectContaining({
        adfLeadId: 123,
        recipientEmail: 'recipient@example.com',
        emailSubject: 'Test Email',
        emailProvider: 'mailhog',
        deliveryStatus: 'sent'
      }));
    });
  });
  
  describe('Template-Based Email Sending', () => {
    it('should render and send template-based email successfully', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Vehicle Interest',
        templateName: 'adf-response',
        templateData: {
          vehicleMake: 'Honda',
          vehicleModel: 'Accord'
        }
      };
      
      const result = await emailService.sendTemplate(options);
      
      expect(result).toEqual({ messageId: expect.any(String) });
      expect(sendgrid.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Vehicle Interest',
        html: expect.stringContaining('Thank you for your interest in Honda Accord'),
        text: expect.stringContaining('Thank you for your interest in Honda Accord')
      }));
    });
    
    it('should handle missing template data gracefully', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Vehicle Interest',
        templateName: 'adf-response',
        templateData: {} // Missing required data
      };
      
      const result = await emailService.sendTemplate(options);
      
      // Should still send with empty placeholders
      expect(result).toEqual({ messageId: expect.any(String) });
    });
    
    it('should handle template rendering errors gracefully', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('Template not found'));
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Vehicle Interest',
        templateName: 'non-existent-template',
        templateData: {}
      };
      
      await expect(emailService.sendTemplate(options)).rejects.toThrow('Failed to render email template');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to render email template'),
        expect.any(Object)
      );
    });
  });
  
  describe('Error Handling and Retry Logic', () => {
    it('should handle transient errors with retry', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      // Mock first call to fail with rate limit error (transient)
      vi.mocked(sendgrid.send)
        .mockRejectedValueOnce({ code: 429, message: 'Too many requests' })
        .mockResolvedValueOnce([{ statusCode: 202 }, {}]); // Second call succeeds
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        retryOptions: {
          retries: 1,
          retryDelay: 100
        }
      };
      
      const result = await emailService.send(options);
      
      // Should eventually succeed after retry
      expect(result).toEqual({ messageId: expect.any(String) });
      expect(sendgrid.send).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Retrying email send after error'),
        expect.any(Object)
      );
    });
    
    it('should give up after max retries', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      // Mock all calls to fail
      vi.mocked(sendgrid.send)
        .mockRejectedValue({ code: 429, message: 'Too many requests' });
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        retryOptions: {
          retries: 2,
          retryDelay: 100
        }
      };
      
      await expect(emailService.send(options)).rejects.toThrow('Failed to send email after 2 retries');
      
      // Should have tried 3 times (initial + 2 retries)
      expect(sendgrid.send).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email after 2 retries'),
        expect.any(Object)
      );
    });
    
    it('should not retry on permanent errors', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      // Mock call to fail with authentication error (permanent)
      vi.mocked(sendgrid.send)
        .mockRejectedValueOnce({ code: 401, message: 'Unauthorized' });
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        retryOptions: {
          retries: 2,
          retryDelay: 100
        }
      };
      
      await expect(emailService.send(options)).rejects.toThrow('Failed to send email via SendGrid');
      
      // Should not retry on permanent errors
      expect(sendgrid.send).toHaveBeenCalledTimes(1);
    });
    
    it('should track failed delivery in database', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      // Mock call to fail
      vi.mocked(sendgrid.send)
        .mockRejectedValueOnce(new Error('SendGrid API error'));
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123
      };
      
      try {
        await emailService.send(options);
      } catch (error) {
        // Expected to throw
      }
      
      // Should track failed delivery
      expect(emailService['db'].insert).toHaveBeenCalled();
      expect(emailService['db'].insert().values).toHaveBeenCalledWith(expect.objectContaining({
        adfLeadId: 123,
        deliveryStatus: 'failed',
        errorMessage: expect.stringContaining('SendGrid API error')
      }));
    });
    
    it('should emit email.failed event on failure', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      // Mock call to fail
      vi.mocked(sendgrid.send)
        .mockRejectedValueOnce(new Error('SendGrid API error'));
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123
      };
      
      try {
        await emailService.send(options);
      } catch (error) {
        // Expected to throw
      }
      
      expect(eventBus.emit).toHaveBeenCalledWith('email.failed', expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Test Email',
        adfLeadId: 123,
        error: expect.stringContaining('SendGrid API error')
      }));
    });
  });
  
  describe('Rate Limiting', () => {
    it('should respect rate limits with throttling', async () => {
      // Enable rate limiting
      emailService['rateLimitEnabled'] = true;
      emailService['rateLimitPerSecond'] = 2;
      
      const sendgrid = require('@sendgrid/mail').default;
      
      // Send 3 emails in quick succession
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      const startTime = Date.now();
      
      // Send 3 emails (rate limit is 2 per second)
      await Promise.all([
        emailService.send(options),
        emailService.send(options),
        emailService.send(options)
      ]);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should have taken at least 1 second due to rate limiting
      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(sendgrid.send).toHaveBeenCalledTimes(3);
    });
    
    it('should handle concurrent requests properly', async () => {
      // Enable rate limiting with very low limit for testing
      emailService['rateLimitEnabled'] = true;
      emailService['rateLimitPerSecond'] = 1;
      
      const sendgrid = require('@sendgrid/mail').default;
      
      // Send 5 emails concurrently
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      const startTime = Date.now();
      
      // Send 5 emails (rate limit is 1 per second)
      await Promise.all([
        emailService.send(options),
        emailService.send(options),
        emailService.send(options),
        emailService.send(options),
        emailService.send(options)
      ]);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should have taken at least 4 seconds due to rate limiting
      expect(duration).toBeGreaterThanOrEqual(4000);
      expect(sendgrid.send).toHaveBeenCalledTimes(5);
    });
  });
  
  describe('Metrics Tracking', () => {
    it('should track successful email delivery metrics', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123,
        dealershipId: 456
      };
      
      await emailService.send(options);
      
      expect(prometheusMetrics.incrementLeadsProcessed).toHaveBeenCalledWith(expect.objectContaining({
        dealership_id: 456,
        source_provider: 'sendgrid',
        lead_type: 'email',
        status: 'email_sent'
      }));
    });
    
    it('should track failed email delivery metrics', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      // Mock call to fail
      vi.mocked(sendgrid.send)
        .mockRejectedValueOnce(new Error('SendGrid API error'));
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123,
        dealershipId: 456
      };
      
      try {
        await emailService.send(options);
      } catch (error) {
        // Expected to throw
      }
      
      expect(prometheusMetrics.incrementLeadsProcessed).toHaveBeenCalledWith(expect.objectContaining({
        dealership_id: 456,
        source_provider: 'sendgrid',
        lead_type: 'email',
        status: 'email_failed'
      }));
    });
    
    it('should track handover email metrics when isHandoverEmail is true', async () => {
      const options: EmailOptions = {
        to: 'sales@dealership.com',
        subject: 'Handover: New Lead',
        text: 'Handover email content',
        dealershipId: 456,
        isHandoverEmail: true
      };
      
      await emailService.send(options);
      
      expect(prometheusMetrics.incrementHandoverEmailSent).toHaveBeenCalledWith(expect.objectContaining({
        dealership_id: 456,
        status: 'sent',
        template: 'default'
      }));
    });
    
    it('should track handover email metrics with template name', async () => {
      const options: EmailOptions = {
        to: 'sales@dealership.com',
        subject: 'Handover: New Lead',
        templateName: 'handover-dossier',
        templateData: {},
        dealershipId: 456,
        isHandoverEmail: true
      };
      
      await emailService.send(options);
      
      expect(prometheusMetrics.incrementHandoverEmailSent).toHaveBeenCalledWith(expect.objectContaining({
        dealership_id: 456,
        status: 'sent',
        template: 'handover-dossier'
      }));
    });
  });
  
  describe('Email Delivery Tracking', () => {
    it('should create email delivery tracking record', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123
      };
      
      await emailService.send(options);
      
      expect(emailService['db'].insert).toHaveBeenCalled();
      expect(emailService['db'].insert().values).toHaveBeenCalledWith(expect.objectContaining({
        adfLeadId: 123,
        recipientEmail: 'recipient@example.com',
        emailSubject: 'Test Email',
        deliveryStatus: 'sent',
        deliveryAttempts: 1
      }));
    });
    
    it('should update existing tracking record on retry', async () => {
      // Mock existing tracking record
      vi.mocked(emailService['db'].select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([
          { 
            id: 1, 
            adfLeadId: 123, 
            deliveryStatus: 'failed', 
            deliveryAttempts: 1,
            errorMessage: 'Previous error'
          }
        ])
      } as any);
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123,
        isRetry: true
      };
      
      await emailService.send(options);
      
      // Should update existing record
      expect(emailService['db'].update).toHaveBeenCalled();
      expect(emailService['db'].update().set).toHaveBeenCalledWith(expect.objectContaining({
        deliveryStatus: 'sent',
        deliveryAttempts: 2, // Incremented
        updatedAt: expect.any(Date)
      }));
    });
    
    it('should track message ID from provider', async () => {
      const sendgrid = require('@sendgrid/mail').default;
      
      // Mock SendGrid to return message ID
      vi.mocked(sendgrid.send).mockResolvedValueOnce([
        { 
          statusCode: 202,
          headers: { 'x-message-id': 'sendgrid-msg-123' }
        },
        {}
      ]);
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        adfLeadId: 123
      };
      
      await emailService.send(options);
      
      expect(emailService['db'].insert().values).toHaveBeenCalledWith(expect.objectContaining({
        providerMessageId: 'sendgrid-msg-123'
      }));
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty recipient list', async () => {
      const options: EmailOptions = {
        to: '',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      await expect(emailService.send(options)).rejects.toThrow('Recipient email is required');
    });
    
    it('should handle invalid email addresses', async () => {
      const options: EmailOptions = {
        to: 'not-an-email-address',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      // Should still attempt to send and let the provider validate
      await emailService.send(options);
      
      // But should log a warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Potentially invalid email address'),
        expect.any(Object)
      );
    });
    
    it('should handle missing subject', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        text: 'This is a test email'
      };
      
      await emailService.send(options);
      
      // Should use default subject
      const sendgrid = require('@sendgrid/mail').default;
      expect(sendgrid.send).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'No Subject'
      }));
    });
    
    it('should handle missing both text and HTML content', async () => {
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email'
      };
      
      await expect(emailService.send(options)).rejects.toThrow('Email must have either text or HTML content');
    });
    
    it('should handle extremely large email content', async () => {
      const largeContent = 'A'.repeat(1000000); // 1MB of content
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Large Email',
        text: largeContent
      };
      
      // Should truncate and still send
      await emailService.send(options);
      
      const sendgrid = require('@sendgrid/mail').default;
      expect(sendgrid.send).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringMatching(/^A{1,500000}/) // Should be truncated
      }));
      
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Email content exceeds recommended size'),
        expect.any(Object)
      );
    });
    
    it('should sanitize email content for security', async () => {
      const suspiciousContent = '<script>alert("XSS")</script>Test email with script';
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: suspiciousContent
      };
      
      await emailService.send(options);
      
      // Should log warning about suspicious content
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Potentially suspicious email content'),
        expect.any(Object)
      );
    });
  });
});
