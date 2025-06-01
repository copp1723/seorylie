import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createHash } from 'crypto';
import logger from '../utils/logger';
import type { AdfXmlStructure, InsertAdfLead } from '@shared/schema-resolver';

// ADF XML Parsing Configuration
const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: '$',
  textNodeName: '_',
  parseAttributeValue: false, // Keep attributes as strings to preserve version "1.0"
  parseTagValue: true,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false,
  allowBooleanAttributes: true,
  processEntities: true,
  htmlEntities: true,
  ignoreNameSpace: false,
  removeNSPrefix: false,
  parseNodeValue: true,
  cdataPropName: '__cdata',
};

// ADF XML Schema Validation Rules based on ADF 1.0 Specification
export class AdfSchemaValidator {
  private static requiredFields = [
    'adf.prospect.requestdate',
    'adf.prospect.customer.contact.name',
  ];

  private static optionalFields = [
    'adf.prospect.vehicle.year',
    'adf.prospect.vehicle.make', 
    'adf.prospect.vehicle.model',
    'adf.prospect.customer.contact.email',
    'adf.prospect.customer.contact.phone',
    'adf.prospect.vendor.vendorname',
    'adf.prospect.provider.name',
  ];

  /**
   * Validates ADF XML structure against ADF 1.0 specification
   */
  static validateAdfStructure(parsedXml: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if root ADF element exists
    if (!parsedXml.adf) {
      errors.push('Missing root <adf> element');
      return { isValid: false, errors };
    }

    // Validate ADF version
    const version = parsedXml.adf.$?.version;
    if (!version) {
      errors.push('Missing ADF version attribute');
    } else if (version !== '1.0') {
      errors.push(`Unsupported ADF version: ${version}. Expected 1.0`);
    }

    // Check for prospect element
    if (!parsedXml.adf.prospect) {
      errors.push('Missing <prospect> element');
      return { isValid: false, errors };
    }

    const prospect = parsedXml.adf.prospect;

    // Validate required fields
    this.requiredFields.forEach(fieldPath => {
      if (!this.getNestedValue(parsedXml, fieldPath)) {
        errors.push(`Missing required field: ${fieldPath}`);
      }
    });

    // Validate request date format
    const requestDate = prospect.requestdate;
    if (requestDate && !this.isValidDateFormat(requestDate)) {
      errors.push(`Invalid requestdate format: ${requestDate}. Expected ISO 8601 or MM/DD/YYYY format`);
    }

    // Validate customer contact structure
    if (prospect.customer?.contact) {
      const contact = prospect.customer.contact;
      
      // Validate name structure
      if (contact.name && !this.validateNameStructure(contact.name)) {
        errors.push('Invalid customer name structure. Expected name parts with type attributes');
      }

      // Validate email format
      if (contact.email && !this.isValidEmail(contact.email)) {
        errors.push(`Invalid email format: ${contact.email}`);
      }

      // Validate phone format
      if (contact.phone && !this.validatePhoneStructure(contact.phone)) {
        errors.push('Invalid phone structure or format');
      }
    }

    // Validate vehicle information if present
    if (prospect.vehicle && !this.validateVehicleStructure(prospect.vehicle)) {
      errors.push('Invalid vehicle information structure');
    }

    // Validate vendor information if present
    if (prospect.vendor && !this.validateVendorStructure(prospect.vendor)) {
      errors.push('Invalid vendor information structure');
    }

    return { isValid: errors.length === 0, errors };
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static isValidDateFormat(dateStr: string): boolean {
    // Support ISO 8601 and common US formats
    const isoFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)?$/;
    const usFormat = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
    const shortIsoFormat = /^\d{4}-\d{2}-\d{2}$/;
    
    if (isoFormat.test(dateStr) || usFormat.test(dateStr) || shortIsoFormat.test(dateStr)) {
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    }
    return false;
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static validateNameStructure(name: any): boolean {
    if (typeof name === 'string') return true; // Simple string name is valid

    // Handle array of name elements with part attributes
    if (Array.isArray(name)) {
      return name.every((part: any) =>
        part.$ && ['first', 'last', 'full'].includes(part.$.part) && part._
      );
    }

    // Handle single name element with part attribute
    if (name.$ && name._ && ['first', 'last', 'full'].includes(name.$.part)) {
      return true;
    }

    // Handle structured name with parts
    if (name.part) {
      if (Array.isArray(name.part)) {
        return name.part.every((part: any) =>
          part.$ && ['first', 'last', 'full'].includes(part.$.type) && part._
        );
      } else if (name.part.$ && name.part._) {
        return ['first', 'last', 'full'].includes(name.part.$.type);
      }
    }
    return false;
  }

  private static validatePhoneStructure(phone: any): boolean {
    if (typeof phone === 'string') {
      return this.isValidPhoneNumber(phone);
    }
    
    if (phone.$ && phone._) {
      return this.isValidPhoneNumber(phone._) && 
             ['voice', 'fax', 'cellphone'].includes(phone.$.type);
    }
    return false;
  }

  private static isValidPhoneNumber(phone: string): boolean {
    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  }

  private static validateVehicleStructure(vehicle: any): boolean {
    // Vehicle information is optional, but if present should have basic structure
    if (vehicle.year && isNaN(parseInt(vehicle.year))) {
      return false;
    }
    return true;
  }

  private static validateVendorStructure(vendor: any): boolean {
    // Vendor structure is flexible but should be reasonable
    return true; // Basic structure validation
  }
}

export class AdfParser {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser(XML_PARSER_OPTIONS);
  }

