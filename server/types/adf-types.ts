/**
 * ADF (Automotive Data Format) Types
 * Enhanced TypeScript interfaces for ADF parser v2 with XSD validation
 */

// Validation error codes for enhanced error handling
export enum ValidationErrorCode {
  XML_SYNTAX_ERROR = "XML_SYNTAX_ERROR",
  XSD_VALIDATION_FAILED = "XSD_VALIDATION_FAILED",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_DATA_FORMAT = "INVALID_DATA_FORMAT",
  UNSUPPORTED_ADF_VERSION = "UNSUPPORTED_ADF_VERSION",
  PARSING_ERROR = "PARSING_ERROR",
}

// Enhanced ADF parser configuration
export interface AdfParserV2Config {
  strictMode?: boolean;
  xsdVersion?: string;
  schemaBasePath?: string;
  extractPartialData?: boolean;
  requireMinimumFields?: boolean;
  minimumRequiredFields?: string[];
}

// Enhanced parsing result with detailed validation info
export interface AdfParseResult {
  success: boolean;
  parsedData?: any;
  mappedLead?: any;
  errors: string[];
  warnings: string[];
  validationDetails?: {
    xsdValidationPassed: boolean;
    partialDataExtracted: boolean;
    minimumFieldsPresent: boolean;
    missingRequiredFields: string[];
  };
  parserUsed: "v1" | "v2";
  parseTimeMs: number;
}

// Enhanced validation error with error codes
export class AdfValidationError extends Error {
  constructor(
    message: string,
    public code: ValidationErrorCode,
    public details?: any,
  ) {
    super(message);
    this.name = "AdfValidationError";
  }
}
