import { EventEmitter } from 'events';
import Imap from 'imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import logger from '../utils/logger';
import db from '../db';
import { eq } from 'drizzle-orm';
import { dealerships, dealershipEmailConfigs } from '@shared/schema-resolver';

export interface AdfEmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  markSeen: boolean;
  searchCriteria: string[];
  pollingInterval: number;
}

export interface AdfEmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    size: number;
  }>;
  rawContent: string;
}

export class AdfEmailListener extends EventEmitter {
  private imap: Imap | null = null;
  private isConnected: boolean = false;
  private isListening: boolean = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 30000; // 30 seconds

  constructor() {
    super();
    this.setupErrorHandling();
  }

  /**
   * Start listening for ADF emails
   */
  async start(): Promise<void> {
    if (this.isListening) {
      logger.warn('ADF Email Listener is already running');
      return;
    }

    try {
      // Get email configurations from database
      const emailConfigs = await this.getEmailConfigurations();
      
      if (emailConfigs.length === 0) {
        logger.warn('No email configurations found for ADF listening');
        return;
      }

      // Start with the primary configuration
      const primaryConfig = emailConfigs.find(config => config.isPrimary) || emailConfigs[0];
      await this.connectToEmail(primaryConfig);
      
      this.isListening = true;
      logger.info('ADF Email Listener started successfully');
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to start ADF Email Listener', { error: err.message });
      throw err;
    }
  }

