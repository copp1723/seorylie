/**
 * Test script to simulate PureCars API integration
 * This script allows testing of the API endpoints with dealer ID and conversation flow
 */
import fetch from 'node-fetch';
import readline from 'readline';
import { randomUUID } from 'crypto';

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration for the test
const config = {
  apiUrl: 'http://localhost:5000/api',
  apiKey: '',
  dealerId: '',
  customerName: 'Test Customer',
  customerPhone: '+15555555555',
  customerEmail: 'test@example.com',
  customerId: randomUUID()
};

// Helper to prompt for input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

// Helper to make API requests
async function apiRequest(endpoint: string, method = 'GET', body?: any) {
  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      console.error(data);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('API Request failed:', error);
    return null;
  }
}

// Test the inbound message endpoint
async function testInboundMessage(message: string) {
  console.log(`\nSending inbound message: "${message}"`);
  
  const payload = {
    dealerId: config.dealerId,
    customerName: config.customerName,
    customerPhone: config.customerPhone,
    customerEmail: config.customerEmail,
    customerId: config.customerId,
    message: message,
    channel: 'test'
  };
  
  const response = await apiRequest('/inbound', 'POST', payload);
  
  if (response) {
    console.log('\nResponse:');
    console.log(JSON.stringify(response, null, 2));
    return response;
  }
  
  return null;
}

// Test reply to an existing conversation
async function testReply(conversationId: number, message: string) {
  console.log(`\nSending reply to conversation ${conversationId}: "${message}"`);
  
  const payload = {
    dealerId: config.dealerId,
    conversationId: conversationId,
    message: message,
    channel: 'test'
  };
  
  const response = await apiRequest('/reply', 'POST', payload);
  
  if (response) {
    console.log('\nResponse:');
    console.log(JSON.stringify(response, null, 2));
    return response;
  }
  
  return null;
}

// Test manual handover
async function testHandover(conversationId: number, reason: string) {
  console.log(`\nTriggering manual handover for conversation ${conversationId}`);
  
  const payload = {
    dealerId: config.dealerId,
    conversationId: conversationId,
    reason: reason
  };
  
  const response = await apiRequest('/handover', 'POST', payload);
  
  if (response) {
    console.log('\nHandover dossier:');
    console.log(JSON.stringify(response.handoverDossier, null, 2));
    return response;
  }
  
  return null;
}

// Test getting conversation history
async function testGetConversation(conversationId: number) {
  console.log(`\nFetching conversation history for ID ${conversationId}`);
  
  const response = await apiRequest(`/conversations/${conversationId}?dealerId=${config.dealerId}`);
  
  if (response) {
    console.log('\nConversation history:');
    console.log(JSON.stringify(response, null, 2));
    return response;
  }
  
  return null;
}

// Test getting dealer configuration
async function testGetDealerConfig() {
  console.log(`\nFetching configuration for dealer ID ${config.dealerId}`);
  
  const response = await apiRequest(`/dealers/${config.dealerId}/config`);
  
  if (response) {
    console.log('\nDealer configuration:');
    console.log(JSON.stringify(response, null, 2));
    return response;
  }
  
  return null;
}

