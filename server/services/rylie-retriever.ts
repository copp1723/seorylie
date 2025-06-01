import { Retriever } from '../lib/agent-squad-stub';
import db from '../db';
import { vehicles, dealerships, personas } from '../../shared/schema';
import { eq, and, like, sql } from 'drizzle-orm';
import logger from '../utils/logger';

export interface RylieRetrieverOptions {
  dealershipId: number;
  maxResults?: number;
  includeVehicleData?: boolean;
  includeDealershipInfo?: boolean;
  includePersonaData?: boolean;
}

export interface RetrievedDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  type: 'vehicle' | 'dealership' | 'persona' | 'customer_history';
}

/**
 * Custom retriever that integrates with Rylie's existing data
 * Provides context-aware information for Agent Squad responses
 */
export class RylieRetriever implements Retriever {
  private options: RylieRetrieverOptions;

  constructor(options: RylieRetrieverOptions) {
    this.options = {
      maxResults: 10,
      includeVehicleData: true,
      includeDealershipInfo: true,
      includePersonaData: true,
      ...options
    };

    logger.info('RylieRetriever initialized', { options: this.options });
  }

  async retrieve(query: string, context?: Record<string, any>): Promise<RetrievedDocument[]> {
    try {
      logger.info('Retrieving documents for query', {
        query: query.substring(0, 100),
        dealershipId: this.options.dealershipId,
        context
      });

      const documents: RetrievedDocument[] = [];

      // Extract keywords and intent from query
      const keywords = this.extractKeywords(query);
      const intent = this.analyzeIntent(query, keywords);

      // Retrieve different types of documents based on intent
      if (intent.includes('vehicle') || intent.includes('inventory')) {
        const vehicleDocs = await this.retrieveVehicleDocuments(keywords, query);
        documents.push(...vehicleDocs);
      }

      if (intent.includes('dealership') || intent.includes('location') || intent.includes('contact')) {
        const dealershipDocs = await this.retrieveDealershipDocuments();
        documents.push(...dealershipDocs);
      }

      if (intent.includes('persona') || intent.includes('greeting') || intent.includes('introduction')) {
        const personaDocs = await this.retrievePersonaDocuments();
        documents.push(...personaDocs);
      }

      // Always include relevant customer conversation history if available
      if (context?.conversationId) {
        const historyDocs = await this.retrieveConversationHistory(context.conversationId);
        documents.push(...historyDocs);
      }

      // Sort by relevance score and limit results
      const sortedDocs = documents
        .sort((a, b) => b.score - a.score)
        .slice(0, this.options.maxResults);

      logger.info('Document retrieval completed', {
        totalDocs: sortedDocs.length,
        types: [...new Set(sortedDocs.map(d => d.type))],
        dealershipId: this.options.dealershipId
      });

      return sortedDocs;

    } catch (error) {
      logger.error('Document retrieval failed', { error, query, dealershipId: this.options.dealershipId });
      return [];
    }
  }

  private extractKeywords(query: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Automotive-specific keywords
    const automotiveTerms = [
      'car', 'vehicle', 'truck', 'suv', 'sedan', 'coupe', 'hatchback', 'wagon',
      'new', 'used', 'certified', 'pre-owned',
      'honda', 'toyota', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi',
      'civic', 'camry', 'accord', 'corolla', 'f-150', 'silverado', 'escape',
      'financing', 'lease', 'loan', 'payment', 'down', 'trade',
      'service', 'maintenance', 'repair', 'oil', 'tire', 'brake',
      'test', 'drive', 'appointment', 'visit', 'schedule'
    ];

    return words.filter(word =>
      automotiveTerms.includes(word) ||
      word.length > 4 ||
      /^\d{4}$/.test(word) // Year
    );
  }

  private analyzeIntent(query: string, keywords: string[]): string[] {
    const intents: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Vehicle/Inventory intent
    if (keywords.some(k => ['car', 'vehicle', 'truck', 'suv', 'sedan'].includes(k)) ||
        lowerQuery.includes('looking for') || lowerQuery.includes('interested in')) {
      intents.push('vehicle', 'inventory');
    }

    // Service intent
    if (keywords.some(k => ['service', 'maintenance', 'repair'].includes(k)) ||
        lowerQuery.includes('appointment')) {
      intents.push('service');
    }

    // Financing intent
    if (keywords.some(k => ['financing', 'lease', 'loan', 'payment'].includes(k))) {
      intents.push('financing');
    }

    // Location/Contact intent
    if (lowerQuery.includes('location') || lowerQuery.includes('address') ||
        lowerQuery.includes('phone') || lowerQuery.includes('contact')) {
      intents.push('dealership', 'location', 'contact');
    }

    // Greeting intent
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') ||
        lowerQuery.includes('greeting') || query.length < 20) {
      intents.push('persona', 'greeting');
    }

