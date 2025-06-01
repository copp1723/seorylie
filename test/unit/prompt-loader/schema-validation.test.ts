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
  "title": "ADF Prompt Metadata Schema",
  "description": "Schema for validating ADF prompt template metadata",
  "type": "object",
  "required": ["id", "description", "tags"],
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
      "description": "Brief description of the prompt's purpose and usage",
      "minLength": 10,
      "maxLength": 500
    },
    "tags": {
      "type": "array",
      "description": "Categorization tags for filtering and organization",
      "items": {
        "type": "string",
        "pattern": "^[a-z0-9:_-]+$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "max_turn": {
      "type": "integer",
      "description": "Maximum conversation turn this prompt should be used for (if applicable)",
      "minimum": 1,
      "maximum": 10
    },
    "filepath": {
      "type": "string",
      "description": "Relative path to the prompt file from the prompts/adf directory",
      "pattern": "^(v[0-9]+/)?[a-zA-Z0-9-_/]+\\.md$"
    },
    "version": {
      "type": "string",
      "description": "Version identifier for the prompt template",
      "pattern": "^v[0-9]+(\\.[0-9]+){0,2}$",
      "default": "v1"
    },
    "created_at": {
      "type": "string",
      "description": "ISO timestamp of when the prompt was created",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "description": "ISO timestamp of when the prompt was last updated",
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

// Valid metadata sample for testing
const validMetadata = {
  id: "base-system-prompt",
  description: "This is a valid description for the prompt template that meets the minimum length requirement.",
  tags: ["system", "base", "identity"],
  filepath: "base-system-prompt.md",
  version: "v1"
};

describe('Prompt Schema Validation', () => {
  beforeAll(async () => {
    // Mock file read to return our schema
    (fs.readFile as jest.Mock).mockImplementation((filePath, encoding, callback) => {
      if (typeof callback === 'function') {
        callback(null, JSON.stringify(mockSchemaContent));
      } else {
        return Promise.resolve(JSON.stringify(mockSchemaContent));
      }
    });

    // Initialize AJV
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    
    // Load schema
    const schemaPath = path.resolve(process.cwd(), 'prompts/adf/prompt-schema.json');
    const schemaContent = await readFile(schemaPath, 'utf8');
    schema = JSON.parse(schemaContent);
    
    // Compile validator
    validate = ajv.compile(schema);
  });

  describe('Required Fields Validation', () => {
    it('should validate when all required fields are present', () => {
      expect(validate(validMetadata)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should fail when id is missing', () => {
      const metadata = { ...validMetadata };
      delete metadata.id;
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: expect.objectContaining({
            missingProperty: 'id'
          })
        })
      );
    });

    it('should fail when description is missing', () => {
      const metadata = { ...validMetadata };
      delete metadata.description;
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: expect.objectContaining({
            missingProperty: 'description'
          })
        })
      );
    });

    it('should fail when tags is missing', () => {
      const metadata = { ...validMetadata };
      delete metadata.tags;
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: expect.objectContaining({
            missingProperty: 'tags'
          })
        })
      );
    });
  });

  describe('String Pattern Validations', () => {
    it('should validate when id matches pattern', () => {
      const metadata = { 
        ...validMetadata,
        id: "valid-id-123"
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when id contains invalid characters', () => {
      const metadata = { 
        ...validMetadata,
        id: "Invalid ID!"
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
          instancePath: '/id'
        })
      );
    });

    it('should validate when filepath matches pattern', () => {
      const metadata = { 
        ...validMetadata,
        filepath: "v1/objections/price-objection.md"
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when filepath has invalid format', () => {
      const metadata = { 
        ...validMetadata,
        filepath: "invalid/path/to/file.txt"
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
          instancePath: '/filepath'
        })
      );
    });

    it('should validate when version matches pattern', () => {
      const metadata = { 
        ...validMetadata,
        version: "v1.2.3"
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when version has invalid format', () => {
      const metadata = { 
        ...validMetadata,
        version: "version1"
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
          instancePath: '/version'
        })
      );
    });

    it('should validate when tags have valid format', () => {
      const metadata = { 
        ...validMetadata,
        tags: ["valid", "valid-tag", "valid:tag", "valid_tag", "valid1"]
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when tags contain invalid characters', () => {
      const metadata = { 
        ...validMetadata,
        tags: ["Invalid Tag!"]
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern'
        })
      );
    });
  });

  describe('Length Constraints', () => {
    it('should validate when id length is within bounds', () => {
      const metadata = { 
        ...validMetadata,
        id: "min" // 3 chars (minimum)
      };
      
      expect(validate(metadata)).toBe(true);
      
      metadata.id = "a".repeat(50); // 50 chars (maximum)
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when id is too short', () => {
      const metadata = { 
        ...validMetadata,
        id: "ab" // 2 chars (below minimum of 3)
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minLength',
          instancePath: '/id'
        })
      );
    });

    it('should fail when id is too long', () => {
      const metadata = { 
        ...validMetadata,
        id: "a".repeat(51) // 51 chars (above maximum of 50)
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'maxLength',
          instancePath: '/id'
        })
      );
    });

    it('should validate when description length is within bounds', () => {
      const metadata = { 
        ...validMetadata,
        description: "a".repeat(10) // 10 chars (minimum)
      };
      
      expect(validate(metadata)).toBe(true);
      
      metadata.description = "a".repeat(500); // 500 chars (maximum)
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when description is too short', () => {
      const metadata = { 
        ...validMetadata,
        description: "short" // 5 chars (below minimum of 10)
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minLength',
          instancePath: '/description'
        })
      );
    });

    it('should fail when description is too long', () => {
      const metadata = { 
        ...validMetadata,
        description: "a".repeat(501) // 501 chars (above maximum of 500)
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'maxLength',
          instancePath: '/description'
        })
      );
    });

    it('should validate when tags array has at least one item', () => {
      const metadata = { 
        ...validMetadata,
        tags: ["single-tag"]
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when tags array is empty', () => {
      const metadata = { 
        ...validMetadata,
        tags: []
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minItems',
          instancePath: '/tags'
        })
      );
    });
  });

  describe('Type Validations', () => {
    it('should validate when max_turn is an integer', () => {
      const metadata = { 
        ...validMetadata,
        max_turn: 5
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when max_turn is not an integer', () => {
      const metadata = { 
        ...validMetadata,
        max_turn: "five" // string instead of integer
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
          instancePath: '/max_turn'
        })
      );
    });

    it('should validate when max_turn is within bounds', () => {
      const metadata = { 
        ...validMetadata,
        max_turn: 1 // minimum
      };
      
      expect(validate(metadata)).toBe(true);
      
      metadata.max_turn = 10; // maximum
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when max_turn is below minimum', () => {
      const metadata = { 
        ...validMetadata,
        max_turn: 0 // below minimum of 1
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minimum',
          instancePath: '/max_turn'
        })
      );
    });

    it('should fail when max_turn is above maximum', () => {
      const metadata = { 
        ...validMetadata,
        max_turn: 11 // above maximum of 10
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'maximum',
          instancePath: '/max_turn'
        })
      );
    });

    it('should validate when active is a boolean', () => {
      const metadata = { 
        ...validMetadata,
        active: true
      };
      
      expect(validate(metadata)).toBe(true);
      
      metadata.active = false;
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when active is not a boolean', () => {
      const metadata = { 
        ...validMetadata,
        active: "yes" // string instead of boolean
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
          instancePath: '/active'
        })
      );
    });
  });

  describe('Format Validations', () => {
    it('should validate when created_at is a valid date-time', () => {
      const metadata = { 
        ...validMetadata,
        created_at: "2023-06-01T12:00:00Z"
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when created_at is not a valid date-time', () => {
      const metadata = { 
        ...validMetadata,
        created_at: "not-a-date"
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'format',
          instancePath: '/created_at'
        })
      );
    });

    it('should validate when updated_at is a valid date-time', () => {
      const metadata = { 
        ...validMetadata,
        updated_at: "2023-06-01T12:00:00Z"
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when updated_at is not a valid date-time', () => {
      const metadata = { 
        ...validMetadata,
        updated_at: "not-a-date"
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'format',
          instancePath: '/updated_at'
        })
      );
    });
  });

  describe('Uniqueness Validation', () => {
    it('should validate when tags are unique', () => {
      const metadata = { 
        ...validMetadata,
        tags: ["tag1", "tag2", "tag3"]
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when tags contain duplicates', () => {
      const metadata = { 
        ...validMetadata,
        tags: ["tag1", "tag2", "tag1"] // duplicate "tag1"
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'uniqueItems',
          instancePath: '/tags'
        })
      );
    });
  });

  describe('Additional Properties', () => {
    it('should fail when additional properties are present', () => {
      const metadata = { 
        ...validMetadata,
        unknownProperty: "some value" // not defined in schema
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties'
        })
      );
    });
  });

  describe('Conditional Validation', () => {
    it('should validate when turn tag is present and max_turn is provided', () => {
      const metadata = { 
        ...validMetadata,
        tags: ["turn:3", "other-tag"],
        max_turn: 3
      };
      
      expect(validate(metadata)).toBe(true);
    });

    it('should fail when turn tag is present but max_turn is missing', () => {
      const metadata = { 
        ...validMetadata,
        tags: ["turn:3", "other-tag"]
        // max_turn is missing
      };
      
      expect(validate(metadata)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: expect.objectContaining({
            missingProperty: 'max_turn'
          })
        })
      );
    });

    it('should validate when no turn tag is present and max_turn is missing', () => {
      const metadata = { 
        ...validMetadata,
        tags: ["no-turn-tag", "other-tag"]
        // max_turn is not required
      };
      
      expect(validate(metadata)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', () => {
      expect(validate({})).toBe(false);
      expect(validate.errors?.length).toBeGreaterThan(0);
    });

    it('should handle null values', () => {
      expect(validate(null)).toBe(false);
      expect(validate.errors?.length).toBeGreaterThan(0);
    });

    it('should handle arrays instead of objects', () => {
      expect(validate([])).toBe(false);
      expect(validate.errors?.length).toBeGreaterThan(0);
    });

    it('should handle primitive values instead of objects', () => {
      expect(validate("string")).toBe(false);
      expect(validate(123)).toBe(false);
      expect(validate(true)).toBe(false);
    });
  });
});