  /**
   * Parses and validates ADF XML content
   */
  async parseAdfXml(xmlContent: string): Promise<{
    success: boolean;
    parsedData?: AdfXmlStructure;
    mappedLead?: Partial<InsertAdfLead>;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: Validate XML syntax
      const xmlValidation = XMLValidator.validate(xmlContent);
      if (xmlValidation !== true) {
        errors.push(`XML syntax error: ${xmlValidation.err?.msg || 'Invalid XML'}`);
        return { success: false, errors, warnings };
      }

      // Step 2: Parse XML
      const parsedXml = this.xmlParser.parse(xmlContent) as AdfXmlStructure;
      
      // Step 3: Validate ADF schema
      const schemaValidation = AdfSchemaValidator.validateAdfStructure(parsedXml);
      if (!schemaValidation.isValid) {
        errors.push(...schemaValidation.errors);
        return { success: false, parsedData: parsedXml, errors, warnings };
      }

      // Step 4: Extract and map data
      const mappedLead = this.extractLeadData(parsedXml);
      
      // Step 5: Generate deduplication hash
      mappedLead.deduplicationHash = this.generateDeduplicationHash(mappedLead);

      // Step 6: Store raw XML for audit
      mappedLead.rawAdfXml = xmlContent;
      mappedLead.parsedAdfData = parsedXml as any;

      logger.info('ADF XML parsed successfully', { 
        customerName: mappedLead.customerFullName,
        requestDate: mappedLead.requestDate,
        vendorName: mappedLead.vendorName 
      });

      return {
        success: true,
        parsedData: parsedXml,
        mappedLead,
        errors,
        warnings
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Parsing error: ${errorMessage}`);
      logger.error('ADF XML parsing failed', { error: errorMessage });
      
      return { success: false, errors, warnings };
    }
  }

  /**
   * Extracts lead data from parsed ADF XML and maps to internal schema
   */
  private extractLeadData(parsedXml: AdfXmlStructure): Partial<InsertAdfLead> {
    const prospect = parsedXml.adf.prospect;
    const lead: Partial<InsertAdfLead> = {};

    // ADF Header
    lead.adfVersion = parsedXml.adf.$?.version || '1.0';
    lead.requestDate = this.parseRequestDate(prospect.requestdate || '');

    // Customer Information
    if (prospect.customer?.contact) {
      const contact = prospect.customer.contact;
      
      // Extract name
      const nameInfo = this.extractNameFromContact(contact);
      lead.customerFullName = nameInfo.fullName;
      lead.customerFirstName = nameInfo.firstName;
      lead.customerLastName = nameInfo.lastName;

      // Extract contact details
      lead.customerEmail = contact.email || null;
      lead.customerPhone = this.extractPhoneFromContact(contact);

      // Extract address
      if (contact.address) {
        const addr = contact.address;
        lead.customerAddress = [addr.street, addr.apartment].filter(Boolean).join(', ') || null;
        lead.customerCity = addr.city || null;
        lead.customerState = addr.regioncode || null;
        lead.customerZip = addr.postalcode || null;
        lead.customerCountry = addr.country || 'US';
      }
    }

    // Vehicle Information
    if (prospect.vehicle) {
      const vehicle = prospect.vehicle;
      lead.vehicleYear = vehicle.year ? parseInt(vehicle.year) : null;
      lead.vehicleMake = vehicle.make || null;
      lead.vehicleModel = vehicle.model || null;
      lead.vehicleTrim = vehicle.trim || null;
      lead.vehicleVin = vehicle.vin || null;
      lead.vehicleStock = vehicle.stock || null;
      lead.vehicleCondition = vehicle.condition || null;
      lead.vehiclePrice = vehicle.price ? Math.round(parseFloat(vehicle.price) * 100) : null; // Convert to cents
      lead.vehicleMileage = vehicle.mileage ? parseInt(vehicle.mileage) : null;
    }

    // Vendor Information
    if (prospect.vendor) {
      const vendor = prospect.vendor;
      lead.vendorName = vendor.vendorname || null;
      
      if (vendor.contact) {
        lead.vendorEmail = vendor.contact.email || null;
        lead.vendorPhone = vendor.contact.phone || null;
        
        if (vendor.contact.address) {
          const addr = vendor.contact.address;
          lead.vendorAddress = addr.street || null;
          lead.vendorCity = addr.city || null;
          lead.vendorState = addr.regioncode || null;
          lead.vendorZip = addr.postalcode || null;
        }
      }
    }

    // Provider Information
    if (prospect.provider) {
      const provider = prospect.provider;
      lead.providerName = provider.name || null;
      lead.providerEmail = provider.email || null;
      lead.providerPhone = provider.phone || null;
      lead.providerService = provider.service || null;
    }

    // Additional Information
    lead.comments = prospect.comments || null;
    lead.timeFrame = prospect.timeframe || null;

    // Trade-in Information
    if (prospect.trade?.vehicle) {
      const trade = prospect.trade.vehicle;
      lead.tradeInYear = trade.year ? parseInt(trade.year) : null;
      lead.tradeInMake = trade.make || null;
      lead.tradeInModel = trade.model || null;
      lead.tradeInTrim = trade.trim || null;
      lead.tradeInVin = trade.vin || null;
      lead.tradeInMileage = trade.mileage ? parseInt(trade.mileage) : null;
      lead.tradeInCondition = trade.condition || null;
      lead.tradeInValue = trade.value ? Math.round(parseFloat(trade.value) * 100) : null; // Convert to cents
    }

    // Set default processing status
    lead.processingStatus = 'processed';
    lead.leadStatus = 'new';

    return lead;
  }

  /**
   * Extracts name information from ADF contact structure
   */
  private extractNameFromContact(contact: any): {
    fullName: string;
    firstName?: string;
    lastName?: string;
  } {
    if (!contact.name) {
      return { fullName: 'Unknown' };
    }

    // Handle simple string name
    if (typeof contact.name === 'string') {
      const parts = contact.name.trim().split(/\s+/);
      return {
        fullName: contact.name.trim(),
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || undefined
      };
    }

    // Handle structured name with parts
    let firstName = '';
    let lastName = '';
    let fullName = '';

    if (contact.name.part) {
      const parts = Array.isArray(contact.name.part) ? contact.name.part : [contact.name.part];
      
      parts.forEach((part: any) => {
        if (part.$ && part._) {
          switch (part.$.type) {
            case 'first':
              firstName = part._;
              break;
            case 'last':
              lastName = part._;
              break;
            case 'full':
              fullName = part._;
              break;
          }
        }
      });
    }

    // Build full name if not provided
    if (!fullName) {
      fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
    }

    return {
      fullName,
      firstName: firstName || undefined,
      lastName: lastName || undefined
    };
  }

  /**
   * Extracts phone number from ADF contact structure
   */
  private extractPhoneFromContact(contact: any): string | null {
    if (!contact.phone) return null;

    // Handle simple string phone
    if (typeof contact.phone === 'string') {
      return contact.phone;
    }

    // Handle structured phone with type and value
    if (contact.phone._ && typeof contact.phone._ === 'string') {
      return contact.phone._;
    }

    // Handle array of phones (take first voice phone)
    if (Array.isArray(contact.phone)) {
      const voicePhone = contact.phone.find((p: any) => p.$?.type === 'voice' || !p.$?.type);
      return voicePhone?._ || contact.phone[0]?._ || null;
    }

    return null;
  }

  /**
   * Parses request date to JavaScript Date object
   */
  private parseRequestDate(dateStr: string): Date {
    if (!dateStr) {
      return new Date(); // Default to current time if no date provided
    }

    // Try parsing the date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // If direct parsing fails, try MM/DD/YYYY format
    const usFormatMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usFormatMatch) {
      const [, month, day, year] = usFormatMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Fallback to current date
    logger.warn('Could not parse request date, using current date', { dateStr });
    return new Date();
  }

  /**
   * Generates deduplication hash for the lead
   */
  private generateDeduplicationHash(lead: Partial<InsertAdfLead>): string {
    // Create hash based on request date, customer contact, and vendor
    const hashInput = [
      lead.requestDate?.toISOString().split('T')[0], // Date part only
      lead.customerFullName?.toLowerCase().trim(),
      lead.customerEmail?.toLowerCase().trim(),
      lead.customerPhone?.replace(/\D/g, ''), // Digits only
      lead.vendorName?.toLowerCase().trim()
    ].filter(Boolean).join('|');

    return createHash('sha256').update(hashInput).digest('hex');
  }
}

// Export with both names for compatibility
export { AdfParser as ADFParser };
export default AdfParser;