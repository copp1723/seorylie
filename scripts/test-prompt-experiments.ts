/**
 * Test script for A/B testing of prompt variants
 * This allows creating, running, and evaluating different prompt templates
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { promptVariants, promptExperiments, experimentVariants, dealerships, promptMetrics } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// Sample conversation types for testing
const SAMPLE_CONVERSATION_TYPES = [
  'vehicle_inquiry',
  'price_negotiation',
  'trade_in_question',
  'financing_options', 
  'service_scheduling',
  'general_information'
];

// Sample prompt templates for quick setup
const SAMPLE_PROMPT_TEMPLATES = {
  standard: `You are an AI assistant for an automotive dealership. 
Your role is to provide helpful, accurate information about vehicles, pricing, and services.
Be friendly but professional in your responses.
If you don't know an answer, acknowledge that and offer to connect the customer with a sales representative.`,

  conversational: `You are a friendly, conversational assistant at a car dealership.
Talk to customers like you're having a casual chat, using simple language and occasional humor.
Focus on building rapport while still being helpful with vehicle information.
Make customers feel comfortable by responding in a warm, approachable way.`,

  direct_sales: `You are a sales-focused automotive assistant.
Your primary goal is to move customers toward a purchase decision.
Be direct about the benefits of acting quickly and emphasize current promotions.
Always suggest concrete next steps like booking a test drive or visiting the showroom.
Focus on creating urgency and excitement about available vehicles.`,

  expert_consultant: `You are an expert automotive consultant with deep industry knowledge.
Provide detailed technical information about vehicles when responding to customers.
Use specific terminology to demonstrate expertise and build credibility.
Focus on educating customers about vehicle features, specifications, and technology.
Position yourself as a trusted advisor in the car-buying process.`
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

// Function to create a new prompt variant
async function createPromptVariant(dealershipId: number) {
  console.log('\n=== Create New Prompt Variant ===\n');
  
  // Show template options
  console.log('Select a base template or create a custom one:');
  console.log('1. Standard Professional');
  console.log('2. Conversational Friendly');
  console.log('3. Direct Sales-Focused');
  console.log('4. Expert Consultant');
  console.log('5. Custom Template');
  
  const templateChoice = await prompt('Enter choice (1-5): ');
  
  let promptTemplate = '';
  let name = '';
  
  switch (templateChoice) {
    case '1':
      promptTemplate = SAMPLE_PROMPT_TEMPLATES.standard;
      name = 'Standard Professional';
      break;
    case '2':
      promptTemplate = SAMPLE_PROMPT_TEMPLATES.conversational;
      name = 'Conversational Friendly';
      break;
    case '3':
      promptTemplate = SAMPLE_PROMPT_TEMPLATES.direct_sales;
      name = 'Direct Sales-Focused';
      break;
    case '4':
      promptTemplate = SAMPLE_PROMPT_TEMPLATES.expert_consultant;
      name = 'Expert Consultant';
      break;
    case '5':
      name = await prompt('Enter variant name: ');
      console.log('\nEnter custom prompt template (finish with a line containing only "END"):');
      const lines = [];
      let line;
      while ((line = await prompt('')) !== 'END') {
        lines.push(line);
      }
      promptTemplate = lines.join('\n');
      break;
    default:
      promptTemplate = SAMPLE_PROMPT_TEMPLATES.standard;
      name = 'Standard Professional';
  }
  
  if (templateChoice !== '5') {
    const customName = await prompt(`Enter variant name (default: ${name}): `);
    if (customName) name = customName;
  }
  
  const description = await prompt('Enter a brief description of this variant: ');
  
  const isControlStr = await prompt('Is this the control variant for experiments? (y/n): ');
  const isControl = isControlStr.toLowerCase() === 'y';
  
  // Create the variant
  console.log('\nCreating prompt variant...');
  
  try {
    const [variant] = await db.insert(promptVariants)
      .values({
        name,
        description,
        promptTemplate,
        isControl,
        isActive: true,
        dealershipId
      })
      .returning();
    
    console.log(`\n✅ Prompt variant created successfully with ID: ${variant.id}`);
    return variant;
    
  } catch (error) {
    console.error('Error creating prompt variant:', error);
    throw error;
  }
}

// Function to list all prompt variants
async function listPromptVariants(dealershipId?: number) {
  console.log('\n=== Prompt Variants ===\n');
  
  try {
    let query = db.select().from(promptVariants).orderBy(desc(promptVariants.createdAt));
    
    if (dealershipId) {
      query = query.where(eq(promptVariants.dealershipId, dealershipId));
    }
    
    const variants = await query;
    
    if (variants.length === 0) {
      console.log('No prompt variants found.');
      return [];
    }
    
    console.log(`Found ${variants.length} prompt variants:\n`);
    
    variants.forEach((variant, index) => {
      console.log(`${index + 1}. ${variant.name}${variant.isControl ? ' (Control)' : ''}${variant.isActive ? '' : ' (Inactive)'}`);
      console.log(`   ID: ${variant.id}`);
      if (variant.description) console.log(`   Description: ${variant.description}`);
      console.log(`   Created: ${variant.createdAt.toLocaleString()}`);
      console.log('');
    });
    
    return variants;
    
  } catch (error) {
    console.error('Error listing prompt variants:', error);
    throw error;
  }
}

// Function to view a specific prompt variant
async function viewPromptVariant(variantId: number) {
  console.log(`\n=== Viewing Prompt Variant ID: ${variantId} ===\n`);
  
  try {
    const [variant] = await db.select()
      .from(promptVariants)
      .where(eq(promptVariants.id, variantId));
    
    if (!variant) {
      console.log('Prompt variant not found.');
      return null;
    }
    
    console.log(`Name: ${variant.name}${variant.isControl ? ' (Control)' : ''}${variant.isActive ? '' : ' (Inactive)'}`);
    if (variant.dealershipId) {
      const [dealership] = await db.select()
        .from(dealerships)
        .where(eq(dealerships.id, variant.dealershipId));
      
      if (dealership) {
        console.log(`Dealership: ${dealership.name} (ID: ${dealership.id})`);
      }
    }
    
    if (variant.description) console.log(`Description: ${variant.description}`);
    console.log(`Created: ${variant.createdAt.toLocaleString()}`);
    console.log(`Updated: ${variant.updatedAt.toLocaleString()}`);
    
    console.log('\nPrompt Template:');
    console.log('---------------');
    console.log(variant.promptTemplate);
    console.log('---------------');
    
    // Get metrics if any exist
    const metrics = await db.select()
      .from(promptMetrics)
      .where(eq(promptMetrics.variantId, variant.id));
    
    if (metrics.length > 0) {
      console.log('\nPerformance Metrics:');
      console.log(`Total uses: ${metrics.length}`);
      
      const avgResponseTime = metrics.reduce((sum, m) => sum + (m.responseTime || 0), 0) / metrics.length;
      const avgTokensUsed = metrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0) / metrics.length;
      const escalationRate = metrics.filter(m => m.wasEscalated).length / metrics.length * 100;
      
      console.log(`Average response time: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`Average tokens used: ${avgTokensUsed.toFixed(0)}`);
      console.log(`Escalation rate: ${escalationRate.toFixed(1)}%`);
      
      if (metrics.some(m => m.customerRating !== null)) {
        const ratedMetrics = metrics.filter(m => m.customerRating !== null);
        const avgRating = ratedMetrics.reduce((sum, m) => sum + (m.customerRating || 0), 0) / ratedMetrics.length;
        console.log(`Average customer rating: ${avgRating.toFixed(1)}/5 (from ${ratedMetrics.length} ratings)`);
      }
    }
    
    return variant;
    
  } catch (error) {
    console.error('Error viewing prompt variant:', error);
    throw error;
  }
}

// Function to create a new A/B test experiment
async function createExperiment(dealershipId: number) {
  console.log('\n=== Create New A/B Test Experiment ===\n');
  
  // Get all prompt variants for this dealership
  const variants = await db.select()
    .from(promptVariants)
    .where(and(
      eq(promptVariants.dealershipId, dealershipId),
      eq(promptVariants.isActive, true)
    ));
  
  if (variants.length < 2) {
    console.log('You need at least 2 active prompt variants to create an experiment.');
    
    const createNewVariant = await prompt('Would you like to create a new variant now? (y/n): ');
    if (createNewVariant.toLowerCase() === 'y') {
      await createPromptVariant(dealershipId);
      // Return and suggest running this function again
      console.log('\nPlease run the create experiment command again after creating your variants.');
      return null;
    } else {
      return null;
    }
  }
  
  // Show available variants
  console.log('Available prompt variants:');
  variants.forEach((variant, index) => {
    console.log(`${index + 1}. ${variant.name}${variant.isControl ? ' (Control)' : ''}`);
  });
  
  // Get experiment details
  const name = await prompt('\nEnter experiment name: ');
  const description = await prompt('Enter experiment description: ');
  
  // Calculate start date (now) and end date (2 weeks from now by default)
  const startDate = new Date();
  const defaultEndDate = new Date(startDate);
  defaultEndDate.setDate(defaultEndDate.getDate() + 14);
  
  const endDateStr = await prompt(`Enter end date (YYYY-MM-DD, default: ${defaultEndDate.toISOString().split('T')[0]}): `);
  let endDate = defaultEndDate;
  
  if (endDateStr) {
    try {
      endDate = new Date(endDateStr);
    } catch (e) {
      console.log('Invalid date format, using default end date (2 weeks from now).');
    }
  }
  
  // Select variants to include
  const selectedVariantIndices = (await prompt('Enter the variant numbers to include (comma-separated, e.g., "1,3,4"): '))
    .split(',')
    .map(n => parseInt(n.trim()) - 1)
    .filter(n => !isNaN(n) && n >= 0 && n < variants.length);
  
  if (selectedVariantIndices.length < 2) {
    console.log('You need to select at least 2 variants for an experiment.');
    return null;
  }
  
  const selectedVariants = selectedVariantIndices.map(i => variants[i]);
  
  // Create the experiment
  console.log('\nCreating experiment...');
  
  try {
    const [experiment] = await db.insert(promptExperiments)
      .values({
        name,
        description,
        dealershipId,
        startDate,
        endDate,
        isActive: true
      })
      .returning();
    
    console.log(`\nExperiment created with ID: ${experiment.id}`);
    
    // Add variants to the experiment
    console.log('Adding variants to experiment...');
    
    // Calculate even distribution for variants
    const defaultTrafficPerVariant = Math.floor(100 / selectedVariants.length);
    let remainingTraffic = 100 - (defaultTrafficPerVariant * selectedVariants.length);
    
    for (const variant of selectedVariants) {
      const trafficAllocation = defaultTrafficPerVariant + (remainingTraffic > 0 ? 1 : 0);
      if (remainingTraffic > 0) remainingTraffic--;
      
      await db.insert(experimentVariants)
        .values({
          experimentId: experiment.id,
          variantId: variant.id,
          trafficAllocation
        });
      
      console.log(`- Added variant "${variant.name}" with ${trafficAllocation}% traffic allocation`);
    }
    
    console.log('\n✅ Experiment setup complete!');
    return experiment;
    
  } catch (error) {
    console.error('Error creating experiment:', error);
    throw error;
  }
}

// Function to list all experiments
async function listExperiments(dealershipId?: number) {
  console.log('\n=== A/B Test Experiments ===\n');
  
  try {
    let query = db.select().from(promptExperiments).orderBy(desc(promptExperiments.startDate));
    
    if (dealershipId) {
      query = query.where(eq(promptExperiments.dealershipId, dealershipId));
    }
    
    const experiments = await query;
    
    if (experiments.length === 0) {
      console.log('No experiments found.');
      return [];
    }
    
    console.log(`Found ${experiments.length} experiments:\n`);
    
    for (const experiment of experiments) {
      const now = new Date();
      let status = 'Scheduled';
      
      if (experiment.startDate <= now) {
        if (experiment.endDate && experiment.endDate <= now) {
          status = 'Completed';
        } else {
          status = 'Running';
        }
      }
      
      console.log(`${experiment.name} (ID: ${experiment.id})`);
      console.log(`Status: ${status}${experiment.isActive ? '' : ' (Inactive)'}`);
      if (experiment.description) console.log(`Description: ${experiment.description}`);
      console.log(`Period: ${experiment.startDate.toLocaleDateString()} to ${experiment.endDate ? experiment.endDate.toLocaleDateString() : 'Ongoing'}`);
      
      // Get variants
      const expVariants = await db.select({
        expVariant: experimentVariants,
        variant: promptVariants
      })
      .from(experimentVariants)
      .innerJoin(
        promptVariants,
        eq(experimentVariants.variantId, promptVariants.id)
      )
      .where(eq(experimentVariants.experimentId, experiment.id));
      
      if (expVariants.length > 0) {
        console.log('Variants:');
        for (const { expVariant, variant } of expVariants) {
          console.log(`- ${variant.name}${variant.isControl ? ' (Control)' : ''}: ${expVariant.trafficAllocation}% traffic`);
        }
      }
      
      console.log(''); // Empty line for spacing
    }
    
    return experiments;
    
  } catch (error) {
    console.error('Error listing experiments:', error);
    throw error;
  }
}

// Function to view a specific experiment
async function viewExperiment(experimentId: number) {
  console.log(`\n=== Viewing Experiment ID: ${experimentId} ===\n`);
  
  try {
    const [experiment] = await db.select()
      .from(promptExperiments)
      .where(eq(promptExperiments.id, experimentId));
    
    if (!experiment) {
      console.log('Experiment not found.');
      return null;
    }
    
    // Get dealership info if available
    let dealershipName = 'Global';
    if (experiment.dealershipId) {
      const [dealership] = await db.select()
        .from(dealerships)
        .where(eq(dealerships.id, experiment.dealershipId));
      
      if (dealership) {
        dealershipName = dealership.name;
      }
    }
    
    // Determine status
    const now = new Date();
    let status = 'Scheduled';
    
    if (experiment.startDate <= now) {
      if (experiment.endDate && experiment.endDate <= now) {
        status = 'Completed';
      } else {
        status = 'Running';
      }
    }
    
    console.log(`Name: ${experiment.name}`);
    console.log(`Status: ${status}${experiment.isActive ? '' : ' (Inactive)'}`);
    console.log(`Dealership: ${dealershipName}`);
    if (experiment.description) console.log(`Description: ${experiment.description}`);
    console.log(`Start Date: ${experiment.startDate.toLocaleString()}`);
    console.log(`End Date: ${experiment.endDate ? experiment.endDate.toLocaleString() : 'Ongoing'}`);
    
    // Get variants and their metrics
    const expVariants = await db.select({
      expVariant: experimentVariants,
      variant: promptVariants
    })
    .from(experimentVariants)
    .innerJoin(
      promptVariants,
      eq(experimentVariants.variantId, promptVariants.id)
    )
    .where(eq(experimentVariants.experimentId, experiment.id));
    
    if (expVariants.length > 0) {
      console.log('\nVariants and Performance:');
      
      for (const { expVariant, variant } of expVariants) {
        console.log(`\n${variant.name}${variant.isControl ? ' (Control)' : ''}`);
        console.log(`Traffic Allocation: ${expVariant.trafficAllocation}%`);
        
        // Get metrics for this variant
        const metrics = await db.select()
          .from(promptMetrics)
          .where(eq(promptMetrics.variantId, variant.id));
        
        if (metrics.length > 0) {
          const avgResponseTime = metrics.reduce((sum, m) => sum + (m.responseTime || 0), 0) / metrics.length;
          const avgTokensUsed = metrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0) / metrics.length;
          const escalationRate = metrics.filter(m => m.wasEscalated).length / metrics.length * 100;
          
          console.log(`Metrics:`);
          console.log(`- Total interactions: ${metrics.length}`);
          console.log(`- Avg response time: ${avgResponseTime.toFixed(0)}ms`);
          console.log(`- Avg tokens used: ${avgTokensUsed.toFixed(0)}`);
          console.log(`- Escalation rate: ${escalationRate.toFixed(1)}%`);
          
          if (metrics.some(m => m.customerRating !== null)) {
            const ratedMetrics = metrics.filter(m => m.customerRating !== null);
            const avgRating = ratedMetrics.reduce((sum, m) => sum + (m.customerRating || 0), 0) / ratedMetrics.length;
            console.log(`- Avg customer rating: ${avgRating.toFixed(1)}/5 (from ${ratedMetrics.length} ratings)`);
          }
        } else {
          console.log('No metrics available yet.');
        }
      }
    }
    
    if (experiment.conclusionNotes) {
      console.log('\nConclusion Notes:');
      console.log(experiment.conclusionNotes);
    }
    
    return experiment;
    
  } catch (error) {
    console.error('Error viewing experiment:', error);
    throw error;
  }
}

// Function to test a prompt variant
async function testPromptVariant(variantId: number) {
  console.log(`\n=== Testing Prompt Variant ID: ${variantId} ===\n`);
  
  try {
    // Get the variant
    const [variant] = await db.select()
      .from(promptVariants)
      .where(eq(promptVariants.id, variantId));
    
    if (!variant) {
      console.log('Prompt variant not found.');
      return;
    }
    
    console.log(`Testing Variant: ${variant.name}`);
    
    // Sample customer messages for testing different scenarios
    const sampleMessages = {
      vehicle_inquiry: [
        "What SUVs do you have available under $35,000?",
        "Do you have any hybrid or electric vehicles in stock?",
        "I'm looking for a family car with good safety ratings. What do you recommend?"
      ],
      price_negotiation: [
        "Can you do any better on the price of that Camry we looked at?",
        "I got a quote from another dealership that's $1,500 less. Can you match it?",
        "What's your absolute best price on the 2023 Highlander?"
      ],
      trade_in_question: [
        "How much can I get for my 2018 Honda Accord with 45,000 miles?",
        "I want to trade in my current car. What information do you need from me?",
        "Will you take my car as a trade-in if I still owe money on it?"
      ],
      financing_options: [
        "What are your current interest rates for new car loans?",
        "Do you offer any 0% financing promotions right now?",
        "Can I get pre-approved for financing before I come in?"
      ],
      service_scheduling: [
        "I need to schedule an oil change for my Toyota. When can you fit me in?",
        "How much does a brake inspection cost?",
        "My check engine light is on. Can I bring it in to have it looked at?"
      ],
      general_information: [
        "What are your hours of operation?",
        "Do you offer loaner cars during service?",
        "How long does the buying process usually take from start to finish?"
      ]
    };
    
    // Display test menu
    console.log('\nSelect a conversation type to test:');
    SAMPLE_CONVERSATION_TYPES.forEach((type, idx) => {
      console.log(`${idx + 1}. ${type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)}`);
    });
    
    const typeChoice = await prompt('\nEnter choice (1-6): ');
    const conversationType = SAMPLE_CONVERSATION_TYPES[parseInt(typeChoice) - 1] || SAMPLE_CONVERSATION_TYPES[0];
    
    // Display message options for the selected type
    console.log(`\nSelect a sample message for "${conversationType.replace('_', ' ')}":`);
    sampleMessages[conversationType as keyof typeof sampleMessages].forEach((msg, idx) => {
      console.log(`${idx + 1}. ${msg}`);
    });
    console.log(`${sampleMessages[conversationType as keyof typeof sampleMessages].length + 1}. Enter your own message`);
    
    const messageChoice = await prompt('\nEnter choice: ');
    let testMessage = '';
    
    if (parseInt(messageChoice) > sampleMessages[conversationType as keyof typeof sampleMessages].length) {
      testMessage = await prompt('Enter your test message: ');
    } else {
      const idx = parseInt(messageChoice) - 1;
      if (idx >= 0 && idx < sampleMessages[conversationType as keyof typeof sampleMessages].length) {
        testMessage = sampleMessages[conversationType as keyof typeof sampleMessages][idx];
      } else {
        testMessage = sampleMessages[conversationType as keyof typeof sampleMessages][0];
      }
    }
    
    console.log(`\nTesting with message: "${testMessage}"`);
    console.log('\nGenerating response...');
    
    // Import OpenAI service directly in this test script
    try {
      const startTime = Date.now();
      
      // Dynamic import of OpenAI service
      const { generateResponse } = await import('../server/services/openai');
      
      // Generate response
      const response = await generateResponse({
        systemPrompt: variant.promptTemplate,
        customerMessage: testMessage,
        previousMessages: [],
        dealershipId: variant.dealershipId || 1,
        relevantVehicles: [],
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log('\n=== Generated Response ===\n');
      console.log(response.message);
      console.log('\n=========================\n');
      
      // Record basic metrics
      console.log('Response Metrics:');
      console.log(`- Response time: ${responseTime}ms`);
      console.log(`- Customer message length: ${testMessage.length} chars`);
      console.log(`- Assistant response length: ${response.message.length} chars`);
      
      // Ask for rating
      const ratingStr = await prompt('\nRate this response (1-5, 5 being best): ');
      const rating = parseInt(ratingStr);
      
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        // Store metrics in the database
        await db.insert(promptMetrics)
          .values({
            variantId: variant.id,
            conversationId: 0, // Placeholder for test
            messageId: 0, // Placeholder for test
            responseTime,
            tokensUsed: Math.round(response.message.length / 4), // Rough estimate
            customerMessageLength: testMessage.length,
            assistantResponseLength: response.message.length,
            wasEscalated: response.handover || false,
            wasSuccessful: rating >= 4,
            customerRating: rating
          });
        
        console.log(`\nRating recorded. Thank you for testing this prompt variant!`);
      }
      
    } catch (error) {
      console.log('\nCould not generate AI response directly. In a production environment, this would call the API endpoint.');
      console.log('Error details:', error.message);
    }
    
  } catch (error) {
    console.error('Error testing prompt variant:', error);
  }
}

// Main function to run the A/B testing tool
async function testPromptExperiments() {
  console.log('\n=== Rylie AI A/B Testing Tool ===\n');
  
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
      console.log('\n=== A/B Testing Menu ===');
      console.log('1. List all prompt variants');
      console.log('2. Create new prompt variant');
      console.log('3. View prompt variant details');
      console.log('4. Test prompt variant');
      console.log('5. List all experiments');
      console.log('6. Create new experiment');
      console.log('7. View experiment details');
      console.log('8. Exit');
      
      const choice = await prompt('\nEnter choice (1-8): ');
      
      switch (choice) {
        case '1':
          await listPromptVariants(selectedDealership.id);
          break;
          
        case '2':
          await createPromptVariant(selectedDealership.id);
          break;
          
        case '3': {
          const variants = await listPromptVariants(selectedDealership.id);
          if (variants.length > 0) {
            const variantId = parseInt(await prompt('Enter variant ID to view: '));
            await viewPromptVariant(variantId);
          }
          break;
        }
          
        case '4': {
          const variants = await listPromptVariants(selectedDealership.id);
          if (variants.length > 0) {
            const variantId = parseInt(await prompt('Enter variant ID to test: '));
            await testPromptVariant(variantId);
          }
          break;
        }
          
        case '5':
          await listExperiments(selectedDealership.id);
          break;
          
        case '6':
          await createExperiment(selectedDealership.id);
          break;
          
        case '7': {
          const experiments = await listExperiments(selectedDealership.id);
          if (experiments.length > 0) {
            const experimentId = parseInt(await prompt('Enter experiment ID to view: '));
            await viewExperiment(experimentId);
          }
          break;
        }
          
        case '8':
          console.log('\nExiting A/B testing tool...');
          running = false;
          break;
          
        default:
          console.log('Invalid choice. Please try again.');
      }
    }
    
  } catch (error) {
    console.error('Error in A/B testing tool:', error);
  } finally {
    rl.close();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testPromptExperiments().then(() => {
    console.log('A/B testing tool completed.');
    process.exit(0);
  }).catch(error => {
    console.error('Error running A/B testing tool:', error);
    process.exit(1);
  });
}

export { testPromptExperiments };