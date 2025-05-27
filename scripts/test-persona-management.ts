/**
 * Test script for managing and testing Rylie AI personas
 * This allows for creating, retrieving, and testing persona configurations
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { personas, dealerships } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Default base persona templates
const DEFAULT_PERSONA_TEMPLATES = {
  standard: `You are Rylie, an AI assistant for {dealershipName}, a {make} dealership. 
Your goal is to help customers with their automotive questions and guide them toward making a purchase or booking service.

Always be professional, friendly, and knowledgeable about {make} vehicles. 
When customers express interest in specific vehicles, provide relevant information from our inventory.
If a customer question is outside your knowledge or requires human assistance, politely offer to connect them with a sales representative.

Current inventory highlights:
{inventoryHighlights}

Use these guidelines for specific scenarios:
- For pricing questions: Provide MSRP and mention current promotions, but suggest speaking with a sales representative for the best offer
- For trade-in questions: Ask about the vehicle's year, make, model, and condition to provide a rough estimate range
- For financing questions: Explain available options but don't quote specific interest rates
- For test drives: Offer to schedule an appointment and ask for preferred times`,

  sales_focused: `You are Rylie, a sales-focused automotive assistant for {dealershipName}, specializing in {make} vehicles.
Your primary objective is to convert inquiries into showroom visits and sales opportunities.

Be friendly but direct in guiding customers toward taking the next step in the sales process.
Highlight specific vehicles that match customer interests and emphasize limited-time offers.
Focus on creating urgency and excitement about our current inventory.

Current sales promotions:
{currentPromotions}

Key inventory to highlight:
{inventoryHighlights}

Response guidelines:
- Always ask for contact information if not provided
- Suggest specific available time slots for test drives
- Mention limited availability on popular models
- Provide specific next steps for the customer
- When appropriate, mention manager specials on select inventory`
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

// Function to create a test persona
async function createTestPersona(dealershipId: number) {
  console.log('\n=== Create New Persona ===\n');
  
  // Get template choice
  console.log('Select a base template:');
  console.log('1. Standard Customer Service');
  console.log('2. Sales Focused');
  console.log('3. Custom Template');
  
  const templateChoice = await prompt('Enter choice (1-3): ');
  
  let promptTemplate = '';
  
  if (templateChoice === '1') {
    promptTemplate = DEFAULT_PERSONA_TEMPLATES.standard;
  } else if (templateChoice === '2') {
    promptTemplate = DEFAULT_PERSONA_TEMPLATES.sales_focused;
  } else {
    promptTemplate = await prompt('Enter custom prompt template:\n');
  }
  
  // Get persona details
  const name = await prompt('Enter persona name: ');
  
  // Set default arguments
  const defaultArguments = {
    dealershipName: "Test Dealership",
    make: "Toyota",
    inventoryHighlights: "2024 RAV4 - starting at $28,995\n2024 Camry - starting at $26,420\n2024 Highlander - starting at $36,620",
    currentPromotions: "0% APR for 60 months on select models\n$1,500 customer cash on 2023 models\nLease specials on RAV4 from $299/month"
  };
  
  // Customizable arguments
  console.log('\nCustomize arguments for the prompt template:');
  const dealershipName = await prompt(`Dealership name (default: ${defaultArguments.dealershipName}): `) || defaultArguments.dealershipName;
  const make = await prompt(`Primary vehicle make (default: ${defaultArguments.make}): `) || defaultArguments.make;
  const inventoryHighlights = await prompt(`Inventory highlights (default: summarized): `) || defaultArguments.inventoryHighlights;
  const currentPromotions = await prompt(`Current promotions (default: summarized): `) || defaultArguments.currentPromotions;
  
  // Compile arguments
  const arguments = {
    dealershipName,
    make,
    inventoryHighlights,
    currentPromotions
  };
  
  // Ask if this should be the default persona
  const isDefaultStr = await prompt('Set as default persona? (y/n): ');
  const isDefault = isDefaultStr.toLowerCase() === 'y';
  
  // Create the persona
  console.log('\nCreating persona...');
  
  try {
    if (isDefault) {
      // If setting as default, clear other defaults first
      await db.update(personas)
        .set({ isDefault: false })
        .where(eq(personas.dealershipId, dealershipId));
    }
    
    const [newPersona] = await db.insert(personas)
      .values({
        dealershipId,
        name,
        promptTemplate,
        arguments,
        isDefault,
      })
      .returning();
    
    console.log(`\n✅ Persona created successfully with ID: ${newPersona.id}`);
    return newPersona;
    
  } catch (error) {
    console.error('Error creating persona:', error);
    throw error;
  }
}

// Function to list all personas for a dealership
async function listPersonas(dealershipId: number) {
  console.log('\n=== Persona List ===\n');
  
  try {
    const dealershipPersonas = await db.select()
      .from(personas)
      .where(eq(personas.dealershipId, dealershipId));
    
    if (dealershipPersonas.length === 0) {
      console.log('No personas found for this dealership.');
      return [];
    }
    
    console.log(`Found ${dealershipPersonas.length} personas:\n`);
    
    dealershipPersonas.forEach((persona, index) => {
      console.log(`${index + 1}. ${persona.name}${persona.isDefault ? ' (Default)' : ''}`);
      console.log(`   ID: ${persona.id}`);
      console.log(`   Created: ${persona.createdAt.toLocaleString()}`);
      console.log(`   Updated: ${persona.updatedAt.toLocaleString()}`);
      console.log('');
    });
    
    return dealershipPersonas;
    
  } catch (error) {
    console.error('Error listing personas:', error);
    throw error;
  }
}

// Function to view a specific persona
async function viewPersona(personaId: number) {
  console.log(`\n=== Viewing Persona ID: ${personaId} ===\n`);
  
  try {
    const [persona] = await db.select()
      .from(personas)
      .where(eq(personas.id, personaId));
    
    if (!persona) {
      console.log('Persona not found.');
      return null;
    }
    
    console.log(`Name: ${persona.name}${persona.isDefault ? ' (Default)' : ''}`);
    console.log(`Dealership ID: ${persona.dealershipId}`);
    console.log(`Created: ${persona.createdAt.toLocaleString()}`);
    console.log(`Updated: ${persona.updatedAt.toLocaleString()}`);
    
    console.log('\nPrompt Template:');
    console.log('---------------');
    console.log(persona.promptTemplate);
    console.log('---------------');
    
    console.log('\nArguments:');
    console.log('---------------');
    const args = persona.arguments as Record<string, any>;
    for (const [key, value] of Object.entries(args)) {
      console.log(`${key}: ${value}`);
    }
    console.log('---------------');
    
    return persona;
    
  } catch (error) {
    console.error('Error viewing persona:', error);
    throw error;
  }
}

// Function to test a persona with sample customer messages
async function testPersona(personaId: number) {
  console.log(`\n=== Testing Persona ID: ${personaId} ===\n`);
  
  try {
    // Get the persona
    const [persona] = await db.select()
      .from(personas)
      .where(eq(personas.id, personaId));
    
    if (!persona) {
      console.log('Persona not found.');
      return;
    }
    
    console.log(`Testing Persona: ${persona.name}`);
    
    // Get the dealership
    const [dealership] = await db.select()
      .from(dealerships)
      .where(eq(dealerships.id, persona.dealershipId));
    
    if (!dealership) {
      console.log('Associated dealership not found.');
      return;
    }
    
    // Sample customer messages to test
    const sampleMessages = [
      "Hi there, I'm interested in a new SUV. What do you have available?",
      "What's your best deal on a Camry right now?",
      "Can I get a rough estimate on my trade-in? I have a 2019 Accord with about 45,000 miles.",
      "Do you have any hybrid models in stock?",
      "What are your financing rates like?",
      "I'd like to schedule a test drive for this weekend."
    ];
    
    // Display test menu
    console.log('\nSelect a test message or enter your own:');
    sampleMessages.forEach((msg, idx) => {
      console.log(`${idx + 1}. ${msg}`);
    });
    console.log('7. Enter your own message');
    
    const choice = await prompt('\nEnter choice (1-7): ');
    let testMessage = '';
    
    if (choice === '7') {
      testMessage = await prompt('Enter your test message: ');
    } else {
      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < sampleMessages.length) {
        testMessage = sampleMessages[idx];
      } else {
        testMessage = sampleMessages[0];
      }
    }
    
    console.log(`\nTesting with message: "${testMessage}"`);
    console.log('\nGenerating response...');
    
    // Get vehicles for this dealership
    const vehicles = await db.select()
      .from(dealerships)
      .where(eq(dealerships.id, persona.dealershipId));
    
    // Import OpenAI service directly in this test script
    // Note: In a real scenario, you would call the server API endpoint instead
    try {
      // Dynamic import of OpenAI service
      const { generateResponse } = await import('../server/services/openai');
      
      // Apply template arguments to prompt
      const args = persona.arguments as Record<string, any>;
      let filledTemplate = persona.promptTemplate;
      
      for (const [key, value] of Object.entries(args)) {
        filledTemplate = filledTemplate.replace(new RegExp(`{${key}}`, 'g'), value);
      }
      
      // Generate response
      const response = await generateResponse({
        systemPrompt: filledTemplate,
        customerMessage: testMessage,
        previousMessages: [],
        dealershipId: dealership.id,
        relevantVehicles: vehicles || [],
      });
      
      console.log('\n=== Generated Response ===\n');
      console.log(response.message);
      console.log('\n=========================\n');
      
      // Ask if response met expectations
      const feedback = await prompt('Did the response meet your expectations? (y/n): ');
      
      if (feedback.toLowerCase() === 'n') {
        const improvementFeedback = await prompt('What could be improved? ');
        console.log('\nFeedback recorded. This would be used to improve the persona in a production system.');
      } else {
        console.log('\nGreat! The persona is working as expected.');
      }
      
    } catch (error) {
      console.log('\nCould not generate AI response directly. In a production environment, this would call the API endpoint.');
      console.log('Error details:', error.message);
    }
    
  } catch (error) {
    console.error('Error testing persona:', error);
  }
}

// Function to update an existing persona
async function updatePersona(personaId: number) {
  console.log(`\n=== Updating Persona ID: ${personaId} ===\n`);
  
  try {
    // Get current persona
    const [persona] = await db.select()
      .from(personas)
      .where(eq(personas.id, personaId));
    
    if (!persona) {
      console.log('Persona not found.');
      return null;
    }
    
    console.log('Current persona details:');
    console.log(`Name: ${persona.name}`);
    console.log(`Default: ${persona.isDefault ? 'Yes' : 'No'}`);
    
    // Get updated values
    const name = await prompt(`New name (current: ${persona.name}): `) || persona.name;
    
    const updateTemplateStr = await prompt('Update prompt template? (y/n): ');
    let promptTemplate = persona.promptTemplate;
    
    if (updateTemplateStr.toLowerCase() === 'y') {
      console.log('Current template:');
      console.log('---------------');
      console.log(persona.promptTemplate);
      console.log('---------------');
      
      promptTemplate = await prompt('Enter new template (press Enter to keep current):\n') || persona.promptTemplate;
    }
    
    const updateArgsStr = await prompt('Update template arguments? (y/n): ');
    let args = persona.arguments as Record<string, any>;
    
    if (updateArgsStr.toLowerCase() === 'y') {
      console.log('Current arguments:');
      
      for (const [key, value] of Object.entries(args)) {
        console.log(`${key}: ${value}`);
        const newValue = await prompt(`New value for ${key} (press Enter to keep current): `) || value;
        args[key] = newValue;
      }
      
      const addNewArgStr = await prompt('Add new argument? (y/n): ');
      
      if (addNewArgStr.toLowerCase() === 'y') {
        let addingArgs = true;
        
        while (addingArgs) {
          const argName = await prompt('Argument name: ');
          const argValue = await prompt('Argument value: ');
          
          if (argName && argValue) {
            args[argName] = argValue;
          }
          
          const continueStr = await prompt('Add another argument? (y/n): ');
          addingArgs = continueStr.toLowerCase() === 'y';
        }
      }
    }
    
    const isDefaultStr = await prompt(`Set as default persona? (current: ${persona.isDefault ? 'Yes' : 'No'}): `);
    const isDefault = isDefaultStr.toLowerCase() === 'y' ? true : persona.isDefault;
    
    // Confirm update
    console.log('\nReady to update persona with following changes:');
    console.log(`Name: ${name}`);
    console.log(`Default: ${isDefault ? 'Yes' : 'No'}`);
    console.log('Template: [Updated]');
    console.log('Arguments: [Updated]');
    
    const confirmStr = await prompt('\nConfirm update? (y/n): ');
    
    if (confirmStr.toLowerCase() !== 'y') {
      console.log('Update cancelled.');
      return null;
    }
    
    // Update the persona
    if (isDefault) {
      // If setting as default, clear other defaults first
      await db.update(personas)
        .set({ isDefault: false })
        .where(eq(personas.dealershipId, persona.dealershipId));
    }
    
    const [updatedPersona] = await db.update(personas)
      .set({
        name,
        promptTemplate,
        arguments: args,
        isDefault,
        updatedAt: new Date()
      })
      .where(eq(personas.id, personaId))
      .returning();
    
    console.log(`\n✅ Persona updated successfully.`);
    return updatedPersona;
    
  } catch (error) {
    console.error('Error updating persona:', error);
    throw error;
  }
}

// Main function to run the persona testing tool
async function testPersonaManagement() {
  console.log('\n=== Rylie AI Persona Management Tool ===\n');
  
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
      console.log('\n=== Persona Management Menu ===');
      console.log('1. List all personas');
      console.log('2. Create new persona');
      console.log('3. View persona details');
      console.log('4. Update existing persona');
      console.log('5. Test persona response');
      console.log('6. Exit');
      
      const choice = await prompt('\nEnter choice (1-6): ');
      
      switch (choice) {
        case '1':
          await listPersonas(selectedDealership.id);
          break;
          
        case '2':
          await createTestPersona(selectedDealership.id);
          break;
          
        case '3': {
          const personas = await listPersonas(selectedDealership.id);
          if (personas.length > 0) {
            const personaId = parseInt(await prompt('Enter persona ID to view: '));
            await viewPersona(personaId);
          }
          break;
        }
          
        case '4': {
          const personas = await listPersonas(selectedDealership.id);
          if (personas.length > 0) {
            const personaId = parseInt(await prompt('Enter persona ID to update: '));
            await updatePersona(personaId);
          }
          break;
        }
          
        case '5': {
          const personas = await listPersonas(selectedDealership.id);
          if (personas.length > 0) {
            const personaId = parseInt(await prompt('Enter persona ID to test: '));
            await testPersona(personaId);
          }
          break;
        }
          
        case '6':
          console.log('\nExiting persona management tool...');
          running = false;
          break;
          
        default:
          console.log('Invalid choice. Please try again.');
      }
    }
    
  } catch (error) {
    console.error('Error in persona management tool:', error);
  } finally {
    rl.close();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testPersonaManagement().then(() => {
    console.log('Persona management tool completed.');
    process.exit(0);
  }).catch(error => {
    console.error('Error running persona management tool:', error);
    process.exit(1);
  });
}

export { testPersonaManagement };