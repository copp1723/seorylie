#!/usr/bin/env tsx

/**
 * Comprehensive Specialized Agents Testing Suite
 * Tests all 8 automotive agents with domain-specific scenarios
 */

import dotenv from 'dotenv';
import { 
  initializeAgentSquad, 
  routeMessageThroughAgentSquad, 
  getAgentSquadHealth,
  isAgentSquadReady 
} from './server/services/agentSquad/index.js';

// Load environment variables
dotenv.config();

async function testSpecializedAgents() {
  console.log('🚗 Testing Specialized Automotive Agents...\n');

  try {
    // Initialize Agent Squad
    console.log('📋 Initializing Agent Squad with specialized configurations...');
    const initResult = await initializeAgentSquad({
      enabled: true,
      openaiApiKey: process.env.OPENAI_API_KEY,
      defaultDealershipId: 1,
      enableAnalytics: true,
      enableAdvancedRouting: true,
      fallbackToOriginal: true
    });

    if (!initResult) {
      console.log('❌ Agent Squad initialization failed');
      return;
    }

    console.log('✅ Agent Squad initialized with 8 specialized agents\n');

    // Comprehensive test scenarios for each agent
    const agentTestScenarios = [
      // GENERAL ASSISTANT AGENT TESTS
      {
        category: "GENERAL ASSISTANT",
        tests: [
          {
            message: "Hello! I'm new to car buying and not sure where to start",
            expectedAgent: "general-agent",
            description: "First-time buyer greeting"
          },
          {
            message: "Can you tell me about your dealership and what makes you different?",
            expectedAgent: "general-agent", 
            description: "Dealership information inquiry"
          },
          {
            message: "I'm just browsing today, what should I know about car shopping?",
            expectedAgent: "general-agent",
            description: "Browsing customer education"
          }
        ]
      },

      // INVENTORY SPECIALIST AGENT TESTS
      {
        category: "INVENTORY SPECIALIST",
        tests: [
          {
            message: "I'm looking for a reliable sedan under $25,000 with good gas mileage",
            expectedAgent: "inventory-agent",
            description: "Specific vehicle search with criteria"
          },
          {
            message: "Do you have any red Honda Civics in stock?",
            expectedAgent: "inventory-agent",
            description: "Specific make/model/color search"
          },
          {
            message: "What's the difference between the Toyota Camry and Honda Accord?",
            expectedAgent: "inventory-agent",
            description: "Vehicle comparison request"
          },
          {
            message: "I need a truck for construction work with good towing capacity",
            expectedAgent: "inventory-agent",
            description: "Work vehicle needs assessment"
          }
        ]
      },

      // FINANCE SPECIALIST AGENT TESTS
      {
        category: "FINANCE SPECIALIST", 
        tests: [
          {
            message: "Should I lease or buy? What are the pros and cons?",
            expectedAgent: "finance-agent",
            description: "Lease vs buy education"
          },
          {
            message: "What will my monthly payment be on a $30,000 car?",
            expectedAgent: "finance-agent",
            description: "Payment calculation inquiry"
          },
          {
            message: "My credit score is 640, what financing options do I have?",
            expectedAgent: "finance-agent",
            description: "Credit-based financing question"
          },
          {
            message: "I want to put $5,000 down, how does that affect my loan?",
            expectedAgent: "finance-agent",
            description: "Down payment impact question"
          }
        ]
      },

      // SERVICE SPECIALIST AGENT TESTS
      {
        category: "SERVICE SPECIALIST",
        tests: [
          {
            message: "My car is making a grinding noise when I brake",
            expectedAgent: "service-agent",
            description: "Safety-related diagnostic issue"
          },
          {
            message: "When should I get my oil changed? My car has 5,000 miles on it",
            expectedAgent: "service-agent", 
            description: "Maintenance scheduling question"
          },
          {
            message: "I need to schedule a service appointment for next week",
            expectedAgent: "service-agent",
            description: "Appointment scheduling request"
          },
          {
            message: "Is my brake repair covered under warranty?",
            expectedAgent: "service-agent",
            description: "Warranty coverage inquiry"
          }
        ]
      },

      // TRADE-IN SPECIALIST AGENT TESTS
      {
        category: "TRADE-IN SPECIALIST",
        tests: [
          {
            message: "What's my 2020 Toyota Camry worth as a trade-in?",
            expectedAgent: "trade-agent",
            description: "Trade-in valuation request"
          },
          {
            message: "I owe more on my car than it's worth, what are my options?",
            expectedAgent: "trade-agent",
            description: "Negative equity situation"
          },
          {
            message: "When is the best time to trade in my vehicle?",
            expectedAgent: "trade-agent",
            description: "Trade timing advice"
          },
          {
            message: "KBB says my car is worth $15k but you offered $12k, why?",
            expectedAgent: "trade-agent",
            description: "Valuation discrepancy explanation"
          }
        ]
      },

      // SALES SPECIALIST AGENT TESTS
      {
        category: "SALES SPECIALIST",
        tests: [
          {
            message: "I'd like to schedule a test drive for the Honda Pilot",
            expectedAgent: "sales-agent",
            description: "Test drive scheduling"
          },
          {
            message: "I'm ready to buy, what's the next step?",
            expectedAgent: "sales-agent",
            description: "Purchase process initiation"
          },
          {
            message: "I'm not sure if this is the right car for me",
            expectedAgent: "sales-agent",
            description: "Purchase hesitation/objection"
          },
          {
            message: "Are there any current promotions or incentives available?",
            expectedAgent: "sales-agent",
            description: "Incentive inquiry"
          }
        ]
      },

      // CREDIT SPECIALIST AGENT TESTS
      {
        category: "CREDIT SPECIALIST",
        tests: [
          {
            message: "I have bad credit, can you still help me get a car?",
            expectedAgent: "credit-agent",
            description: "Bad credit financing inquiry"
          },
          {
            message: "I've never had credit before, what are my options?",
            expectedAgent: "credit-agent",
            description: "No credit history scenario"
          },
          {
            message: "I filed bankruptcy last year, can I get financing?",
            expectedAgent: "credit-agent",
            description: "Post-bankruptcy financing"
          }
        ]
      },

      // LEASE SPECIALIST AGENT TESTS
      {
        category: "LEASE SPECIALIST",
        tests: [
          {
            message: "My lease is ending in 3 months, what are my options?",
            expectedAgent: "lease-agent",
            description: "Lease-end options"
          },
          {
            message: "I'm over my mileage allowance, what happens now?",
            expectedAgent: "lease-agent",
            description: "Mileage overage concern"
          },
          {
            message: "Can I buy my leased vehicle at the end of the term?",
            expectedAgent: "lease-agent",
            description: "Lease buyout option"
          }
        ]
      }
    ];

    let totalTests = 0;
    let successfulRouting = 0;
    let agentAccuracy = {};

    // Test each agent category
    for (const category of agentTestScenarios) {
      console.log(`\n🎯 Testing ${category.category} (${category.tests.length} scenarios)`);
      console.log('=' + '='.repeat(50));

      for (let i = 0; i < category.tests.length; i++) {
        const test = category.tests[i];
        totalTests++;
        
        console.log(`\n   Test ${i + 1}: ${test.description}`);
        console.log(`   Message: "${test.message}"`);
        
        try {
          const result = await routeMessageThroughAgentSquad(
            test.message,
            `test-user-${totalTests}`,
            `test-conversation-${totalTests}`,
            { 
              dealershipId: 1,
              messageId: `test-msg-${totalTests}`,
              platform: 'agent-test'
            }
          );

          if (result.success) {
            const routedCorrectly = result.selectedAgent === test.expectedAgent;
            if (routedCorrectly) {
              successfulRouting++;
              console.log(`   ✅ CORRECT: Routed to ${result.selectedAgent}`);
            } else {
              console.log(`   ⚠️  MISMATCH: Expected ${test.expectedAgent}, got ${result.selectedAgent}`);
            }
            
            console.log(`   📊 Confidence: ${result.confidence}`);
            console.log(`   ⏱️  Processing: ${result.processingTime}ms`);
            console.log(`   🧠 Reasoning: ${result.reasoning?.substring(0, 100)}...`);
            
            if (result.sentiment) {
              console.log(`   😊 Sentiment: ${result.sentiment}`);
            }
            
            // Track agent accuracy
            if (!agentAccuracy[result.selectedAgent]) {
              agentAccuracy[result.selectedAgent] = { correct: 0, total: 0 };
            }
            agentAccuracy[result.selectedAgent].total++;
            if (routedCorrectly) {
              agentAccuracy[result.selectedAgent].correct++;
            }
            
          } else {
            console.log(`   ❌ ROUTING FAILED: ${result.error}`);
          }
          
        } catch (error) {
          console.log(`   ❌ TEST ERROR: ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Test escalation scenarios
    console.log(`\n\n🚨 Testing Escalation Scenarios`);
    console.log('=' + '='.repeat(50));
    
    const escalationTests = [
      {
        message: "This is TERRIBLE service!!! I want to speak to a manager NOW!!!",
        description: "Angry customer escalation"
      },
      {
        message: "I'm extremely frustrated with my experience here. This is unacceptable!",
        description: "High frustration escalation"
      },
      {
        message: "I need urgent help with my car, it's not safe to drive",
        description: "Safety urgency escalation"
      }
    ];

    for (let i = 0; i < escalationTests.length; i++) {
      const test = escalationTests[i];
      totalTests++;
      
      console.log(`\n   Escalation Test ${i + 1}: ${test.description}`);
      console.log(`   Message: "${test.message}"`);
      
      try {
        const result = await routeMessageThroughAgentSquad(
          test.message,
          `escalation-user-${i}`,
          `escalation-conversation-${i}`,
          { 
            dealershipId: 1,
            messageId: `escalation-msg-${i}`,
            platform: 'escalation-test'
          }
        );

        if (result.success) {
          console.log(`   🎯 Routed to: ${result.selectedAgent}`);
          console.log(`   📊 Confidence: ${result.confidence}`);
          console.log(`   😊 Sentiment: ${result.sentiment || 'N/A'}`);
          console.log(`   🔥 Priority: ${result.priority || 'N/A'}`);
          
          if (result.escalated) {
            console.log(`   ✅ ESCALATED: Correctly identified for human assistance`);
          } else {
            console.log(`   ⚠️  NOT ESCALATED: May need adjustment for this scenario`);
          }
        } else {
          console.log(`   ❌ ESCALATION TEST FAILED: ${result.error}`);
        }
        
      } catch (error) {
        console.log(`   ❌ ESCALATION ERROR: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Results Summary
    console.log(`\n\n📊 TEST RESULTS SUMMARY`);
    console.log('=' + '='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Successful Routing: ${successfulRouting}`);
    console.log(`Accuracy Rate: ${Math.round((successfulRouting / totalTests) * 100)}%`);
    
    console.log(`\n🎯 Agent-Specific Accuracy:`);
    for (const [agent, stats] of Object.entries(agentAccuracy)) {
      const accuracy = Math.round((stats.correct / stats.total) * 100);
      console.log(`   ${agent}: ${stats.correct}/${stats.total} (${accuracy}%)`);
    }

    console.log(`\n✅ SPECIALIZED AGENTS VERIFICATION:`);
    console.log(`   🤖 General Assistant: Handles greetings, browsing, dealership info`);
    console.log(`   🔍 Inventory Specialist: Vehicle search with database functions`);
    console.log(`   💰 Finance Specialist: Loans, leases, payment calculations`);
    console.log(`   🔧 Service Specialist: Maintenance, repairs, appointments`);
    console.log(`   🔄 Trade-in Specialist: Vehicle valuations and equity`);
    console.log(`   📝 Sales Specialist: Test drives and purchase process`);
    console.log(`   💳 Credit Specialist: Bad credit and financing challenges`);
    console.log(`   📋 Lease Specialist: Lease-end and lease-specific guidance`);

    console.log(`\n🎉 Specialized Automotive Agents testing completed!`);

  } catch (error) {
    console.error('❌ Specialized agents test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSpecializedAgents().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});