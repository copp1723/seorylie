import fetch from 'node-fetch';

// Retrieve API key from database
async function getApiKey() {
  try {
    const response = await fetch('http://localhost:5000/api/dealerships/1/apikeys');
    const apiKeys = await response.json();
    return apiKeys[0]?.key || null;
  } catch (error) {
    console.error('Error fetching API key:', error);
    return null;
  }
}

// Test the inbound message endpoint
async function testInboundMessage(apiKey: string) {
  console.log('\n----- Testing /api/inbound endpoint -----');
  try {
    const response = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'John Doe',
        customerPhone: '555-123-4567',
        customerMessage: 'Hi, I\'m interested in the Toyota RAV4. Can you tell me more about it?',
        channel: 'sms',
        campaignContext: 'Summer Sale Campaign - Toyota SUVs'
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error testing inbound message:', error);
    return null;
  }
}

// Main function to run the tests
async function runTests() {
  // First, we need to get an API key
  console.log('Fetching API key...');
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    console.error('Failed to retrieve an API key. Make sure the server is running and the database is seeded.');
    return;
  }
  
  console.log(`Using API key: ${apiKey}`);
  
  // Test the inbound message endpoint
  const inboundResult = await testInboundMessage(apiKey);
  
  if (inboundResult && inboundResult.conversationId) {
    // If you want to add more test cases, you can do so here
    console.log('\nAll tests completed successfully!');
  } else {
    console.error('Tests failed to complete.');
  }
}

// Run the tests
runTests();