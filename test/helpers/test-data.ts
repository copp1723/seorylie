import { v4 as uuidv4 } from 'uuid';
import db from '../../server/db';
import { 
  customers, 
  leads, 
  conversations,
  leadSourcesTable,
  apiKeys,
  dealerships 
} from '../../shared/lead-management-schema';
import crypto from 'crypto';

/**
 * Generate a test API key for a dealership
 */
export async function generateTestApiKey(dealershipId: number = 1): Promise<string> {
  const apiKey = `test_${crypto.randomBytes(32).toString('hex')}`;
  
  await db.insert(apiKeys).values({
    dealershipId,
    key: apiKey,
    description: 'Test API key',
    isActive: true
  });
  
  return apiKey;
}

/**
 * Create a test customer
 */
export async function createTestCustomer(dealershipId: number = 1) {
  const customerId = uuidv4();
  const customerData = {
    id: customerId,
    dealershipId,
    firstName: 'Test',
    lastName: 'Customer',
    fullName: 'Test Customer',
    email: `test.customer.${Date.now()}@example.com`,
    phone: '+1-555-123-4567',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'US',
    preferredLanguage: 'en',
    leadScore: 0,
    customerValue: 0,
    gdprConsent: false,
    marketingOptIn: true,
    doNotCall: false,
    totalLeads: 0,
    totalPurchases: 0,
    customFields: {},
    deduplicationHash: crypto.createHash('sha256')
      .update(`test.customer.${Date.now()}@example.com|5551234567|Test Customer`)
      .digest('hex')
  };

  const [customer] = await db.insert(customers).values(customerData).returning();
  return customer;
}

/**
 * Create a test lead
 */
export async function createTestLead(dealershipId: number = 1, customerId?: string) {
  let customer;
  if (customerId) {
    const existingCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    customer = existingCustomers[0];
  }
  
  if (!customer) {
    customer = await createTestCustomer(dealershipId);
  }

  const leadId = uuidv4();
  const leadNumber = `TEST-LEAD-${Date.now()}`;
  
  const leadData = {
    id: leadId,
    dealershipId,
    customerId: customer.id,
    leadNumber,
    status: 'new' as const,
    priority: 'medium' as const,
    requestType: 'Purchase',
    description: 'Test lead for automated testing',
    source: 'api' as const,
    medium: 'test',
    campaign: 'test_campaign',
    leadScore: 0,
    firstContactDate: new Date(),
    lastContactDate: new Date(),
    originalPayload: {},
    customFields: {},
    deduplicationHash: crypto.createHash('sha256')
      .update(`${customer.id}|Purchase||`)
      .digest('hex'),
    version: 1
  };

  const [lead] = await db.insert(leads).values(leadData).returning();
  return lead;
}

/**
 * Create a test conversation
 */
export async function createTestConversation(dealershipId: number = 1, leadId?: string, customerId?: string) {
  let lead;
  if (leadId) {
    const existingLeads = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    lead = existingLeads[0];
  }
  
  if (!lead) {
    lead = await createTestLead(dealershipId, customerId);
  }

  const conversationId = uuidv4();
  const conversationData = {
    id: conversationId,
    dealershipId,
    leadId: lead.id,
    customerId: lead.customerId,
    subject: 'Test Conversation',
    status: 'active' as const,
    channel: 'api',
    lastMessageAt: new Date(),
    messageCount: 0,
    isAiAssisted: true,
    tags: [],
    priority: 'medium' as const
  };

  const [conversation] = await db.insert(conversations).values(conversationData).returning();
  return conversation;
}

/**
 * Create a test lead source
 */
export async function createTestLeadSource(dealershipId: number = 1) {
  const sourceId = uuidv4();
  const sourceData = {
    id: sourceId,
    dealershipId,
    name: 'Test API Source',
    type: 'api' as const,
    description: 'Test lead source for automated testing',
    configuration: {},
    totalLeads: 0,
    isActive: true
  };

  const [source] = await db.insert(leadSourcesTable).values(sourceData).returning();
  return source;
}

/**
 * Sample ADF XML data for testing
 */
