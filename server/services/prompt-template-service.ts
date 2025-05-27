import logger from '../utils/logger';
import db from '../db';
import { sql } from 'drizzle-orm';

export type PromptTemplateType = 'greeting' | 'qualification' | 'followup' | 'closing' | 'objection_handling' | 'appointment_booking';
export type PromptTone = 'professional' | 'friendly' | 'casual' | 'formal' | 'urgent' | 'empathetic';
export type TemplateVariableType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';

export interface TemplateVariable {
  name: string;
  type: TemplateVariableType;
  description?: string;
  defaultValue?: string;
  required: boolean;
  validationRules?: Record<string, any>;
  options?: string[]; // For select/multiselect types
}

export interface PromptTemplate {
  id: string;
  dealershipId: number;
  name: string;
  description?: string;
  leadSource?: string;
  templateType: PromptTemplateType;
  promptContent: string;
  tone: PromptTone;
  language: string;
  variables: TemplateVariable[];
  conditions?: Record<string, any>;
  priority: number;
  version: number;
  isActive: boolean;
  isDefault: boolean;
  usageCount: number;
  successRate?: number;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateRenderContext {
  customerName?: string;
  dealershipName?: string;
  agentName?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  leadSource?: string;
  urgencyLevel?: string;
  customVariables?: Record<string, any>;
}

export interface TemplateSelectionCriteria {
  dealershipId: number;
  leadSource?: string;
  templateType: PromptTemplateType;
  customerData?: Record<string, any>;
  conversationContext?: Record<string, any>;
}

export class PromptTemplateService {
  private static instance: PromptTemplateService;

  private constructor() {}

  static getInstance(): PromptTemplateService {
    if (!PromptTemplateService.instance) {
      PromptTemplateService.instance = new PromptTemplateService();
    }
    return PromptTemplateService.instance;
  }

  /**
   * Select the best template based on criteria
   */
  async selectTemplate(criteria: TemplateSelectionCriteria): Promise<PromptTemplate | null> {
    try {
      logger.info('Selecting template', criteria);

      // Build query with priority order:
      // 1. Exact lead source match
      // 2. Generic template (null lead source)
      // 3. Highest priority
      // 4. Highest success rate
      const result = await db.execute(sql`
        SELECT pt.*, 
               CASE 
                 WHEN pt.lead_source = ${criteria.leadSource || null} THEN 1
                 WHEN pt.lead_source IS NULL THEN 2
                 ELSE 3
               END as source_priority
        FROM prompt_templates pt
        WHERE pt.dealership_id = ${criteria.dealershipId}
        AND pt.template_type = ${criteria.templateType}
        AND pt.is_active = true
        AND (pt.lead_source = ${criteria.leadSource || null} OR pt.lead_source IS NULL)
        ORDER BY 
          source_priority ASC,
          pt.priority ASC,
          pt.success_rate DESC NULLS LAST,
          pt.created_at DESC
        LIMIT 1
      `);

      if (!result.rows || result.rows.length === 0) {
        logger.warn('No template found for criteria', criteria);
        return null;
      }

      const row = result.rows[0] as any;
      return this.mapRowToTemplate(row);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to select template', err, criteria);
      throw err;
    }
  }

  /**
   * Render template with variables
   */
  renderTemplate(template: PromptTemplate, context: TemplateRenderContext): string {
    try {
      let rendered = template.promptContent;

      // Replace template variables with actual values
      const variables = {
        customer_name: context.customerName || 'Customer',
        dealership_name: context.dealershipName || 'Our Dealership',
        agent_name: context.agentName || 'Assistant',
        vehicle_make: context.vehicleMake || '',
        vehicle_model: context.vehicleModel || '',
        lead_source: context.leadSource || '',
        urgency_level: context.urgencyLevel || 'normal',
        ...context.customVariables
      };

      // Replace variables in template
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        rendered = rendered.replace(regex, String(value || ''));
      }

      // Clean up any remaining unreplaced variables
      rendered = rendered.replace(/{{[^}]+}}/g, '');

      // Apply tone-specific formatting
      rendered = this.applyToneFormatting(rendered, template.tone);

      logger.info('Template rendered successfully', {
        templateId: template.id,
        templateType: template.templateType,
        tone: template.tone,
        renderedLength: rendered.length
      });