  /**
   * Stop listening for emails
   */
  async stop(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      this.isListening = false;
      
      if (this.pollingTimer) {
        clearTimeout(this.pollingTimer);
        this.pollingTimer = null;
      }

      if (this.imap && this.isConnected) {
        this.imap.end();
      }

      logger.info('ADF Email Listener stopped');
      this.emit('stopped');
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error stopping ADF Email Listener', { error: err.message });
      throw err;
    }
  }

  /**
   * Get email configurations from database
   */
  private async getEmailConfigurations(): Promise<any[]> {
    try {
      const configs = await db.query.dealershipEmailConfigs.findMany({
        where: eq(dealershipEmailConfigs.status, 'active'),
        with: {
          dealership: true
        }
      });

      return configs.map(config => ({
        id: config.id,
        dealershipId: config.dealershipId,
        dealershipName: config.dealership?.name || 'Unknown',
        emailAddress: config.emailAddress,
        host: config.imapHost,
        port: config.imapPort,
        user: config.imapUser,
        password: this.decryptPassword(config.imapPassEncrypted),
        tls: config.imapUseSsl,
        isPrimary: config.isPrimary,
        pollingInterval: config.pollingIntervalMs || 300000 // 5 minutes default
      }));
    } catch (error) {
      logger.error('Failed to get email configurations', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Connect to email server
   */
  private async connectToEmail(config: any): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.imap = new Imap({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          tls: config.tls,
          tlsOptions: { rejectUnauthorized: false },
          authTimeout: 30000,
          connTimeout: 30000
        });

        this.imap.once('ready', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          logger.info('Connected to email server', { 
            host: config.host, 
            user: config.user,
            dealership: config.dealershipName 
          });
          
          this.emit('connected');
          this.startPolling(config.pollingInterval);
          resolve();
        });

        this.imap.once('error', (error) => {
          this.isConnected = false;
          logger.error('IMAP connection error', { 
            error: error.message,
            host: config.host,
            user: config.user 
          });
          
          this.emit('error', error);
          this.handleReconnection(config);
          reject(error);
        });

        this.imap.once('end', () => {
          this.isConnected = false;
          logger.info('IMAP connection ended');
          this.emit('disconnected');
          
          if (this.isListening) {
            this.handleReconnection(config);
          }
        });

        this.imap.connect();
        
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to create IMAP connection', { error: err.message });
        reject(err);
      }
    });
  }

  /**
   * Start polling for new emails
   */
  private startPolling(interval: number): void {
    if (!this.isListening || !this.imap || !this.isConnected) {
      return;
    }

    this.pollingTimer = setTimeout(async () => {
      try {
        await this.checkForNewEmails();
      } catch (error) {
        logger.error('Error during email polling', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      // Schedule next poll
      if (this.isListening) {
        this.startPolling(interval);
      }
    }, interval);
  }

  /**
   * Check for new emails with ADF attachments
   */
  private async checkForNewEmails(): Promise<void> {
    if (!this.imap || !this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox('INBOX', false, (error, box) => {
        if (error) {
          logger.error('Failed to open inbox', { error: error.message });
          reject(error);
          return;
        }

        // Search for unseen emails
        this.imap!.search(['UNSEEN'], (searchError, results) => {
          if (searchError) {
            logger.error('Email search failed', { error: searchError.message });
            reject(searchError);
            return;
          }

          if (!results || results.length === 0) {
            resolve();
            return;
          }

          logger.info(`Found ${results.length} new emails`);
          this.processEmails(results).then(resolve).catch(reject);
        });
      });
    });
  }

  /**
   * Process found emails
   */
  private async processEmails(emailIds: number[]): Promise<void> {
    if (!this.imap) {
      return;
    }

    const fetch = this.imap.fetch(emailIds, {
      bodies: '',
      markSeen: true,
      struct: true
    });

    fetch.on('message', (msg, seqno) => {
      let buffer = '';
      
      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
        });
      });

      msg.once('end', async () => {
        try {
          const parsed = await simpleParser(buffer);
          await this.handleParsedEmail(parsed, seqno);
        } catch (error) {
          logger.error('Failed to parse email', { 
            error: error instanceof Error ? error.message : String(error),
            seqno 
          });
        }
      });
    });

    fetch.once('error', (error) => {
      logger.error('Email fetch error', { error: error.message });
    });

    fetch.once('end', () => {
      logger.debug('Email fetch completed');
    });
  }

  /**
   * Handle parsed email and check for ADF attachments
   */
  private async handleParsedEmail(parsed: ParsedMail, seqno: number): Promise<void> {
    try {
      // Check if email has XML attachments (potential ADF)
      const xmlAttachments = parsed.attachments?.filter(att => 
        att.filename?.toLowerCase().endsWith('.xml') ||
        att.contentType?.includes('application/xml') ||
        att.contentType?.includes('text/xml')
      ) || [];

      if (xmlAttachments.length === 0) {
        logger.debug('No XML attachments found', { 
          subject: parsed.subject,
          from: parsed.from?.text 
        });
        return;
      }

      // Process each XML attachment
      for (const attachment of xmlAttachments) {
        const emailData: AdfEmailData = {
          id: `${seqno}-${Date.now()}`,
          subject: parsed.subject || '',
          from: parsed.from?.text || '',
          to: parsed.to?.text || '',
          date: parsed.date || new Date(),
          attachments: [{
            filename: attachment.filename || 'unknown.xml',
            content: attachment.content,
            contentType: attachment.contentType || 'application/xml',
            size: attachment.size || attachment.content.length
          }],
          rawContent: parsed.html || parsed.text || ''
        };

        logger.info('Processing ADF email', {
          subject: emailData.subject,
          from: emailData.from,
          attachmentCount: emailData.attachments.length
        });

        this.emit('email', emailData);
      }

    } catch (error) {
      logger.error('Error handling parsed email', { 
        error: error instanceof Error ? error.message : String(error),
        seqno 
      });
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(config: any): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, stopping email listener');
      this.stop();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.isListening) {
        this.connectToEmail(config).catch(error => {
          logger.error('Reconnection failed', { error: error.message });
        });
      }
    }, delay);
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      logger.error('ADF Email Listener error', { error: error.message });
    });
  }

  /**
   * Decrypt password (simplified - in production use proper encryption)
   */
  private decryptPassword(encryptedPassword: string): string {
    // This is a simplified decryption - in production, use proper encryption
    if (encryptedPassword.startsWith('encrypted:')) {
      return encryptedPassword.replace('encrypted:', '');
    }
    return encryptedPassword;
  }
}

// Export singleton instance
export const adfEmailListener = new AdfEmailListener();
