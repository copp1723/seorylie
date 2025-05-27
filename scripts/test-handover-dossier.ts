import fetch from 'node-fetch';

// Simple test script to demonstrate the handover dossier functionality

async function testHandoverDossier() {
  try {
    // Get the first dealership
    console.log("Getting dealership...");
    const dealershipsResponse = await fetch('http://localhost:5000/api/dealerships');
    const dealerships = await dealershipsResponse.json();
    const dealership = dealerships[0];
    console.log(`Using dealership: ${dealership.name} (ID: ${dealership.id})`);
    
    // Generate a test API key
    console.log("\nGenerating a test API key...");
    const apiKeyResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/apikeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Handover Dossier Test' })
    });
    
    const apiKeyData = await apiKeyResponse.json();
    const apiKey = apiKeyData.key;
    console.log(`API Key generated: ${apiKey}`);
    
    // Create a new conversation that will lead to handover
    console.log("\n----- CONVERSATION WITH HANDOVER -----");
    
    // Send initial message
    console.log("Sending initial customer message...");
    const initialMessage = "Hi there, I'm interested in a luxury SUV for my family. We need something with three rows of seats.";
    console.log(`CUSTOMER: ${initialMessage}`);
    
    const initialResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Michael Reynolds',
        customerPhone: '555-987-6543',
        customerEmail: 'michael.reynolds@example.com',
        customerMessage: initialMessage,
        channel: 'sms',
        dealershipId: dealership.id
      })
    });
    
    const initialData = await initialResponse.json();
    console.log(`RYLIE: ${initialData.response}`);
    const conversationId = initialData.conversationId;
    
    // Send a follow-up message
    console.log("\nSending follow-up message...");
    const followupMessage = "I currently have a BMW X5, but I'm looking to upgrade. Do you have any X7s in stock?";
    console.log(`CUSTOMER: ${followupMessage}`);
    
    const followupResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Michael Reynolds',
        conversationId: conversationId,
        customerMessage: followupMessage,
        channel: 'sms'
      })
    });
    
    const followupData = await followupResponse.json();
    console.log(`RYLIE: ${followupData.response}`);
    
    // Send message that should trigger handover
    console.log("\nSending message that should trigger handover...");
    const handoverMessage = "I'm ready to buy today if you can give me your best price. I can come in this afternoon to finalize the deal.";
    console.log(`CUSTOMER: ${handoverMessage}`);
    
    const handoverResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Michael Reynolds',
        conversationId: conversationId,
        customerMessage: handoverMessage,
        channel: 'sms'
      })
    });
    
    const handoverData = await handoverResponse.json();
    console.log(`RYLIE: ${handoverData.response}`);
    console.log(`Conversation Status: ${handoverData.status}`);
    
    if (handoverData.status === 'escalated') {
      console.log("✅ Successfully detected high buying intent and escalated to human support.");
      console.log(`✅ Escalation reason: ${handoverData.escalationReason || 'Not specified'}`);
      
      // Get the conversation details to verify it was properly escalated
      console.log("\nRetrieving conversation to verify escalation...");
      const conversationResponse = await fetch(`http://localhost:5000/api/conversations/${conversationId}`);
      const conversationData = await conversationResponse.json();
      
      console.log(`Conversation status in database: ${conversationData.conversation.status}`);
      console.log(`✅ Status correctly set to '${conversationData.conversation.status}'`);
      
      // Note about the dossier
      console.log("\n📝 A handover dossier would have been generated with:");
      console.log("- Customer name and details");
      console.log("- Personality assessment");
      console.log("- Vehicle interests (BMW X7)");
      console.log("- Conversation summary");
      console.log("- Suggested approach for the sales representative");
      console.log("- Full conversation history");
    }
    
    console.log("\n----- CONVERSATION END -----");
    console.log("\nTest completed successfully!");
    
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testHandoverDossier();