      return rendered;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to render template', err, {
        templateId: template.id,
        context
      });
      throw err;
    }
  }

  /**
   * Track template usage for analytics
   */
  async trackTemplateUsage(
    templateId: string,
    conversationId: number,
    customerId: number,
    renderedPrompt: string,
    variablesUsed: Record<string, any>
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO template_usage_analytics (
          template_id, conversation_id, customer_id, dealership_id,
          lead_source, rendered_prompt, variables_used
        )
        SELECT 
          ${templateId}, ${conversationId}, ${customerId}, pt.dealership_id,
          pt.lead_source, ${renderedPrompt}, ${JSON.stringify(variablesUsed)}
        FROM prompt_templates pt
        WHERE pt.id = ${templateId}
      `);

      logger.info('Template usage tracked', {
        templateId,
        conversationId,
        customerId
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to track template usage', err, {
        templateId,
        conversationId
      });
      // Don't throw - usage tracking failure shouldn't break the main flow
    }
  }

  /**
   * Create new template
   */
  async createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const templateId = crypto.randomUUID();

      // If this is set as default, unset other defaults
      if (template.isDefault) {
        await this.unsetDefaultTemplates(
          template.dealershipId,
          template.templateType,
          template.leadSource
        );
      }

      await db.execute(sql`
        INSERT INTO prompt_templates (
          id, dealership_id, name, description, lead_source, template_type,
          prompt_content, tone, language, variables, conditions, priority,
          version, is_active, is_default, created_by
        )
        VALUES (
          ${templateId}, ${template.dealershipId}, ${template.name}, 
          ${template.description || null}, ${template.leadSource || null}, 
          ${template.templateType}, ${template.promptContent}, ${template.tone},
          ${template.language}, ${JSON.stringify(template.variables)}, 
          ${JSON.stringify(template.conditions || {})}, ${template.priority},
          ${template.version}, ${template.isActive}, ${template.isDefault},
          ${template.createdBy}
        )
      `);

      logger.info('Template created successfully', {
        templateId,
        name: template.name,
        dealershipId: template.dealershipId,
        templateType: template.templateType
      });

      return templateId;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create template', err, template);
      throw err;
    }
  }

  /**
   * Update existing template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    try {
      // If setting as default, unset other defaults
      if (updates.isDefault) {
        const template = await this.getTemplate(templateId);
        if (template) {
          await this.unsetDefaultTemplates(
            template.dealershipId,
            template.templateType,
            template.leadSource
          );
        }
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey = this.camelToSnakeCase(key);
          updateFields.push(`${dbKey} = ?`);
          
          if (key === 'variables' || key === 'conditions') {
            updateValues.push(JSON.stringify(value));
          } else {
            updateValues.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        return;
      }

      await db.execute(sql`
        UPDATE prompt_templates 
        SET ${sql.raw(updateFields.join(', '))}
        WHERE id = ${templateId}
      `);

      logger.info('Template updated successfully', {
        templateId,
        updatedFields: Object.keys(updates)
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update template', err, { templateId, updates });
      throw err;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<PromptTemplate | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM prompt_templates WHERE id = ${templateId}
      `);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTemplate(result.rows[0] as any);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get template', err, { templateId });
      throw err;
    }
  }

  /**
   * Get templates for dealership
   */
  async getTemplates(
    dealershipId: number,
    filters: {
      leadSource?: string;
      templateType?: PromptTemplateType;
      isActive?: boolean;
      limit?: number;
    } = {}
  ): Promise<PromptTemplate[]> {
    try {
      let whereConditions = [`dealership_id = ${dealershipId}`];
      
      if (filters.leadSource !== undefined) {
        whereConditions.push(`lead_source = '${filters.leadSource}'`);
      }
      
      if (filters.templateType) {
        whereConditions.push(`template_type = '${filters.templateType}'`);
      }
      
      if (filters.isActive !== undefined) {
        whereConditions.push(`is_active = ${filters.isActive}`);
      }

      const whereClause = whereConditions.join(' AND ');
      const limit = filters.limit || 100;

      const result = await db.execute(sql`
        SELECT * FROM prompt_templates 
        WHERE ${sql.raw(whereClause)}
        ORDER BY priority ASC, created_at DESC
        LIMIT ${limit}
      `);

      return (result.rows || []).map(row => this.mapRowToTemplate(row as any));

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get templates', err, { dealershipId, filters });
      throw err;
    }
  }

  /**
   * Get template performance analytics
   */
  async getTemplateAnalytics(
    templateId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_usage,
          COUNT(CASE WHEN response_received THEN 1 END) as responses_received,
          COUNT(CASE WHEN conversation_successful THEN 1 END) as successful_conversations,
          AVG(response_time_minutes) as avg_response_time,
          AVG(customer_satisfaction_score) as avg_satisfaction,
          AVG(CASE WHEN conversation_successful THEN 1.0 ELSE 0.0 END) as success_rate
        FROM template_usage_analytics
        WHERE template_id = ${templateId}
        AND used_at BETWEEN ${startDate} AND ${endDate}
      `);

      const analytics = result.rows[0] || {};

      // Get daily usage breakdown
      const dailyResult = await db.execute(sql`
        SELECT 
          DATE(used_at) as date,
          COUNT(*) as usage_count,
          COUNT(CASE WHEN conversation_successful THEN 1 END) as successful_count
        FROM template_usage_analytics
        WHERE template_id = ${templateId}
        AND used_at BETWEEN ${startDate} AND ${endDate}
        GROUP BY DATE(used_at)
        ORDER BY date
      `);

      return {
        summary: analytics,
        dailyBreakdown: dailyResult.rows || []
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get template analytics', err, {
        templateId,
        startDate,
        endDate
      });
      throw err;
    }
  }

  /**
   * Test template with sample data
   */
  testTemplate(template: PromptTemplate, sampleContext: TemplateRenderContext): {
    rendered: string;
    missingVariables: string[];
    warnings: string[];
  } {
    try {
      const rendered = this.renderTemplate(template, sampleContext);
      
      // Check for missing variables
      const missingVariables: string[] = [];
      const warnings: string[] = [];
      
      template.variables.forEach(variable => {
        if (variable.required) {
          const variableKey = variable.name.toLowerCase().replace(/\s+/g, '_');
          const hasValue = sampleContext.customVariables?.[variableKey] || 
                          sampleContext.customVariables?.[variable.name] ||
                          Object.values(sampleContext).some(v => v !== undefined);
          
          if (!hasValue) {
            missingVariables.push(variable.name);
          }
        }
      });

      // Check for potential issues
      if (rendered.length > 2000) {
        warnings.push('Template output is very long (>2000 characters)');
      }

      if (rendered.includes('{{')) {
        warnings.push('Template contains unreplaced variables');
      }

      return {
        rendered,
        missingVariables,
        warnings
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Template test failed: ${err.message}`);
    }
  }

  // Private helper methods
  private mapRowToTemplate(row: any): PromptTemplate {
    return {
      id: row.id,
      dealershipId: row.dealership_id,
      name: row.name,
      description: row.description,
      leadSource: row.lead_source,
      templateType: row.template_type,
      promptContent: row.prompt_content,
      tone: row.tone,
      language: row.language || 'en',
      variables: row.variables || [],
      conditions: row.conditions || {},
      priority: row.priority || 1,
      version: row.version || 1,
      isActive: row.is_active,
      isDefault: row.is_default,
      usageCount: row.usage_count || 0,
      successRate: row.success_rate,
      createdBy: row.created_by,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private async unsetDefaultTemplates(
    dealershipId: number,
    templateType: PromptTemplateType,
    leadSource?: string
  ): Promise<void> {
    await db.execute(sql`
      UPDATE prompt_templates 
      SET is_default = false
      WHERE dealership_id = ${dealershipId}
      AND template_type = ${templateType}
      AND (lead_source = ${leadSource || null} OR (lead_source IS NULL AND ${leadSource || null} IS NULL))
      AND is_default = true
    `);
  }

  private applyToneFormatting(content: string, tone: PromptTone): string {
    switch (tone) {
      case 'urgent':
        return content.toUpperCase();
      case 'casual':
        return content.toLowerCase();
      case 'formal':
        // Ensure proper capitalization
        return content.replace(/\b\w/g, l => l.toUpperCase());
      default:
        return content;
    }
  }

  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

// Export singleton instance
export const promptTemplateService = PromptTemplateService.getInstance();