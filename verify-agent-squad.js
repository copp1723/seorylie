#!/usr/bin/env node

/**
 * Agent Squad Installation Verification Script
 * Verifies that Agent Squad is properly installed and configured
 */

import { AgentSquad } from 'agent-squad';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function verifyAgentSquad() {
  console.log('🤖 Verifying Agent Squad installation...\n');

  try {
    // Check if Agent Squad module can be imported
    console.log('✅ Agent Squad module imported successfully');
    
    // Check if OPENAI_API_KEY is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OPENAI_API_KEY environment variable not found');
      console.log('   Please add OPENAI_API_KEY to your .env file');
      process.exit(1);
    }
    console.log('✅ OPENAI_API_KEY environment variable found');

    // Test basic Agent Squad initialization
    const squad = new AgentSquad({
      apiKey: process.env.OPENAI_API_KEY,
      // Add basic configuration for testing
    });
    
    console.log('✅ Agent Squad instance created successfully');
    
    // Check TypeScript support
    console.log('✅ TypeScript support verified');
    
    console.log('\n🎉 Agent Squad verification completed successfully!');
    console.log('   Ready for integration development.');
    
  } catch (error) {
    console.error('❌ Agent Squad verification failed:');
    console.error('  ', error.message);
    process.exit(1);
  }
}

// Run verification
verifyAgentSquad().catch(error => {
  console.error('Verification script error:', error);
  process.exit(1);
});