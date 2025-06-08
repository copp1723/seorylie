/**
 * Advanced Prompt Management System
 *
 * Handles dynamic prompt selection, template rendering, and caching for the
 * conversation orchestrator. Supports dealership-specific customizations,
 * vehicle-specific prompts, and template versioning.
 */

import { promises as fs } from "fs";
import path from "path";
import Handlebars from "handlebars";
import db from "../db";
import { sql } from "drizzle-orm";
import logger from "../utils/logger";
import type { ConversationContext } from "./conversation-orchestrator";

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  compiled: HandlebarsTemplateDelegate;
  metadata: {
    version: number;
    variables: string[];
    dealershipId?: number;
    vehicleType?: string;
    turnNumber?: number;
    description?: string;
    author?: string;
    lastModified: Date;
  };
}

export interface PromptSelectionCriteria {
  dealershipId: number;
  turnNumber: number;
  vehicleInterest?: string;
  leadSource?: string;
  customerSegment?: string;
  conversationContext?: any;
}

/**
 * Prompt Manager for dynamic prompt selection and rendering
 */
export class PromptManager {
  private templateCache = new Map<string, PromptTemplate>();
  private fileSystemPrompts = new Map<string, PromptTemplate>();
  private handlebars: typeof Handlebars;
  private isInitialized = false;
  private promptsDirectory: string;

  constructor() {
    this.handlebars = Handlebars.create();
    this.promptsDirectory = path.join(process.cwd(), "prompts");
    this.setupHelpers();
  }

  /**
   * Initialize the prompt manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info("Initializing PromptManager...");

      // Load filesystem prompts
      await this.loadFileSystemPrompts();

      // Load database prompts
      await this.loadDatabasePrompts();

      // Set up file watchers for development
      if (process.env.NODE_ENV === "development") {
        await this.setupFileWatchers();
      }

      this.isInitialized = true;
      logger.info("PromptManager initialized successfully", {
        fileSystemPrompts: this.fileSystemPrompts.size,
        databasePrompts: this.templateCache.size - this.fileSystemPrompts.size,
      });
    } catch (error) {
      logger.error("Failed to initialize PromptManager", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Set up Handlebars helpers for prompt templates
   */
  private setupHelpers(): void {
    // Date formatting helper
    this.handlebars.registerHelper(
      "formatDate",
      (date: Date | string, format = "MM/dd/yyyy") => {
        const d = typeof date === "string" ? new Date(date) : date;
        return d.toLocaleDateString();
      },
    );

    // Capitalize helper
    this.handlebars.registerHelper("capitalize", (str: string) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Vehicle description helper
    this.handlebars.registerHelper("vehicleDescription", (vehicle: any) => {
      if (!vehicle) return "vehicle options";
      const parts = [];
      if (vehicle.year) parts.push(vehicle.year);
      if (vehicle.make) parts.push(vehicle.make);
      if (vehicle.model) parts.push(vehicle.model);
      if (vehicle.trim) parts.push(vehicle.trim);
      return parts.join(" ") || "vehicle";
    });

    // Conditional helper
    this.handlebars.registerHelper(
      "ifCond",
      function (v1, operator, v2, options) {
        switch (operator) {
          case "==":
            return v1 == v2 ? options.fn(this) : options.inverse(this);
          case "===":
            return v1 === v2 ? options.fn(this) : options.inverse(this);
          case "!=":
            return v1 != v2 ? options.fn(this) : options.inverse(this);
          case "!==":
            return v1 !== v2 ? options.fn(this) : options.inverse(this);
          case "<":
            return v1 < v2 ? options.fn(this) : options.inverse(this);
          case "<=":
            return v1 <= v2 ? options.fn(this) : options.inverse(this);
          case ">":
            return v1 > v2 ? options.fn(this) : options.inverse(this);
          case ">=":
            return v1 >= v2 ? options.fn(this) : options.inverse(this);
          case "&&":
            return v1 && v2 ? options.fn(this) : options.inverse(this);
          case "||":
            return v1 || v2 ? options.fn(this) : options.inverse(this);
          default:
            return options.inverse(this);
        }
      },
    );

    // Customer greeting helper
    this.handlebars.registerHelper(
      "customerGreeting",
      (name: string, timeOfDay?: string) => {
        const greeting = this.getTimeBasedGreeting(timeOfDay);
        return name ? `${greeting}, ${name}` : greeting;
      },
    );

    // Previous message summary helper
    this.handlebars.registerHelper(
      "previousMessageSummary",
      (messages: any[], maxLength = 100) => {
        if (!messages || messages.length === 0) {
          return "This is the start of our conversation.";
        }

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.content.length <= maxLength) {
          return lastMessage.content;
        }

        return lastMessage.content.substring(0, maxLength) + "...";
      },
    );
  }

