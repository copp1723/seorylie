import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Mock dependencies
jest.mock('fs');

// Setup for tests
const readFile = promisify(fs.readFile);
let schema: any;
let ajv: Ajv;
let validate: any;

// Mock schema content
const mockSchemaContent = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ADF Prompt Template Metadata",
  "description": "Schema for validating ADF prompt template metadata",
  "type": "object",
  "required": ["id", "description", "tags", "filepath"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the prompt template",
      "pattern": "^[a-z0-9-_]+$",
      "minLength": 3,
      "maxLength": 50
    },
    "description": {
      "type": "string",
      "description": "Brief description of the prompt's purpose",
      "minLength": 10,
      "maxLength": 500
    },
    "tags": {
      "type": "array",
      "description": "Categorization tags for filtering and organization",
      "items": {
        "type": "string",
        "pattern": "^[a-z0-9-_:]+$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "max_turn": {
      "type": "integer",
      "description": "Maximum conversation turn this prompt is designed for (optional)",
      "minimum": 1,
      "maximum": 10
    },
    "filepath": {
      "type": "string",
      "description": "Relative path to the prompt file from the prompts/adf directory",
      "pattern": "^[a-zA-Z0-9-_/]+\\.md$"
    },
    "version": {
      "type": "string",
      "description": "Version of the prompt template",
      "pattern": "^v\\d+(\\.\\d+)?(\\.\\d+)?$",
      "default": "v1"
    },
    "created_at": {
      "type": "string",
      "description": "ISO timestamp when the prompt was created",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "description": "ISO timestamp when the prompt was last updated",
      "format": "date-time"
    },
    "author": {
      "type": "string",
      "description": "Name or identifier of the prompt author"
    },
    "active": {
      "type": "boolean",
      "description": "Whether this prompt is currently active in the system",
      "default": true
    }
  },
  "additionalProperties": false,
  "allOf": [
    {
      "if": {
        "properties": {
          "tags": {
            "contains": {
              "pattern": "^turn:[0-9]+$"
            }
          }
        }
      },
      "then": {
        "required": ["max_turn"]
      }
    }
  ]
};

// Basic valid metadata for testing
const validMetadata = {
  id: "test-prompt",
  description: "This is a test prompt for validation purposes",
  tags: ["test", "validation", "schema"],
  filepath: "test/prompt.md",
  created_at: "2023-01-01T00:00:00.000Z",
  updated_at: "2023-01-01T00:00:00.000Z",
  version: "v1.0.0",
  author: "Test Author",
  active: true
};

