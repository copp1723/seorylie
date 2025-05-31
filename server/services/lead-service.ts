import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import db from '../db';
import { 
  customers, 
  leads, 
  vehicleInterests, 
  conversations,
  messages,
  leadActivities,
  leadSourcesTable,
  type InsertCustomer,
  type InsertLead,
  type InsertVehicleInterest,
  type InsertConversation,
  type Customer,
  type Lead,
  type Conversation
} from '../../shared/lead-management-schema';
import logger from '../utils/logger';
import crypto from 'crypto';

export interface InboundLeadData {
  customer: {
    firstName?: string;
    lastName?: string;
    fullName: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    preferredLanguage?: string;
  };
  vehicleInterest?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    vin?: string;
    stockNumber?: string;
    condition?: 'new' | 'used' | 'cpo';
    minPrice?: number;
    maxPrice?: number;
    tradeIn?: {
      year?: number;
      make?: string;
      model?: string;
      vin?: string;
      mileage?: number;
      condition?: string;
    };
  };
  lead: {
    requestType?: string;
    description?: string;
    timeframe?: string;
    source: string;
    medium?: string;
    campaign?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  };
  attribution?: {
    source: string;
    medium?: string;
    campaign?: string;
    keyword?: string;
    referrer?: string;
    landingPage?: string;
  };
  customFields?: Record<string, any>;
}

export interface LeadCreationResult {
  success: boolean;
  leadId?: string;
  customerId?: string;
  conversationId?: string;
  errors: string[];
  warnings: string[];
  isExistingCustomer: boolean;
  isDuplicateLead: boolean;
}

