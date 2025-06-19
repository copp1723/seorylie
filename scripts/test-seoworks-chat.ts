#!/usr/bin/env tsx

/**
 * Test script for SEOWerks Chat Assistant
 * Tests the chat responses with SEO-specific questions
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// SEOWerks system prompt (abbreviated for testing)
const SEOWORKS_PROMPT = `You are an expert SEO consultant assistant for SEOWerks, specializing in automotive dealership SEO.

Package Details:
- Silver: 3 pages, 3 blogs, 8 GBP posts, 8 SEO improvements monthly
- Gold: 5 pages, 6 blogs, 12 GBP posts, 10 SEO improvements monthly  
- Platinum: 9 pages, 12 blogs, 20 GBP posts, 20 SEO improvements monthly

Remember to be specific about package contents and SEO timelines.`;

async function testChatResponse(question: string) {
  console.log(`\n🤖 User: ${question}`);
  
  try {
    const response = await fetch(`${API_URL}/api/simple-prompt-test/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: SEOWORKS_PROMPT,
        customerMessage: question,
      }),
    });

    const result = await response.json();

    if (response.ok && result.aiResponse) {
      console.log(`💬 Assistant: ${result.aiResponse}`);
    } else {
      console.error('❌ Error:', result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function runTests() {
  console.log('🧪 Testing SEOWerks Chat Assistant\n');
  console.log('=' .repeat(50));

  // Test questions
  const testQuestions = [
    "What does my Gold package include?",
    "How long until I see SEO results?",
    "Why is my organic traffic down this month?",
    "What kind of content are you creating for my dealership?",
    "How do you track SEO performance?",
  ];

  for (const question of testQuestions) {
    await testChatResponse(question);
    console.log('-'.repeat(50));
  }
}

// Run the tests
runTests()
  .then(() => {
    console.log('\n✨ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });