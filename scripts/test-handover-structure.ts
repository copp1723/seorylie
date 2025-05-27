/**
 * Test script for validating lead handover dossier structure
 * This script helps ensure handover information is properly formatted before PureCars integration
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { dealerships } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Define the expected structure of a handover dossier
interface CustomerInsight {
  key: string;
  value: string;
  confidence: number;
}

interface HandoverDossier {
  customerName: string;
  customerContact: string;
  dealershipId: number;
  conversationId: number;
  conversationSummary: string;
  customerInsights: CustomerInsight[];
  vehicleInterests: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    confidence: number;
  }[];
  suggestedApproach: string;
  urgency: 'low' | 'medium' | 'high';
  fullConversationHistory: {
    role: 'customer' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
  escalationReason: string;
}

// Sample conversation scenarios for testing
const SAMPLE_CONVERSATIONS = {
  price_negotiation: {
    customerName: "Michael Johnson",
    customerContact: "+15555551234",
    messages: [
      { role: 'customer', content: "Hi, I'm interested in the 2024 Highlander I saw on your website. What's your best price?" },
      { role: 'assistant', content: "Hello Michael! I'd be happy to discuss the 2024 Toyota Highlander with you. Our listed price is $45,995, which is competitive for the market. Are you interested in a specific trim level?" },
      { role: 'customer', content: "I'm looking at the XLE trim. I got a quote from another dealer for $43,500. Can you match that?" },
      { role: 'assistant', content: "Thanks for that information. While I don't have the authority to negotiate specific prices, I can definitely pass this information to our sales team. The XLE trim has several premium features including leather seats and our advanced safety package. Would you like to schedule a time to come in and test drive it?" },
      { role: 'customer', content: "I've already test driven one at the other dealership. I just want to know if you can match their price before I make a decision." }
    ]
  },
  
  specific_vehicle: {
    customerName: "Sarah Williams",
    customerContact: "sarah.williams@example.com",
    messages: [
      { role: 'customer', content: "Do you have any 2023 Honda CR-V Hybrids in blue?" },
      { role: 'assistant', content: "Hi there! Yes, we currently have 2 blue 2023 Honda CR-V Hybrids in stock. One is the Touring trim with 7 miles priced at $39,995, and the other is the EX-L trim with 15 miles for $36,750. Both have AWD and the blue exterior is called 'Obsidian Blue Pearl.' Would you like more details about either of these vehicles?" },
      { role: 'customer', content: "I'm interested in the EX-L. Does it have a sunroof and what's the MPG?" },
      { role: 'assistant', content: "Yes, the 2023 CR-V Hybrid EX-L does come with a power moonroof as standard equipment. As for fuel economy, it gets an EPA-estimated 40 MPG in the city and 34 MPG on the highway, for a combined rating of 37 MPG. It also features heated leather seats, a power tailgate, and wireless Apple CarPlay and Android Auto. Would you like to schedule a time to see it in person?" },
      { role: 'customer', content: "That sounds good. Do I need to put down a deposit to hold it?" }
    ]
  },
  
  trade_in: {
    customerName: "Robert Garcia",
    customerContact: "+15558889999",
    messages: [
      { role: 'customer', content: "How much would you give me for my 2020 Subaru Outback if I trade it in?" },
      { role: 'assistant', content: "Hello! I'd be happy to help you with trade-in information. To provide an accurate estimate for your 2020 Subaru Outback, we'd need some additional details like the trim level, mileage, condition, and whether you have the service history. Would you mind sharing that information?" },
      { role: 'customer', content: "It's the Premium trim with about 45,000 miles. I've kept up with all the maintenance at the Subaru dealer." },
      { role: 'assistant', content: "Thank you for those details! Based on current market values, a 2020 Subaru Outback Premium with 45,000 miles in good condition could fetch approximately $22,000-$24,500 as a trade-in. This is just an estimate, and our used car manager would provide the official offer after an inspection. Are you looking to trade it in for a specific vehicle from our inventory?" },
      { role: 'customer', content: "I'm thinking about getting a new Toyota RAV4. Do you have any good lease deals right now?" },
      { role: 'assistant', content: "We do have some attractive lease offers on the RAV4 this month! Currently, well-qualified lessees can get a 2024 RAV4 LE for $279/month for 36 months with $2,999 due at signing. We also have the RAV4 Hybrid available with special rates. Your Outback trade-in could significantly reduce your out-of-pocket costs. Would you like to schedule a time to see our RAV4 inventory and get your Outback appraised?" }
    ]
  },
  
  financing_question: {
    customerName: "Jennifer Lopez",
    customerContact: "jlopez1982@example.com",
    messages: [
      { role: 'customer', content: "What are your current interest rates for auto loans? I'm looking at a used Accord." },
      { role: 'assistant', content: "Hello! Thank you for your interest in financing a used Honda Accord with us. Our current interest rates for used vehicles start as low as 4.99% APR for well-qualified buyers, but rates vary based on factors like credit score, loan term, and model year. The 2022-2023 Accords typically qualify for our best used car rates. May I ask what year Accord you're considering?" },
      { role: 'customer', content: "I'm looking at a 2022 model. My credit score is around 720." },
      { role: 'assistant', content: "With a credit score of around 720 and looking at a 2022 Accord, you would likely qualify for a rate between 5.25% and 5.99% APR on a 60-month term. We work with multiple lenders to find the best options for our customers. Would you like to get pre-approved? It's a quick process that won't affect your credit score, and it would give you a more precise rate based on your specific situation." },
      { role: 'customer', content: "Yes, I'd like to get pre-approved. What information do you need from me?" }
    ]
  },
  
  frustrated_customer: {
    customerName: "David Thompson",
    customerContact: "+15553216547",
    messages: [
      { role: 'customer', content: "I was quoted one price over the phone but when I came in yesterday the salesperson said it would be $2000 more. What's going on?" },
      { role: 'assistant', content: "I'm truly sorry to hear about this confusion with pricing. This certainly isn't how we aim to do business. To help resolve this situation, could you share which vehicle you were inquiring about and perhaps the name of the representative you spoke with? I want to look into what happened." },
      { role: 'customer', content: "It was a silver 2023 Mazda CX-5. I spoke with someone named Mark on Tuesday who said it would be $31,500 out the door, but when I came in yesterday, another salesperson said it would be $33,450 with all fees." },
      { role: 'assistant', content: "Thank you for those details. I sincerely apologize for this discrepancy, which must have been frustrating. I'd like to have our sales manager review what happened between the phone quote and your in-person visit. Customer satisfaction is extremely important to us. Would it be okay if I arrange for our sales manager to contact you directly to resolve this issue and honor the original quote you received?" },
      { role: 'customer', content: "Yes, have them call me. This has been really disappointing and I'm considering just going to another dealership at this point." }
    ]
  }
};

// Create readline interface for interactive mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to generate a simulated handover dossier
function generateHandoverDossier(
  scenario: keyof typeof SAMPLE_CONVERSATIONS,
  dealershipId: number,
  customInsights: boolean = false
): HandoverDossier {
  const conversation = SAMPLE_CONVERSATIONS[scenario];
  const now = new Date();
  
  // Base customer insights
  let customerInsights: CustomerInsight[] = [
    { key: "Budget Conscious", value: "Customer is price-sensitive and comparing offers", confidence: 0.85 },
    { key: "Research Phase", value: "Customer has done research and knows what they want", confidence: 0.75 },
    { key: "Timeline", value: "Looking to make a decision within 1-2 weeks", confidence: 0.6 }
  ];
  
  // Scenario-specific insights
  if (scenario === 'price_negotiation') {
    customerInsights.push(
      { key: "Price Shopper", value: "Customer is actively comparing prices between dealerships", confidence: 0.95 },
      { key: "Decision Ready", value: "Customer appears ready to purchase with the right offer", confidence: 0.8 }
    );
  } else if (scenario === 'specific_vehicle') {
    customerInsights.push(
      { key: "Feature Focused", value: "Customer cares about specific features (sunroof, MPG)", confidence: 0.9 },
      { key: "Inventory Urgency", value: "Concerned about vehicle availability", confidence: 0.7 }
    );
  } else if (scenario === 'trade_in') {
    customerInsights.push(
      { key: "Trade Valuation", value: "Customer is exploring trade-in value before committing", confidence: 0.85 },
      { key: "Open to Leasing", value: "Has shown interest in lease options", confidence: 0.75 }
    );
  } else if (scenario === 'financing_question') {
    customerInsights.push(
      { key: "Financing Focused", value: "Primary concern is about rates and terms", confidence: 0.9 },
      { key: "Credit Aware", value: "Customer knows their credit score", confidence: 0.95 }
    );
  } else if (scenario === 'frustrated_customer') {
    customerInsights.push(
      { key: "Dissatisfied", value: "Customer is frustrated with previous experience", confidence: 0.95 },
      { key: "At Risk", value: "High risk of losing this customer to competition", confidence: 0.9 }
    );
  }
  
  // Allow for custom insights if requested
  if (customInsights) {
    const customInsightCount = Math.floor(Math.random() * 3) + 1; // 1-3 custom insights
    for (let i = 0; i < customInsightCount; i++) {
      customerInsights.push({
        key: `Custom Insight ${i+1}`,
        value: `This is a custom insight generated for testing (${i+1})`,
        confidence: Math.random() * 0.5 + 0.5 // 0.5-1.0 confidence
      });
    }
  }
  
  // Generate vehicle interests based on scenario
  let vehicleInterests = [];
  
  if (scenario === 'price_negotiation') {
    vehicleInterests.push({
      year: 2024,
      make: "Toyota",
      model: "Highlander",
      trim: "XLE",
      confidence: 0.95
    });
  } else if (scenario === 'specific_vehicle') {
    vehicleInterests.push({
      year: 2023,
      make: "Honda",
      model: "CR-V",
      trim: "EX-L Hybrid",
      confidence: 0.98
    });
  } else if (scenario === 'trade_in') {
    vehicleInterests.push({
      year: 2024,
      make: "Toyota",
      model: "RAV4",
      confidence: 0.75
    });
  } else if (scenario === 'financing_question') {
    vehicleInterests.push({
      year: 2022,
      make: "Honda",
      model: "Accord",
      confidence: 0.85
    });
  } else if (scenario === 'frustrated_customer') {
    vehicleInterests.push({
      year: 2023,
      make: "Mazda",
      model: "CX-5",
      confidence: 0.9
    });
  }
  
  // Generate suggested approach based on scenario
  let suggestedApproach = "";
  let urgency: 'low' | 'medium' | 'high' = 'medium';
  let escalationReason = "";
  
  switch (scenario) {
    case 'price_negotiation':
      suggestedApproach = "Customer is comparing prices. Consider discussing the value-adds of our dealership beyond just price, such as our service department and warranty options. Be prepared to discuss what flexibility we have on the Highlander XLE pricing.";
      urgency = 'high';
      escalationReason = "Customer is actively comparing offers and likely to make a quick decision based on price matching.";
      break;
    case 'specific_vehicle':
      suggestedApproach = "Customer has shown specific interest in the CR-V Hybrid EX-L and is asking about holding the vehicle. Recommend discussing deposit options and scheduling a specific time for them to come in. Emphasize limited availability of this configuration.";
      urgency = 'high';
      escalationReason = "Customer is ready to place a deposit on a specific in-demand vehicle.";
      break;
    case 'trade_in':
      suggestedApproach = "Customer is exploring trade-in value for their Subaru Outback and showing interest in RAV4 lease options. Recommend having the used car manager review comparable Outback values before their visit, and prepare lease scenarios with the trade-in applied.";
      urgency = 'medium';
      escalationReason = "Customer is evaluating trade-in options and comparing lease deals.";
      break;
    case 'financing_question':
      suggestedApproach = "Customer has good credit and is interested in financing pre-approval for a 2022 Accord. They're ready to share their information for pre-approval. Recommend having a finance specialist contact them promptly to complete the application and discuss available inventory.";
      urgency = 'medium';
      escalationReason = "Customer is ready to begin the financing process and needs expert assistance.";
      break;
    case 'frustrated_customer':
      suggestedApproach = "Customer experienced a significant price discrepancy and is considering other dealerships. This requires immediate attention from a sales manager. Recommend reviewing the original quote, acknowledging the error, and being prepared to honor the original price to restore trust.";
      urgency = 'high';
      escalationReason = "Customer is dissatisfied with a pricing discrepancy and may go to a competitor if not addressed immediately.";
      break;
  }
  
  // Create conversation history with timestamps
  const fullConversationHistory = conversation.messages.map((message, index) => {
    // Generate timestamped messages, each 3-5 minutes apart
    const messageTime = new Date(now);
    messageTime.setMinutes(messageTime.getMinutes() - (conversation.messages.length - index) * (3 + Math.floor(Math.random() * 3)));
    
    return {
      role: message.role as 'customer' | 'assistant',
      content: message.content,
      timestamp: messageTime
    };
  });
  
  // Generate a conversation summary
  const conversationSummary = `Customer ${conversation.customerName} ${getConversationSummary(scenario)}`;
  
  // Create and return the handover dossier
  return {
    customerName: conversation.customerName,
    customerContact: conversation.customerContact,
    dealershipId: dealershipId,
    conversationId: Math.floor(Math.random() * 1000) + 1, // Simulated conversation ID
    conversationSummary,
    customerInsights,
    vehicleInterests,
    suggestedApproach,
    urgency,
    fullConversationHistory,
    escalationReason
  };
}

// Helper function to get conversation summary based on scenario
function getConversationSummary(scenario: keyof typeof SAMPLE_CONVERSATIONS): string {
  switch (scenario) {
    case 'price_negotiation':
      return "is comparing prices for a 2024 Toyota Highlander XLE. They received a quote of $43,500 from another dealership and want to know if we can match it. They've already completed a test drive elsewhere and appear ready to make a decision based on price.";
    case 'specific_vehicle':
      return "is interested in a blue 2023 Honda CR-V Hybrid EX-L. They've inquired about specific features including the sunroof and fuel economy, and are now asking about placing a deposit to hold the vehicle.";
    case 'trade_in':
      return "wants to trade in their 2020 Subaru Outback Premium with 45,000 miles for a new Toyota RAV4. They're interested in our current lease offers and how their trade-in would affect the deal structure.";
    case 'financing_question':
      return "is looking to finance a 2022 Honda Accord and has a credit score of approximately 720. They're now ready to begin the pre-approval process and are asking what information is needed to proceed.";
    case 'frustrated_customer':
      return "is upset about a pricing discrepancy on a 2023 Mazda CX-5. They were quoted $31,500 over the phone but were told $33,450 when they visited the dealership. They're considering going to another dealership if this isn't resolved.";
  }
}

// Function to validate a handover dossier structure
function validateHandoverDossier(dossier: HandoverDossier): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check required fields
  if (!dossier.customerName) issues.push("Missing customerName");
  if (!dossier.customerContact) issues.push("Missing customerContact");
  if (!dossier.dealershipId) issues.push("Missing dealershipId");
  if (!dossier.conversationId) issues.push("Missing conversationId");
  if (!dossier.conversationSummary) issues.push("Missing conversationSummary");
  if (!dossier.escalationReason) issues.push("Missing escalationReason");
  
  // Check arrays
  if (!dossier.customerInsights || !Array.isArray(dossier.customerInsights) || dossier.customerInsights.length === 0) {
    issues.push("Missing or empty customerInsights array");
  } else {
    // Check customer insights structure
    for (let i = 0; i < dossier.customerInsights.length; i++) {
      const insight = dossier.customerInsights[i];
      if (!insight.key) issues.push(`CustomerInsight #${i+1} missing 'key'`);
      if (!insight.value) issues.push(`CustomerInsight #${i+1} missing 'value'`);
      if (typeof insight.confidence !== 'number' || insight.confidence < 0 || insight.confidence > 1) {
        issues.push(`CustomerInsight #${i+1} has invalid confidence value (must be 0-1)`);
      }
    }
  }
  
  if (!dossier.vehicleInterests || !Array.isArray(dossier.vehicleInterests) || dossier.vehicleInterests.length === 0) {
    issues.push("Missing or empty vehicleInterests array");
  } else {
    // Check vehicle interests structure
    for (let i = 0; i < dossier.vehicleInterests.length; i++) {
      const vehicle = dossier.vehicleInterests[i];
      if (!vehicle.make && !vehicle.model && !vehicle.vin) {
        issues.push(`VehicleInterest #${i+1} needs at least one identifier (make, model, or VIN)`);
      }
      if (typeof vehicle.confidence !== 'number' || vehicle.confidence < 0 || vehicle.confidence > 1) {
        issues.push(`VehicleInterest #${i+1} has invalid confidence value (must be 0-1)`);
      }
    }
  }
  
  if (!dossier.fullConversationHistory || !Array.isArray(dossier.fullConversationHistory) || dossier.fullConversationHistory.length === 0) {
    issues.push("Missing or empty fullConversationHistory array");
  } else {
    // Check conversation history structure
    for (let i = 0; i < dossier.fullConversationHistory.length; i++) {
      const message = dossier.fullConversationHistory[i];
      if (!message.role || (message.role !== 'customer' && message.role !== 'assistant')) {
        issues.push(`Message #${i+1} has invalid role (must be 'customer' or 'assistant')`);
      }
      if (!message.content) issues.push(`Message #${i+1} missing content`);
      if (!message.timestamp) issues.push(`Message #${i+1} missing timestamp`);
    }
  }
  
  // Check suggested approach
  if (!dossier.suggestedApproach) issues.push("Missing suggestedApproach");
  
  // Check urgency
  if (!dossier.urgency || !['low', 'medium', 'high'].includes(dossier.urgency)) {
    issues.push("Missing or invalid urgency (must be 'low', 'medium', or 'high')");
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// Function to display a handover dossier
function displayHandoverDossier(dossier: HandoverDossier) {
  console.log('\n=== LEAD HANDOVER DOSSIER ===\n');
  
  console.log(`CUSTOMER: ${dossier.customerName}`);
  console.log(`CONTACT: ${dossier.customerContact}`);
  console.log(`DEALERSHIP ID: ${dossier.dealershipId}`);
  console.log(`CONVERSATION ID: ${dossier.conversationId}`);
  console.log(`URGENCY: ${dossier.urgency.toUpperCase()}`);
  
  console.log('\nCONVERSATION SUMMARY:');
  console.log(dossier.conversationSummary);
  
  console.log('\nCUSTOMER INSIGHTS:');
  dossier.customerInsights.forEach(insight => {
    console.log(`- ${insight.key}: ${insight.value} (${Math.round(insight.confidence * 100)}% confidence)`);
  });
  
  console.log('\nVEHICLE INTERESTS:');
  dossier.vehicleInterests.forEach(vehicle => {
    let description = vehicle.vin ? `VIN: ${vehicle.vin}` : `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.trim || ''}`.trim();
    console.log(`- ${description} (${Math.round(vehicle.confidence * 100)}% confidence)`);
  });
  
  console.log('\nSUGGESTED APPROACH:');
  console.log(dossier.suggestedApproach);
  
  console.log('\nESCALATION REASON:');
  console.log(dossier.escalationReason);
  
  console.log('\nCONVERSATION HISTORY:');
  dossier.fullConversationHistory.forEach(message => {
    const timestamp = message.timestamp.toLocaleTimeString();
    const role = message.role === 'customer' ? 'Customer' : 'AI Assistant';
    console.log(`[${timestamp}] ${role}: ${message.content}`);
  });
  
  console.log('\n===========================\n');
}

// Export the dossier to a JSON file
function exportHandoverDossier(dossier: HandoverDossier, fileName?: string): string {
  const logsDir = path.join(process.cwd(), 'test-data', 'handovers');
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const defaultFileName = `handover-${dossier.customerName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
  const outputPath = path.join(logsDir, fileName || defaultFileName);
  
  fs.writeFileSync(outputPath, JSON.stringify(dossier, null, 2));
  
  return outputPath;
}

// Main function to test handover dossier generation and validation
async function testHandoverStructure() {
  console.log('\n=== Rylie AI Lead Handover Structure Testing Tool ===\n');
  
  try {
    // First check if we have dealerships in the database
    const existingDealerships = await db.select().from(dealerships);
    
    if (existingDealerships.length === 0) {
      console.log('No dealerships found in the database. Creating a test dealership...');
      
      // Create a test dealership
      const [newDealership] = await db.insert(dealerships).values({
        name: 'Test Dealership',
        location: '123 Test Street, Testville, TS 12345',
        contactEmail: 'contact@testdealership.com',
        contactPhone: '(555) 123-4567',
        domain: 'testdealership.com',
        handoverEmail: 'handover@testdealership.com'
      }).returning();
      
      console.log(`Test dealership created with ID: ${newDealership.id}`);
    }
    
    // Get all dealerships to select one
    const dealershipList = await db.select().from(dealerships);
    
    console.log('Available dealerships:');
    dealershipList.forEach((dealership, index) => {
      console.log(`${index + 1}. ${dealership.name} (ID: ${dealership.id})`);
    });
    
    const dealershipIndex = parseInt(await prompt('\nSelect dealership (number): ')) - 1;
    const selectedDealership = dealershipList[dealershipIndex] || dealershipList[0];
    
    console.log(`\nSelected dealership: ${selectedDealership.name} (ID: ${selectedDealership.id})`);
    
    // Main menu loop
    let running = true;
    while (running) {
      console.log('\n=== Lead Handover Testing Menu ===');
      console.log('1. Generate handover from scenario');
      console.log('2. Validate custom handover structure');
      console.log('3. Export sample handovers for all scenarios');
      console.log('4. Exit');
      
      const choice = await prompt('\nEnter choice (1-4): ');
      
      switch (choice) {
        case '1': {
          console.log('\nSelect a conversation scenario:');
          Object.keys(SAMPLE_CONVERSATIONS).forEach((key, index) => {
            console.log(`${index + 1}. ${key.replace('_', ' ')}`);
          });
          
          const scenarioIndex = parseInt(await prompt('\nEnter scenario number: ')) - 1;
          const scenarioKey = Object.keys(SAMPLE_CONVERSATIONS)[scenarioIndex] as keyof typeof SAMPLE_CONVERSATIONS;
          
          if (!scenarioKey) {
            console.log('Invalid scenario selection.');
            break;
          }
          
          const addCustomInsights = (await prompt('Add random custom insights? (y/n): ')).toLowerCase() === 'y';
          
          // Generate the handover dossier
          const dossier = generateHandoverDossier(scenarioKey, selectedDealership.id, addCustomInsights);
          
          // Validate the structure
          const validation = validateHandoverDossier(dossier);
          
          if (validation.valid) {
            console.log('\n✅ Handover dossier structure is valid.');
          } else {
            console.log('\n❌ Handover dossier has structural issues:');
            validation.issues.forEach(issue => console.log(`- ${issue}`));
          }
          
          // Display the dossier
          displayHandoverDossier(dossier);
          
          // Ask if user wants to export
          const exportDossier = (await prompt('Export this handover dossier to file? (y/n): ')).toLowerCase() === 'y';
          
          if (exportDossier) {
            const fileName = await prompt('Enter file name (leave empty for default): ');
            const filePath = exportHandoverDossier(dossier, fileName || undefined);
            console.log(`Dossier exported to ${filePath}`);
          }
          
          break;
        }
          
        case '2': {
          console.log('\nValidate custom handover structure:');
          console.log('Enter JSON file path or manually input JSON structure.');
          
          const inputType = await prompt('Enter "file" or "manual": ');
          
          let dossierData: HandoverDossier | null = null;
          
          if (inputType.toLowerCase() === 'file') {
            const filePath = await prompt('Enter path to JSON file: ');
            try {
              const fileContent = fs.readFileSync(filePath, 'utf8');
              dossierData = JSON.parse(fileContent) as HandoverDossier;
            } catch (error) {
              console.error(`Error reading file: ${error.message}`);
              break;
            }
          } else if (inputType.toLowerCase() === 'manual') {
            console.log('Enter JSON structure (finish with a line containing only "END"):');
            const lines = [];
            let line;
            while ((line = await prompt('')) !== 'END') {
              lines.push(line);
            }
            
            try {
              dossierData = JSON.parse(lines.join('\n')) as HandoverDossier;
            } catch (error) {
              console.error(`Error parsing JSON: ${error.message}`);
              break;
            }
          } else {
            console.log('Invalid input type selection.');
            break;
          }
          
          if (dossierData) {
            // Validate the structure
            const validation = validateHandoverDossier(dossierData);
            
            if (validation.valid) {
              console.log('\n✅ Handover dossier structure is valid.');
            } else {
              console.log('\n❌ Handover dossier has structural issues:');
              validation.issues.forEach(issue => console.log(`- ${issue}`));
            }
            
            // Display the dossier
            displayHandoverDossier(dossierData);
          }
          
          break;
        }
          
        case '3': {
          console.log('\nExporting sample handovers for all scenarios...');
          
          const scenarioKeys = Object.keys(SAMPLE_CONVERSATIONS) as Array<keyof typeof SAMPLE_CONVERSATIONS>;
          const exportDir = path.join(process.cwd(), 'test-data', 'handovers', `export-batch-${Date.now()}`);
          
          if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
          }
          
          for (const scenarioKey of scenarioKeys) {
            // Generate the handover dossier
            const dossier = generateHandoverDossier(scenarioKey, selectedDealership.id);
            
            // Export to file
            const fileName = `handover-${scenarioKey}-${dossier.customerName.replace(/\s+/g, '-').toLowerCase()}.json`;
            const filePath = path.join(exportDir, fileName);
            
            fs.writeFileSync(filePath, JSON.stringify(dossier, null, 2));
            console.log(`- Exported ${scenarioKey} scenario to ${fileName}`);
          }
          
          console.log(`\nAll handovers exported to ${exportDir}`);
          break;
        }
          
        case '4':
          console.log('\nExiting handover testing tool...');
          running = false;
          break;
          
        default:
          console.log('Invalid choice. Please try again.');
      }
    }
    
  } catch (error) {
    console.error('Error in handover testing tool:', error);
  } finally {
    rl.close();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testHandoverStructure().then(() => {
    console.log('Handover testing tool completed.');
    process.exit(0);
  }).catch(error => {
    console.error('Error running handover testing tool:', error);
    process.exit(1);
  });
}

export { testHandoverStructure, validateHandoverDossier, generateHandoverDossier };