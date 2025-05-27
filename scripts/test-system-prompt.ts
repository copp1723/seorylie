/**
 * Test script for checking the system prompt integration
 * This script simulates a basic conversation using the new centralized system prompt
 */
import OpenAI from 'openai';
import * as readline from 'readline';
import { DEFAULT_SYSTEM_PROMPT } from '../server/services/system-prompts/default';

// Initialize readline interface for testing in the console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Basic prompt function
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Process a customer message using the system prompt
 */
async function processChatMessage(
  customerMessage: string, 
  customerName: string = 'Customer', 
  productInventory: string = 'Sample inventory: 2024 Toyota RAV4 Hybrid, 2023 Honda Civic, 2024 Ford F-150'
) {
  // Replace placeholders in the system prompt
  let systemPrompt = DEFAULT_SYSTEM_PROMPT
    .replace('[ARG-Agent Name]', 'Rylie')
    .replace('[ARG-Employer Name]', 'PureCars Dealership')
    .replace('[ARG-Information About Employer]', 'A family-owned dealership since 1987')
    .replace('[ARG-Products]', 'New and certified pre-owned vehicles')
    .replace('[ARG-Employer Contact Details]', 'Phone: 555-123-4567, Email: sales@purecars.example.com')
    .replace('[ARG-Name]', 'Alex')
    .replace('[ARG-Contact Details]', 'Phone: 555-987-6543')
    .replace('[INPUT-Product Inventory]', productInventory)
    .replace('[INPUT-CUSTOMER NAME]', customerName)
    .replace('[INPUT-CONVERSATION]', 'No previous conversation');

  try {
    // Call OpenAI API with the system prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Use the latest OpenAI model (gpt-4o) which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: customerMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    // Parse the JSON response
    const content = completion.choices[0].message.content;
    if (!content) {
      console.error('Error: Empty response from OpenAI');
      return 'Error: Could not generate response';
    }

    try {
      const response = JSON.parse(content);
      
      // Display the full JSON response for debugging
      console.log('\n--- Full JSON Response ---');
      console.log(JSON.stringify(response, null, 2));
      console.log('-------------------------\n');
      
      // Return the formatted answer from the JSON response
      return response.answer || 'No answer field in response';
    } catch (error) {
      console.error('Error parsing response JSON:', error);
      console.log('Raw response:', content);
      return content;
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return 'Error: Could not generate response';
  }
}

/**
 * Run an interactive test session
 */
async function runInteractiveTest() {
  console.log('=== Rylie AI System Prompt Tester ===');
  console.log('Type your message as a customer to test the system prompt.');
  console.log('Type "exit" to quit.\n');

  let customerName = await prompt('Enter customer name (default: "Customer"): ');
  if (!customerName) customerName = 'Customer';

  while (true) {
    console.log('\n----------------------------\n');
    const customerMessage = await prompt('Customer: ');
    
    if (customerMessage.toLowerCase() === 'exit') {
      break;
    }
    
    console.log('\nProcessing...\n');
    const response = await processChatMessage(customerMessage, customerName);
    console.log('Rylie AI Response:');
    console.log(response);
  }

  rl.close();
  console.log('\nTest completed. Goodbye!');
}

/**
 * Run automated tests with predefined messages
 */
async function runAutomatedTest() {
  console.log('=== Rylie AI Automated System Prompt Tests ===');
  
  const testMessages = [
    "I'm looking for a new car. What do you recommend?",
    "How much is the 2024 Toyota RAV4?",
    "Can I get financing for a Honda Civic?",
    "Do you have any electric vehicles?",
    "¿Tienen autos usados disponibles ahora?", // Spanish: "Do you have used cars available now?"
  ];
  
  for (let i = 0; i < testMessages.length; i++) {
    console.log(`\n=== Test Case ${i+1}: "${testMessages[i]}" ===`);
    const response = await processChatMessage(testMessages[i]);
    console.log('Rylie AI Response:');
    console.log(response);
    console.log('===========================\n');
  }
  
  console.log('All automated tests completed.');
}

/**
 * Main function
 */
async function main() {
  console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    console.log('Please set the OPENAI_API_KEY environment variable and try again.');
    process.exit(1);
  }
  
  const mode = await prompt('Choose test mode (1 for interactive, 2 for automated): ');
  
  if (mode === '1') {
    await runInteractiveTest();
  } else if (mode === '2') {
    await runAutomatedTest();
  } else {
    console.log('Invalid mode. Exiting.');
  }
}

// Run the main function
main().catch(error => {
  console.error('Error running test:', error);
});