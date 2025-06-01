import { Retriever } from '../../lib/agent-squad-stub';
import { db } from '../../db';
import { vehicles, dealerships, personas } from '../../../shared/schema';
import { eq, and, like, sql } from 'drizzle-orm';
import logger from '../../utils/logger';

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
  type: 'vehicle' | 'dealership' | 'persona' | 'customer_history' | 'service' | 'finance' | 'trade' | 'knowledge';
}

export interface RetrievalStrategy {
  prioritizeInventory: boolean;
  includePersona: boolean;
  includeHistory: boolean;
  maxVehicleResults: number;
  contextWeight: number;
  useSemanticSearch: boolean;
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
      logger.info('Enhanced document retrieval for query', { 
        query: query.substring(0, 100),
        dealershipId: this.options.dealershipId,
        context: context ? Object.keys(context) : [],
        conversationId: context?.conversationId
      });

      const documents: RetrievedDocument[] = [];
      const startTime = Date.now();

      // Extract keywords and analyze intent with enhanced context awareness
      const keywords = this.extractKeywords(query);
      const intent = this.analyzeIntent(query, keywords, context);
      
      // Enhanced context-aware retrieval strategy
      const retrievalStrategy = this.determineRetrievalStrategy(query, intent, context);
      
      logger.debug('Retrieval strategy determined', {
        strategy: retrievalStrategy,
        intents: intent,
        keywords: keywords.slice(0, 5),
        contextAvailable: !!context
      });

      // Parallel retrieval for performance optimization
      const retrievalTasks = [];

      // Always retrieve dealership context for better responses
      if (this.options.includeDealershipInfo) {
        retrievalTasks.push(this.retrieveDealershipDocuments());
      }

      // Vehicle/inventory retrieval with enhanced context
      if (intent.includes('vehicle') || intent.includes('inventory') || retrievalStrategy.prioritizeInventory) {
        retrievalTasks.push(this.retrieveVehicleDocuments(keywords, query, context));
      }

      // Service-specific retrieval
      if (intent.includes('service') || intent.includes('maintenance')) {
        retrievalTasks.push(this.retrieveServiceDocuments(keywords, context));
      }

      // Finance-specific retrieval
      if (intent.includes('financing') || intent.includes('loan') || intent.includes('lease')) {
        retrievalTasks.push(this.retrieveFinanceDocuments(keywords, context));
      }

      // Persona information for greetings and brand consistency
      if (intent.includes('persona') || intent.includes('greeting') || retrievalStrategy.includePersona) {
        retrievalTasks.push(this.retrievePersonaDocuments());
      }

      // Customer conversation history with enhanced integration
      if (context?.conversationId || context?.customerHistory) {
        retrievalTasks.push(this.retrieveConversationHistory(context.conversationId, context));
      }

      // Execute all retrieval tasks in parallel
      const retrievalResults = await Promise.allSettled(retrievalTasks);
      
