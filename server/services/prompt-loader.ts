import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import glob from 'glob';
import matter from 'gray-matter';
import { logger } from '../utils/logger';

// Promisify file system operations
const readFile = promisify(fs.readFile);
const globAsync = promisify(glob);

// Define interfaces for prompt data
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

interface Prompt {
  metadata: PromptMetadata;
  content: string;
  template: string;
}

// Cache storage
const promptCache: Map<string, Prompt> = new Map();
let schemaValidator: Ajv;
let isInitialized = false;

/**
 * Initialize the prompt loader
 * Loads schema and validates it
 */
async function initialize(): Promise<void> {
  if (isInitialized) return;
  
  try {
    // Initialize schema validator
    schemaValidator = new Ajv({ allErrors: true });
    addFormats(schemaValidator);
    
    // Load schema
    const schemaPath = path.resolve(process.cwd(), 'prompts/adf/prompt-schema.json');
    const schemaContent = await readFile(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);
    
    // Add schema to validator
    schemaValidator.addSchema(schema, 'prompt-schema');
    
    // Load all prompts
    await loadAllPrompts();
    
    isInitialized = true;
    logger.info(`Prompt loader initialized with ${promptCache.size} prompts`);
  } catch (error) {
    logger.error('Failed to initialize prompt loader', { error });
    throw new Error(`Failed to initialize prompt loader: ${error.message}`);
  }
}

/**
 * Get the version folder based on environment variable
 */
function getVersionFolder(): string {
  const version = process.env.PROMPT_LIBRARY_VERSION || 'v1';
  return `v${version.replace(/^v/, '')}`;
}

/**
 * Load all prompts from the filesystem
 */
async function loadAllPrompts(): Promise<void> {
  try {
    const versionFolder = getVersionFolder();
    const basePromptDir = path.resolve(process.cwd(), 'prompts/adf');
    const versionedPromptDir = path.resolve(basePromptDir, versionFolder);
    
    // Determine which directory to use (versioned if exists, otherwise base)
    const promptDir = fs.existsSync(versionedPromptDir) ? versionedPromptDir : basePromptDir;
    
    // Find all markdown files
    const promptFiles = await globAsync('**/*.md', { cwd: promptDir });
    
    // Process each prompt file
    for (const file of promptFiles) {
      const filePath = path.join(promptDir, file);
      await loadPromptFile(filePath, file);
    }
    
    logger.info(`Loaded ${promptCache.size} prompts from ${promptDir}`);
  } catch (error) {
    logger.error('Failed to load prompts', { error });
    throw new Error(`Failed to load prompts: ${error.message}`);
  }
}

/**
 * Load and parse a single prompt file
 */
async function loadPromptFile(filePath: string, relativePath: string): Promise<void> {
  try {
    // Read file content
    const fileContent = await readFile(filePath, 'utf8');
    
    // Parse front matter
    const { data, content } = matter(fileContent);
    
    // Extract metadata from front matter and file path
    const id = data.id || path.basename(filePath, '.md');
    
    // Create metadata object
    const metadata: PromptMetadata = {
      id,
      description: data.description || extractDescriptionFromContent(content),
      tags: data.tags || extractTagsFromContent(content) || [],
      filepath: relativePath,
      ...data
    };
    
    // Validate metadata against schema
    const validate = schemaValidator.getSchema('prompt-schema');
    if (!validate) {
      throw new Error('Schema validator not initialized');
    }
    
    const isValid = validate(metadata);
    if (!isValid) {
      const errors = schemaValidator.errorsText(validate.errors);
      logger.warn(`Invalid prompt metadata in ${filePath}: ${errors}`);
      
      // Continue loading but mark as inactive if validation fails
      metadata.active = false;
    }
    
    // Store in cache
    promptCache.set(id, {
      metadata,
      content,
      template: content
    });
  } catch (error) {
    logger.error(`Failed to load prompt file: ${filePath}`, { error });
    // Continue loading other prompts
  }
}

/**
 * Extract description from content if not provided in front matter
 */
function extractDescriptionFromContent(content: string): string {
  // Look for a purpose section in the content
  const purposeMatch = content.match(/\*\*Purpose\*\*\s*\n(.*?)(\n\n|\n---)/s);
  if (purposeMatch && purposeMatch[1]) {
    return purposeMatch[1].trim();
  }
  
  // Fallback to first paragraph
  const firstParagraph = content.split('\n\n')[0];
  return firstParagraph.replace(/^#.*\n/, '').trim();
}

/**
 * Extract tags from content if not provided in front matter
 */
function extractTagsFromContent(content: string): string[] | null {
  // Look for a tags section at the end of the content
  const tagsMatch = content.match(/###\s*Tags\s*\n(.*?)(\n\n|\n---|\s*$)/s);
  if (tagsMatch && tagsMatch[1]) {
    return tagsMatch[1]
      .split(/\s+/)
      .map(tag => tag.trim())
      .filter(tag => tag.startsWith('`') && tag.endsWith('`'))
      .map(tag => tag.slice(1, -1));
  }
  return null;
}

/**
 * Get a prompt by ID
 */
export async function getPrompt(id: string): Promise<Prompt | null> {
  if (!isInitialized) {
    await initialize();
  }
  
  const prompt = promptCache.get(id);
  if (!prompt || prompt.metadata.active === false) {
    return null;
  }
  
  return prompt;
}

/**
 * Get all prompts matching specific tags
 */
export async function getPromptsByTags(tags: string[]): Promise<Prompt[]> {
  if (!isInitialized) {
    await initialize();
  }
  
  const prompts: Prompt[] = [];
  
  for (const prompt of promptCache.values()) {
    if (prompt.metadata.active === false) continue;
    
    const hasAllTags = tags.every(tag => 
      prompt.metadata.tags.some(promptTag => 
        promptTag === tag || promptTag.startsWith(`${tag}:`)
      )
    );
    
    if (hasAllTags) {
      prompts.push(prompt);
    }
  }
  
  return prompts;
}

/**
 * Get a prompt for a specific conversation turn
 */
export async function getPromptForTurn(turn: number): Promise<Prompt | null> {
  if (!isInitialized) {
    await initialize();
  }
  
  // Find prompts with turn:N tag where N matches the requested turn
  const turnTag = `turn:${turn}`;
  
  for (const prompt of promptCache.values()) {
    if (prompt.metadata.active === false) continue;
    
    if (prompt.metadata.tags.includes(turnTag)) {
      return prompt;
    }
  }
  
  return null;
}

/**
 * Reload all prompts (useful for testing or after file changes)
 */
export async function reloadPrompts(): Promise<void> {
  promptCache.clear();
  isInitialized = false;
  await initialize();
}

/**
 * Debug function to list all loaded prompts
 */
export function debugList(): void {
  console.log(`Loaded prompts (${promptCache.size}):`);
  
  for (const [id, prompt] of promptCache.entries()) {
    console.log(`- ${id} (${prompt.metadata.filepath})`);
    console.log(`  Tags: ${prompt.metadata.tags.join(', ')}`);
    console.log(`  Active: ${prompt.metadata.active !== false}`);
    console.log('');
  }
}

/**
 * Get all prompt IDs (for testing and debugging)
 */
export async function getAllPromptIds(): Promise<string[]> {
  if (!isInitialized) {
    await initialize();
  }
  
  return Array.from(promptCache.keys());
}

// Auto-initialize when imported
initialize().catch(err => {
  logger.error('Failed to auto-initialize prompt loader', { error: err });
});

export default {
  getPrompt,
  getPromptsByTags,
  getPromptForTurn,
  reloadPrompts,
  debugList,
  getAllPromptIds
};
