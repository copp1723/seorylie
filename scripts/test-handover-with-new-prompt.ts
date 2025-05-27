/**
 * Test script for verifying the handover functionality with the new system prompt
 * This script simulates a conversation and triggers the handover process
 */
import { db } from '../server/db';
import { conversations, messages, dealerships } from '../shared/schema';
import { createHandoverDossier, sendHandoverDossierEmail } from '../server/services/handover';
import { eq } from 'drizzle-orm';
import * as readline from 'readline';

// Initialize readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Basic prompt function for user input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Create test data for handover testing
 */
async function createTestData() {
  console.log('Creating test data for handover testing...');
  
  // Check if test dealership exists
  let dealership = await db.query.dealerships.findFirst({
    where: eq(dealerships.name, 'Test Dealership')
  });
  
  if (!dealership) {
    console.log('Creating test dealership...');
    const [newDealership] = await db.insert(dealerships)
      .values({
        name: 'Test Dealership',
        location: 'Test Location',
        contactEmail: 'test@example.com',
        handoverEmail: 'handover@example.com',
        contactPhone: '555-123-4567',
        active: true
      })
      .returning();
    
    dealership = newDealership;
  }
  
  // Create a test conversation
  const [conversation] = await db.insert(conversations)
    .values({
      dealershipId: dealership.id,
      customerName: 'Test Customer',
      customerEmail: 'customer@example.com',
      customerPhone: '555-987-6543',
      status: 'active'
    })
    .returning();
  
  // Add test messages to the conversation
  await db.insert(messages)
    .values([
      {
        conversationId: conversation.id,
        content: "Hi, I'm interested in buying a new SUV for my family. We need something spacious with good safety features.",
        isFromCustomer: true,
        channel: 'chat' // Add the required channel field
      },
      {
        conversationId: conversation.id,
        content: "Hello! Thank you for reaching out to Test Dealership. I'd be happy to help you find the perfect SUV for your family. We have several models with excellent safety ratings and spacious interiors. Could you tell me more about what features are most important to you?",
        isFromCustomer: false,
        channel: 'chat' // Add the required channel field
      },
      {
        conversationId: conversation.id,
        content: "Safety is our top priority since we have two young kids. We also need good cargo space for road trips. Our budget is around $40,000, but we might go a bit higher for the right vehicle. Can you recommend something?",
        isFromCustomer: true,
        channel: 'chat' // Add the required channel field
      },
      {
        conversationId: conversation.id,
        content: "I completely understand prioritizing safety with young children. Based on your needs, I'd recommend looking at the 2024 Toyota Highlander or the Honda Pilot. Both have excellent safety ratings, spacious interiors, and ample cargo space for family road trips. They also fall within your budget range. Would you be interested in scheduling a test drive to see which one feels right for your family?",
        isFromCustomer: false,
        channel: 'chat' // Add the required channel field
      },
      {
        conversationId: conversation.id,
        content: "Those sound promising! What about fuel efficiency? We do a lot of driving, so that's important too. And do they have third-row seating?",
        isFromCustomer: true,
        channel: 'chat' // Add the required channel field
      }
    ]);
  
  console.log(`Test data created successfully! Conversation ID: ${conversation.id}`);
  return conversation;
}

/**
 * Test handover process with the new system prompt
 */
async function testHandover() {
  try {
    // Create test data
    const conversation = await createTestData();
    
    console.log('\n=== Testing Handover Process with New System Prompt ===\n');
    
    // Create handover dossier
    console.log('Creating handover dossier...');
    const dossier = await createHandoverDossier({
      conversationId: conversation.id,
      dealershipId: conversation.dealershipId,
      customerName: conversation.customerName,
      customerContact: conversation.customerEmail || conversation.customerPhone,
      escalationReason: 'Customer has specific questions that require expert knowledge'
    });
    
    console.log('\nHandover Dossier created successfully!');
    console.log('Summary:', dossier.conversationSummary);
    console.log('\nSuggested Approach:', dossier.suggestedApproach);
    
    // Display customer insights
    console.log('\nCustomer Insights:');
    dossier.customerInsights.forEach((insight) => {
      console.log(`- ${insight.key}: ${insight.value} (Confidence: ${Math.round(insight.confidence * 100)}%)`);
    });
    
    // Display vehicle interests
    console.log('\nVehicle Interests:');
    dossier.vehicleInterests.forEach((vehicle) => {
      console.log(`- ${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.trim || ''} (Confidence: ${Math.round(vehicle.confidence * 100)}%)`);
    });
    
    // Option to send email
    const sendEmail = await prompt('\nWould you like to test sending the handover email? (y/n): ');
    
    if (sendEmail.toLowerCase() === 'y') {
      console.log('\nSending handover email...');
      const success = await sendHandoverDossierEmail(dossier);
      
      if (success) {
        console.log('Handover email sent successfully!');
      } else {
        console.log('Failed to send handover email. Check logs for more details.');
      }
    }
    
    // Clean up
    const cleanup = await prompt('\nWould you like to clean up the test data? (y/n): ');
    
    if (cleanup.toLowerCase() === 'y') {
      console.log('\nCleaning up test data...');
      await db.delete(messages).where(eq(messages.conversationId, conversation.id));
      await db.delete(conversations).where(eq(conversations.id, conversation.id));
      console.log('Test data cleaned up successfully!');
    }
    
  } catch (error) {
    console.error('Error testing handover:', error);
  } finally {
    rl.close();
  }
}

// Run the test
console.log('===== Handover Test with New System Prompt =====');
testHandover().catch(console.error);