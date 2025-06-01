import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { glob } from 'glob';
import matter from 'gray-matter';
import { logger } from '../utils/logger';

// Promisify file system operations
const readFile = promisify(fs.readFile);
const globAsync = promisify(glob);

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
  author?: string;
  active?: boolean;
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
      const files = await globAsync('**/*.md', { cwd: baseDir });
      logger.info(`Found ${files.length} prompt template files`);
      
      // Process each file
      for (const file of files) {
        try {
          const filePath = path.join(baseDir, file);
          const content = await readFile(filePath, 'utf8');
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
    try {
      // Use gray-matter to parse front matter
      const parsed = matter(content);
      const frontMatter = parsed.data || {};
      
      // Extract title (first heading) as ID if not in front matter
      let id = frontMatter.id;
      let description = frontMatter.description;
      let tags = frontMatter.tags || [];
      let maxTurn = frontMatter.max_turn;
      let author = frontMatter.author;
      let active = frontMatter.active !== undefined ? frontMatter.active : true;
      
      // If front matter doesn't have ID, extract from content
      if (!id) {
        const titleMatch = content.match(/^#\s+(.+?)(?:\s+–\s+(.+?))?$/m);
        if (!titleMatch) {
          throw new Error(`No title found in prompt file: ${filepath}`);
        }
        
        const title = titleMatch[1].trim();
        description = description || titleMatch[2]?.trim() || '';
        
        // Generate ID from title
        id = title.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      
      // Extract purpose section if description is still missing
      if (!description) {
        const purposeMatch = content.match(/\*\*Purpose\*\*\s+(.+?)(?:\n\s*\n|$)/s);
        description = purposeMatch ? purposeMatch[1].trim() : '';
      }
      
      // Extract tags if not in front matter
      if (!tags || tags.length === 0) {
        const tagsMatch = content.match(/### Tags\s+`(.+?)`/s);
        tags = tagsMatch 
          ? tagsMatch[1].split('`').filter(t => t.trim() && t.trim() !== ' ').map(t => t.trim())
          : [];
      }
      
      // Determine max turn if it's a turn template and not already set
      if (maxTurn === undefined) {
        const turnMatch = id.match(/turn-?(\d+)/i) || tags.find(t => t.startsWith('turn:'))?.match(/turn:(\d+)/i);
        if (turnMatch) {
          maxTurn = parseInt(turnMatch[1], 10);
        }
      }
      
      // Extract template content
      let templateContent = parsed.content.trim();
      
      // If content doesn't look like the template, try to extract it from markdown
      if (!templateContent.includes('\n') || !templateContent.match(/^[A-Za-z]/m)) {
        const templateMatch = content.match(/## Prompt Template\s+(.+?)(?:\n\s*\n---|\n\s*\n###|$)/s);
        templateContent = templateMatch ? templateMatch[1].trim() : templateContent;
      }
      
      // Create metadata
      const metadata: PromptMetadata = {
        id,
        description,
        tags,
        filepath,
        created_at: frontMatter.created_at || new Date().toISOString(),
        updated_at: frontMatter.updated_at || new Date().toISOString(),
        author,
        active
      };
      
      if (maxTurn !== undefined) {
        metadata.max_turn = maxTurn;
      }
      
      return {
        metadata,
        content: templateContent,
        rawContent: content
      };
    } catch (error) {
      logger.error(`Error parsing prompt file ${filepath}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Error parsing prompt file ${filepath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate prompt metadata against the schema
   */
  private validatePromptMetadata(metadata: PromptMetadata): boolean {
    try {
      const validate = this.validator.compile(this.schema);
      const isValid = validate(metadata);
      
      if (!isValid && validate.errors) {
        logger.warn(`Validation errors for prompt ${metadata.id}:`);
        validate.errors.forEach(err => {
          logger.warn(`- ${err.instancePath}: ${err.message}`);
        });
      }
      
      return !!isValid;
    } catch (error) {
      logger.error(`Schema validation error for ${metadata.id}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
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
   * Get all active prompts
   */
  public getActivePrompts(): PromptTemplate[] {
    if (!this.initialized) {
      throw new Error('Prompt loader not initialized. Call initialize() first.');
    }
    
    return Array.from(this.prompts.values())
      .filter(prompt => prompt.metadata.active !== false);
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
        if (p.author) console.log(`  Author: ${p.author}`);
        console.log(`  Active: ${p.active !== false}`);
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
export const getActivePrompts = (): PromptTemplate[] => promptLoader.getActivePrompts();
export const debugList = PromptLoader.debugList;
