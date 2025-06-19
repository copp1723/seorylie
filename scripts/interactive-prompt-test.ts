/**
 * Interactive prompt testing script
 * This script provides a simple way to test the system prompt directly
 * without needing the full application running
 */
import OpenAI from "openai";
import readline from "readline";
import { DEFAULT_SYSTEM_PROMPT } from "../server/services/system-prompts/default";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Sample inventory for testing
const SAMPLE_INVENTORY = `
- 2024 Toyota RAV4 Hybrid XLE (Silver): AWD, 2.5L Hybrid Engine, 41 MPG City/38 Highway, Leather Seats, Sunroof, $34,995
- 2023 Honda Civic EX (Blue): FWD, 1.5L Turbo Engine, 33 MPG City/42 Highway, Android Auto/Apple CarPlay, $26,450
- 2024 Ford F-150 XLT (Black): 4x4, 3.5L EcoBoost, Leather Interior, Navigation, Towing Package, $48,995
- 2022 Chevrolet Equinox LT (White): FWD, 1.5L Turbo, Heated Seats, Remote Start, Teen Driver Technology, $27,500
- 2023 Tesla Model Y (Red): AWD, Dual Motor, 330 Mile Range, Premium Interior, 15" Touchscreen, Autopilot, $59,990
`;

// Function to format JSON for display
function formatJSON(json: any): string {
  return JSON.stringify(json, null, 2);
}

/**
 * Process a customer message using the new system prompt
 */
async function processChatMessage(
  customerMessage: string,
  customerName: string = "Customer",
) {
  // Create OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("\n--- Processing customer message ---");

  // Format the system prompt with test values
  const formattedPrompt = DEFAULT_SYSTEM_PROMPT.replace(
    "[ARG-Agent Name]",
    "Rylie",
  )
    .replace("[ARG-Employer Name]", "PureCars Dealership")
    .replace(
      "[ARG-Information About Employer]",
      "A family-owned dealership since 1987",
    )
    .replace("[ARG-Products]", "New and certified pre-owned vehicles")
    .replace(
      "[ARG-Employer Contact Details]",
      "Phone: 555-123-4567, Email: sales@purecars.example.com",
    )
    .replace("[ARG-Name]", "Alex")
    .replace("[ARG-Contact Details]", "Phone: 555-987-6543")
    .replace("[INPUT-Product Inventory]", SAMPLE_INVENTORY)
    .replace("[INPUT-CUSTOMER NAME]", customerName)
    .replace("[INPUT-CONVERSATION]", "No previous conversation");

  try {
    console.log("Calling OpenAI API...");
    const startTime = Date.now();

    // Call OpenAI with the formatted system prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: formattedPrompt,
        },
        {
          role: "user",
          content: customerMessage,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const responseTime = Date.now() - startTime;
    console.log(`Response received in ${responseTime}ms`);

    // Extract the response content
    const responseContent = completion.choices[0].message.content;

    if (!responseContent) {
      console.error("Error: Empty response from OpenAI");
      return;
    }

    try {
      // Parse and display the JSON response
      const jsonResponse = JSON.parse(responseContent);

      console.log("\n=== RESPONSE ===\n");
      console.log(jsonResponse.answer);

      console.log("\n=== ANALYTICS ===");
      console.log(`Sales Readiness: ${jsonResponse.sales_readiness}`);
      console.log(`Message Type: ${jsonResponse.type}`);
      console.log(`Quick Insights: ${jsonResponse.quick_insights}`);

      console.log("\n=== FULL JSON RESPONSE ===");
      console.log(formatJSON(jsonResponse));

      return jsonResponse;
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      console.log("Raw response:", responseContent);
    }
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
  }
}

/**
 * Run the interactive test session
 */
async function runInteractiveTest() {
  console.log("\n====================================");
  console.log("RYLIE AI SYSTEM PROMPT INTERACTIVE TESTER");
  console.log("====================================\n");
  console.log("This tool lets you test the updated system prompt directly.");
  console.log(
    "Type your message as if you were a customer contacting the dealership.",
  );
  console.log('Type "exit" to quit.\n');

  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OpenAI API key not found in environment variables.");
    console.log("Please make sure OPENAI_API_KEY is set in your .env file.");
    rl.close();
    return;
  }

  // Set initial customer name
  let customerName = "Customer";

  // Ask for customer name
  rl.question(
    "Enter a customer name for the test (or press Enter for default): ",
    (name) => {
      if (name && name.trim() !== "") {
        customerName = name.trim();
      }

      console.log(
        `\nWelcome, ${customerName}! What would you like to ask about our vehicles?\n`,
      );

      // Start the message loop
      askForMessage();
    },
  );

  // Function to ask for the next message
  function askForMessage() {
    rl.question("Your message: ", async (input) => {
      // Check for exit command
      if (input.toLowerCase() === "exit") {
        console.log("\nThank you for testing the updated system prompt!");
        rl.close();
        return;
      }

      // Process the message
      await processChatMessage(input, customerName);

      // Ask for the next message
      askForMessage();
    });
  }
}

// Start the interactive test
runInteractiveTest();
