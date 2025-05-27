import fetch from 'node-fetch';
import { randomBytes } from 'crypto';

// Simple test script to try out Rylie's conversational capabilities

async function testRylie() {
  try {
    // 1. First, get a list of dealerships
    console.log("Getting dealerships...");
    const dealershipsResponse = await fetch('http://localhost:5000/api/dealerships');
    const dealerships = await dealershipsResponse.json();
    
    if (!dealerships || dealerships.length === 0) {
      console.error("No dealerships found. Make sure the database is seeded.");
      return;
    }
    
    const dealership = dealerships[0]; // Use the first dealership
    console.log(`Using dealership: ${dealership.name} (ID: ${dealership.id})`);
    
    // 2. Create a test API key for this dealership
    console.log("\nGenerating a test API key...");
    const apiKeyResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/apikeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Test Key for Rylie Demo'
      })
    });
    
    const apiKeyData = await apiKeyResponse.json();
    if (!apiKeyData || !apiKeyData.key) {
      console.error("Failed to generate API key.");
      return;
    }
    
    const apiKey = apiKeyData.key;
    console.log(`API Key generated: ${apiKey}`);
    
    // 3. Send an initial customer message
    console.log("\n----- CONVERSATION START -----");
    console.log("Sending initial customer message...");
    
    const initialMessage = "Hi there, I'm looking for a family SUV with good safety features. Can you help me?";
    console.log(`CUSTOMER: ${initialMessage}`);
    
    const inboundResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Sarah Johnson',
        customerPhone: '555-123-4567',
        customerEmail: 'sarah.johnson@example.com',
        customerMessage: initialMessage,
        channel: 'sms',
        dealershipId: dealership.id,
        campaignContext: 'Family SUV Campaign 2025'
      })
    });
    
    const inboundData = await inboundResponse.json();
    
    if (!inboundData || !inboundData.response) {
      console.error("Failed to get response from Rylie.");
      return;
    }
    
    console.log(`RYLIE: ${inboundData.response}`);
    
    if (!inboundData.conversationId) {
      console.error("No conversation ID returned.");
      return;
    }
    
    const conversationId = inboundData.conversationId;
    
    // 4. Send a follow-up message
    console.log("\nSending follow-up customer message...");
    
    const followUpMessage = "I'm particularly interested in the Toyota RAV4. Does it have all-wheel drive?";
    console.log(`CUSTOMER: ${followUpMessage}`);
    
    const followUpResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Sarah Johnson',
        conversationId: conversationId,
        customerMessage: followUpMessage,
        channel: 'sms'
      })
    });
    
    const followUpData = await followUpResponse.json();
    
    if (!followUpData || !followUpData.response) {
      console.error("Failed to get follow-up response from Rylie.");
      return;
    }
    
    console.log(`RYLIE: ${followUpData.response}`);
    
    // 5. Send a message that should trigger escalation
    console.log("\nSending message that should trigger escalation...");
    
    const escalationMessage = "What's the best financing deal you can offer me on this RAV4?";
    console.log(`CUSTOMER: ${escalationMessage}`);
    
    const escalationResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Sarah Johnson',
        conversationId: conversationId,
        customerMessage: escalationMessage,
        channel: 'sms'
      })
    });
    
    const escalationData = await escalationResponse.json();
    
    if (!escalationData || !escalationData.response) {
      console.error("Failed to get escalation response from Rylie.");
      return;
    }
    
    console.log(`RYLIE: ${escalationData.response}`);
    console.log(`Conversation Status: ${escalationData.status}`);
    
    if (escalationData.status === 'escalated') {
      console.log("✅ Successfully detected financing question and escalated to human support.");
    }
    
    console.log("\n----- CONVERSATION END -----");
    console.log("\nTest completed successfully!");
    
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testRylie();