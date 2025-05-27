import Imap from 'imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { AdfParser } from './adf-parser';
import { AdfLeadProcessor } from './adf-lead-processor';

export interface ImapConfig {
  host: string;
  port: number;
  tls: boolean;
  user: string;
  password: string;
  tlsOptions?: {
    rejectUnauthorized: boolean;
  };
}

export interface EmailListenerConfig {
  imap: ImapConfig;
  mailbox: string;
  checkInterval: number; // seconds
  markAsRead: boolean;
  maxRetries: number;
  enabled: boolean;
}

export interface ProcessedEmail {
  messageId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  hasAdfContent: boolean;
  adfXmlContent?: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    isAdf: boolean;
  }>;
  processingResult?: {
    success: boolean;
    leadId?: number;
    errors: string[];
  };
}

export class AdfEmailListener extends EventEmitter {
  private config: EmailListenerConfig;
  private imap: Imap;
  private adfParser: AdfParser;
  private leadProcessor: AdfLeadProcessor;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 30000; // 30 seconds

  constructor(config: EmailListenerConfig) {
    super();
    this.config = config;
    this.adfParser = new AdfParser();
    this.leadProcessor = new AdfLeadProcessor();
    
    this.imap = new Imap(this.config.imap);
    this.setupImapEventHandlers();
  }