export class LeadService {
  /**
   * Generate customer deduplication hash
   */
  private generateCustomerDeduplicationHash(
    email?: string,
    phone?: string,
    fullName?: string
  ): string {
    const normalizedEmail = email?.toLowerCase().trim() || '';
    const normalizedPhone = phone?.replace(/[^0-9]/g, '') || '';
    const normalizedName = fullName?.toLowerCase().trim() || '';
    
    const hashInput = `${normalizedEmail}|${normalizedPhone}|${normalizedName}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Generate lead deduplication hash
   */
  private generateLeadDeduplicationHash(
    customerId: string,
    requestType?: string,
    vehicleYear?: number,
    vehicleMake?: string,
    vehicleModel?: string
  ): string {
    const hashInput = [
      customerId,
      requestType || '',
      vehicleYear?.toString() || '',
      vehicleMake?.toLowerCase().trim() || '',
      vehicleModel?.toLowerCase().trim() || ''
    ].join('|');
    
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Generate unique lead number
   */
  private async generateLeadNumber(dealershipId: number): Promise<string> {
    const now = new Date();
    const yearFull = now.getFullYear();           // e.g. 2025
    const yearShort = yearFull.toString().slice(-2); // "25"

    // Define the current calendar year window
    const startOfYear = new Date(yearFull, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(yearFull, 11, 31, 23, 59, 59, 999);

    // Count existing leads for this dealership within the same year
    const [{ total }] = await db
      .select({ total: sql`COUNT(${leads.id})`.as('total') })
      .from(leads)
      .where(and(
        eq(leads.dealershipId, dealershipId),
        gte(leads.createdAt, startOfYear),
        lte(leads.createdAt, endOfYear)
      ))
      .limit(1);

    const nextSeq = Number(total ?? 0) + 1;
    return `LEAD-${dealershipId}-${yearShort}-${nextSeq.toString().padStart(4, '0')}`;
  }

  /**
   * Find or create customer
   */
  private async findOrCreateCustomer(
    dealershipId: number,
    customerData: InboundLeadData['customer']
  ): Promise<{ customer: Customer; isExisting: boolean }> {
    const deduplicationHash = this.generateCustomerDeduplicationHash(
      customerData.email,
      customerData.phone,
      customerData.fullName
    );

    // Try to find existing customer
    const existingCustomers = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.dealershipId, dealershipId),
        eq(customers.deduplicationHash, deduplicationHash)
      ))
      .limit(1);

    if (existingCustomers.length > 0) {
      const customer = existingCustomers[0];
      
      // Update last contact date and increment lead count
      await db
        .update(customers)
        .set({
          lastContactDate: new Date(),
          totalLeads: customer.totalLeads + 1,
          updatedAt: new Date()
        })
        .where(eq(customers.id, customer.id));

      return { customer, isExisting: true };
    }

    // Create new customer
    const newCustomerData: InsertCustomer = {
      dealershipId,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      fullName: customerData.fullName,
      email: customerData.email,
      phone: customerData.phone,
      address: customerData.address,
      city: customerData.city,
      state: customerData.state,
      zipCode: customerData.zipCode,
      country: customerData.country || 'US',
      preferredLanguage: customerData.preferredLanguage || 'en',
      firstContactDate: new Date(),
      lastContactDate: new Date(),
      totalLeads: 1,
      deduplicationHash
    };

    const [newCustomer] = await db
      .insert(customers)
      .values(newCustomerData)
      .returning();

    return { customer: newCustomer, isExisting: false };
  }

  /**
   * Create vehicle interest if provided
   */
  private async createVehicleInterest(
    vehicleData: InboundLeadData['vehicleInterest']
  ): Promise<string | null> {
    if (!vehicleData) return null;

    const vehicleInterestData: InsertVehicleInterest = {
      year: vehicleData.year,
      make: vehicleData.make,
      model: vehicleData.model,
      trim: vehicleData.trim,
      vin: vehicleData.vin,
      stockNumber: vehicleData.stockNumber,
      condition: vehicleData.condition,
      minPrice: vehicleData.minPrice,
      maxPrice: vehicleData.maxPrice,
      hasTradeIn: !!vehicleData.tradeIn,
      tradeInYear: vehicleData.tradeIn?.year,
      tradeInMake: vehicleData.tradeIn?.make,
      tradeInModel: vehicleData.tradeIn?.model,
      tradeInVin: vehicleData.tradeIn?.vin,
      tradeInMileage: vehicleData.tradeIn?.mileage,
      tradeInCondition: vehicleData.tradeIn?.condition
    };

    const [vehicleInterest] = await db
      .insert(vehicleInterests)
      .values(vehicleInterestData)
      .returning();

    return vehicleInterest.id;
  }

  /**
   * Check for duplicate lead
   */
  private async checkForDuplicateLead(
    dealershipId: number,
    customerId: string,
    leadData: InboundLeadData['lead'],
    vehicleData?: InboundLeadData['vehicleInterest']
  ): Promise<Lead | null> {
    const deduplicationHash = this.generateLeadDeduplicationHash(
      customerId,
      leadData.requestType,
      vehicleData?.year,
      vehicleData?.make,
      vehicleData?.model
    );

    const existingLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.dealershipId, dealershipId),
        eq(leads.deduplicationHash, deduplicationHash)
      ))
      .limit(1);

    return existingLeads[0] || null;
  }

  /**
   * Find lead source by name or type
   */
  private async findLeadSource(dealershipId: number, source: string): Promise<string | null> {
    const leadSources = await db
      .select()
      .from(leadSourcesTable)
      .where(and(
        eq(leadSourcesTable.dealershipId, dealershipId),
        eq(leadSourcesTable.type, source as any)
      ))
      .limit(1);

    return leadSources[0]?.id || null;
  }

  /**
   * Create new lead
   */
  private async createLead(
    dealershipId: number,
    customerId: string,
    vehicleInterestId: string | null,
    sourceId: string | null,
    leadData: InboundLeadData['lead'],
    attribution: InboundLeadData['attribution'],
    customFields: Record<string, any>,
    originalPayload: InboundLeadData
  ): Promise<Lead> {
    const leadNumber = await this.generateLeadNumber(dealershipId);
    const deduplicationHash = this.generateLeadDeduplicationHash(
      customerId,
      leadData.requestType,
      originalPayload.vehicleInterest?.year,
      originalPayload.vehicleInterest?.make,
      originalPayload.vehicleInterest?.model
    );

    const newLeadData: InsertLead = {
      dealershipId,
      customerId,
      vehicleInterestId,
      sourceId,
      leadNumber,
      status: 'new',
      priority: leadData.priority || 'medium',
      requestType: leadData.requestType,
      description: leadData.description,
      timeframe: leadData.timeframe,
      source: leadData.source as any,
      medium: leadData.medium || attribution?.medium,
      campaign: leadData.campaign || attribution?.campaign,
      keyword: attribution?.keyword,
      referrer: attribution?.referrer,
      landingPage: attribution?.landingPage,
      firstContactDate: new Date(),
      lastContactDate: new Date(),
      originalPayload,
      customFields: customFields || {},
      deduplicationHash
    };

    const [newLead] = await db
      .insert(leads)
      .values(newLeadData)
      .returning();

    return newLead;
  }

  /**
   * Create initial conversation for the lead
   */
  private async createInitialConversation(
    dealershipId: number,
    leadId: string,
    customerId: string,
    channel: string = 'api'
  ): Promise<Conversation> {
    const conversationData: InsertConversation = {
      dealershipId,
      leadId,
      customerId,
      subject: `New Lead Inquiry`,
      status: 'active',
      channel,
      lastMessageAt: new Date(),
      messageCount: 0,
      isAiAssisted: true
    };

    const [conversation] = await db
      .insert(conversations)
      .values(conversationData)
      .returning();

    return conversation;
  }

  /**
   * Log lead activity
   */
  private async logLeadActivity(
    leadId: string,
    type: string,
    description: string,
    userId?: number
  ): Promise<void> {
    await db.insert(leadActivities).values({
      leadId,
      userId,
      type,
      description
    });
  }

  /**
   * Process inbound lead data
   */
  async processInboundLead(
    dealershipId: number,
    leadData: InboundLeadData
  ): Promise<LeadCreationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      logger.info('Processing inbound lead', { 
        dealershipId, 
        customerName: leadData.customer.fullName 
      });

      // Find or create customer
      const { customer, isExisting } = await this.findOrCreateCustomer(
        dealershipId,
        leadData.customer
      );

      // Create vehicle interest if provided
      const vehicleInterestId = await this.createVehicleInterest(
        leadData.vehicleInterest
      );

      // Check for duplicate lead
      const duplicateLead = await this.checkForDuplicateLead(
        dealershipId,
        customer.id,
        leadData.lead,
        leadData.vehicleInterest
      );

      if (duplicateLead) {
        logger.warn('Duplicate lead detected', { 
          duplicateLeadId: duplicateLead.id,
          customerId: customer.id
        });

        return {
          success: false,
          leadId: duplicateLead.id,
          customerId: customer.id,
          errors: ['Duplicate lead detected'],
          warnings,
          isExistingCustomer: isExisting,
          isDuplicateLead: true
        };
      }

      // Find lead source
      const sourceId = await this.findLeadSource(dealershipId, leadData.lead.source);
      if (!sourceId) {
        warnings.push(`Lead source '${leadData.lead.source}' not found, lead will be created without source reference`);
      }

      // Create the lead
      const newLead = await this.createLead(
        dealershipId,
        customer.id,
        vehicleInterestId,
        sourceId,
        leadData.lead,
        leadData.attribution,
        leadData.customFields || {},
        leadData
      );

      // Create initial conversation
      const conversation = await this.createInitialConversation(
        dealershipId,
        newLead.id,
        customer.id
      );

      // Log lead creation activity
      await this.logLeadActivity(
        newLead.id,
        'lead_created',
        `Lead created from ${leadData.lead.source} source`
      );

      logger.info('Lead processed successfully', {
        leadId: newLead.id,
        leadNumber: newLead.leadNumber,
        customerId: customer.id,
        conversationId: conversation.id
      });

      return {
        success: true,
        leadId: newLead.id,
        customerId: customer.id,
        conversationId: conversation.id,
        errors,
        warnings,
        isExistingCustomer: isExisting,
        isDuplicateLead: false
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Lead processing failed', { 
        error: err.message, 
        dealershipId,
        customerName: leadData.customer.fullName
      });

      errors.push(`Lead processing failed: ${err.message}`);

      return {
        success: false,
        errors,
        warnings,
        isExistingCustomer: false,
        isDuplicateLead: false
      };
    }
  }

  /**
   * Get lead by ID with full details
   */
  async getLeadById(leadId: string, dealershipId: number): Promise<Lead | null> {
    const leadResults = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.id, leadId),
        eq(leads.dealershipId, dealershipId)
      ))
      .limit(1);

    return leadResults[0] || null;
  }

  /**
   * Get leads for a dealership with pagination
   */
  async getLeads(
    dealershipId: number,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      source?: string;
      customerId?: string;
    } = {}
  ): Promise<Lead[]> {
    const { limit = 50, offset = 0, status, source, customerId } = options;

    let query = db
      .select()
      .from(leads)
      .where(eq(leads.dealershipId, dealershipId));

    if (status) {
      query = query.where(and(
        eq(leads.dealershipId, dealershipId),
        eq(leads.status, status as any)
      ));
    }

    if (source) {
      query = query.where(and(
        eq(leads.dealershipId, dealershipId),
        eq(leads.source, source as any)
      ));
    }

    if (customerId) {
      query = query.where(and(
        eq(leads.dealershipId, dealershipId),
        eq(leads.customerId, customerId)
      ));
    }

    return query
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);
  }
}