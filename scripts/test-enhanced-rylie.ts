import fetch from 'node-fetch';
import { randomBytes } from 'crypto';

// Test script for trying out Rylie's enhanced conversational capabilities
// with the new style guide, links and handover functionality

async function testEnhancedRylie() {
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
        description: 'Test Key for Enhanced Rylie Demo'
      })
    });
    
    const apiKeyData = await apiKeyResponse.json();
    if (!apiKeyData || !apiKeyData.key) {
      console.error("Failed to generate API key.");
      return;
    }
    
    const apiKey = apiKeyData.key;
    console.log(`API Key generated: ${apiKey}`);
    
    // 3. Get or create a persona with the enhanced properties
    console.log("\nSetting up enhanced persona with links and handover email...");
    const personasResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/personas`);
    const personas = await personasResponse.json();
    
    let persona;
    if (personas && personas.length > 0) {
      persona = personas[0]; // Use the first persona
      console.log(`Using existing persona: ${persona.name}`);
    } else {
      console.error("No personas found. Make sure the database is seeded with at least one persona.");
      return;
    }
    
    // 4. Update the persona with our enhanced arguments
    console.log("\nUpdating persona with trade-in link, financing link, and handover email...");
    const updatePersonaResponse = await fetch(`http://localhost:5000/api/personas/${persona.id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        arguments: {
          ...persona.arguments,
          tone: "friendly and helpful",
          tradeInUrl: "https://www.example.com/trade-in",
          financingUrl: "https://www.example.com/financing",
          handoverEmail: "sales@example.com" // This would be the real sales email in production
        }
      })
    });
    
    // 5. Send an initial customer message
    console.log("\n----- CONVERSATION START -----");
    console.log("Sending initial customer message...");
    
    const initialMessage = "Hey there! I've been looking at SUVs for my growing family. We need something spacious but also good on gas.";
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
    
    // 6. Send a message about trade-ins to test URL inclusion
    console.log("\nSending message about trade-ins...");
    
    const tradeInMessage = "I have a 2018 Honda Civic I'd like to trade in. How does that process work?";
    console.log(`CUSTOMER: ${tradeInMessage}`);
    
    const tradeInResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Sarah Johnson',
        conversationId: conversationId,
        customerMessage: tradeInMessage,
        channel: 'sms'
      })
    });
    
    const tradeInData = await tradeInResponse.json();
    console.log(`RYLIE: ${tradeInData.response}`);
    
    // 7. Send a message about financing to test URL inclusion
    console.log("\nSending message about financing...");
    
    const financingMessage = "What kind of financing options do you offer for qualified buyers?";
    console.log(`CUSTOMER: ${financingMessage}`);
    
    const financingResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Sarah Johnson',
        conversationId: conversationId,
        customerMessage: financingMessage,
        channel: 'sms'
      })
    });
    
    const financingData = await financingResponse.json();
    console.log(`RYLIE: ${financingData.response}`);
    
    // 8. Send a message that should trigger handover and generate a dossier
    console.log("\nSending message that should trigger handover...");
    
    const handoverMessage = "I'm ready to buy! Can I come in today to sign the papers and drive home in my new SUV?";
    console.log(`CUSTOMER: ${handoverMessage}`);
    
    const handoverResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Sarah Johnson',
        conversationId: conversationId,
        customerMessage: handoverMessage,
        channel: 'sms'
      })
    });
    
    const handoverData = await handoverResponse.json();
    console.log(`RYLIE: ${handoverData.response}`);
    console.log(`Conversation Status: ${handoverData.status}`);
    
    if (handoverData.status === 'escalated') {
      console.log(`✅ Successfully detected high buying intent and escalated to human support.`);
      console.log(`✅ Handover reason: ${handoverData.handoverReason || 'Not specified'}`);
      console.log(`✅ A handover dossier email would have been sent to: sales@example.com`);
    }
    
    console.log("\n----- CONVERSATION END -----");
    console.log("\nTest completed successfully!");
    
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testEnhancedRylie();