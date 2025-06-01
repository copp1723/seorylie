import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { glob } from 'glob';
import { logger } from '../utils/logger';

/**
 * Interface for prompt template metadata
 */
interface PromptMetadata {
  id: string;
  description: string;
  tags: string[];
  max_turn?: number;
  filepath: string;
  version?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for a complete prompt template
 */
interface PromptTemplate {
  metadata: PromptMetadata;
  content: string;
  rawContent: string;
}

/**
 * Service for loading, validating, and retrieving prompt templates
 */
export class PromptLoader {
  private static instance: PromptLoader;
  private prompts: Map<string, PromptTemplate> = new Map();
  private schema: any;
  private validator: Ajv;
  private promptsDir: string;
  private version: string;
  private initialized: boolean = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.validator = new Ajv({ allErrors: true });
    addFormats(this.validator);
    this.version = process.env.PROMPT_LIBRARY_VERSION || 'v1';
    this.promptsDir = path.resolve(process.cwd(), 'prompts/adf');
    
    // Load schema
    try {
      const schemaPath = path.join(this.promptsDir, 'prompt-schema.json');
      this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      logger.info(`Loaded prompt schema from ${schemaPath}`);
    } catch (error) {
      logger.error(`Failed to load prompt schema: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to load prompt schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PromptLoader {
    if (!PromptLoader.instance) {
      PromptLoader.instance = new PromptLoader();
    }
    return PromptLoader.instance;
  }

  /**
   * Initialize the prompt loader
   * Scans the prompts directory, validates and caches all prompt templates
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info(`Initializing prompt loader with version: ${this.version}`);
    
    try {
      // Get version-specific directory if it exists, otherwise use root
      const versionDir = path.join(this.promptsDir, `v${this.version}`);
      const baseDir = fs.existsSync(versionDir) ? versionDir : this.promptsDir;
      
      logger.info(`Scanning for prompt templates in: ${baseDir}`);
      
      // Find all markdown files
      const files = await glob('**/*.md', { cwd: baseDir });
      logger.info(`Found ${files.length} prompt template files`);
      
      // Process each file
      for (const file of files) {
        try {
          const filePath = path.join(baseDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const prompt = this.parsePromptFile(content, file);
          
          // Validate metadata
          const isValid = this.validatePromptMetadata(prompt.metadata);
          if (isValid) {
            this.prompts.set(prompt.metadata.id, prompt);
            logger.debug(`Loaded prompt: ${prompt.metadata.id} (${file})`);
          } else {
            logger.warn(`Invalid prompt metadata in ${file}, skipping`);
          }
        } catch (error) {
          logger.error(`Error processing prompt file ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      logger.info(`Successfully loaded ${this.prompts.size} valid prompt templates`);
      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize prompt loader: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to initialize prompt loader: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse a prompt file to extract metadata and content
   */
  private parsePromptFile(content: string, filepath: string): PromptTemplate {
    // Extract title (first heading) as ID
    const titleMatch = content.match(/^#\s+(.+?)(?:\s+–\s+(.+?))?$/m);
    if (!titleMatch) {
      throw new Error(`No title found in prompt file: ${filepath}`);
    }
    
    const title = titleMatch[1].trim();
    const description = titleMatch[2]?.trim() || '';
    
    // Extract purpose section
    const purposeMatch = content.match(/\*\*Purpose\*\*\s+(.+?)(?:\n\s*\n|$)/s);
    const purpose = purposeMatch ? purposeMatch[1].trim() : '';
    
    // Extract tags
    const tagsMatch = content.match(/### Tags\s+`(.+?)`/s);
    const tags = tagsMatch 
      ? tagsMatch[1].split('`').filter(t => t.trim() && t.trim() !== ' ').map(t => t.trim())
      : [];
    
    // Determine max turn if it's a turn template
    let maxTurn: number | undefined;
    const turnMatch = title.match(/Turn (\d+)/i) || tags.find(t => t.startsWith('turn:'))?.match(/turn:(\d+)/i);
    if (turnMatch) {
      maxTurn = parseInt(turnMatch[1], 10);
    }
    
    // Generate ID from title
    const id = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Extract template content
    const templateMatch = content.match(/## Prompt Template\s+(.+?)(?:\n\s*\n---|\n\s*\n###|$)/s);
    const templateContent = templateMatch ? templateMatch[1].trim() : '';
    
    // Create metadata
    const metadata: PromptMetadata = {
      id,
      description: purpose || description,
      tags,
      filepath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    if (maxTurn !== undefined) {
      metadata.max_turn = maxTurn;
    }
    
    return {
      metadata,
      content: templateContent,
      rawContent: content
    };
  }

  /**
   * Validate prompt metadata against the schema
   */
  private validatePromptMetadata(metadata: PromptMetadata): boolean {
    const validate = this.validator.compile(this.schema);
    const isValid = validate(metadata);
    
    if (!isValid && validate.errors) {
      logger.warn(`Validation errors for prompt ${metadata.id}:`);
      validate.errors.forEach(err => {
        logger.warn(`- ${err.instancePath}: ${err.message}`);
      });
    }
    
    return !!isValid;
  }

  /**
   * Get a prompt template by ID
   */
  public getPrompt(id: string): PromptTemplate | null {
    if (!this.initialized) {
      throw new Error('Prompt loader not initialized. Call initialize() first.');
    }
    
    const prompt = this.prompts.get(id);
    if (!prompt) {
      logger.warn(`Prompt not found: ${id}`);
      return null;
    }
    
    return prompt;
  }

  /**
   * Get all prompts matching a tag
   */
  public getPromptsByTag(tag: string): PromptTemplate[] {
    if (!this.initialized) {
      throw new Error('Prompt loader not initialized. Call initialize() first.');
    }
    
    return Array.from(this.prompts.values())
      .filter(prompt => prompt.metadata.tags.some(t => t === tag || t.startsWith(`${tag}:`)));
  }

  /**
   * Get all prompts for a specific turn
   */
  public getPromptsByTurn(turn: number): PromptTemplate[] {
    if (!this.initialized) {
      throw new Error('Prompt loader not initialized. Call initialize() first.');
    }
    
    return Array.from(this.prompts.values())
      .filter(prompt => 
        prompt.metadata.max_turn === turn || 
        prompt.metadata.tags.some(t => t === `turn:${turn}`)
      );
  }

  /**
   * List all available prompts (for debugging)
   */
  public listPrompts(): PromptMetadata[] {
    if (!this.initialized) {
      throw new Error('Prompt loader not initialized. Call initialize() first.');
    }
    
    return Array.from(this.prompts.values()).map(p => p.metadata);
  }

  /**
   * Debug function to list all prompts
   */
  public static debugList(): void {
    const loader = PromptLoader.getInstance();
    loader.initialize().then(() => {
      console.log('Available prompts:');
      const prompts = loader.listPrompts();
      prompts.forEach(p => {
        console.log(`- ${p.id} (${p.filepath})`);
        console.log(`  Description: ${p.description}`);
        console.log(`  Tags: ${p.tags.join(', ')}`);
        if (p.max_turn) console.log(`  Max Turn: ${p.max_turn}`);
        console.log('');
      });
    }).catch(err => {
      console.error('Error listing prompts:', err);
    });
  }

  /**
   * Refresh the prompt cache (useful for development)
   */
  public async refresh(): Promise<void> {
    logger.info('Refreshing prompt cache');
    this.prompts.clear();
    this.initialized = false;
    await this.initialize();
  }
}

// Export singleton instance and convenience methods
export const promptLoader = PromptLoader.getInstance();
export const getPrompt = (id: string): PromptTemplate | null => promptLoader.getPrompt(id);
export const getPromptsByTag = (tag: string): PromptTemplate[] => promptLoader.getPromptsByTag(tag);
export const getPromptsByTurn = (turn: number): PromptTemplate[] => promptLoader.getPromptsByTurn(turn);
export const debugList = PromptLoader.debugList;
