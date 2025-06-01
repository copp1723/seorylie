import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import glob from 'glob';
import * as promptLoader from '../../../server/services/prompt-loader';

// Mock dependencies
jest.mock('fs');
jest.mock('glob');
jest.mock('../../../server/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock data
const mockPrompts = {
  'base-system-prompt': {
    path: 'prompts/adf/base-system-prompt.md',
    content: `# Base System Prompt – Automotive Sales AI Agent

## Agent Identity  
You are **{{agent_alias}}**, a highly knowledgeable, friendly, and proactive digital sales consultant.

---

### Tags  
\`system\` \`base\` \`identity\``,
    metadata: {
      id: 'base-system-prompt',
      description: 'Base system prompt for automotive sales AI agent',
      tags: ['system', 'base', 'identity'],
      filepath: 'base-system-prompt.md',
    },
  },
  'turn1-initial-contact': {
    path: 'prompts/adf/turn1-initial-contact.md',
    content: `# Turn 1 – Initial Contact

**Purpose**  
Kick-off the conversation with a fast, friendly greeting.

---

## Prompt Template  

Hi {{lead_first_name | there}}, this is {{agent_alias}} with {{dealership_name}}.  

---

### Tags  
\`turn:1\` \`stage:prospect\` \`goal:qualify\``,
    metadata: {
      id: 'turn1-initial-contact',
      description: 'Kick-off the conversation with a fast, friendly greeting.',
      tags: ['turn:1', 'stage:prospect', 'goal:qualify'],
      max_turn: 1,
      filepath: 'turn1-initial-contact.md',
    },
  },
  'objection-price': {
    path: 'prompts/adf/objections/objection-price.md',
    content: `# Objection – Price Concern

**Purpose**  
Address the customer's concern that the vehicle price is too high.

---

## Prompt Template  

I understand price is an important factor, {{lead_first_name}}.  

---

### Tags  
\`objection:price\` \`goal:reinforce_value\` \`goal:offer_alternatives\``,
    metadata: {
      id: 'objection-price',
      description: 'Address the customer\'s concern that the vehicle price is too high.',
      tags: ['objection:price', 'goal:reinforce_value', 'goal:offer_alternatives'],
      filepath: 'objections/objection-price.md',
    },
  },
  'invalid-prompt': {
    path: 'prompts/adf/invalid-prompt.md',
    content: `# Invalid Prompt
This prompt has no tags or proper metadata.`,
    metadata: {
      id: 'invalid-prompt',
      // Missing required fields
      filepath: 'invalid-prompt.md',
    },
  },
};

// Mock schema
const mockSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'ADF Prompt Metadata Schema',
  type: 'object',
  required: ['id', 'description', 'tags'],
  properties: {
    id: { type: 'string' },
    description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    max_turn: { type: 'integer' },
    filepath: { type: 'string' },
  },
};

// Setup mocks
const mockReadFile = jest.fn();
const mockGlobAsync = jest.fn();

// Helper to setup mocks for each test
function setupMocks(version = 'v1') {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Mock environment variable
  process.env.PROMPT_LIBRARY_VERSION = version;
  
  // Mock file existence check
  (fs.existsSync as jest.Mock).mockImplementation((path) => {
    return path.includes(`/v${version}`);
  });
  
  // Mock readFile
  mockReadFile.mockImplementation((filePath) => {
    if (filePath.endsWith('prompt-schema.json')) {
      return Promise.resolve(JSON.stringify(mockSchema));
    }
    
    // Find the matching mock prompt
    const promptId = Object.keys(mockPrompts).find(id => 
      filePath.includes(mockPrompts[id].path)
    );
    
    if (promptId) {
      return Promise.resolve(mockPrompts[promptId].content);
    }
    
    return Promise.reject(new Error(`File not found: ${filePath}`));
  });
  
  // Mock glob
  mockGlobAsync.mockResolvedValue([
    'base-system-prompt.md',
    'turn1-initial-contact.md',
    'objections/objection-price.md',
    'invalid-prompt.md',
  ]);
  
  // Apply mocks
  (fs.readFile as unknown as jest.Mock).mockImplementation((...args) => {
    const callback = args[args.length - 1];
    if (typeof callback === 'function') {
      mockReadFile(args[0])
        .then(data => callback(null, data))
        .catch(err => callback(err));
    } else {
      return mockReadFile(args[0]);
    }
  });
  
  (glob as unknown as jest.Mock).mockImplementation((...args) => {
    const callback = args[args.length - 1];
    if (typeof callback === 'function') {
      mockGlobAsync()
        .then(data => callback(null, data))
        .catch(err => callback(err));
    } else {
      return mockGlobAsync();
    }
  });
  
  // Reset the module to force reinitialization
  jest.isolateModules(() => {
    jest.resetModules();
    promptLoader.reloadPrompts();
  });
}

