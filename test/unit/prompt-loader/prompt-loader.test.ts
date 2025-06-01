import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { PromptLoader, promptLoader, getPrompt, getPromptsByTag, getPromptsByTurn } from '../../../server/services/prompt-loader';

// Mock dependencies
jest.mock('fs');
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn(),
  join: jest.fn((a, b, c) => `${a}/${b}${c ? '/' + c : ''}`)
}));
jest.mock('glob');
jest.mock('../../../server/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('PromptLoader', () => {
  // Sample data for tests
  const mockSchema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ADF Prompt Template Metadata",
    "type": "object",
    "required": ["id", "description", "tags", "filepath"],
    "properties": {
      "id": { "type": "string" },
      "description": { "type": "string" },
      "tags": { "type": "array", "items": { "type": "string" } },
      "filepath": { "type": "string" }
    }
  };

  const mockTurn1Prompt = `# Turn 1 – Initial Contact

**Purpose**  
Kick-off the conversation with a friendly greeting.

---

## Prompt Template  

Hi {{lead_first_name}}, this is {{agent_alias}} with {{dealership_name}}.  
Thanks for reaching out about a new vehicle!

---

### Tags  
\`turn:1\` \`stage:prospect\` \`goal:qualify\`
`;

  const mockPriceObjectionPrompt = `# Objection – Price Concern

**Purpose**  
Address price concerns effectively.

---

## Prompt Template  

I understand price is important, {{lead_first_name}}.
Here are some options that might help...

---

### Tags  
\`objection:price\` \`goal:reinforce_value\`
`;

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    // @ts-ignore - accessing private property for testing
    PromptLoader.instance = undefined;
    
    // Mock path.resolve
    (path.resolve as jest.Mock).mockReturnValue('/project/prompts/adf');
    
    // Mock fs.existsSync
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    // Mock fs.readFileSync for schema
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('prompt-schema.json')) {
        return JSON.stringify(mockSchema);
      }
      if (filePath.includes('turn1-initial-contact.md')) {
        return mockTurn1Prompt;
      }
      if (filePath.includes('objection-price.md')) {
        return mockPriceObjectionPrompt;
      }
      throw new Error(`Unexpected file: ${filePath}`);
    });
    
    // Mock glob
    (glob as unknown as jest.Mock).mockResolvedValue([
      'turn1-initial-contact.md',
      'objections/objection-price.md'
    ]);
    
    // Mock process.env
    process.env.PROMPT_LIBRARY_VERSION = 'v1';
    
    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  describe('Initialization', () => {
    it('should load the schema and initialize correctly', async () => {
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      expect(fs.readFileSync).toHaveBeenCalledWith('/project/prompts/adf/prompt-schema.json', 'utf8');
      expect(glob).toHaveBeenCalledWith('**/*.md', { cwd: '/project/prompts/adf' });
      expect(fs.readFileSync).toHaveBeenCalledTimes(3); // schema + 2 prompt files
    });
    
    it('should handle version-specific directories if they exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      expect(glob).toHaveBeenCalledWith('**/*.md', { cwd: '/project/prompts/adf/v1' });
    });
    
    it('should not reinitialize if already initialized', async () => {
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      // Clear mock calls
      jest.clearAllMocks();
      
      // Call initialize again
      await loader.initialize();
      
      // Should not call fs or glob again
      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(glob).not.toHaveBeenCalled();
    });
    
    it('should handle schema loading errors', async () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Schema file not found');
      });
      
      const loader = PromptLoader.getInstance();
      await expect(loader.initialize()).rejects.toThrow('Failed to load prompt schema');
    });
    
    it('should handle glob errors', async () => {
      (glob as unknown as jest.Mock).mockRejectedValueOnce(new Error('Glob error'));
      
      const loader = PromptLoader.getInstance();
      await expect(loader.initialize()).rejects.toThrow('Failed to initialize prompt loader');
    });
  });

  describe('Prompt Parsing', () => {
    it('should correctly parse turn templates', async () => {
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      const prompt = loader.getPrompt('turn-1-initial-contact');
      
      expect(prompt).not.toBeNull();
      expect(prompt?.metadata).toEqual(expect.objectContaining({
        id: 'turn-1-initial-contact',
        description: 'Kick-off the conversation with a friendly greeting.',
        tags: ['turn:1', 'stage:prospect', 'goal:qualify'],
        max_turn: 1
      }));
      expect(prompt?.content).toContain('Hi {{lead_first_name}}');
    });
    
    it('should correctly parse objection templates', async () => {
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      const prompt = loader.getPrompt('objection-price-concern');
      
      expect(prompt).not.toBeNull();
      expect(prompt?.metadata).toEqual(expect.objectContaining({
        id: 'objection-price-concern',
        description: 'Address price concerns effectively.',
        tags: ['objection:price', 'goal:reinforce_value']
      }));
      expect(prompt?.content).toContain('I understand price is important');
    });
    
    it('should handle malformed prompt files', async () => {
      // Mock a malformed file
      (fs.readFileSync as jest.Mock).mockImplementationOnce((filePath: string) => {
        if (filePath.includes('turn1-initial-contact.md')) {
          return 'Invalid content with no title';
        }
        return JSON.stringify(mockSchema);
      });
      
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      // Should skip the invalid file but load the valid one
      expect(loader.getPrompt('turn-1-initial-contact')).toBeNull();
      expect(loader.getPrompt('objection-price-concern')).not.toBeNull();
    });
  });

  describe('Validation', () => {
    it('should validate prompts against the schema', async () => {
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      // Both prompts should be valid
      expect(loader.listPrompts()).toHaveLength(2);
    });
    
    it('should reject prompts that fail validation', async () => {
      // Mock an invalid prompt (missing required tags)
      const invalidPrompt = `# Invalid Prompt

**Purpose**  
This prompt is invalid.

---

## Prompt Template  

Invalid template content.

---

### No Tags Here
`;
      
      (fs.readFileSync as jest.Mock).mockImplementationOnce((filePath: string) => {
        if (filePath.includes('turn1-initial-contact.md')) {
          return invalidPrompt;
        }
        return JSON.stringify(mockSchema);
      });
      
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      // Should skip the invalid prompt but load the valid one
      expect(loader.getPrompt('invalid-prompt')).toBeNull();
      expect(loader.getPrompt('objection-price-concern')).not.toBeNull();
      expect(loader.listPrompts()).toHaveLength(1);
    });
  });

  describe('Getter Methods', () => {
    beforeEach(async () => {
      const loader = PromptLoader.getInstance();
      await loader.initialize();
    });
    
    it('should get prompt by ID', () => {
      const prompt = getPrompt('turn-1-initial-contact');
      expect(prompt).not.toBeNull();
      expect(prompt?.metadata.id).toBe('turn-1-initial-contact');
    });
    
    it('should return null for non-existent prompt IDs', () => {
      const prompt = getPrompt('non-existent');
      expect(prompt).toBeNull();
    });
    
    it('should get prompts by tag', () => {
      const prompts = getPromptsByTag('turn:1');
      expect(prompts).toHaveLength(1);
      expect(prompts[0].metadata.id).toBe('turn-1-initial-contact');
      
      const objectionPrompts = getPromptsByTag('objection');
      expect(objectionPrompts).toHaveLength(1);
      expect(objectionPrompts[0].metadata.id).toBe('objection-price-concern');
    });
    
    it('should get prompts by turn number', () => {
      const prompts = getPromptsByTurn(1);
      expect(prompts).toHaveLength(1);
      expect(prompts[0].metadata.id).toBe('turn-1-initial-contact');
      
      const noPrompts = getPromptsByTurn(99);
      expect(noPrompts).toHaveLength(0);
    });
    
    it('should throw if methods are called before initialization', () => {
      // Reset singleton to get a fresh instance
      // @ts-ignore - accessing private property for testing
      PromptLoader.instance = undefined;
      
      const loader = PromptLoader.getInstance();
      expect(() => loader.getPrompt('any')).toThrow('not initialized');
      expect(() => loader.getPromptsByTag('any')).toThrow('not initialized');
      expect(() => loader.getPromptsByTurn(1)).toThrow('not initialized');
      expect(() => loader.listPrompts()).toThrow('not initialized');
    });
  });

  describe('Refresh', () => {
    it('should refresh the prompt cache', async () => {
      const loader = PromptLoader.getInstance();
      await loader.initialize();
      
      // Clear mock calls
      jest.clearAllMocks();
      
      // Refresh
      await loader.refresh();
      
      // Should reinitialize
      expect(fs.readFileSync).toHaveBeenCalledWith('/project/prompts/adf/prompt-schema.json', 'utf8');
      expect(glob).toHaveBeenCalledWith('**/*.md', { cwd: '/project/prompts/adf' });
    });
  });

  describe('Debug Functions', () => {
    it('should provide a debug list function', async () => {
      // Mock console.log
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Call debug function
      await PromptLoader.debugList();
      
      // Should log prompt info
      expect(consoleLogSpy).toHaveBeenCalledWith('Available prompts:');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('turn-1-initial-contact'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('objection-price-concern'));
      
      consoleLogSpy.mockRestore();
    });
    
    it('should handle errors in debug list', async () => {
      // Mock console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock error in initialize
      (glob as unknown as jest.Mock).mockRejectedValueOnce(new Error('Debug error'));
      
      // Call debug function
      await PromptLoader.debugList();
      
      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error listing prompts:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});
