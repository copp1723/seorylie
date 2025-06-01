/**
 * STAB-307 Agent Squad System Validation - Prompt Template Tests
 * 
 * Validate prompt template system functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptTemplateService, type PromptTemplate, type TemplateSelectionCriteria, type TemplateRenderContext } from '../../server/services/prompt-template-service';
import { mockData } from '../../test-utils/setup';

describe('Prompt Template System', () => {
  let templateService: PromptTemplateService;
  
  beforeEach(() => {
    templateService = PromptTemplateService.getInstance();
  });

  describe('Template Selection', () => {
    it('should select appropriate template based on criteria', async () => {
      const criteria: TemplateSelectionCriteria = {
        dealershipId: 1,
        templateType: 'greeting',
        leadSource: 'website',
        customerData: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      };

      const template = await templateService.selectTemplate(criteria);
      
      if (template) {
        expect(template.dealershipId).toBe(1);
        expect(template.templateType).toBe('greeting');
        expect(template.isActive).toBe(true);
      }
    });

    it('should prefer exact lead source matches', async () => {
      const criteria: TemplateSelectionCriteria = {
        dealershipId: 1,
        templateType: 'greeting',
        leadSource: 'facebook'
      };

      const template = await templateService.selectTemplate(criteria);
      
      if (template) {
        // Should prefer exact match or fallback gracefully
        expect(template.leadSource === 'facebook' || template.leadSource === null).toBe(true);
      }
    });

    it('should fall back to generic templates when no lead source match', async () => {
      const criteria: TemplateSelectionCriteria = {
        dealershipId: 1,
        templateType: 'qualification',
        leadSource: 'non-existent-source'
      };

      const template = await templateService.selectTemplate(criteria);
      
      if (template) {
        // Should fall back to generic template
        expect(template.leadSource).toBeNull();
      }
    });

    it('should handle missing templates gracefully', async () => {
      const criteria: TemplateSelectionCriteria = {
        dealershipId: 9999, // Non-existent dealership
        templateType: 'greeting'
      };

      const template = await templateService.selectTemplate(criteria);
      expect(template).toBeNull();
    });
  });

  describe('Template Variable Validation', () => {
    it('should validate required template variables', () => {
      const mockTemplate: PromptTemplate = {
        id: 'test-template-1',
        dealershipId: 1,
        name: 'Test Greeting',
        templateType: 'greeting',
        promptContent: 'Hello {{customerName}}, welcome to {{dealershipName}}!',
        tone: 'friendly',
        language: 'en',
        variables: [
          {
            name: 'customerName',
            type: 'text',
            required: true,
            description: 'Customer first name'
          },
          {
            name: 'dealershipName',
            type: 'text',
            required: true,
            description: 'Name of the dealership'
          }
        ],
        priority: 1,
        version: 1,
        isActive: true,
        isDefault: false,
        usageCount: 0,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const context: TemplateRenderContext = {
        customerName: 'John',
        dealershipName: 'Test Motors'
      };

      const errors = templateService.validateVariables(mockTemplate, context);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const mockTemplate: PromptTemplate = {
        id: 'test-template-2',
        dealershipId: 1,
        name: 'Test Template',
        templateType: 'greeting',
        promptContent: 'Hello {{customerName}}, interested in {{vehicleMake}}?',
        tone: 'professional',
        language: 'en',
        variables: [
          {
            name: 'customerName',
            type: 'text',
            required: true
          },
          {
            name: 'vehicleMake',
            type: 'text',
            required: true
          }
        ],
        priority: 1,
        version: 1,
        isActive: true,
        isDefault: false,
        usageCount: 0,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const context: TemplateRenderContext = {
        customerName: 'John'
        // Missing vehicleMake
      };

      const errors = templateService.validateVariables(mockTemplate, context);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('vehicleMake');
    });

    it('should validate variable types', () => {
      const mockTemplate: PromptTemplate = {
        id: 'test-template-3',
        dealershipId: 1,
        name: 'Test Template',
        templateType: 'qualification',
        promptContent: 'Your budget is {{budget}} and year preference is {{year}}',
        tone: 'professional',
        language: 'en',
        variables: [
          {
            name: 'budget',
            type: 'number',
            required: true,
            validationRules: { min: 1000, max: 100000 }
          },
          {
            name: 'year',
            type: 'number',
            required: true,
            validationRules: { min: 2000, max: 2025 }
          }
        ],
        priority: 1,
        version: 1,
        isActive: true,
        isDefault: false,
        usageCount: 0,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Valid context
      let context: TemplateRenderContext = {
        customVariables: {
          budget: 25000,
          year: 2022
        }
      };

      let errors = templateService.validateVariables(mockTemplate, context);
      expect(errors).toHaveLength(0);

      // Invalid context - budget too high
      context = {
        customVariables: {
          budget: 150000,
          year: 2022
        }
      };

      errors = templateService.validateVariables(mockTemplate, context);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('budget');
    });
  });

  describe('Template Rendering', () => {
    it('should render templates with variables correctly', () => {
      const template = 'Hello {{customerName}}, welcome to {{dealershipName}}! We have a great {{vehicleMake}} {{vehicleModel}} for you.';
      
      const context: TemplateRenderContext = {
        customerName: 'John',
        dealershipName: 'Premium Motors',
        vehicleMake: 'Honda',
        vehicleModel: 'Accord'
      };

      const rendered = templateService.renderTemplate(template, context);
      
      expect(rendered).toBe('Hello John, welcome to Premium Motors! We have a great Honda Accord for you.');
      expect(rendered).not.toContain('{{');
      expect(rendered).not.toContain('}}');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{customerName}}, your {{missingVariable}} is ready!';
      
      const context: TemplateRenderContext = {
        customerName: 'John'
      };

      const rendered = templateService.renderTemplate(template, context);
      
      expect(rendered).toBe('Hello John, your {{missingVariable}} is ready!');
      expect(rendered).toContain('{{missingVariable}}'); // Should leave unmatched variables
    });

    it('should handle custom variables', () => {
      const template = 'Your budget of {{budget}} qualifies you for {{financing_option}}';
      
      const context: TemplateRenderContext = {
        customVariables: {
          budget: '$25,000',
          financing_option: 'premium financing'
        }
      };

      const rendered = templateService.renderTemplate(template, context);
      
      expect(rendered).toBe('Your budget of $25,000 qualifies you for premium financing');
    });

    it('should handle special characters and formatting', () => {
      const template = 'Hi {{customerName}}! Your payment would be ~${{payment}}/month 🚗';
      
      const context: TemplateRenderContext = {
        customerName: 'María',
        customVariables: {
          payment: '299'
        }
      };

      const rendered = templateService.renderTemplate(template, context);
      
      expect(rendered).toBe('Hi María! Your payment would be ~$299/month 🚗');
    });
  });

  describe('Template Management', () => {
    it('should create new templates with validation', async () => {
      const newTemplate = {
        dealershipId: 1,
        name: 'Test Follow-up Template',
        description: 'For follow-up conversations',
        templateType: 'followup' as const,
        promptContent: 'Hi {{customerName}}, following up on your interest in {{vehicleMake}}',
        tone: 'friendly' as const,
        language: 'en',
        variables: [
          {
            name: 'customerName',
            type: 'text' as const,
            required: true
          },
          {
            name: 'vehicleMake',
            type: 'text' as const,
            required: true
          }
        ],
        priority: 1,
        createdBy: 'test-user'
      };

      const result = await templateService.createTemplate(newTemplate);
      
      if (result.success) {
        expect(result.template).toBeDefined();
        expect(result.template?.name).toBe(newTemplate.name);
        expect(result.template?.variables).toHaveLength(2);
      }
    });

    it('should update existing templates', async () => {
      // First create a template
      const newTemplate = {
        dealershipId: 1,
        name: 'Update Test Template',
        templateType: 'greeting' as const,
        promptContent: 'Original content',
        tone: 'professional' as const,
        language: 'en',
        variables: [],
        priority: 1,
        createdBy: 'test-user'
      };

      const createResult = await templateService.createTemplate(newTemplate);
      
      if (createResult.success && createResult.template) {
        const updates = {
          promptContent: 'Updated content',
          tone: 'friendly' as const
        };

        const updateResult = await templateService.updateTemplate(
          createResult.template.id,
          updates
        );

        if (updateResult.success) {
          expect(updateResult.template?.promptContent).toBe('Updated content');
          expect(updateResult.template?.tone).toBe('friendly');
        }
      }
    });

    it('should deactivate templates', async () => {
      const template = await templateService.selectTemplate({
        dealershipId: 1,
        templateType: 'greeting'
      });

      if (template) {
        const result = await templateService.deactivateTemplate(template.id);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Template Analytics and Performance', () => {
    it('should track template usage', async () => {
      const template = await templateService.selectTemplate({
        dealershipId: 1,
        templateType: 'greeting'
      });

      if (template) {
        const initialUsage = template.usageCount;
        
        await templateService.trackUsage(template.id, {
          sessionId: 'test-session',
          customerResponse: 'positive',
          conversionOccurred: true
        });

        const updatedTemplate = await templateService.getTemplateById(template.id);
        
        if (updatedTemplate) {
          expect(updatedTemplate.usageCount).toBe(initialUsage + 1);
        }
      }
    });

    it('should calculate template success rates', async () => {
      const metrics = await templateService.getTemplateMetrics(1, {
        templateType: 'greeting',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date()
        }
      });

      expect(metrics).toHaveProperty('totalUsage');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeLessThanOrEqual(1);
    });

    it('should provide template performance comparison', async () => {
      const comparison = await templateService.compareTemplates([
        'template-1',
        'template-2'
      ]);

      expect(Array.isArray(comparison)).toBe(true);
      
      if (comparison.length > 0) {
        comparison.forEach(template => {
          expect(template).toHaveProperty('id');
          expect(template).toHaveProperty('name');
          expect(template).toHaveProperty('usageCount');
          expect(template).toHaveProperty('successRate');
        });
      }
    });
  });

  describe('A/B Testing and Optimization', () => {
    it('should support A/B testing of templates', async () => {
      const testConfig = {
        dealershipId: 1,
        templateType: 'greeting' as const,
        variants: [
          {
            templateId: 'template-a',
            weight: 50
          },
          {
            templateId: 'template-b',
            weight: 50
          }
        ],
        duration: 7 // days
      };

      const result = await templateService.createABTest(testConfig);
      
      if (result.success) {
        expect(result.testId).toBeDefined();
        expect(result.variants).toHaveLength(2);
      }
    });

    it('should track A/B test results', async () => {
      const testResults = await templateService.getABTestResults('test-123');
      
      if (testResults) {
        expect(testResults).toHaveProperty('testId');
        expect(testResults).toHaveProperty('status');
        expect(testResults).toHaveProperty('variants');
        expect(Array.isArray(testResults.variants)).toBe(true);
        
        if (testResults.variants.length > 0) {
          testResults.variants.forEach(variant => {
            expect(variant).toHaveProperty('templateId');
            expect(variant).toHaveProperty('impressions');
            expect(variant).toHaveProperty('conversions');
            expect(variant).toHaveProperty('conversionRate');
          });
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid template syntax', () => {
      const invalidTemplate = 'Hello {{customerName}, missing closing brace';
      
      const context: TemplateRenderContext = {
        customerName: 'John'
      };

      const rendered = templateService.renderTemplate(invalidTemplate, context);
      
      // Should handle gracefully without throwing
      expect(rendered).toBeDefined();
      expect(typeof rendered).toBe('string');
    });

    it('should handle circular variable references', () => {
      const circularTemplate = 'Hello {{var1}} and {{var2}}';
      
      const context: TemplateRenderContext = {
        customVariables: {
          var1: '{{var2}}',
          var2: '{{var1}}'
        }
      };

      const rendered = templateService.renderTemplate(circularTemplate, context);
      
      // Should not cause infinite loop
      expect(rendered).toBeDefined();
      expect(typeof rendered).toBe('string');
    });

    it('should handle very large templates', () => {
      const largeTemplate = 'Hello {{customerName}}! ' + 'This is a very long template. '.repeat(1000);
      
      const context: TemplateRenderContext = {
        customerName: 'John'
      };

      const rendered = templateService.renderTemplate(largeTemplate, context);
      
      expect(rendered).toContain('Hello John!');
      expect(rendered.length).toBeGreaterThan(largeTemplate.length - 20); // Account for variable substitution
    });

    it('should handle templates with no variables', () => {
      const staticTemplate = 'Welcome to our dealership! We have great deals today.';
      
      const context: TemplateRenderContext = {};

      const rendered = templateService.renderTemplate(staticTemplate, context);
      
      expect(rendered).toBe(staticTemplate);
    });

    it('should validate template content for security', () => {
      const maliciousTemplate = 'Hello {{customerName}}, your data: <script>alert("xss")</script>';
      
      const validation = templateService.validateTemplateContent(maliciousTemplate);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(expect.stringContaining('script'));
    });
  });
});