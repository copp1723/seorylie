/**
 * Integrated testing script that uses sample conversations to test both
 * AI responses and lead handover dossier generation
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { dealerships, conversations, messages, promptVariants } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { sampleConversations } from '../test-data/sample-conversations';
import { validateHandoverDossier } from './test-handover-structure';

// Create test directories if they don't exist
const TEST_LOGS_DIR = path.join(process.cwd(), 'test-data', 'logs');
const TEST_HANDOVERS_DIR = path.join(process.cwd(), 'test-data', 'handovers');

if (!fs.existsSync(TEST_LOGS_DIR)) {
  fs.mkdirSync(TEST_LOGS_DIR, { recursive: true });
}

if (!fs.existsSync(TEST_HANDOVERS_DIR)) {
  fs.mkdirSync(TEST_HANDOVERS_DIR, { recursive: true });
}

// Handover dossier interface
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

// Function to test AI response to a customer message
async function generateAIResponse(
  customerMessage: string,
  previousMessages: Array<{ role: 'customer' | 'assistant', content: string }>,
  dealershipId: number,
  personaId?: number
): Promise<{
  response: string;
  shouldEscalate: boolean;
  reason?: string;
  handoverDossier?: HandoverDossier;
}> {
  try {
    console.log('Generating AI response...');
    
    // Get the prompt template to use
    let systemPrompt = '';
    
    if (personaId) {
      // If persona ID provided, get that specific persona
      const [persona] = await db.select()
        .from(promptVariants)
        .where(eq(promptVariants.id, personaId));
      
      if (persona) {
        systemPrompt = persona.promptTemplate;
      }
    } else {
      // Otherwise use a default persona for the dealership or fallback to a standard prompt
      const [defaultPersona] = await db.select()
        .from(promptVariants)
        .where(
          eq(promptVariants.dealershipId, dealershipId)
        )
        .orderBy(desc(promptVariants.isControl))
        .limit(1);
      
      if (defaultPersona) {
        systemPrompt = defaultPersona.promptTemplate;
      } else {
        // Default system prompt if no personas found
        systemPrompt = `You are an AI assistant for an automotive dealership.
Your role is to provide helpful, accurate information about vehicles, pricing, and services.
Be friendly but professional in your responses.
If you don't know an answer, acknowledge that and offer to connect the customer with a sales representative.

Key guidelines:
- For pricing questions: Provide general ranges but suggest speaking with a sales representative for specific offers
- For trade-in questions: Ask about the vehicle's year, make, model, and condition to provide a rough estimate
- For financing questions: Explain available options but don't quote specific interest rates
- For test drives: Offer to schedule an appointment

Monitor the conversation for signs the customer:
1. Is ready to make a purchase decision
2. Has specific questions that require human expertise
3. Is showing frustration or confusion
4. Needs personalized pricing or trade-in information
5. Would benefit from an in-person visit

In these cases, politely offer to connect them with a sales representative.`;
      }
    }
    
    // In a real scenario, we would call the OpenAI API here
    // For testing purposes, we'll use a simplified approach
    const { generateResponse } = await import('../server/services/openai');
    
    // Generate the response
    const aiResponse = await generateResponse({
      systemPrompt,
      customerMessage,
      previousMessages,
      dealershipId,
      relevantVehicles: [], // In a real scenario, we would get relevant vehicles from the database
    });
    
    return aiResponse;
    
  } catch (error) {
    console.error('Error generating AI response:', error);
    return {
      response: "I apologize, but I'm having trouble responding right now. Let me connect you with a sales representative who can assist you better.",
      shouldEscalate: true,
      reason: "System error: Unable to generate proper response"
    };
  }
}

// Function to run a simulated conversation
async function runSimulatedConversation(
  scenarioKey: keyof typeof sampleConversations,
  dealershipId: number,
  complexityLevel: number = 0,
  personaId?: number
) {
  console.log(`\n=== Running Simulated Conversation: ${scenarioKey} (Complexity: ${complexityLevel + 1}) ===\n`);
  
  const scenario = sampleConversations[scenarioKey];
  const customerReplies = scenario.customerReplies;
  
  if (complexityLevel >= customerReplies.length) {
    complexityLevel = customerReplies.length - 1;
  }
  
  // Start with the initial dealership message and first customer reply
  console.log(`Dealership: "${scenario.dealershipInitialMessage}"`);
  console.log(`Customer: "${customerReplies[complexityLevel]}"`);
  
  // Create a simulated conversation
  const [conversation] = await db.insert(conversations)
    .values({
      dealershipId,
      customerName: `Test Customer (${scenarioKey})`,
      customerPhone: "+15555555555",
      status: "active",
      campaignContext: scenarioKey,
    })
    .returning();
  
  console.log(`\nCreated test conversation with ID: ${conversation.id}`);
  
  // Store the initial dealership message
  await db.insert(messages)
    .values({
      conversationId: conversation.id,
      content: scenario.dealershipInitialMessage,
      isFromCustomer: false,
      channel: "text",
    });
  
  // Store the customer message
  await db.insert(messages)
    .values({
      conversationId: conversation.id,
      content: customerReplies[complexityLevel],
      isFromCustomer: true,
      channel: "text",
    });
  
  // Generate AI response
  const previousMessages = [
    { role: 'assistant' as const, content: scenario.dealershipInitialMessage },
    { role: 'customer' as const, content: customerReplies[complexityLevel] }
  ];
  
  const aiResponse = await generateAIResponse(
    customerReplies[complexityLevel],
    previousMessages.slice(0, -1), // Don't include the last message as it's what we're responding to
    dealershipId,
    personaId
  );
  
  // Store the AI response
  await db.insert(messages)
    .values({
      conversationId: conversation.id,
      content: aiResponse.response,
      isFromCustomer: false,
      channel: "text",
      metadata: aiResponse.shouldEscalate ? { handoverReason: aiResponse.reason } : undefined
    });
  
  // Display the AI response
  console.log(`\nAI: "${aiResponse.response}"\n`);
  
  // Check if the response indicates a handover should occur
  if (aiResponse.shouldEscalate) {
    console.log(`\n! HANDOVER TRIGGERED !`);
    console.log(`Reason: ${aiResponse.reason}`);
    
    // Update conversation status
    await db.update(conversations)
      .set({ status: "escalated" })
      .where(eq(conversations.id, conversation.id));
    
    // Display handover dossier if available
    if (aiResponse.handoverDossier) {
      const dossier = aiResponse.handoverDossier;
      
      // Validate the dossier structure
      const validation = validateHandoverDossier(dossier);
      
      if (validation.valid) {
        console.log('\n✅ Handover dossier structure is valid.');
      } else {
        console.log('\n❌ Handover dossier has structural issues:');
        validation.issues.forEach(issue => console.log(`- ${issue}`));
      }
      
      // Display and save dossier
      console.log('\n=== LEAD HANDOVER DOSSIER ===\n');
      
      console.log(`CUSTOMER: ${dossier.customerName}`);
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
      
      // Save the dossier to file
      const fileName = `handover-${scenarioKey}-complexity-${complexityLevel+1}-${Date.now()}.json`;
      const filePath = path.join(TEST_HANDOVERS_DIR, fileName);
      fs.writeFileSync(filePath, JSON.stringify(dossier, null, 2));
      console.log(`\nHandover dossier saved to ${filePath}`);
    } else {
      console.log('\n⚠️ No handover dossier was generated.');
    }
  }
  
  // Continue the conversation?
  const continueConversation = await prompt('\nContinue this conversation with additional messages? (y/n): ');
  
  if (continueConversation.toLowerCase() === 'y') {
    let conversationActive = true;
    const conversationMessages = [...previousMessages, { role: 'assistant' as const, content: aiResponse.response }];
    
    while (conversationActive) {
      const nextMessagePrompt = await prompt('\nEnter next customer message (or "exit" to end, "scenario" for next sample message): ');
      
      if (nextMessagePrompt.toLowerCase() === 'exit') {
        conversationActive = false;
        continue;
      }
      
      let customerMessage = '';
      
      if (nextMessagePrompt.toLowerCase() === 'scenario') {
        // Move to the next complexity level if available, otherwise stay at current level
        const nextLevel = Math.min(complexityLevel + 1, customerReplies.length - 1);
        customerMessage = customerReplies[nextLevel];
        console.log(`\nCustomer: "${customerMessage}"`);
      } else {
        customerMessage = nextMessagePrompt;
        console.log(`\nCustomer: "${customerMessage}"`);
      }
      
      // Add the customer message to the conversation
      await db.insert(messages)
        .values({
          conversationId: conversation.id,
          content: customerMessage,
          isFromCustomer: true,
          channel: "text",
        });
      
      // Add to our tracking array
      conversationMessages.push({ role: 'customer' as const, content: customerMessage });
      
      // Generate AI response
      const nextAiResponse = await generateAIResponse(
        customerMessage,
        conversationMessages.slice(0, -1), // Don't include the last message
        dealershipId,
        personaId
      );
      
      // Store the AI response
      await db.insert(messages)
        .values({
          conversationId: conversation.id,
          content: nextAiResponse.response,
          isFromCustomer: false,
          channel: "text",
          metadata: nextAiResponse.shouldEscalate ? { handoverReason: nextAiResponse.reason } : undefined
        });
      
      // Add to our tracking array
      conversationMessages.push({ role: 'assistant' as const, content: nextAiResponse.response });
      
      // Display the AI response
      console.log(`\nAI: "${nextAiResponse.response}"\n`);
      
      // Check if the response indicates a handover should occur
      if (nextAiResponse.shouldEscalate) {
        console.log(`\n! HANDOVER TRIGGERED !`);
        console.log(`Reason: ${nextAiResponse.reason}`);
        
        // Update conversation status
        await db.update(conversations)
          .set({ status: "escalated" })
          .where(eq(conversations.id, conversation.id));
        
        // Display handover dossier if available
        if (nextAiResponse.handoverDossier) {
          const dossier = nextAiResponse.handoverDossier;
          
          // Validate the dossier structure
          const validation = validateHandoverDossier(dossier);
          
          if (validation.valid) {
            console.log('\n✅ Handover dossier structure is valid.');
          } else {
            console.log('\n❌ Handover dossier has structural issues:');
            validation.issues.forEach(issue => console.log(`- ${issue}`));
          }
          
          // Display dossier (abbreviated)
          console.log('\n=== LEAD HANDOVER DOSSIER ===\n');
          console.log(`CUSTOMER: ${dossier.customerName}`);
          console.log(`URGENCY: ${dossier.urgency.toUpperCase()}`);
          console.log('\nCUSTOMER INSIGHTS:');
          dossier.customerInsights.slice(0, 3).forEach(insight => {
            console.log(`- ${insight.key}: ${insight.value}`);
          });
          
          // Save the dossier to file
          const fileName = `handover-${scenarioKey}-extended-${Date.now()}.json`;
          const filePath = path.join(TEST_HANDOVERS_DIR, fileName);
          fs.writeFileSync(filePath, JSON.stringify(dossier, null, 2));
          console.log(`\nHandover dossier saved to ${filePath}`);
        }
        
        // End conversation after handover
        const continueAfterHandover = await prompt('\nHandover triggered. Continue conversation anyway? (y/n): ');
        if (continueAfterHandover.toLowerCase() !== 'y') {
          conversationActive = false;
        }
      }
    }
  }
  
  // Export conversation log
  const allMessages = await db.select().from(messages).where(eq(messages.conversationId, conversation.id));
  
  const conversationLog = allMessages.map(msg => {
    return `[${msg.createdAt.toLocaleString()}] ${msg.isFromCustomer ? 'Customer' : 'AI'}: ${msg.content}`;
  }).join('\n\n');
  
  const logFileName = `conversation-${scenarioKey}-complexity-${complexityLevel+1}-${Date.now()}.log`;
  const logFilePath = path.join(TEST_LOGS_DIR, logFileName);
  fs.writeFileSync(logFilePath, conversationLog);
  
  console.log(`\nConversation log saved to ${logFilePath}`);
  
  return {
    conversation,
    messages: allMessages,
    handoverTriggered: allMessages.some(msg => !msg.isFromCustomer && msg.metadata && msg.metadata.handoverReason)
  };
}

// Function to run batch testing on multiple conversation scenarios
async function runBatchTesting(dealershipId: number, personaId?: number) {
  console.log('\n=== Running Batch Testing of All Scenarios ===\n');
  
  const scenarioKeys = Object.keys(sampleConversations) as Array<keyof typeof sampleConversations>;
  const results: Array<{
    scenario: string;
    complexityLevel: number;
    handoverTriggered: boolean;
    messageCount: number;
  }> = [];
  
  // Create a test report directory
  const batchDir = path.join(TEST_HANDOVERS_DIR, `batch-test-${Date.now()}`);
  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true });
  }
  
  // Test each scenario at each complexity level
  for (const scenarioKey of scenarioKeys) {
    for (let complexityLevel = 0; complexityLevel < sampleConversations[scenarioKey].customerReplies.length; complexityLevel++) {
      console.log(`\nTesting ${scenarioKey} at complexity level ${complexityLevel + 1}...`);
      
      const testResult = await runSimulatedConversation(
        scenarioKey,
        dealershipId,
        complexityLevel,
        personaId
      );
      
      results.push({
        scenario: scenarioKey,
        complexityLevel: complexityLevel + 1,
        handoverTriggered: testResult.handoverTriggered,
        messageCount: testResult.messages.length
      });
    }
  }
  
  // Generate a batch test report
  const reportContent = `
=== Rylie AI Batch Test Report ===
Date: ${new Date().toLocaleString()}
Dealership ID: ${dealershipId}
${personaId ? `Persona ID: ${personaId}` : 'Default persona used'}

Results:
${results.map(result => 
  `Scenario: ${result.scenario} (Complexity: ${result.complexityLevel})
   Messages: ${result.messageCount}
   Handover Triggered: ${result.handoverTriggered ? 'YES' : 'NO'}
  `
).join('\n')}

Summary:
- Total Tests: ${results.length}
- Handovers Triggered: ${results.filter(r => r.handoverTriggered).length} (${Math.round(results.filter(r => r.handoverTriggered).length / results.length * 100)}%)
- Average Message Count: ${Math.round(results.reduce((sum, r) => sum + r.messageCount, 0) / results.length)}
`;

  const reportPath = path.join(batchDir, 'batch-test-report.txt');
  fs.writeFileSync(reportPath, reportContent);
  
  console.log(`\nBatch testing completed. Report saved to ${reportPath}`);
  
  return {
    results,
    reportPath
  };
}

// Function to test intent detection in a specific scenario
async function testIntentDetection(
  scenarioKey: keyof typeof sampleConversations,
  dealershipId: number,
  personaId?: number
) {
  console.log(`\n=== Testing Intent Detection: ${scenarioKey} ===\n`);
  
  const scenario = sampleConversations[scenarioKey];
  const expectedIntents: Record<string, Record<number, string[]>> = {
    equityOffer: {
      0: ['Information Request', 'Financial Question'],
      1: ['Price Negotiation', 'Skeptical Customer'],
      2: ['Trust Issues', 'Past Negative Experience']
    },
    leaseMaturity: {
      0: ['Lease End Question', 'Process Inquiry'],
      1: ['Lease Return Concern', 'Relocation Plan'],
      2: ['Frustrated Customer', 'Confused About Process']
    },
    overdueService: {
      0: ['Service Scheduling', 'Loaner Car Request'],
      1: ['Convenience Focused', 'Time Constraint'],
      2: ['Customer Frustration', 'Process Complaint']
    },
    lostLead: {
      0: ['Vehicle Search', 'Budget Constraint'],
      1: ['Price Sensitivity', 'Pre-Purchase Research'],
      2: ['Previous Negative Experience', 'No-Pressure Request']
    },
    tradeInValue: {
      0: ['Trade-In Valuation', 'Timing Consideration'],
      1: ['Skeptical of Trade Value', 'Vehicle Condition Disclosure'],
      2: ['Frustrated Customer', 'Trust Issues']
    }
  };
  
  const results: Array<{
    complexityLevel: number;
    customerMessage: string;
    detectedInsights: string[];
    expectedIntents: string[];
    matchRate: number;
  }> = [];
  
  // Test each complexity level
  for (let complexityLevel = 0; complexityLevel < scenario.customerReplies.length; complexityLevel++) {
    const customerMessage = scenario.customerReplies[complexityLevel];
    console.log(`\nTesting complexity level ${complexityLevel + 1}:`);
    console.log(`Customer: "${customerMessage}"`);
    
    // Generate AI response with customer message only
    const previousMessages = [
      { role: 'assistant' as const, content: scenario.dealershipInitialMessage }
    ];
    
    const aiResponse = await generateAIResponse(
      customerMessage,
      previousMessages,
      dealershipId,
      personaId
    );
    
    // Extract detected insights
    const detectedInsights: string[] = [];
    
    if (aiResponse.handoverDossier) {
      aiResponse.handoverDossier.customerInsights.forEach(insight => {
        detectedInsights.push(insight.key);
      });
    } else {
      detectedInsights.push('No insights generated');
    }
    
    // Compare with expected intents
    const expected = expectedIntents[scenarioKey]?.[complexityLevel] || [];
    
    // Calculate a simple match rate (how many expected intents were found)
    let matchCount = 0;
    for (const intent of expected) {
      if (detectedInsights.some(insight => 
        insight.toLowerCase().includes(intent.toLowerCase()) ||
        intent.toLowerCase().includes(insight.toLowerCase())
      )) {
        matchCount++;
      }
    }
    
    const matchRate = expected.length ? matchCount / expected.length : 0;
    
    console.log(`\nAI Response: "${aiResponse.response}"`);
    console.log('\nIntent Detection Results:');
    console.log(`Expected intents: ${expected.join(', ')}`);
    console.log(`Detected insights: ${detectedInsights.join(', ')}`);
    console.log(`Match rate: ${Math.round(matchRate * 100)}%`);
    
    results.push({
      complexityLevel: complexityLevel + 1,
      customerMessage,
      detectedInsights,
      expectedIntents: expected,
      matchRate
    });
  }
  
  // Generate an intent detection report
  const reportContent = `
=== Rylie AI Intent Detection Report ===
Scenario: ${scenarioKey}
Date: ${new Date().toLocaleString()}
Dealership ID: ${dealershipId}
${personaId ? `Persona ID: ${personaId}` : 'Default persona used'}

Results:
${results.map(result => 
  `Complexity Level: ${result.complexityLevel}
   Customer: "${result.customerMessage}"
   Expected Intents: ${result.expectedIntents.join(', ')}
   Detected Insights: ${result.detectedInsights.join(', ')}
   Match Rate: ${Math.round(result.matchRate * 100)}%
  `
).join('\n\n')}

Summary:
- Average Match Rate: ${Math.round(results.reduce((sum, r) => sum + r.matchRate, 0) / results.length * 100)}%
`;

  const reportPath = path.join(TEST_LOGS_DIR, `intent-detection-${scenarioKey}-${Date.now()}.txt`);
  fs.writeFileSync(reportPath, reportContent);
  
  console.log(`\nIntent detection analysis completed. Report saved to ${reportPath}`);
  
  return {
    results,
    reportPath
  };
}

// Main function to run the conversation-to-handover testing
async function testConversationToHandover() {
  console.log('\n=== Rylie AI Conversation-to-Handover Testing Tool ===\n');
  
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
    
    // Get available personas for the dealership
    const personaList = await db.select()
      .from(promptVariants)
      .where(eq(promptVariants.dealershipId, selectedDealership.id));
    
    let selectedPersonaId: number | undefined = undefined;
    
    if (personaList.length > 0) {
      console.log('\nAvailable personas:');
      console.log('0. Use default persona');
      personaList.forEach((persona, index) => {
        console.log(`${index + 1}. ${persona.name}${persona.isControl ? ' (Control)' : ''}`);
      });
      
      const personaIndex = parseInt(await prompt('\nSelect persona (number): '));
      
      if (personaIndex > 0 && personaIndex <= personaList.length) {
        selectedPersonaId = personaList[personaIndex - 1].id;
        console.log(`Selected persona: ${personaList[personaIndex - 1].name}`);
      } else {
        console.log('Using default persona.');
      }
    } else {
      console.log('\nNo personas found for this dealership. Using default prompt.');
    }
    
    // Main menu loop
    let running = true;
    while (running) {
      console.log('\n=== Conversation-to-Handover Testing Menu ===');
      console.log('1. Test single conversation with handover');
      console.log('2. Run batch testing on all scenarios');
      console.log('3. Analyze intent detection');
      console.log('4. Exit');
      
      const choice = await prompt('\nEnter choice (1-4): ');
      
      switch (choice) {
        case '1': {
          // Display available scenarios
          console.log('\nAvailable conversation scenarios:');
          Object.keys(sampleConversations).forEach((key, index) => {
            console.log(`${index + 1}. ${key.replace('_', ' ')}`);
          });
          
          const scenarioIndex = parseInt(await prompt('\nSelect scenario (number): ')) - 1;
          const scenarioKeys = Object.keys(sampleConversations) as Array<keyof typeof sampleConversations>;
          
          if (scenarioIndex >= 0 && scenarioIndex < scenarioKeys.length) {
            const scenarioKey = scenarioKeys[scenarioIndex];
            
            // Select complexity level
            const complexityLevels = sampleConversations[scenarioKey].customerReplies.length;
            console.log(`\nThis scenario has ${complexityLevels} complexity levels:`);
            for (let i = 0; i < complexityLevels; i++) {
              console.log(`${i + 1}. ${i === 0 ? 'Standard' : i === 1 ? 'Challenging' : 'Difficult'}`);
            }
            
            const complexityIndex = parseInt(await prompt('\nSelect complexity level (number): ')) - 1;
            
            if (complexityIndex >= 0 && complexityIndex < complexityLevels) {
              await runSimulatedConversation(
                scenarioKey,
                selectedDealership.id,
                complexityIndex,
                selectedPersonaId
              );
            } else {
              console.log('Invalid complexity level selection.');
            }
          } else {
            console.log('Invalid scenario selection.');
          }
          break;
        }
          
        case '2':
          await runBatchTesting(
            selectedDealership.id,
            selectedPersonaId
          );
          break;
          
        case '3': {
          // Display available scenarios for intent detection
          console.log('\nAvailable scenarios for intent detection analysis:');
          Object.keys(sampleConversations).forEach((key, index) => {
            console.log(`${index + 1}. ${key.replace('_', ' ')}`);
          });
          
          const scenarioIndex = parseInt(await prompt('\nSelect scenario (number): ')) - 1;
          const scenarioKeys = Object.keys(sampleConversations) as Array<keyof typeof sampleConversations>;
          
          if (scenarioIndex >= 0 && scenarioIndex < scenarioKeys.length) {
            const scenarioKey = scenarioKeys[scenarioIndex];
            await testIntentDetection(
              scenarioKey,
              selectedDealership.id,
              selectedPersonaId
            );
          } else {
            console.log('Invalid scenario selection.');
          }
          break;
        }
          
        case '4':
          console.log('\nExiting conversation-to-handover testing tool...');
          running = false;
          break;
          
        default:
          console.log('Invalid choice. Please try again.');
      }
    }
    
  } catch (error) {
    console.error('Error in conversation-to-handover testing tool:', error);
  } finally {
    rl.close();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testConversationToHandover().then(() => {
    console.log('Conversation-to-handover testing completed.');
    process.exit(0);
  }).catch(error => {
    console.error('Error running conversation-to-handover testing:', error);
    process.exit(1);
  });
}

export { testConversationToHandover, runSimulatedConversation, testIntentDetection };