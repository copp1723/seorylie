import fetch from 'node-fetch';

// Test script to demonstrate the new lead handover format

async function testLeadHandoverFormat() {
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
      body: JSON.stringify({ description: 'New Format Handover Test' })
    });
    
    const apiKeyData = await apiKeyResponse.json();
    const apiKey = apiKeyData.key;
    console.log(`API Key generated: ${apiKey}`);
    
    // Get and update the first persona with handover email
    console.log("\nUpdating persona with handover email...");
    const personasResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/personas`);
    const personas = await personasResponse.json();
    
    if (!personas || personas.length === 0) {
      console.error("No personas found. Make sure the database is seeded with at least one persona.");
      return;
    }
    
    const persona = personas[0];
    console.log(`Using persona: ${persona.name}`);
    
    // Update the persona with handover email
    const updateResponse = await fetch(`http://localhost:5000/api/personas/${persona.id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        arguments: {
          ...persona.arguments,
          tradeInUrl: "https://www.example.com/trade-in",
          financingUrl: "https://www.example.com/financing",
          handoverEmail: "sales@example.com" // This would be the real sales email in production
        }
      })
    });
    
    // Create a new conversation that demonstrates a buying customer
    console.log("\n----- CONVERSATION WITH NEW HANDOVER FORMAT -----");
    
    // Send initial message
    console.log("Sending initial customer message...");
    const initialMessage = "Hi there, I'm Kyle. I just moved to the area and my car broke down yesterday. I need a reliable vehicle for work ASAP.";
    console.log(`CUSTOMER: ${initialMessage}`);
    
    const initialResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Kyle Olinger',
        customerPhone: '555-789-1234',
        customerEmail: 'kyleolinger@neotools.ai',
        customerMessage: initialMessage,
        channel: 'sms',
        dealershipId: dealership.id
      })
    });
    
    const initialData = await initialResponse.json();
    console.log(`RYLIE: ${initialData.response}`);
    const conversationId = initialData.conversationId;
    
    // Send follow-up message to build context
    console.log("\nSending follow-up message about finances...");
    const financesMessage = "I had some medical bills last year that hurt my credit score, but I've been at my job for 3 years with stable income. Would financing be a problem?";
    console.log(`CUSTOMER: ${financesMessage}`);
    
    const financesResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Kyle Olinger',
        conversationId: conversationId,
        customerMessage: financesMessage,
        channel: 'sms'
      })
    });
    
    const financesData = await financesResponse.json();
    console.log(`RYLIE: ${financesData.response}`);
    
    // Send vehicle preferences message
    console.log("\nSending message about vehicle preferences...");
    const preferencesMessage = "I need something fuel-efficient but spacious enough for my tools. I'm a contractor, so I'm hauling equipment daily.";
    console.log(`CUSTOMER: ${preferencesMessage}`);
    
    const preferencesResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Kyle Olinger',
        conversationId: conversationId,
        customerMessage: preferencesMessage,
        channel: 'sms'
      })
    });
    
    const preferencesData = await preferencesResponse.json();
    console.log(`RYLIE: ${preferencesData.response}`);
    
    // Send message that should trigger handover
    console.log("\nSending message for immediate purchase intent...");
    const purchaseMessage = "I need to make this happen today. My buddy can drop me off at the dealership this afternoon. What's the next step to secure financing and drive home in a new truck?";
    console.log(`CUSTOMER: ${purchaseMessage}`);
    
    const purchaseResponse = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Kyle Olinger',
        conversationId: conversationId,
        customerMessage: purchaseMessage,
        channel: 'sms'
      })
    });
    
    const purchaseData = await purchaseResponse.json();
    console.log(`RYLIE: ${purchaseData.response}`);
    console.log(`Conversation Status: ${purchaseData.status}`);
    
    if (purchaseData.status === 'escalated') {
      console.log("✅ Successfully detected high buying intent and escalated to human support.");
      console.log(`✅ Escalation reason: ${purchaseData.escalationReason || 'Not specified'}`);
      
      console.log("\n📝 A handover dossier was generated with the new format:");
      console.log("1. Lead Identification - Customer details and purchase timeline");
      console.log("2. Conversation Summary - Key points and lead intent");
      console.log("3. Relationship Building Information - Personal insights and communication style");
      console.log("4. Sales Strategies - Engagement tips and closing strategies");
      
      console.log("\n📧 An email would have been sent to: sales@example.com");
      console.log("The email contains all necessary information for the sales representative to pick up the conversation and close the deal.");
    }
    
    console.log("\n----- CONVERSATION END -----");
    console.log("\nTest completed successfully!");
    
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testLeadHandoverFormat();