export const sampleAdfXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf version="1.0">
  <prospect>
    <requestdate>2024-01-15T10:30:00Z</requestdate>
    <customer>
      <contact>
        <name part="first">John</name>
        <name part="last">Smith</name>
        <email>john.smith@example.com</email>
        <phone type="voice" time="nopreference">555-123-4567</phone>
        <address>
          <street>123 Main Street</street>
          <apartment>Apt 4B</apartment>
          <city>Springfield</city>
          <regioncode>IL</regioncode>
          <postalcode>62701</postalcode>
          <country>US</country>
        </address>
      </contact>
    </customer>
    <vehicle>
      <year>2024</year>
      <make>Honda</make>
      <model>Accord</model>
      <trim>Sport</trim>
      <vin>1HGCV1F30PA123456</vin>
      <stock>H24001</stock>
      <condition>New</condition>
      <price>32500.00</price>
      <mileage>12</mileage>
    </vehicle>
    <vendor>
      <vendorname>Springfield Honda</vendorname>
      <contact>
        <email>sales@springfieldhonda.com</email>
        <phone>555-987-6543</phone>
        <address>
          <street>456 Auto Plaza Drive</street>
          <city>Springfield</city>
          <regioncode>IL</regioncode>
          <postalcode>62702</postalcode>
        </address>
      </contact>
    </vendor>
    <provider>
      <name>AutoTrader.com</name>
      <email>leads@autotrader.com</email>
      <phone>800-AUTOTRADER</phone>
      <service>AutoTrader</service>
    </provider>
    <comments>Looking for a reliable sedan with good fuel economy. Interested in financing options.</comments>
    <timeframe>Within 2 weeks</timeframe>
  </prospect>
</adf>`;

/**
 * Sample invalid ADF XML for testing
 */
export const invalidAdfXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf>
  <prospect>
    <customer>
      <!-- Missing required contact information -->
    </customer>
  </prospect>
</adf>`;

/**
 * Sample webhook payload for Twilio
 */
export const sampleTwilioWebhook = {
  MessageSid: 'SM1234567890123456789012345678901234',
  MessageStatus: 'delivered',
  To: '+15551234567',
  From: '+15559876543',
  Body: 'Hello from Rylie AI!',
  Timestamp: new Date().toISOString()
};

/**
 * Clean up test data
 */
export async function cleanupTestData() {
  // Delete test API keys
  await db.delete(apiKeys).where(like(apiKeys.key, 'test_%'));
  
  // Delete test conversations, leads, customers in proper order
  await db.delete(conversations).where(like(conversations.subject, 'Test%'));
  await db.delete(leads).where(like(leads.leadNumber, 'TEST-LEAD-%'));
  await db.delete(customers).where(like(customers.email, 'test.customer.%@example.com'));
  await db.delete(leadSourcesTable).where(eq(leadSourcesTable.name, 'Test API Source'));
}

/**
 * Sample payloads for positive and negative testing
 */
export const samplePayloads = {
  validInboundLead: {
    customer: {
      firstName: "Alice",
      lastName: "Johnson",
      fullName: "Alice Johnson",
      email: "alice.johnson@example.com",
      phone: "+1-555-987-6543",
      city: "Austin",
      state: "TX",
      zipCode: "78701"
    },
    vehicleInterest: {
      year: 2024,
      make: "Toyota",
      model: "Camry",
      condition: "new",
      maxPrice: 30000
    },
    lead: {
      requestType: "Purchase",
      description: "Interested in a fuel-efficient sedan",
      source: "website_form",
      priority: "medium"
    },
    attribution: {
      source: "google",
      medium: "organic",
      campaign: "toyota_camry_2024"
    }
  },

  invalidInboundLeads: [
    {
      name: "missing_customer_fullName",
      payload: {
        customer: {
          firstName: "John"
          // Missing fullName
        },
        lead: {
          source: "website_form"
        }
      }
    },
    {
      name: "invalid_email_format",
      payload: {
        customer: {
          fullName: "John Smith",
          email: "not-an-email"
        },
        lead: {
          source: "website_form"
        }
      }
    },
    {
      name: "invalid_lead_source",
      payload: {
        customer: {
          fullName: "John Smith"
        },
        lead: {
          source: "invalid_source"
        }
      }
    },
    {
      name: "invalid_vehicle_year",
      payload: {
        customer: {
          fullName: "John Smith"
        },
        vehicleInterest: {
          year: 1800
        },
        lead: {
          source: "website_form"
        }
      }
    }
  ]
};

// Import eq function for database queries
import { eq, like } from 'drizzle-orm';