      // Process successful retrievals
      retrievalResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          documents.push(...result.value);
        } else {
          logger.warn('Retrieval task failed', { index, error: result.reason });
        }
      });

      // Enhanced document scoring and ranking
      const scoredDocs = this.enhanceDocumentScoring(documents, query, keywords, intent, context);

      // Apply intelligent filtering and deduplication
      const filteredDocs = this.applyIntelligentFiltering(scoredDocs, query, context);

      // Sort by enhanced relevance score and limit results
      const finalDocs = filteredDocs
        .sort((a, b) => b.score - a.score)
        .slice(0, this.options.maxResults);

      const processingTime = Date.now() - startTime;
      
      logger.info('Enhanced document retrieval completed', {
        totalDocs: finalDocs.length,
        types: [...new Set(finalDocs.map(d => d.type))],
        dealershipId: this.options.dealershipId,
        processingTimeMs: processingTime,
        strategy: retrievalStrategy,
        averageScore: finalDocs.reduce((sum, doc) => sum + doc.score, 0) / finalDocs.length
      });

      return finalDocs;

    } catch (error) {
      logger.error('Enhanced document retrieval failed', { error, query, dealershipId: this.options.dealershipId });
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

  private analyzeIntent(query: string, keywords: string[], context?: Record<string, any>): string[] {
    const intents: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Enhanced Vehicle/Inventory intent detection
    if (keywords.some(k => ['car', 'vehicle', 'truck', 'suv', 'sedan', 'coupe', 'hatchback', 'wagon', 'convertible'].includes(k)) ||
        lowerQuery.includes('looking for') || lowerQuery.includes('interested in') ||
        lowerQuery.includes('shopping') || lowerQuery.includes('need') ||
        /\b(honda|toyota|ford|chevrolet|nissan|bmw|mercedes|audi|lexus|acura)\b/.test(lowerQuery)) {
      intents.push('vehicle', 'inventory');
    }

    // Enhanced Service intent detection
    if (keywords.some(k => ['service', 'maintenance', 'repair', 'oil', 'brake', 'tire', 'transmission', 'engine'].includes(k)) ||
        lowerQuery.includes('appointment') || lowerQuery.includes('schedule') ||
        lowerQuery.includes('check engine') || lowerQuery.includes('problem') ||
        lowerQuery.includes('noise') || lowerQuery.includes('warranty')) {
      intents.push('service', 'maintenance');
    }

    // Enhanced Financing intent detection
    if (keywords.some(k => ['financing', 'lease', 'loan', 'payment', 'credit', 'monthly', 'down', 'apr', 'rate'].includes(k)) ||
        lowerQuery.includes('finance') || lowerQuery.includes('afford') ||
        lowerQuery.includes('budget') || lowerQuery.includes('qualify')) {
      intents.push('financing');
      
      // Sub-categorize financing intent
      if (lowerQuery.includes('lease') || lowerQuery.includes('leasing')) {
        intents.push('lease');
      }
      if (lowerQuery.includes('loan') || lowerQuery.includes('buy') || lowerQuery.includes('purchase')) {
        intents.push('loan');
      }
    }

    // Trade-in intent detection
    if (keywords.some(k => ['trade', 'value', 'worth', 'appraisal', 'estimate'].includes(k)) ||
        lowerQuery.includes('trade in') || lowerQuery.includes('current car') ||
        lowerQuery.includes('what\'s it worth') || lowerQuery.includes('sell')) {
      intents.push('trade', 'valuation');
    }

    // Enhanced Location/Contact intent
    if (lowerQuery.includes('location') || lowerQuery.includes('address') || 
        lowerQuery.includes('phone') || lowerQuery.includes('contact') ||
        lowerQuery.includes('hours') || lowerQuery.includes('directions') ||
        lowerQuery.includes('where are you') || lowerQuery.includes('visit')) {
      intents.push('dealership', 'location', 'contact');
    }

    // Enhanced Greeting/Introduction intent
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || 
        lowerQuery.includes('hey') || lowerQuery.includes('good morning') ||
        lowerQuery.includes('good afternoon') || lowerQuery.includes('good evening') ||
        query.length < 20 && !intents.length) {
      intents.push('persona', 'greeting');
    }

    // Test drive intent
    if (lowerQuery.includes('test drive') || lowerQuery.includes('drive') ||
        lowerQuery.includes('try out') || lowerQuery.includes('experience')) {
      intents.push('test_drive', 'sales');
    }

    // Context-aware intent enhancement
    if (context) {
      // Previous conversation context
      if (context.previousAgent === 'inventory-agent' && !intents.includes('inventory')) {
        intents.push('inventory_followup');
      }
      
      // Customer journey stage
      if (context.journeyStage === 'consideration' && !intents.includes('vehicle')) {
        intents.push('vehicle', 'comparison');
      }
      
      // Recent search history
      if (context.recentSearches && !intents.length) {
        intents.push('inventory', 'followup');
      }
    }

    // Fallback intent for empty classifications
    if (intents.length === 0) {
      intents.push('general');
    }

    return intents;
  }

  private async retrieveVehicleDocuments(keywords: string[], query: string, context?: Record<string, any>): Promise<RetrievedDocument[]> {
    if (!this.options.includeVehicleData) return [];

    try {
      logger.debug('Context-aware vehicle document retrieval', {
        keywords,
        contextKeys: context ? Object.keys(context) : [],
        dealershipId: this.options.dealershipId
      });

      // Build enhanced search conditions based on keywords and context
      const conditions = [
        eq(vehicles.dealershipId, this.options.dealershipId),
        eq(vehicles.isActive, true)
      ];

      // Context-aware keyword processing
      const processedKeywords = this.processKeywordsWithContext(keywords, context);
      
      // Enhanced keyword-based filters with context awareness
      const keywordConditions = [];
      for (const keyword of processedKeywords) {
        const makeModelCondition = sql`(
          LOWER(${vehicles.make}) LIKE ${`%${keyword}%`} OR 
          LOWER(${vehicles.model}) LIKE ${`%${keyword}%`} OR
          LOWER(${vehicles.description}) LIKE ${`%${keyword}%`} OR
          LOWER(${vehicles.trim}) LIKE ${`%${keyword}%`} OR
          LOWER(${vehicles.bodyStyle}) LIKE ${`%${keyword}%`} OR
          LOWER(${vehicles.fuelType}) LIKE ${`%${keyword}%`}
        )`;
        keywordConditions.push(makeModelCondition);
      }

      if (keywordConditions.length > 0) {
        conditions.push(sql`(${keywordConditions.join(' OR ')})`);
      }

      // Context-based filtering enhancements
      if (context) {
        // Price range from context or conversation history
        if (context.priceRange) {
          if (context.priceRange.min) {
            conditions.push(sql`${vehicles.salePrice} >= ${context.priceRange.min * 100}`);
          }
          if (context.priceRange.max) {
            conditions.push(sql`${vehicles.salePrice} <= ${context.priceRange.max * 100}`);
          }
        }

        // Year preferences from context
        if (context.yearPreference) {
          if (context.yearPreference.min) {
            conditions.push(sql`${vehicles.year} >= ${context.yearPreference.min}`);
          }
          if (context.yearPreference.max) {
            conditions.push(sql`${vehicles.year} <= ${context.yearPreference.max}`);
          }
        }

        // Body style preference
        if (context.bodyStylePreference) {
          conditions.push(like(vehicles.bodyStyle, `%${context.bodyStylePreference}%`));
        }

        // Fuel efficiency preference
        if (context.fuelEfficiencyImportant && query.toLowerCase().includes('efficient')) {
          conditions.push(sql`(
            ${vehicles.fuelType} ILIKE '%hybrid%' OR 
            ${vehicles.fuelType} ILIKE '%electric%' OR
            ${vehicles.mpgCity} > 30
          )`);
        }

        // Recent search history integration
        if (context.recentSearches && context.recentSearches.length > 0) {
          const recentMakes = context.recentSearches
            .map((search: any) => search.make)
            .filter(Boolean)
            .slice(0, 3); // Last 3 searches
          
          if (recentMakes.length > 0) {
            const recentMakeConditions = recentMakes.map(make => 
              like(vehicles.make, `%${make}%`)
            );
            // Boost vehicles from recently searched makes
            conditions.push(sql`(${recentMakeConditions.join(' OR ')})`);
          }
        }
      }

      // Enhanced result limit based on context
      const resultLimit = this.determineResultLimit(context, query);

      const vehicleResults = await db.select()
        .from(vehicles)
        .where(and(...conditions))
        .limit(resultLimit);

      // Enhanced vehicle document creation with context-aware scoring
      return vehicleResults.map((vehicle, index) => {
        let contextScore = 0.9 - (index * 0.1);

        // Context-aware score adjustments
        if (context) {
          // Boost score for matching customer preferences
          if (context.preferences) {
            if (context.preferences.make === vehicle.make) contextScore += 0.1;
            if (context.preferences.bodyStyle === vehicle.bodyStyle) contextScore += 0.05;
            if (context.preferences.fuelType === vehicle.fuelType) contextScore += 0.05;
          }

          // Boost score for vehicles in customer's price range
          if (context.priceRange && vehicle.salePrice) {
            const price = vehicle.salePrice / 100;
            if ((!context.priceRange.min || price >= context.priceRange.min) &&
                (!context.priceRange.max || price <= context.priceRange.max)) {
              contextScore += 0.1;
            }
          }

          // Boost certified vehicles if customer values reliability
          if (context.reliabilityImportant && vehicle.certified) {
            contextScore += 0.05;
          }

          // Recent search relevance boost
          if (context.recentSearches) {
            const recentMakes = context.recentSearches.map((s: any) => s.make?.toLowerCase());
            if (recentMakes.includes(vehicle.make?.toLowerCase())) {
              contextScore += 0.08;
            }
          }
        }

        return {
          id: `vehicle_${vehicle.id}`,
          content: this.formatVehicleContentWithContext(vehicle, context),
          metadata: {
            type: 'vehicle',
            vin: vehicle.vin,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            price: vehicle.salePrice ? Math.round(vehicle.salePrice / 100) : null,
            bodyStyle: vehicle.bodyStyle,
            fuelType: vehicle.fuelType,
            certified: vehicle.certified,
            mileage: vehicle.mileage,
            dealershipId: vehicle.dealershipId,
            availability: vehicle.status === 'Available',
            contextRelevance: contextScore > 0.9 ? 'high' : contextScore > 0.7 ? 'medium' : 'low'
          },
          score: Math.min(1.0, contextScore),
          type: 'vehicle' as const
        };
      });

    } catch (error) {
      logger.error('Failed to retrieve context-aware vehicle documents', { error, keywords, context });
      return [];
    }
  }

  private async retrieveDealershipDocuments(): Promise<RetrievedDocument[]> {
    if (!this.options.includeDealershipInfo) return [];

    try {
      logger.debug('Retrieving comprehensive dealership information', { 
        dealershipId: this.options.dealershipId 
      });

      const dealershipResult = await db.select()
        .from(dealerships)
        .where(eq(dealerships.id, this.options.dealershipId))
        .limit(1);

      if (dealershipResult.length === 0) {
        logger.warn('Dealership not found', { dealershipId: this.options.dealershipId });
        return [];
      }

      const dealership = dealershipResult[0];
      const documents: RetrievedDocument[] = [];

      // Main dealership information
      documents.push({
        id: `dealership_main_${dealership.id}`,
        content: this.formatEnhancedDealershipContent(dealership),
        metadata: {
          type: 'dealership',
          subType: 'main_info',
          name: dealership.name,
          subdomain: dealership.subdomain,
          address: dealership.address,
          phone: dealership.contact_phone,
          email: dealership.contact_email,
          city: dealership.city,
          state: dealership.state,
          zip: dealership.zip
        },
        score: 0.9,
        type: 'dealership' as const
      });

      // Dealership services and capabilities
      documents.push({
        id: `dealership_services_${dealership.id}`,
        content: this.formatDealershipServices(dealership),
        metadata: {
          type: 'dealership',
          subType: 'services',
          dealershipId: dealership.id,
          name: dealership.name
        },
        score: 0.75,
        type: 'dealership' as const
      });

      // Hours and contact information
      documents.push({
        id: `dealership_contact_${dealership.id}`,
        content: this.formatDealershipContact(dealership),
        metadata: {
          type: 'dealership',
          subType: 'contact_hours',
          dealershipId: dealership.id,
          phone: dealership.contact_phone,
          email: dealership.contact_email
        },
        score: 0.8,
        type: 'dealership' as const
      });

      // Brand and specialization information
      if (dealership.brands || dealership.specialization) {
        documents.push({
          id: `dealership_brands_${dealership.id}`,
          content: this.formatDealershipBrands(dealership),
          metadata: {
            type: 'dealership',
            subType: 'brands_specialization',
            dealershipId: dealership.id,
            brands: dealership.brands,
            specialization: dealership.specialization
          },
          score: 0.7,
          type: 'dealership' as const
        });
      }

      // Location and directions
      documents.push({
        id: `dealership_location_${dealership.id}`,
        content: this.formatDealershipLocation(dealership),
        metadata: {
          type: 'dealership',
          subType: 'location_directions',
          dealershipId: dealership.id,
          address: dealership.address,
          city: dealership.city,
          state: dealership.state,
          coordinates: dealership.coordinates
        },
        score: 0.65,
        type: 'dealership' as const
      });

      logger.debug('Dealership documents retrieved', {
        dealershipId: this.options.dealershipId,
        documentsCount: documents.length,
        dealershipName: dealership.name
      });

      return documents;

    } catch (error) {
      logger.error('Failed to retrieve enhanced dealership documents', { 
        error, 
        dealershipId: this.options.dealershipId 
      });
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

  private async retrieveConversationHistory(conversationId: string, context?: Record<string, any>): Promise<RetrievedDocument[]> {
    try {
      logger.debug('Retrieving enhanced conversation history', { 
        conversationId, 
        contextKeys: context ? Object.keys(context) : [],
        dealershipId: this.options.dealershipId 
      });

      const documents: RetrievedDocument[] = [];

      // Enhanced conversation context integration
      if (conversationId) {
        // Main conversation summary
        const conversationSummary = await this.generateConversationSummary(conversationId, context);
        documents.push({
          id: `history_summary_${conversationId}`,
          content: conversationSummary,
          metadata: {
            type: 'customer_history',
            subType: 'conversation_summary',
            conversationId,
            dealershipId: this.options.dealershipId,
            lastUpdated: new Date().toISOString()
          },
          score: 0.8,
          type: 'customer_history' as const
        });

        // Recent interactions context
        if (context?.recentInteractions) {
          const recentContext = this.formatRecentInteractions(context.recentInteractions, conversationId);
          documents.push({
            id: `history_recent_${conversationId}`,
            content: recentContext,
            metadata: {
              type: 'customer_history',
              subType: 'recent_interactions',
              conversationId,
              interactionCount: context.recentInteractions.length,
              dealershipId: this.options.dealershipId
            },
            score: 0.7,
            type: 'customer_history' as const
          });
        }

        // Customer preferences from history
        if (context?.customerPreferences || context?.searchHistory) {
          const preferencesContext = this.formatCustomerPreferences(context);
          documents.push({
            id: `history_preferences_${conversationId}`,
            content: preferencesContext,
            metadata: {
              type: 'customer_history',
              subType: 'customer_preferences',
              conversationId,
              dealershipId: this.options.dealershipId,
              hasSearchHistory: !!context?.searchHistory,
              hasPreferences: !!context?.customerPreferences
            },
            score: 0.75,
            type: 'customer_history' as const
          });
        }

        // Previous agent interactions
        if (context?.agentHistory) {
          const agentContext = this.formatAgentHistory(context.agentHistory, conversationId);
          documents.push({
            id: `history_agents_${conversationId}`,
            content: agentContext,
            metadata: {
              type: 'customer_history',
              subType: 'agent_history',
              conversationId,
              previousAgents: context.agentHistory.map((h: any) => h.agent),
              dealershipId: this.options.dealershipId
            },
            score: 0.65,
            type: 'customer_history' as const
          });
        }

        // Customer journey stage context
        if (context?.journeyStage || context?.customerType) {
          const journeyContext = this.formatJourneyContext(context);
          documents.push({
            id: `history_journey_${conversationId}`,
            content: journeyContext,
            metadata: {
              type: 'customer_history',
              subType: 'journey_context',
              conversationId,
              journeyStage: context?.journeyStage,
              customerType: context?.customerType,
              dealershipId: this.options.dealershipId
            },
            score: 0.6,
            type: 'customer_history' as const
          });
        }
      }

      // Fallback context if no specific conversation ID
      if (!conversationId && context) {
        documents.push({
          id: `context_${Date.now()}`,
          content: this.formatGeneralContext(context),
          metadata: {
            type: 'customer_history',
            subType: 'general_context',
            dealershipId: this.options.dealershipId,
            contextProvided: Object.keys(context)
          },
          score: 0.5,
          type: 'customer_history' as const
        });
      }

      logger.debug('Conversation history retrieval completed', {
        conversationId,
        documentsRetrieved: documents.length,
        types: documents.map(d => d.metadata.subType),
        totalScore: documents.reduce((sum, doc) => sum + doc.score, 0)
      });

      return documents;

    } catch (error) {
      logger.error('Failed to retrieve enhanced conversation history', { error, conversationId, context });
      
      // Fallback with basic context
      return [{
        id: `history_fallback_${conversationId || 'unknown'}`,
        content: 'Previous conversation context available. The customer may reference earlier interactions in this conversation.',
        metadata: {
          type: 'customer_history',
          subType: 'fallback',
          conversationId: conversationId || 'unknown',
          dealershipId: this.options.dealershipId,
          error: 'Failed to load detailed history'
        },
        score: 0.3,
        type: 'customer_history' as const
      }];
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
   * Determine intelligent retrieval strategy based on context
   */
  private determineRetrievalStrategy(query: string, intents: string[], context?: Record<string, any>): RetrievalStrategy {
    const strategy: RetrievalStrategy = {
      prioritizeInventory: intents.includes('vehicle') || intents.includes('inventory'),
      includePersona: intents.includes('greeting') || intents.includes('persona') || !intents.some(i => ['vehicle', 'service', 'financing'].includes(i)),
      includeHistory: !!context?.conversationId || !!context?.customerHistory,
      maxVehicleResults: 5,
      contextWeight: 0.3,
      useSemanticSearch: false
    };

    // Adjust strategy based on context
    if (context?.urgency === 'high') {
      strategy.prioritizeInventory = true;
      strategy.maxVehicleResults = 3; // Focused results for urgency
    }

    if (context?.customerType === 'returning') {
      strategy.includeHistory = true;
      strategy.contextWeight = 0.5; // Higher weight for returning customers
    }

    return strategy;
  }

  /**
   * Enhanced document scoring with context awareness
   */
  private enhanceDocumentScoring(documents: RetrievedDocument[], query: string, keywords: string[], intents: string[], context?: Record<string, any>): RetrievedDocument[] {
    return documents.map(doc => {
      let enhancedScore = doc.score;

      // Boost score based on intent matching
      if (intents.includes('vehicle') && doc.type === 'vehicle') {
        enhancedScore += 0.2;
      }
      if (intents.includes('dealership') && doc.type === 'dealership') {
        enhancedScore += 0.3;
      }
      if (intents.includes('persona') && doc.type === 'persona') {
        enhancedScore += 0.2;
      }

      // Keyword matching bonus
      const contentLower = doc.content.toLowerCase();
      const keywordMatches = keywords.filter(keyword => contentLower.includes(keyword.toLowerCase())).length;
      enhancedScore += keywordMatches * 0.1;

      // Context-based scoring
      if (context) {
        // Recent search history relevance
        if (context.recentSearches && doc.type === 'vehicle') {
          const recentMakes = context.recentSearches.map((s: any) => s.make?.toLowerCase()).filter(Boolean);
          if (recentMakes.includes(doc.metadata.make?.toLowerCase())) {
            enhancedScore += 0.15;
          }
        }

        // Customer preference matching
        if (context.preferences && doc.type === 'vehicle') {
          if (context.preferences.bodyStyle === doc.metadata.bodyStyle) {
            enhancedScore += 0.1;
          }
          if (context.preferences.maxPrice && doc.metadata.price <= context.preferences.maxPrice) {
            enhancedScore += 0.1;
          }
        }
      }

      return {
        ...doc,
        score: Math.min(1.0, enhancedScore) // Cap at 1.0
      };
    });
  }

  /**
   * Apply intelligent filtering and deduplication
   */
  private applyIntelligentFiltering(documents: RetrievedDocument[], query: string, context?: Record<string, any>): RetrievedDocument[] {
    // Remove exact duplicates
    const uniqueDocs = documents.filter((doc, index, self) =>
      index === self.findIndex(d => d.id === doc.id)
    );

    // Filter low-scoring documents
    const minScore = 0.1;
    const filteredDocs = uniqueDocs.filter(doc => doc.score >= minScore);

    // Ensure diversity in results
    const diverseDocs: RetrievedDocument[] = [];
    const typeCount: Record<string, number> = {};

    for (const doc of filteredDocs) {
      const currentCount = typeCount[doc.type] || 0;
      
      // Limit each type to prevent dominance
      const maxPerType = doc.type === 'vehicle' ? 6 : 2;
      
      if (currentCount < maxPerType) {
        diverseDocs.push(doc);
        typeCount[doc.type] = currentCount + 1;
      }
    }

    return diverseDocs;
  }

  /**
   * Retrieve service-related documents
   */
  private async retrieveServiceDocuments(keywords: string[], context?: Record<string, any>): Promise<RetrievedDocument[]> {
    try {
      // Create service-related content based on keywords and context
      const serviceContent = this.generateServiceContent(keywords, context);
      
      return [{
        id: `service_${this.options.dealershipId}_${Date.now()}`,
        content: serviceContent,
        metadata: {
          type: 'service',
          keywords,
          dealershipId: this.options.dealershipId
        },
        score: 0.7,
        type: 'service' as const
      }];
    } catch (error) {
      logger.error('Failed to retrieve service documents', { error, keywords });
      return [];
    }
  }

  /**
   * Retrieve finance-related documents
   */
  private async retrieveFinanceDocuments(keywords: string[], context?: Record<string, any>): Promise<RetrievedDocument[]> {
    try {
      const financeContent = this.generateFinanceContent(keywords, context);
      
      return [{
        id: `finance_${this.options.dealershipId}_${Date.now()}`,
        content: financeContent,
        metadata: {
          type: 'finance',
          keywords,
          dealershipId: this.options.dealershipId
        },
        score: 0.7,
        type: 'finance' as const
      }];
    } catch (error) {
      logger.error('Failed to retrieve finance documents', { error, keywords });
      return [];
    }
  }

  /**
   * Generate contextual service content
   */
  private generateServiceContent(keywords: string[], context?: Record<string, any>): string {
    let content = "Our service department offers comprehensive automotive maintenance and repair services.\n\n";
    
    if (keywords.includes('oil')) {
      content += "• Oil Change Services: Regular oil changes every 3,000-7,500 miles depending on your vehicle\n";
    }
    if (keywords.includes('brake')) {
      content += "• Brake Services: Brake pad replacement, rotor resurfacing, and complete brake system inspection\n";
    }
    if (keywords.includes('tire')) {
      content += "• Tire Services: Tire rotation, balancing, alignment, and new tire installation\n";
    }
    if (keywords.includes('maintenance')) {
      content += "• Preventive Maintenance: Scheduled maintenance per manufacturer recommendations\n";
    }
    
    content += "\nOur certified technicians use genuine parts and provide warranty coverage on all work.";
    return content;
  }

  /**
   * Generate contextual finance content
   */
  private generateFinanceContent(keywords: string[], context?: Record<string, any>): string {
    let content = "We offer comprehensive financing solutions for your automotive purchase.\n\n";
    
    if (keywords.includes('lease')) {
      content += "• Leasing Options: Lower monthly payments with flexible terms (24-39 months)\n";
    }
    if (keywords.includes('loan')) {
      content += "• Auto Loans: Competitive rates with terms from 36-84 months\n";
    }
    if (keywords.includes('credit')) {
      content += "• Credit Solutions: We work with all credit types, including first-time buyers\n";
    }
    if (keywords.includes('payment')) {
      content += "• Payment Calculator: We'll help you find a payment that fits your budget\n";
    }
    
    content += "\nPre-approval available. Our finance specialists will find the best rates for your situation.";
    return content;
  }

  /**
   * Process keywords with context awareness
   */
  private processKeywordsWithContext(keywords: string[], context?: Record<string, any>): string[] {
    let processedKeywords = [...keywords];

    if (context) {
      // Add inferred keywords from context
      if (context.preferences) {
        if (context.preferences.make && !processedKeywords.includes(context.preferences.make.toLowerCase())) {
          processedKeywords.push(context.preferences.make.toLowerCase());
        }
        if (context.preferences.bodyStyle && !processedKeywords.includes(context.preferences.bodyStyle.toLowerCase())) {
          processedKeywords.push(context.preferences.bodyStyle.toLowerCase());
        }
      }

      // Add keywords from recent searches
      if (context.recentSearches) {
        context.recentSearches.forEach((search: any) => {
          if (search.make && !processedKeywords.includes(search.make.toLowerCase())) {
            processedKeywords.push(search.make.toLowerCase());
          }
          if (search.model && !processedKeywords.includes(search.model.toLowerCase())) {
            processedKeywords.push(search.model.toLowerCase());
          }
        });
      }

      // Add contextual keywords based on conversation stage
      if (context.journeyStage === 'consideration') {
        processedKeywords.push('comparison', 'features', 'options');
      } else if (context.journeyStage === 'decision') {
        processedKeywords.push('pricing', 'availability', 'financing');
      }
    }

    // Remove duplicates and return
    return [...new Set(processedKeywords)];
  }

  /**
   * Determine appropriate result limit based on context
   */
  private determineResultLimit(context?: Record<string, any>, query?: string): number {
    let baseLimit = 5;

    if (context) {
      // Increase limit for browsing customers
      if (context.journeyStage === 'awareness' || context.customerType === 'browsing') {
        baseLimit = 8;
      }

      // Reduce limit for focused searches
      if (context.urgency === 'high' || context.journeyStage === 'decision') {
        baseLimit = 3;
      }

      // Increase limit if customer has shown interest in multiple makes
      if (context.recentSearches && context.recentSearches.length > 2) {
        baseLimit = Math.min(10, baseLimit + 2);
      }
    }

    // Adjust based on query specificity
    if (query) {
      const specificTerms = ['vin', 'stock', 'specific', 'exact'];
      if (specificTerms.some(term => query.toLowerCase().includes(term))) {
        baseLimit = 2; // Very focused search
      }
    }

    return baseLimit;
  }

  /**
   * Generate comprehensive conversation summary
   */
  private async generateConversationSummary(conversationId: string, context?: Record<string, any>): Promise<string> {
    try {
      let summary = `Previous conversation context for customer interaction ${conversationId}.\n\n`;

      if (context?.messageCount) {
        summary += `Total messages in conversation: ${context.messageCount}\n`;
      }

      if (context?.duration) {
        summary += `Conversation duration: ${context.duration}\n`;
      }

      if (context?.lastInteraction) {
        summary += `Last interaction: ${new Date(context.lastInteraction).toLocaleDateString()}\n`;
      }

      if (context?.topicsCovered && Array.isArray(context.topicsCovered)) {
        summary += `\nTopics discussed:\n`;
        context.topicsCovered.forEach((topic: string, index: number) => {
          summary += `${index + 1}. ${topic}\n`;
        });
      }

      if (context?.currentIntent) {
        summary += `\nCurrent customer intent: ${context.currentIntent}\n`;
      }

      if (context?.unresolved && Array.isArray(context.unresolved)) {
        summary += `\nUnresolved items:\n`;
        context.unresolved.forEach((item: string, index: number) => {
          summary += `• ${item}\n`;
        });
      }

      return summary.trim();
    } catch (error) {
      logger.error('Failed to generate conversation summary', { error, conversationId });
      return `Conversation context available for ${conversationId}. Customer may reference previous interactions.`;
    }
  }

  /**
   * Format recent interactions for context
   */
  private formatRecentInteractions(interactions: any[], conversationId: string): string {
    let content = `Recent conversation highlights for ${conversationId}:\n\n`;

    interactions.slice(-5).forEach((interaction: any, index: number) => {
      const timestamp = interaction.timestamp ? new Date(interaction.timestamp).toLocaleTimeString() : 'Recent';
      content += `${index + 1}. [${timestamp}] `;
      
      if (interaction.type === 'question') {
        content += `Customer asked: "${interaction.content}"\n`;
      } else if (interaction.type === 'search') {
        content += `Customer searched for: ${interaction.criteria}\n`;
      } else if (interaction.type === 'interest') {
        content += `Customer showed interest in: ${interaction.target}\n`;
      } else {
        content += `${interaction.type}: ${interaction.content}\n`;
      }
    });

    return content.trim();
  }

  /**
   * Format customer preferences from conversation history
   */
  private formatCustomerPreferences(context: Record<string, any>): string {
    let content = `Customer preferences and search history:\n\n`;

    if (context.customerPreferences) {
      content += `Stated preferences:\n`;
      Object.entries(context.customerPreferences).forEach(([key, value]) => {
        content += `• ${key}: ${value}\n`;
      });
    }

    if (context.searchHistory && Array.isArray(context.searchHistory)) {
      content += `\nRecent searches:\n`;
      context.searchHistory.slice(-5).forEach((search: any, index: number) => {
        content += `${index + 1}. `;
        if (search.make) content += `${search.make} `;
        if (search.model) content += `${search.model} `;
        if (search.priceRange) content += `($${search.priceRange.min || 0}-$${search.priceRange.max || 'unlimited'}) `;
        if (search.bodyStyle) content += `${search.bodyStyle} `;
        content += `\n`;
      });
    }

    if (context.savedVehicles && Array.isArray(context.savedVehicles)) {
      content += `\nSaved/favorited vehicles:\n`;
      context.savedVehicles.forEach((vehicle: any, index: number) => {
        content += `${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
        if (vehicle.reason) content += ` (${vehicle.reason})`;
        content += `\n`;
      });
    }

    return content.trim();
  }

  /**
   * Format agent interaction history
   */
  private formatAgentHistory(agentHistory: any[], conversationId: string): string {
    let content = `Previous agent interactions in this conversation:\n\n`;

    agentHistory.slice(-5).forEach((interaction: any, index: number) => {
      content += `${index + 1}. ${interaction.agent || 'Unknown Agent'}`;
      if (interaction.timestamp) {
        content += ` (${new Date(interaction.timestamp).toLocaleTimeString()})`;
      }
      content += `:\n`;
      
      if (interaction.topic) {
        content += `   Topic: ${interaction.topic}\n`;
      }
      if (interaction.outcome) {
        content += `   Outcome: ${interaction.outcome}\n`;
      }
      if (interaction.followUp) {
        content += `   Follow-up needed: ${interaction.followUp}\n`;
      }
      content += `\n`;
    });

    return content.trim();
  }

  /**
   * Format customer journey context
   */
  private formatJourneyContext(context: Record<string, any>): string {
    let content = `Customer journey context:\n\n`;

    if (context.journeyStage) {
      content += `Current stage: ${context.journeyStage}\n`;
      
      // Add stage-specific context
      switch (context.journeyStage) {
        case 'awareness':
          content += `Customer is in early exploration phase, gathering information about options.\n`;
          break;
        case 'consideration':
          content += `Customer is actively comparing vehicles and evaluating options.\n`;
          break;
        case 'decision':
          content += `Customer is ready to make a purchase decision and needs final details.\n`;
          break;
        case 'purchase':
          content += `Customer is in the purchase process, handling paperwork and logistics.\n`;
          break;
      }
    }

    if (context.customerType) {
      content += `Customer type: ${context.customerType}\n`;
    }

    if (context.urgency) {
      content += `Urgency level: ${context.urgency}\n`;
    }

    if (context.budget) {
      content += `Stated budget: $${context.budget.min || 0} - $${context.budget.max || 'unlimited'}\n`;
    }

    if (context.timeline) {
      content += `Purchase timeline: ${context.timeline}\n`;
    }

    if (context.motivation) {
      content += `Purchase motivation: ${context.motivation}\n`;
    }

    return content.trim();
  }

  /**
   * Format general context when no specific conversation ID
   */
  private formatGeneralContext(context: Record<string, any>): string {
    let content = `Available customer context:\n\n`;

    if (context.sessionStart) {
      content += `Session started: ${new Date(context.sessionStart).toLocaleString()}\n`;
    }

    if (context.referrer) {
      content += `Referrer: ${context.referrer}\n`;
    }

    if (context.userAgent) {
      content += `Platform: ${context.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}\n`;
    }

    if (context.location) {
      content += `Location: ${context.location}\n`;
    }

    const availableData = [];
    if (context.preferences) availableData.push('customer preferences');
    if (context.searchHistory) availableData.push('search history');
    if (context.recentInteractions) availableData.push('recent interactions');

    if (availableData.length > 0) {
      content += `\nAvailable context: ${availableData.join(', ')}\n`;
    }

    return content.trim();
  }

  /**
   * Format enhanced dealership content with comprehensive information
   */
  private formatEnhancedDealershipContent(dealership: any): string {
    let content = `${dealership.name}\n`;
    content += `${dealership.description || 'Full-service automotive dealership'}\n\n`;

    // Location Information
    if (dealership.address) {
      content += `📍 Location:\n`;
      content += `${dealership.address}\n`;
      if (dealership.city && dealership.state) {
        content += `${dealership.city}, ${dealership.state}`;
        if (dealership.zip) content += ` ${dealership.zip}`;
        content += `\n`;
      }
      content += `\n`;
    }

    // Contact Information
    content += `📞 Contact Information:\n`;
    if (dealership.contact_phone) {
      content += `Phone: ${dealership.contact_phone}\n`;
    }
    if (dealership.contact_email) {
      content += `Email: ${dealership.contact_email}\n`;
    }
    if (dealership.website) {
      content += `Website: ${dealership.website}\n`;
    }
    content += `\n`;

    // Brand Information
    if (dealership.brands) {
      content += `🚗 Brands We Serve:\n${dealership.brands}\n\n`;
    }

    // Hours of Operation
    if (dealership.hours) {
      content += `🕒 Hours of Operation:\n${dealership.hours}\n\n`;
    } else {
      content += `🕒 Hours: Please call for current hours of operation\n\n`;
    }

    // Persona Integration
    if (dealership.persona_name) {
      content += `🤝 Your Assistant: ${dealership.persona_name}`;
      if (dealership.persona_tone) {
        content += ` - ${dealership.persona_tone} assistant`;
      }
      content += `\n`;
    }

    return content.trim();
  }

  /**
   * Format dealership services and capabilities
   */
  private formatDealershipServices(dealership: any): string {
    let content = `${dealership.name} - Services & Capabilities\n\n`;

    content += `🔧 Our Services:\n`;
    content += `• New Vehicle Sales\n`;
    content += `• Certified Pre-Owned Vehicles\n`;
    content += `• Vehicle Trade-Ins & Appraisals\n`;
    content += `• Automotive Financing & Leasing\n`;
    content += `• Professional Service & Maintenance\n`;
    content += `• Genuine Parts & Accessories\n`;
    content += `• Warranty & Extended Protection Plans\n`;

    if (dealership.specializations) {
      content += `\n⭐ Specializations:\n${dealership.specializations}\n`;
    }

    if (dealership.certifications) {
      content += `\n🏆 Certifications:\n${dealership.certifications}\n`;
    }

    content += `\n✨ Customer Commitments:\n`;
    content += `• Transparent, no-pressure sales process\n`;
    content += `• Competitive pricing and financing options\n`;
    content += `• Professional, certified technicians\n`;
    content += `• Commitment to customer satisfaction\n`;
    content += `• Local community involvement\n`;

    return content.trim();
  }

  /**
   * Format dealership contact and hours information
   */
  private formatDealershipContact(dealership: any): string {
    let content = `${dealership.name} - Contact & Hours\n\n`;

    // Primary contact methods
    content += `📞 Contact Us:\n`;
    if (dealership.contact_phone) {
      content += `Sales: ${dealership.contact_phone}\n`;
    }
    if (dealership.service_phone) {
      content += `Service: ${dealership.service_phone}\n`;
    }
    if (dealership.parts_phone) {
      content += `Parts: ${dealership.parts_phone}\n`;
    }
    if (dealership.contact_email) {
      content += `Email: ${dealership.contact_email}\n`;
    }

    // Department-specific hours
    if (dealership.sales_hours || dealership.service_hours) {
      content += `\n🕒 Department Hours:\n`;
      if (dealership.sales_hours) {
        content += `Sales: ${dealership.sales_hours}\n`;
      }
      if (dealership.service_hours) {
        content += `Service: ${dealership.service_hours}\n`;
      }
      if (dealership.parts_hours) {
        content += `Parts: ${dealership.parts_hours}\n`;
      }
    } else if (dealership.hours) {
      content += `\n🕒 Hours: ${dealership.hours}\n`;
    }

    // Emergency or after-hours information
    if (dealership.emergency_contact) {
      content += `\n🚨 Emergency Service: ${dealership.emergency_contact}\n`;
    }

    // Online services
    content += `\n💻 Online Services:\n`;
    content += `• Schedule service appointments\n`;
    content += `• Browse our inventory\n`;
    content += `• Get financing pre-approval\n`;
    content += `• Request vehicle information\n`;
    if (dealership.website) {
      content += `\nVisit us online: ${dealership.website}\n`;
    }

    return content.trim();
  }

  /**
   * Format dealership brands and specialization
   */
  private formatDealershipBrands(dealership: any): string {
    let content = `${dealership.name} - Brands & Expertise\n\n`;

    if (dealership.brands) {
      content += `🚗 Authorized Dealer For:\n`;
      const brands = Array.isArray(dealership.brands) ? dealership.brands : [dealership.brands];
      brands.forEach(brand => {
        content += `• ${brand}\n`;
      });
      content += `\n`;
    }

    if (dealership.specialization) {
      content += `⭐ Our Specializations:\n`;
      const specializations = Array.isArray(dealership.specialization) 
        ? dealership.specialization 
        : [dealership.specialization];
      specializations.forEach(spec => {
        content += `• ${spec}\n`;
      });
      content += `\n`;
    }

    // Add brand-specific expertise
    content += `🎯 Our Expertise:\n`;
    content += `• Factory-trained technicians\n`;
    content += `• Genuine OEM parts and accessories\n`;
    content += `• Brand-specific financing programs\n`;
    content += `• Manufacturer warranty services\n`;
    content += `• Latest model knowledge and features\n`;
    content += `• Trade-in expertise for all brands\n`;

    if (dealership.awards) {
      content += `\n🏆 Awards & Recognition:\n${dealership.awards}\n`;
    }

    return content.trim();
  }

  /**
   * Format dealership location and directions
   */
  private formatDealershipLocation(dealership: any): string {
    let content = `${dealership.name} - Location & Directions\n\n`;

    // Address
    content += `📍 Our Address:\n`;
    if (dealership.address) {
      content += `${dealership.address}\n`;
    }
    if (dealership.city && dealership.state) {
      content += `${dealership.city}, ${dealership.state}`;
      if (dealership.zip) content += ` ${dealership.zip}`;
      content += `\n`;
    }

    // GPS coordinates if available
    if (dealership.coordinates) {
      content += `GPS: ${dealership.coordinates}\n`;
    }

    content += `\n🚗 Getting Here:\n`;
    
    // Landmarks or directions
    if (dealership.landmarks) {
      content += `Near: ${dealership.landmarks}\n`;
    }
    
    if (dealership.directions) {
      content += `Directions: ${dealership.directions}\n`;
    } else {
      content += `• Easy highway access\n`;
      content += `• Convenient parking available\n`;
      content += `• Public transportation accessible\n`;
    }

    // Service area
    if (dealership.service_area) {
      content += `\n🗺️ We Serve: ${dealership.service_area}\n`;
    } else if (dealership.city && dealership.state) {
      content += `\n🗺️ Proudly serving ${dealership.city} and surrounding areas\n`;
    }

    // Additional location info
    content += `\n🅿️ Visitor Information:\n`;
    content += `• Free customer parking\n`;
    content += `• Comfortable customer lounge\n`;
    content += `• Complimentary refreshments\n`;
    content += `• Free WiFi available\n`;

    return content.trim();
  }

  /**
   * Format vehicle content with context awareness
   */
  private formatVehicleContentWithContext(vehicle: any, context?: Record<string, any>): string {
    const price = vehicle.salePrice ? `$${Math.round(vehicle.salePrice / 100).toLocaleString()}` : 'Price available upon request';
    const mileage = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : 'Mileage varies';
    
    let content = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}
Price: ${price}
Mileage: ${mileage}`;

    // Add context-relevant details
    if (vehicle.bodyStyle) content += `\nBody Style: ${vehicle.bodyStyle}`;
    if (vehicle.extColor) content += `\nColor: ${vehicle.extColor}`;
    if (vehicle.fuelType) content += `\nFuel Type: ${vehicle.fuelType}`;
    if (vehicle.transmission) content += `\nTransmission: ${vehicle.transmission}`;
    
    // Add fuel economy if customer values efficiency
    if (context?.fuelEfficiencyImportant && (vehicle.mpgCity || vehicle.mpgHighway)) {
      content += `\nFuel Economy: ${vehicle.mpgCity || 'N/A'} city / ${vehicle.mpgHighway || 'N/A'} highway MPG`;
    }

    // Add safety features if customer has mentioned safety
    if (context?.safetyImportant && vehicle.features) {
      const safetyFeatures = vehicle.features.filter((f: string) => 
        f.toLowerCase().includes('safety') || 
        f.toLowerCase().includes('airbag') ||
        f.toLowerCase().includes('brake') ||
        f.toLowerCase().includes('stability')
      );
      if (safetyFeatures.length > 0) {
        content += `\nSafety Features: ${safetyFeatures.slice(0, 3).join(', ')}`;
      }
    }

    // Highlight certified status if customer values reliability
    if (vehicle.certified) {
      content += `\n✓ Certified Pre-Owned`;
      if (context?.reliabilityImportant) {
        content += ` - Extended warranty and multi-point inspection included`;
      }
    }

    // Add availability status
    const availability = vehicle.status === 'Available' ? 'Available Now' : vehicle.status || 'Contact for availability';
    content += `\nAvailability: ${availability}`;
    
    content += `\nStock #: ${vehicle.stockNumber || vehicle.vin}`;
    
    if (vehicle.description) {
      content += `\n${vehicle.description}`;
    }

    // Add contextual call-to-action based on customer journey stage
    if (context?.journeyStage === 'consideration') {
      content += `\n\nWould you like to compare this with similar vehicles or schedule a test drive?`;
    } else if (context?.journeyStage === 'decision') {
      content += `\n\nReady to move forward? I can check current incentives and schedule your visit.`;
    }

    return content.trim();
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