  /**
   * Start the email listener
   */
  public async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('ADF Email Listener is disabled');
      return;
    }

    if (this.isRunning) {
      logger.warn('ADF Email Listener is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting ADF Email Listener', {
      host: this.config.imap.host,
      user: this.config.imap.user,
      mailbox: this.config.mailbox,
      checkInterval: this.config.checkInterval
    });

    try {
      await this.connectToImap();
      this.scheduleEmailCheck();
    } catch (error) {
      this.isRunning = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start ADF Email Listener', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Stop the email listener
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping ADF Email Listener');

    try {
      if (this.imap.state === 'authenticated') {
        await this.closeImapConnection();
      }
    } catch (error) {
      logger.error('Error stopping email listener', { error });
    }
  }

  /**
   * Setup IMAP event handlers
   */
  private setupImapEventHandlers(): void {
    this.imap.once('ready', () => {
      logger.info('IMAP connection ready');
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.imap.once('error', (error: Error) => {
      logger.error('IMAP connection error', { error: error.message });
      this.emit('error', error);
      this.handleReconnect();
    });

    this.imap.once('end', () => {
      logger.info('IMAP connection ended');
      this.emit('disconnected');
      if (this.isRunning) {
        this.handleReconnect();
      }
    });

    this.imap.on('mail', (numNewMsgs: number) => {
      logger.info(`Received ${numNewMsgs} new messages`);
      this.processNewEmails();
    });
  }

  /**
   * Connect to IMAP server
   */
  private async connectToImap(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP connection timeout'));
      }, 30000); // 30 second timeout

      this.imap.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.imap.once('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.imap.connect();
    });
  }

  /**
   * Close IMAP connection
   */
  private async closeImapConnection(): Promise<void> {
    return new Promise((resolve) => {
      this.imap.once('end', () => {
        resolve();
      });
      this.imap.end();
    });
  }

  /**
   * Handle IMAP reconnection
   */
  private async handleReconnect(): Promise<void> {
    if (!this.isRunning || this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, stopping listener');
      this.isRunning = false;
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay / 1000} seconds`);

    setTimeout(async () => {
      try {
        await this.connectToImap();
        logger.info('Successfully reconnected to IMAP');
      } catch (error) {
        logger.error('Reconnection failed', { error });
        this.handleReconnect();
      }
    }, this.reconnectDelay);
  }

  /**
   * Schedule periodic email checks
   */
  private scheduleEmailCheck(): void {
    if (!this.isRunning) return;

    setTimeout(() => {
      this.processNewEmails();
      this.scheduleEmailCheck();
    }, this.config.checkInterval * 1000);
  }

  /**
   * Process new emails in the mailbox
   */
  private async processNewEmails(): Promise<void> {
    if (!this.isRunning || this.imap.state !== 'authenticated') {
      return;
    }

    try {
      await this.openMailbox();
      
      // Search for unseen messages
      const messageIds = await this.searchMessages(['UNSEEN']);
      
      if (messageIds.length === 0) {
        logger.debug('No new messages found');
        return;
      }

      logger.info(`Processing ${messageIds.length} new messages`);

      for (const messageId of messageIds) {
        try {
          await this.processMessage(messageId);
        } catch (error) {
          logger.error('Error processing message', { messageId, error });
        }
      }

    } catch (error) {
      logger.error('Error processing new emails', { error });
    }
  }

  /**
   * Open the specified mailbox
   */
  private async openMailbox(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.openBox(this.config.mailbox, false, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Search for messages matching criteria
   */
  private async searchMessages(criteria: string[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.imap.search(criteria, (error, messageIds) => {
        if (error) {
          reject(error);
        } else {
          resolve(messageIds || []);
        }
      });
    });
  }

  /**
   * Process a single email message
   */
  private async processMessage(messageId: number): Promise<ProcessedEmail> {
    const startTime = Date.now();
    
    try {
      // Fetch the message
      const rawEmail = await this.fetchMessage(messageId);
      const parsedEmail = await simpleParser(rawEmail);

      // Extract basic email information
      const processedEmail: ProcessedEmail = {
        messageId: parsedEmail.messageId || String(messageId),
        subject: parsedEmail.subject || 'No Subject',
        from: this.extractEmailAddress(parsedEmail.from),
        to: this.extractEmailAddress(parsedEmail.to),
        date: parsedEmail.date || new Date(),
        hasAdfContent: false,
        attachments: []
      };

      // Check for ADF content
      const adfContent = await this.extractAdfContent(parsedEmail);
      
      if (adfContent) {
        processedEmail.hasAdfContent = true;
        processedEmail.adfXmlContent = adfContent;

        // Process ADF lead
        const processingResult = await this.leadProcessor.processAdfLead({
          emailMessageId: processedEmail.messageId,
          emailSubject: processedEmail.subject,
          emailFrom: processedEmail.from,
          emailTo: processedEmail.to,
          emailDate: processedEmail.date,
          adfXmlContent: adfContent,
          rawEmailContent: rawEmail.toString(),
          attachmentInfo: processedEmail.attachments
        });

        processedEmail.processingResult = processingResult;

        // Emit events based on processing result
        if (processingResult.success) {
          this.emit('leadProcessed', processedEmail);
          logger.info('ADF lead processed successfully', {
            messageId: processedEmail.messageId,
            leadId: processingResult.leadId,
            processingTime: Date.now() - startTime
          });
        } else {
          this.emit('processingError', processedEmail);
          logger.error('ADF lead processing failed', {
            messageId: processedEmail.messageId,
            errors: processingResult.errors
          });
        }
      } else {
        // No ADF content found
        logger.debug('No ADF content found in message', {
          messageId: processedEmail.messageId,
          subject: processedEmail.subject
        });
        this.emit('noAdfContent', processedEmail);
      }

      // Mark as read if configured
      if (this.config.markAsRead) {
        await this.markMessageAsRead(messageId);
      }

      return processedEmail;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error processing message', { messageId, error: errorMessage });
      
      const failedEmail: ProcessedEmail = {
        messageId: String(messageId),
        subject: 'Error Processing Email',
        from: 'unknown',
        to: 'unknown',
        date: new Date(),
        hasAdfContent: false,
        attachments: [],
        processingResult: {
          success: false,
          errors: [errorMessage]
        }
      };

      this.emit('processingError', failedEmail);
      return failedEmail;
    }
  }

  /**
   * Fetch raw email content
   */
  private async fetchMessage(messageId: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const fetch = this.imap.fetch(messageId, { bodies: '' });
      let buffer = Buffer.alloc(0);

      fetch.on('message', (msg) => {
        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
          });
        });

        msg.once('end', () => {
          resolve(buffer);
        });
      });

      fetch.once('error', (error) => {
        reject(error);
      });

      fetch.once('end', () => {
        if (buffer.length === 0) {
          reject(new Error('No message content received'));
        }
      });
    });
  }

  /**
   * Extract ADF XML content from email
   */
  private async extractAdfContent(parsedEmail: ParsedMail): Promise<string | null> {
    // Check email body for inline ADF XML
    if (parsedEmail.text) {
      const inlineAdf = this.extractAdfFromText(parsedEmail.text);
      if (inlineAdf) {
        return inlineAdf;
      }
    }

    if (parsedEmail.html) {
      const htmlAdf = this.extractAdfFromText(parsedEmail.html);
      if (htmlAdf) {
        return htmlAdf;
      }
    }

    // Check attachments for ADF XML
    if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
      for (const attachment of parsedEmail.attachments) {
        if (this.isAdfAttachment(attachment)) {
          return attachment.content.toString('utf8');
        }
      }
    }

    return null;
  }

  /**
   * Extract ADF XML from text content
   */
  private extractAdfFromText(text: string): string | null {
    // Look for ADF XML tags
    const adfMatch = text.match(/<\?xml[^>]*\?>[\s\S]*?<adf[^>]*>[\s\S]*?<\/adf>/i);
    if (adfMatch) {
      return adfMatch[0];
    }

    // Look for ADF without XML declaration
    const adfOnlyMatch = text.match(/<adf[^>]*>[\s\S]*?<\/adf>/i);
    if (adfOnlyMatch) {
      return `<?xml version="1.0" encoding="UTF-8"?>\n${adfOnlyMatch[0]}`;
    }

    return null;
  }

  /**
   * Check if attachment contains ADF content
   */
  private isAdfAttachment(attachment: Attachment): boolean {
    const filename = attachment.filename?.toLowerCase() || '';
    const contentType = attachment.contentType?.toLowerCase() || '';

    // Check by content type
    if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      return true;
    }

    // Check by filename
    if (filename.includes('adf') || filename.endsWith('.xml')) {
      return true;
    }

    // Check content for ADF tags
    if (attachment.content) {
      const content = attachment.content.toString('utf8', 0, 1000); // Check first 1KB
      return content.includes('<adf') || content.includes('ADF');
    }

    return false;
  }

  /**
   * Extract email address from address object
   */
  private extractEmailAddress(addressField: any): string {
    if (!addressField) return 'unknown';
    
    if (typeof addressField === 'string') {
      return addressField;
    }

    if (Array.isArray(addressField) && addressField.length > 0) {
      return addressField[0].address || addressField[0].text || 'unknown';
    }

    if (addressField.address) {
      return addressField.address;
    }

    return 'unknown';
  }

  /**
   * Mark message as read
   */
  private async markMessageAsRead(messageId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.addFlags(messageId, ['\\Seen'], (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get connection status
   */
  public getStatus(): {
    isRunning: boolean;
    isConnected: boolean;
    reconnectAttempts: number;
    config: EmailListenerConfig;
  } {
    return {
      isRunning: this.isRunning,
      isConnected: this.imap.state === 'authenticated',
      reconnectAttempts: this.reconnectAttempts,
      config: this.config
    };
  }
}

export default AdfEmailListener;