import fetch from 'node-fetch';

// Helper function to generate a random API key for testing
// In a real scenario, we would use actual API keys from the database
const generateTestKey = async (dealershipId: number) => {
  try {
    const response = await fetch(`http://localhost:5000/api/dealerships/${dealershipId}/apikeys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Test Key for API Testing'
      })
    });
    
    const data = await response.json();
    return data.key;
  } catch (error) {
    console.error('Error generating test API key:', error);
    return null;
  }
};

// Test the inbound message endpoint
const testInboundMessage = async (apiKey: string, dealershipId: number) => {
  console.log('\n----- Testing /api/inbound endpoint -----');
  try {
    const response = await fetch('http://localhost:5000/api/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        customerName: 'Sarah Miller',
        customerPhone: '555-987-6543',
        customerMessage: 'Hi, I saw your ad for the Toyota RAV4. Is it still available?',
        channel: 'sms',
        dealershipId: dealershipId,
        campaignContext: 'Summer SUV Sale - 20% off Toyota models'
      })
    });

    const data = await response.json();
    console.log('Inbound Message Response:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error testing inbound message:', error);
    return null;
  }
};

// Test the reply endpoint with a follow-up message
const testReplyEndpoint = async (apiKey: string, conversationId: number) => {
  console.log('\n----- Testing /api/reply endpoint -----');
  try {
    const response = await fetch('http://localhost:5000/api/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        conversationId,
        message: 'Does it have all-wheel drive? And what color options are available?'
      })
    });

    const data = await response.json();
    console.log('Reply Endpoint Response:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error testing reply endpoint:', error);
    return null;
  }
};

// Test the handover endpoint
const testHandoverEndpoint = async (apiKey: string, conversationId: number) => {
  console.log('\n----- Testing /api/handover endpoint -----');
  try {
    const response = await fetch('http://localhost:5000/api/handover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        conversationId,
        reason: 'Customer requested to speak with a human agent',
        assignToUserId: 1 // Admin user ID
      })
    });

    const data = await response.json();
    console.log('Handover Endpoint Response:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error testing handover endpoint:', error);
    return null;
  }
};

// Main function to run the tests
const runTests = async () => {
  // Florida Motors dealership ID = 1
  const dealershipId = 1;
  
  // Step 1: Generate a test API key
  console.log(`Generating test API key for dealership ID ${dealershipId}...`);
  const apiKey = await generateTestKey(dealershipId);
  
  if (!apiKey) {
    console.error('Failed to generate an API key. Exiting tests.');
    return;
  }
  
  console.log(`Test API key generated: ${apiKey}`);
  
  // Step 2: Test the inbound message endpoint
  const inboundResult = await testInboundMessage(apiKey, dealershipId);
  
  if (!inboundResult || !inboundResult.conversationId) {
    console.error('Inbound message test failed. Exiting tests.');
    return;
  }
  
  const conversationId = inboundResult.conversationId;
  console.log(`Created conversation with ID: ${conversationId}`);
  
  // Step 3: Test the reply endpoint
  const replyResult = await testReplyEndpoint(apiKey, conversationId);
  
  if (!replyResult) {
    console.error('Reply endpoint test failed.');
  }
  
  // Step 4: Test the handover endpoint
  const handoverResult = await testHandoverEndpoint(apiKey, conversationId);
  
  if (!handoverResult) {
    console.error('Handover endpoint test failed.');
  }
  
  console.log('\n----- All tests completed -----');
};

// Run the tests
runTests();