describe('Prompt Schema Validation', () => {
  beforeAll(() => {
    // Mock file system to return our schema
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('prompt-schema.json')) {
        return JSON.stringify(mockSchemaContent);
      }
      throw new Error(`Unexpected file read: ${filePath}`);
    });

    // Initialize Ajv with our schema
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    schema = mockSchemaContent;
    validate = ajv.compile(schema);
  });

  describe('Basic Schema Validation', () => {
    test('should validate a complete valid metadata object', () => {
      const result = validate(validMetadata);
      expect(result).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('should validate with minimum required fields', () => {
      const minimalMetadata = {
        id: "minimal",
        description: "Minimal valid metadata",
        tags: ["test"],
        filepath: "minimal.md"
      };
      const result = validate(minimalMetadata);
      expect(result).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Required Fields Validation', () => {
    test('should fail when id is missing', () => {
      const invalidMetadata = { ...validMetadata };
      delete invalidMetadata.id;
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toHaveLength(1);
      expect(validate.errors[0].params.missingProperty).toBe('id');
    });

    test('should fail when description is missing', () => {
      const invalidMetadata = { ...validMetadata };
      delete invalidMetadata.description;
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toHaveLength(1);
      expect(validate.errors[0].params.missingProperty).toBe('description');
    });

    test('should fail when tags is missing', () => {
      const invalidMetadata = { ...validMetadata };
      delete invalidMetadata.tags;
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toHaveLength(1);
      expect(validate.errors[0].params.missingProperty).toBe('tags');
    });

    test('should fail when filepath is missing', () => {
      const invalidMetadata = { ...validMetadata };
      delete invalidMetadata.filepath;
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toHaveLength(1);
      expect(validate.errors[0].params.missingProperty).toBe('filepath');
    });
  });

  describe('Field Format Validation', () => {
    test('should fail when id has invalid format', () => {
      const invalidMetadata = { 
        ...validMetadata,
        id: "Invalid ID with spaces!"
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('pattern');
    });

    test('should fail when id is too short', () => {
      const invalidMetadata = { 
        ...validMetadata,
        id: "ab" // Minimum length is 3
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('minLength');
    });

    test('should fail when id is too long', () => {
      const invalidMetadata = { 
        ...validMetadata,
        id: "a".repeat(51) // Maximum length is 50
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('maxLength');
    });

    test('should fail when description is too short', () => {
      const invalidMetadata = { 
        ...validMetadata,
        description: "Too short" // Minimum length is 10
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('minLength');
    });

    test('should fail when filepath has invalid format', () => {
      const invalidMetadata = { 
        ...validMetadata,
        filepath: "invalid/path/no-extension"
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('pattern');
    });

    test('should fail when version has invalid format', () => {
      const invalidMetadata = { 
        ...validMetadata,
        version: "invalid-version"
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('pattern');
    });

    test('should fail when created_at has invalid date format', () => {
      const invalidMetadata = { 
        ...validMetadata,
        created_at: "not-a-date"
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('format');
    });
  });

  describe('Tags Validation', () => {
    test('should fail when tags is empty array', () => {
      const invalidMetadata = { 
        ...validMetadata,
        tags: []
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('minItems');
    });

    test('should fail when tag has invalid format', () => {
      const invalidMetadata = { 
        ...validMetadata,
        tags: ["valid", "Invalid Tag!"]
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('pattern');
    });

    test('should fail when tags has duplicate items', () => {
      const invalidMetadata = { 
        ...validMetadata,
        tags: ["test", "validation", "test"] // Duplicate "test"
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('uniqueItems');
    });
  });

  describe('New Field Validation', () => {
    test('should validate with author field', () => {
      const metadataWithAuthor = {
        ...validMetadata,
        author: "John Doe"
      };
      const result = validate(metadataWithAuthor);
      expect(result).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('should validate with active field set to false', () => {
      const metadataWithActive = {
        ...validMetadata,
        active: false
      };
      const result = validate(metadataWithActive);
      expect(result).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('should fail when active is not a boolean', () => {
      const invalidMetadata = { 
        ...validMetadata,
        active: "yes" // Should be boolean
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('type');
    });
  });

  describe('Conditional Validation Rules', () => {
    test('should require max_turn when tags contains turn:X pattern', () => {
      const metadataWithTurnTag = {
        ...validMetadata,
        tags: ["test", "turn:2", "validation"],
        // max_turn is missing but required due to turn:2 tag
      };
      const result = validate(metadataWithTurnTag);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('required');
      expect(validate.errors[0].params.missingProperty).toBe('max_turn');
    });

    test('should validate when max_turn is provided with turn tag', () => {
      const validTurnMetadata = {
        ...validMetadata,
        tags: ["test", "turn:3", "validation"],
        max_turn: 3
      };
      const result = validate(validTurnMetadata);
      expect(result).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('should fail when max_turn is out of range', () => {
      const invalidMetadata = { 
        ...validMetadata,
        tags: ["test", "turn:11", "validation"],
        max_turn: 11 // Maximum is 10
      };
      const result = validate(invalidMetadata);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('maximum');
    });

    test('should not require max_turn when no turn tag is present', () => {
      const metadataWithoutTurnTag = {
        ...validMetadata,
        tags: ["test", "validation", "no-turn-tag"]
        // max_turn is not required here
      };
      const result = validate(metadataWithoutTurnTag);
      expect(result).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Additional Properties', () => {
    test('should fail when additional properties are present', () => {
      const metadataWithExtra = {
        ...validMetadata,
        extraProperty: "This should not be allowed"
      };
      const result = validate(metadataWithExtra);
      expect(result).toBe(false);
      expect(validate.errors).toBeTruthy();
      expect(validate.errors[0].keyword).toBe('additionalProperties');
    });
  });
});
