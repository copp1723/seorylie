/**
 * Test script for the A/B testing infrastructure
 * This script simulates conversation flow using the A/B testing system
 */
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

// Function to generate a random customer message
function getRandomCustomerMessage() {
  const messages = [
    "I'm interested in the new SUVs you have available",
    "What's your best deal on a sedan right now?",
    "Do you have any electric vehicles with good range?",
    "I'm looking for something with good gas mileage",
    "Can you tell me about your financing options?",
    "I want to trade in my current car for something newer",
    "What's the warranty like on your vehicles?",
    "Do you have any luxury models with leather seats?",
    "I need a vehicle that can handle off-road driving",
    "I'm looking for a family vehicle with good safety features"
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

async function testABTesting() {
  try {
    console.log('Testing A/B testing infrastructure...\n');
    
    // Step 1: Get dealership info for testing
    const dealershipsResponse = await fetch('http://localhost:5000/api/dealerships');
    const dealerships = await dealershipsResponse.json();
    
    if (!dealerships || dealerships.length === 0) {
      throw new Error('No dealerships found. Please seed the database first.');
    }
    
    const dealershipId = dealerships[0].id;
    console.log(`Using dealership ID: ${dealershipId}\n`);
    
    // Step 2: Get API key for authentication
    const apiKeyResponse = await fetch(`http://localhost:5000/api/dealerships/${dealershipId}/apikeys`);
    const apiKeys = await apiKeyResponse.json();
    
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('No API keys found. Please generate an API key first.');
    }
    
    const apiKey = apiKeys[0].key;
    console.log('Successfully retrieved API key\n');
    
    // Step 3: Create a test prompt variant
    console.log('Creating a test prompt variant...');
    const variantResponse = await fetch('http://localhost:5000/api/abtest/variants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        dealershipId,
        name: `Test Variant ${Date.now()}`,
        description: 'A test variant for A/B testing',
        promptTemplate: `You are Rylie, an AI assistant for {{dealershipName}}. 
          Always be helpful, friendly, and knowledgeable about automotive topics.
          
          When responding to customers:
          - Be concise and direct
          - Focus on the specific question asked
          - Emphasize vehicle features and benefits
          - Suggest alternative options if appropriate
          
          Important information about the dealership:
          - Name: {{dealershipName}}
          - We take trade-ins and offer competitive pricing
          - We offer financing options
          
          Always respond in a formal, professional manner.`,
        isActive: true
      })
    });
    
    const variant = await variantResponse.json();
    console.log(`Created prompt variant ID: ${variant.id}\n`);
    
    // Step 4: Create a second variant for comparison
    console.log('Creating a second test prompt variant...');
    const variant2Response = await fetch('http://localhost:5000/api/abtest/variants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        dealershipId,
        name: `Test Variant B ${Date.now()}`,
        description: 'A second test variant for A/B testing',
        promptTemplate: `You are Rylie, an AI assistant for {{dealershipName}}. 
          Be warm, friendly, and conversational in your approach.
          
          When responding to customers:
          - Use a casual, approachable tone
          - Ask follow-up questions to understand needs better
          - Tell stories about happy customers when relevant
          - Use analogies to explain complex features
          
          Important information about the dealership:
          - Name: {{dealershipName}}
          - We treat customers like family
          - We have a no-pressure sales approach
          
          Always respond in a warm, friendly manner.`,
        isActive: true
      })
    });
    
    const variant2 = await variant2Response.json();
    console.log(`Created second prompt variant ID: ${variant2.id}\n`);
    
    // Step 5: Create an experiment with both variants
    console.log('Creating an experiment with both variants...');
    const experimentResponse = await fetch('http://localhost:5000/api/abtest/experiments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        dealershipId,
        name: `Test Experiment ${Date.now()}`,
        description: 'Testing two different conversation styles',
        isActive: true,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        variants: [
          {
            variantId: variant.id,
            trafficAllocation: 50 // 50% of traffic
          },
          {
            variantId: variant2.id,
            trafficAllocation: 50 // 50% of traffic
          }
        ]
      })
    });
    
    const experiment = await experimentResponse.json();
    console.log(`Created experiment ID: ${experiment.id}\n`);
    
    // Step 6: Simulate conversations using the experiment
    console.log('Simulating conversations to test the A/B testing system...\n');
    
    // Create a conversation
    const conversationResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Test Customer',
        customerPhone: '+1234567890',
        message: getRandomCustomerMessage(),
        customerId: randomUUID()
      })
    });
    
    const conversation = await conversationResponse.json();
    console.log(`Created conversation ID: ${conversation.id}`);
    console.log(`Received response: "${conversation.message.content}"\n`);
    
    // Send some follow-up messages to generate more test data
    for (let i = 0; i < 5; i++) {
      console.log(`Sending follow-up message ${i + 1}...`);
      const replyResponse = await fetch('http://localhost:5000/api/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          message: getRandomCustomerMessage()
        })
      });
      
      const reply = await replyResponse.json();
      console.log(`Received response: "${reply.message.content}"\n`);
      
      // Add a short delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 7: Get the experiment results
    console.log('Fetching experiment results...');
    const resultsResponse = await fetch(`http://localhost:5000/api/abtest/experiments/${experiment.id}/results`, {
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    const results = await resultsResponse.json();
    console.log('\nExperiment Results:');
    console.log(JSON.stringify(results, null, 2));
    
    console.log('\nA/B testing infrastructure test completed successfully!');
  } catch (error) {
    console.error('Error testing A/B testing infrastructure:', error);
  }
}

// Run the test
testABTesting();