  /**
   * Load prompts from filesystem
   */
  private async loadFileSystemPrompts(): Promise<void> {
    try {
      // Check if prompts directory exists
      try {
        await fs.access(this.promptsDirectory);
      } catch {
        logger.warn(`Prompts directory not found: ${this.promptsDirectory}`);
        return;
      }

      await this.loadPromptsFromDirectory(this.promptsDirectory);

      logger.info("Filesystem prompts loaded", {
        count: this.fileSystemPrompts.size,
        directory: this.promptsDirectory,
      });
    } catch (error) {
      logger.error("Failed to load filesystem prompts", {
        error: error instanceof Error ? error.message : String(error),
        directory: this.promptsDirectory,
      });
    }
  }

  /**
   * Recursively load prompts from directory
   */
  private async loadPromptsFromDirectory(
    dirPath: string,
    category = "",
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively load subdirectories
        const subCategory = category ? `${category}/${entry.name}` : entry.name;
        await this.loadPromptsFromDirectory(fullPath, subCategory);
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".hbs")) {
        // Load prompt template
        await this.loadPromptFromFile(fullPath, category);
      }
    }
  }

  /**
   * Load a single prompt from file
   */
  private async loadPromptFromFile(
    filePath: string,
    category: string,
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const filename = path.basename(filePath, path.extname(filePath));

      // Parse front matter if present
      const { metadata, template } = this.parseFrontMatter(content);

      const promptTemplate: PromptTemplate = {
        id: `fs:${category}:${filename}`,
        name: metadata.name || filename,
        category: category || "general",
        content: template,
        compiled: this.handlebars.compile(template),
        metadata: {
          version: metadata.version || 1,
          variables: this.extractVariables(template),
          dealershipId: metadata.dealershipId,
          vehicleType: metadata.vehicleType,
          turnNumber: metadata.turnNumber,
          description: metadata.description,
          author: metadata.author,
          lastModified: new Date(),
        },
      };

      this.fileSystemPrompts.set(promptTemplate.id, promptTemplate);
      this.templateCache.set(promptTemplate.id, promptTemplate);
    } catch (error) {
      logger.error("Failed to load prompt from file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Parse front matter from template content
   */
  private parseFrontMatter(content: string): {
    metadata: any;
    template: string;
  } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (match) {
      try {
        // Simple YAML-like parsing for basic metadata
        const metadataStr = match[1];
        const template = match[2];
        const metadata: any = {};

        metadataStr.split("\n").forEach((line) => {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();

            // Handle different value types
            if (value === "true" || value === "false") {
              metadata[key] = value === "true";
            } else if (!isNaN(Number(value))) {
              metadata[key] = Number(value);
            } else {
              metadata[key] = value.replace(/^['"]|['"]$/g, ""); // Remove quotes
            }
          }
        });

        return { metadata, template };
      } catch (error) {
        logger.warn("Failed to parse front matter, using content as-is", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { metadata: {}, template: content };
  }

  /**
   * Extract variables from template content
   */
  private extractVariables(template: string): string[] {
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const variable = match[1].trim();
      // Remove helpers and extract just the variable name
      const cleanVariable = variable.split(" ")[0].replace(/^[^a-zA-Z_]*/, "");
      if (cleanVariable) {
        variables.add(cleanVariable);
      }
    }

    return Array.from(variables);
  }

  /**
   * Load prompts from database
   */
  private async loadDatabasePrompts(): Promise<void> {
    try {
      const result = await db.execute(sql`
        SELECT id, name, category, template_content, metadata, dealership_id,
               vehicle_type, turn_number, created_at, updated_at
        FROM prompt_templates_v2
        WHERE is_active = true
        ORDER BY name
      `);

      for (const row of result.rows as any[]) {
        const promptTemplate: PromptTemplate = {
          id: `db:${row.id}`,
          name: row.name,
          category: row.category,
          content: row.template_content,
          compiled: this.handlebars.compile(row.template_content),
          metadata: {
            version: row.metadata?.version || 1,
            variables: this.extractVariables(row.template_content),
            dealershipId: row.dealership_id,
            vehicleType: row.vehicle_type,
            turnNumber: row.turn_number,
            description: row.metadata?.description,
            author: row.metadata?.author,
            lastModified: new Date(row.updated_at),
          },
        };

        this.templateCache.set(promptTemplate.id, promptTemplate);
      }

      logger.info("Database prompts loaded", {
        count: result.rows.length,
      });
    } catch (error) {
      logger.error("Failed to load database prompts", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set up file watchers for development
   */
  private async setupFileWatchers(): Promise<void> {
    try {
      const chokidar = await import("chokidar");
      const watcher = chokidar.watch(`${this.promptsDirectory}/**/*.{md,hbs}`, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
      });

      watcher.on("change", async (filePath) => {
        logger.info("Prompt file changed, reloading", { filePath });
        const relativePath = path.relative(this.promptsDirectory, filePath);
        const category = path.dirname(relativePath);
        await this.loadPromptFromFile(
          filePath,
          category === "." ? "" : category,
        );
      });

      logger.info("File watchers set up for prompt templates");
    } catch (error) {
      logger.warn("Failed to set up file watchers", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Select the best prompt for given criteria
   */
  async selectPrompt(
    context: ConversationContext,
    turnNumber: number,
  ): Promise<PromptTemplate> {
    const criteria: PromptSelectionCriteria = {
      dealershipId: context.dealershipId,
      turnNumber,
      vehicleInterest: context.metadata.vehicleInterest,
      leadSource: context.metadata.source,
      conversationContext: context,
    };

    // Priority order for prompt selection:
    // 1. Dealership + vehicle + turn specific
    // 2. Dealership + turn specific
    // 3. Vehicle + turn specific
    // 4. Turn specific
    // 5. Default prompts

    let selectedPrompt = await this.findBestMatch(criteria);

    if (!selectedPrompt) {
      // Fallback to default prompts
      selectedPrompt = await this.getDefaultPrompt(turnNumber);
    }

    if (!selectedPrompt) {
      throw new Error(`No prompt template found for turn ${turnNumber}`);
    }

    logger.debug("Prompt selected", {
      promptId: selectedPrompt.id,
      promptName: selectedPrompt.name,
      turnNumber,
      dealershipId: context.dealershipId,
    });

    return selectedPrompt;
  }

  /**
   * Find the best matching prompt based on criteria
   */
  private async findBestMatch(
    criteria: PromptSelectionCriteria,
  ): Promise<PromptTemplate | null> {
    const candidates = Array.from(this.templateCache.values());

    // Score each template based on how well it matches the criteria
    const scoredTemplates = candidates
      .map((template) => ({
        template,
        score: this.calculateMatchScore(template, criteria),
      }))
      .filter((item) => item.score > 0);

    // Sort by score (highest first)
    scoredTemplates.sort((a, b) => b.score - a.score);

    return scoredTemplates.length > 0 ? scoredTemplates[0].template : null;
  }

  /**
   * Calculate match score for a template against criteria
   */
  private calculateMatchScore(
    template: PromptTemplate,
    criteria: PromptSelectionCriteria,
  ): number {
    let score = 0;

    // Exact dealership match
    if (template.metadata.dealershipId === criteria.dealershipId) {
      score += 100;
    }

    // Turn number match
    if (template.metadata.turnNumber === criteria.turnNumber) {
      score += 50;
    }

    // Vehicle type match
    if (template.metadata.vehicleType && criteria.vehicleInterest) {
      if (
        template.metadata.vehicleType.toLowerCase() ===
        criteria.vehicleInterest.toLowerCase()
      ) {
        score += 25;
      }
    }

    // Category relevance
    if (template.category === "adf" || template.category === "conversation") {
      score += 10;
    }

    // Generic prompts get lower scores unless they're the only option
    if (template.category === "default" || template.category === "general") {
      score += 1;
    }

    return score;
  }

  /**
   * Get default prompt for a turn number
   */
  private async getDefaultPrompt(
    turnNumber: number,
  ): Promise<PromptTemplate | null> {
    // Look for default turn-specific prompts
    const defaultPrompts = Array.from(this.templateCache.values()).filter(
      (template) =>
        (template.category === "default" || template.category === "adf") &&
        (template.metadata.turnNumber === turnNumber ||
          !template.metadata.turnNumber),
    );

    if (defaultPrompts.length > 0) {
      // Prefer turn-specific, fall back to generic
      const turnSpecific = defaultPrompts.find(
        (p) => p.metadata.turnNumber === turnNumber,
      );
      return turnSpecific || defaultPrompts[0];
    }

    // Create a basic fallback prompt if none exist
    return this.createFallbackPrompt(turnNumber);
  }

  /**
   * Create a fallback prompt when no templates are available
   */
  private createFallbackPrompt(turnNumber: number): PromptTemplate {
    const content =
      turnNumber === 1
        ? `Hello {{customerGreeting customerName}}! Thank you for your interest in {{vehicleDescription vehicleInterest}}. I'm here to help you find the perfect vehicle. What questions can I answer for you?`
        : `Thank you for your continued interest{{#if customerName}}, {{customerName}}{{/if}}. Based on our conversation, I'd be happy to help you take the next step. Would you like to schedule a test drive or speak with one of our sales specialists?`;

    return {
      id: `fallback:turn${turnNumber}`,
      name: `Fallback Turn ${turnNumber}`,
      category: "fallback",
      content,
      compiled: this.handlebars.compile(content),
      metadata: {
        version: 1,
        variables: this.extractVariables(content),
        turnNumber,
        description: `Auto-generated fallback prompt for turn ${turnNumber}`,
        lastModified: new Date(),
      },
    };
  }

  /**
   * Render a prompt template with context data
   */
  renderPrompt(template: PromptTemplate, context: any): string {
    try {
      return template.compiled(context);
    } catch (error) {
      logger.error("Failed to render prompt template", {
        templateId: template.id,
        templateName: template.name,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return a basic fallback
      return `Hello! I'm here to help you with your automotive needs. How can I assist you today?`;
    }
  }

  /**
   * Store a new prompt template in the database
   */
  async storePrompt(prompt: {
    name: string;
    category: string;
    content: string;
    dealershipId?: number;
    vehicleType?: string;
    turnNumber?: number;
    metadata?: any;
  }): Promise<string> {
    try {
      const id = crypto.randomUUID();

      await db.execute(sql`
        INSERT INTO prompt_templates_v2 (
          id, name, category, template_content, dealership_id, vehicle_type,
          turn_number, metadata, is_active, created_at, updated_at
        ) VALUES (
          ${id}, ${prompt.name}, ${prompt.category}, ${prompt.content},
          ${prompt.dealershipId}, ${prompt.vehicleType}, ${prompt.turnNumber},
          ${JSON.stringify(prompt.metadata || {})}, true, NOW(), NOW()
        )
      `);

      // Add to cache
      const template: PromptTemplate = {
        id: `db:${id}`,
        name: prompt.name,
        category: prompt.category,
        content: prompt.content,
        compiled: this.handlebars.compile(prompt.content),
        metadata: {
          version: 1,
          variables: this.extractVariables(prompt.content),
          dealershipId: prompt.dealershipId,
          vehicleType: prompt.vehicleType,
          turnNumber: prompt.turnNumber,
          description: prompt.metadata?.description,
          lastModified: new Date(),
        },
      };

      this.templateCache.set(template.id, template);

      logger.info("Prompt template stored", {
        id: template.id,
        name: prompt.name,
        category: prompt.category,
      });

      return id;
    } catch (error) {
      logger.error("Failed to store prompt template", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get time-based greeting
   */
  private getTimeBasedGreeting(timeOfDay?: string): string {
    const hour = new Date().getHours();

    if (timeOfDay) {
      return timeOfDay.toLowerCase().includes("morning")
        ? "Good morning"
        : timeOfDay.toLowerCase().includes("afternoon")
          ? "Good afternoon"
          : timeOfDay.toLowerCase().includes("evening")
            ? "Good evening"
            : "Hello";
    }

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): PromptTemplate[] {
    return Array.from(this.templateCache.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): PromptTemplate | null {
    return this.templateCache.get(id) || null;
  }

  /**
   * Clear template cache (for testing/development)
   */
  clearCache(): void {
    this.templateCache.clear();
    this.fileSystemPrompts.clear();
  }
}

export default PromptManager;