describe('Prompt Loader', () => {
  beforeAll(() => {
    // Mock promisify to return our mock functions
    (promisify as jest.Mock).mockImplementation((fn) => {
      if (fn === fs.readFile) return mockReadFile;
      if (fn === glob) return mockGlobAsync;
      return fn;
    });
  });
  
  beforeEach(() => {
    setupMocks();
  });
  
  describe('Initialization', () => {
    it('should initialize and load prompts', async () => {
      await promptLoader.reloadPrompts();
      
      // Check that the schema was loaded
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('prompt-schema.json'),
        'utf8'
      );
      
      // Check that glob was called to find markdown files
      expect(mockGlobAsync).toHaveBeenCalledWith(
        '**/*.md',
        expect.any(Object)
      );
      
      // Check that prompt files were loaded
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('base-system-prompt.md'),
        'utf8'
      );
    });
    
    it('should handle versioned prompt directories', async () => {
      setupMocks('2');
      
      await promptLoader.reloadPrompts();
      
      // Check that the versioned directory was checked
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('/v2')
      );
    });
    
    it('should fallback to base directory if version directory does not exist', async () => {
      // Mock version that doesn't exist
      setupMocks('999');
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await promptLoader.reloadPrompts();
      
      // Should still load prompts from base directory
      expect(mockGlobAsync).toHaveBeenCalled();
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('base-system-prompt.md'),
        'utf8'
      );
    });
  });
  
  describe('getPrompt', () => {
    it('should return a prompt by ID', async () => {
      const prompt = await promptLoader.getPrompt('base-system-prompt');
      
      expect(prompt).toBeTruthy();
      expect(prompt?.metadata.id).toBe('base-system-prompt');
      expect(prompt?.metadata.tags).toContain('system');
      expect(prompt?.content).toContain('Base System Prompt');
    });
    
    it('should return null for non-existent prompts', async () => {
      const prompt = await promptLoader.getPrompt('non-existent-prompt');
      
      expect(prompt).toBeNull();
    });
    
    it('should not return inactive prompts', async () => {
      // Invalid prompts are marked as inactive during validation
      const prompt = await promptLoader.getPrompt('invalid-prompt');
      
      expect(prompt).toBeNull();
    });
  });
  
  describe('getPromptsByTags', () => {
    it('should return prompts matching all tags', async () => {
      const prompts = await promptLoader.getPromptsByTags(['system', 'base']);
      
      expect(prompts).toHaveLength(1);
      expect(prompts[0].metadata.id).toBe('base-system-prompt');
    });
    
    it('should return prompts with tag prefix matches', async () => {
      const prompts = await promptLoader.getPromptsByTags(['turn']);
      
      expect(prompts).toHaveLength(1);
      expect(prompts[0].metadata.id).toBe('turn1-initial-contact');
    });
    
    it('should return empty array when no prompts match tags', async () => {
      const prompts = await promptLoader.getPromptsByTags(['non-existent-tag']);
      
      expect(prompts).toHaveLength(0);
    });
  });
  
  describe('getPromptForTurn', () => {
    it('should return prompt for specific turn', async () => {
      const prompt = await promptLoader.getPromptForTurn(1);
      
      expect(prompt).toBeTruthy();
      expect(prompt?.metadata.id).toBe('turn1-initial-contact');
      expect(prompt?.metadata.tags).toContain('turn:1');
    });
    
    it('should return null for non-existent turn', async () => {
      const prompt = await promptLoader.getPromptForTurn(999);
      
      expect(prompt).toBeNull();
    });
  });
  
  describe('Schema Validation', () => {
    it('should mark prompts with invalid metadata as inactive', async () => {
      // Force reload to ensure all prompts are loaded
      await promptLoader.reloadPrompts();
      
      // Get all prompt IDs
      const ids = await promptLoader.getAllPromptIds();
      
      // Invalid prompt should be in the cache but marked inactive
      expect(ids).toContain('invalid-prompt');
      
      // But getPrompt should return null for it
      const prompt = await promptLoader.getPrompt('invalid-prompt');
      expect(prompt).toBeNull();
    });
    
    it('should extract description from content when not in metadata', async () => {
      // Mock a prompt with missing description but with Purpose section
      const purposePrompt = {
        path: 'prompts/adf/purpose-prompt.md',
        content: `# Purpose Prompt

**Purpose**  
This is the extracted purpose.

---

### Tags  
\`test\``,
        metadata: {
          id: 'purpose-prompt',
          tags: ['test'],
          filepath: 'purpose-prompt.md',
        },
      };
      
      mockPrompts['purpose-prompt'] = purposePrompt;
      mockGlobAsync.mockResolvedValueOnce([...Object.keys(mockPrompts).map(id => mockPrompts[id].path)]);
      
      await promptLoader.reloadPrompts();
      
      const prompt = await promptLoader.getPrompt('purpose-prompt');
      expect(prompt?.metadata.description).toBe('This is the extracted purpose.');
    });
    
    it('should extract tags from content when not in metadata', async () => {
      // Mock a prompt with missing tags but with Tags section
      const tagsPrompt = {
        path: 'prompts/adf/tags-prompt.md',
        content: `# Tags Prompt

Some content.

---

### Tags  
\`tag1\` \`tag2\` \`tag3\``,
        metadata: {
          id: 'tags-prompt',
          description: 'Test prompt for tag extraction',
          filepath: 'tags-prompt.md',
        },
      };
      
      mockPrompts['tags-prompt'] = tagsPrompt;
      mockGlobAsync.mockResolvedValueOnce([...Object.keys(mockPrompts).map(id => mockPrompts[id].path)]);
      
      await promptLoader.reloadPrompts();
      
      const prompt = await promptLoader.getPrompt('tags-prompt');
      expect(prompt?.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Mock a file read error
      mockReadFile.mockRejectedValueOnce(new Error('File read error'));
      
      // Should not throw
      await expect(promptLoader.reloadPrompts()).resolves.not.toThrow();
    });
    
    it('should handle invalid JSON schema gracefully', async () => {
      // Mock invalid schema JSON
      mockReadFile.mockImplementationOnce(() => Promise.resolve('invalid json'));
      
      // Should throw during initialization
      await expect(promptLoader.reloadPrompts()).rejects.toThrow();
    });
    
    it('should handle glob errors gracefully', async () => {
      // Mock a glob error
      mockGlobAsync.mockRejectedValueOnce(new Error('Glob error'));
      
      // Should throw during initialization
      await expect(promptLoader.reloadPrompts()).rejects.toThrow();
    });
  });
  
  describe('Caching', () => {
    it('should cache prompts after loading', async () => {
      // Load prompts
      await promptLoader.reloadPrompts();
      
      // Clear mocks to verify cache usage
      mockReadFile.mockClear();
      mockGlobAsync.mockClear();
      
      // Get a prompt - should use cache
      await promptLoader.getPrompt('base-system-prompt');
      
      // Should not call fs or glob again
      expect(mockReadFile).not.toHaveBeenCalled();
      expect(mockGlobAsync).not.toHaveBeenCalled();
    });
    
    it('should reload prompts when explicitly requested', async () => {
      // Load prompts
      await promptLoader.reloadPrompts();
      
      // Clear mocks
      mockReadFile.mockClear();
      mockGlobAsync.mockClear();
      
      // Reload prompts
      await promptLoader.reloadPrompts();
      
      // Should call fs and glob again
      expect(mockReadFile).toHaveBeenCalled();
      expect(mockGlobAsync).toHaveBeenCalled();
    });
  });
  
  describe('Debug Functions', () => {
    it('should list all prompts for debugging', async () => {
      // Mock console.log
      const originalConsoleLog = console.log;
      console.log = jest.fn();
      
      // Call debug function
      promptLoader.debugList();
      
      // Verify console output
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Loaded prompts'));
      
      // Restore console.log
      console.log = originalConsoleLog;
    });
    
    it('should return all prompt IDs', async () => {
      const ids = await promptLoader.getAllPromptIds();
      
      // Should include all valid prompts
      expect(ids).toContain('base-system-prompt');
      expect(ids).toContain('turn1-initial-contact');
      expect(ids).toContain('objection-price');
    });
  });
});