    return intents;
  }

  private async retrieveVehicleDocuments(keywords: string[], query: string): Promise<RetrievedDocument[]> {
    if (!this.options.includeVehicleData) return [];

    try {
      // Build search conditions based on keywords
      const conditions = [
        eq(vehicles.dealershipId, this.options.dealershipId),
        eq(vehicles.isActive, true)
      ];

      // Add keyword-based filters
      for (const keyword of keywords) {
        // Check if keyword might be a make/model
        const makeModelCondition = sql`(
          LOWER(${vehicles.make}) LIKE ${`%${keyword}%`} OR
          LOWER(${vehicles.model}) LIKE ${`%${keyword}%`} OR
          LOWER(${vehicles.description}) LIKE ${`%${keyword}%`}
        )`;
        conditions.push(makeModelCondition);
      }

      const vehicleResults = await db.select()
        .from(vehicles)
        .where(and(...conditions))
        .limit(5);

      return vehicleResults.map((vehicle, index) => ({
        id: `vehicle_${vehicle.id}`,
        content: this.formatVehicleContent(vehicle),
        metadata: {
          type: 'vehicle',
          vin: vehicle.vin,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          price: vehicle.salePrice,
          dealershipId: vehicle.dealershipId
        },
        score: 0.9 - (index * 0.1), // Higher score for first results
        type: 'vehicle' as const
      }));

    } catch (error) {
      logger.error('Failed to retrieve vehicle documents', { error, keywords });
      return [];
    }
  }

  private async retrieveDealershipDocuments(): Promise<RetrievedDocument[]> {
    if (!this.options.includeDealershipInfo) return [];

    try {
      const dealershipResult = await db.select()
        .from(dealerships)
        .where(eq(dealerships.id, this.options.dealershipId))
        .limit(1);

      if (dealershipResult.length === 0) return [];

      const dealership = dealershipResult[0];

      return [{
        id: `dealership_${dealership.id}`,
        content: this.formatDealershipContent(dealership),
        metadata: {
          type: 'dealership',
          name: dealership.name,
          subdomain: dealership.subdomain,
          address: dealership.address,
          phone: dealership.contact_phone,
          email: dealership.contact_email
        },
        score: 0.8,
        type: 'dealership' as const
      }];

    } catch (error) {
      logger.error('Failed to retrieve dealership documents', { error });
      return [];
    }
  }

  private async retrievePersonaDocuments(): Promise<RetrievedDocument[]> {
    if (!this.options.includePersonaData) return [];

    try {
      const personaResults = await db.select()
        .from(personas)
        .where(eq(personas.dealershipId, this.options.dealershipId))
        .limit(3);

      return personaResults.map((persona, index) => ({
        id: `persona_${persona.id}`,
        content: this.formatPersonaContent(persona),
        metadata: {
          type: 'persona',
          name: persona.name,
          isDefault: persona.isDefault,
          dealershipId: persona.dealershipId
        },
        score: persona.isDefault ? 0.9 : 0.7 - (index * 0.1),
        type: 'persona' as const
      }));

    } catch (error) {
      logger.error('Failed to retrieve persona documents', { error });
      return [];
    }
  }

  private async retrieveConversationHistory(conversationId: string): Promise<RetrievedDocument[]> {
    try {
      // This would integrate with the conversation service to get recent history
      // For now, return placeholder indicating conversation context is available
      return [{
        id: `history_${conversationId}`,
        content: `Conversation context available for ${conversationId}. This is an ongoing conversation where the customer may reference previous interactions.`,
        metadata: {
          type: 'customer_history',
          conversationId,
          dealershipId: this.options.dealershipId
        },
        score: 0.6,
        type: 'customer_history' as const
      }];

    } catch (error) {
      logger.error('Failed to retrieve conversation history', { error, conversationId });
      return [];
    }
  }

  private formatVehicleContent(vehicle: any): string {
    const price = vehicle.salePrice ? `$${Math.round(vehicle.salePrice / 100).toLocaleString()}` : 'Price available upon request';
    const mileage = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : 'Mileage varies';

    return `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}
Price: ${price}
Mileage: ${mileage}
${vehicle.bodyStyle ? `Body Style: ${vehicle.bodyStyle}` : ''}
${vehicle.extColor ? `Color: ${vehicle.extColor}` : ''}
${vehicle.fuelType ? `Fuel Type: ${vehicle.fuelType}` : ''}
${vehicle.transmission ? `Transmission: ${vehicle.transmission}` : ''}
${vehicle.certified ? 'Certified Pre-Owned' : ''}
Stock #: ${vehicle.stockNumber || vehicle.vin}
${vehicle.description || ''}`.trim();
  }

  private formatDealershipContent(dealership: any): string {
    return `${dealership.name}
${dealership.description || 'Full-service automotive dealership'}
${dealership.address ? `Location: ${dealership.address}` : ''}
${dealership.city && dealership.state ? `${dealership.city}, ${dealership.state} ${dealership.zip || ''}` : ''}
${dealership.contact_phone ? `Phone: ${dealership.contact_phone}` : ''}
${dealership.contact_email ? `Email: ${dealership.contact_email}` : ''}
${dealership.website ? `Website: ${dealership.website}` : ''}
Persona: ${dealership.persona_name || 'Rylie'} - ${dealership.persona_tone || 'friendly'} assistant`.trim();
  }

  private formatPersonaContent(persona: any): string {
    return `Persona: ${persona.name}
${persona.isDefault ? '(Default persona for this dealership)' : ''}
Instructions: ${persona.promptTemplate || 'Standard automotive assistant'}
Configuration: ${JSON.stringify(persona.arguments || {})}`.trim();
  }

  /**
   * Update retriever options dynamically
   */
  updateOptions(newOptions: Partial<RylieRetrieverOptions>): void {
    this.options = { ...this.options, ...newOptions };
    logger.info('RylieRetriever options updated', { options: this.options });
  }
}

/**
 * Factory function to create RylieRetriever instance
 */
export function createRylieRetriever(options: RylieRetrieverOptions): RylieRetriever {
  return new RylieRetriever(options);
}