// Interactive test menu
async function runInteractiveTest() {
  try {
    console.log('=== PureCars Integration Test Tool ===\n');
    
    // Get configuration
    config.apiKey = await prompt('Enter your API key: ');
    config.dealerId = await prompt('Enter the dealer ID: ');
    
    let running = true;
    let currentConversationId: number | null = null;
    
    while (running) {
      console.log('\n=== Test Menu ===');
      console.log('1. Start new conversation');
      console.log('2. Send reply (requires active conversation)');
      console.log('3. Trigger manual handover (requires active conversation)');
      console.log('4. View conversation history (requires active conversation)');
      console.log('5. View dealer configuration');
      console.log('6. Change dealer ID');
      console.log('7. Exit');
      
      const choice = await prompt('\nSelect an option (1-7): ');
      
      switch (choice) {
        case '1':
          const initialMessage = await prompt('Enter customer message: ');
          const response = await testInboundMessage(initialMessage);
          if (response) {
            currentConversationId = response.conversationId;
          }
          break;
          
        case '2':
          if (!currentConversationId) {
            console.log('No active conversation. Please start a new conversation first.');
            break;
          }
          
          const replyMessage = await prompt('Enter reply message: ');
          await testReply(currentConversationId, replyMessage);
          break;
          
        case '3':
          if (!currentConversationId) {
            console.log('No active conversation. Please start a new conversation first.');
            break;
          }
          
          const handoverReason = await prompt('Enter handover reason: ');
          await testHandover(currentConversationId, handoverReason);
          break;
          
        case '4':
          if (!currentConversationId) {
            console.log('No active conversation. Please start a new conversation first.');
            break;
          }
          
          await testGetConversation(currentConversationId);
          break;
          
        case '5':
          await testGetDealerConfig();
          break;
          
        case '6':
          config.dealerId = await prompt('Enter new dealer ID: ');
          currentConversationId = null;
          console.log(`Dealer ID changed to ${config.dealerId}. Any active conversation has been cleared.`);
          break;
          
        case '7':
          running = false;
          break;
          
        default:
          console.log('Invalid choice. Please select a number between 1 and 7.');
      }
    }
    
    console.log('\nExiting test tool. Goodbye!');
    rl.close();
    
  } catch (error) {
    console.error('Error running test:', error);
    rl.close();
  }
}

// Simple automated test of the conversation flow
async function runAutomatedTest() {
  try {
    console.log('=== Running Automated PureCars Integration Test ===\n');
    
    // Get configuration
    config.apiKey = await prompt('Enter your API key: ');
    config.dealerId = await prompt('Enter the dealer ID: ');
    
    // Step 1: Start a new conversation
    console.log('\nStep 1: Starting a new conversation');
    const initialMessage = "Hi, I'm interested in your SUV models. Do you have anything with good gas mileage?";
    const initialResponse = await testInboundMessage(initialMessage);
    
    if (!initialResponse) {
      console.error('Failed to start conversation. Exiting test.');
      rl.close();
      return;
    }
    
    const conversationId = initialResponse.conversationId;
    
    // Step 2: Send a follow-up message
    console.log('\nStep 2: Sending a follow-up message');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay for readability
    
    const followUpMessage = "I'd prefer something that's not too big, maybe a compact SUV. What's your price range?";
    const followUpResponse = await testReply(conversationId, followUpMessage);
    
    if (!followUpResponse) {
      console.error('Failed to send follow-up message. Exiting test.');
      rl.close();
      return;
    }
    
    // Step 3: Send a message that should trigger handover
    console.log('\nStep 3: Sending a message that should trigger handover');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay for readability
    
    const handoverMessage = "Actually, I'd like to speak with a sales representative about financing options and test drive scheduling.";
    const handoverResponse = await testReply(conversationId, handoverMessage);
    
    // Check if handover was triggered automatically
    if (handoverResponse && handoverResponse.status === 'escalated') {
      console.log('\nAutomatic handover was triggered successfully!');
    } else {
      // If not, trigger a manual handover
      console.log('\nAutomatic handover was not triggered. Testing manual handover...');
      
      const manualHandoverResponse = await testHandover(conversationId, 'Customer requested to speak with sales rep');
      
      if (manualHandoverResponse) {
        console.log('\nManual handover successful!');
      }
    }
    
    // Step 4: View the conversation history
    console.log('\nStep 4: Viewing conversation history');
    await testGetConversation(conversationId);
    
    // Step 5: View dealer configuration
    console.log('\nStep 5: Viewing dealer configuration');
    await testGetDealerConfig();
    
    console.log('\nAutomated test completed successfully!');
    rl.close();
    
  } catch (error) {
    console.error('Error running automated test:', error);
    rl.close();
  }
}

// Main function
async function main() {
  const testType = await prompt('Run interactive test or automated test? (i/a): ');
  
  if (testType.toLowerCase() === 'i') {
    await runInteractiveTest();
  } else if (testType.toLowerCase() === 'a') {
    await runAutomatedTest();
  } else {
    console.log('Invalid choice. Exiting.');
    rl.close();
  }
}

// Run the main function
main();