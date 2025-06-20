#!/usr/bin/env node

const http = require('http');

async function testAPI() {
  console.log('🧪 Quick Alpha Test');
  
  // Test 1: Health Check
  console.log('\n1. Testing Health Check...');
  try {
    const response = await makeRequest('http://localhost:10000/health');
    if (response.includes('ok')) {
      console.log('✅ Health check passed');
    } else {
      console.log('❌ Health check failed');
    }
  } catch (e) {
    console.log('❌ Server not responding');
    return;
  }
  
  // Test 2: Authentication
  console.log('\n2. Testing Authentication...');
  try {
    const authResponse = await makePostRequest('http://localhost:10000/api/auth/login', {
      email: 'admin@alphatest.com',
      password: 'TestPass123!'
    });
    
    const auth = JSON.parse(authResponse);
    if (auth.token) {
      console.log('✅ Authentication passed');
      console.log(`   User: ${auth.user.name} (${auth.user.email})`);
      
      // Test 3: Task Status
      console.log('\n3. Testing Task Status API...');
      const taskResponse = await makeAuthRequest('http://localhost:10000/api/seoworks/task-status', auth.token);
      const tasks = JSON.parse(taskResponse);
      if (tasks.tasks) {
        console.log(`✅ Task Status API passed (${tasks.tasks.length} tasks)`);
      } else {
        console.log('❌ Task Status API failed');
      }
      
      // Test 4: Chat Message
      console.log('\n4. Testing Chat Message...');
      const chatResponse = await makeAuthPostRequest('http://localhost:10000/api/chat/message', {
        message: 'What is the status of my SEO tasks?',
        conversation_id: 'quick-test-001'
      }, auth.token);
      
      const chat = JSON.parse(chatResponse);
      if (chat.response) {
        console.log('✅ Chat Message API passed');
        console.log(`   Response: ${chat.response.substring(0, 100)}...`);
      } else {
        console.log('❌ Chat Message API failed');
      }
      
    } else {
      console.log('❌ Authentication failed');
    }
  } catch (e) {
    console.log(`❌ Test failed: ${e.message}`);
  }
  
  console.log('\n🏁 Quick test complete!');
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function makePostRequest(url, body) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    options.method = 'POST';
    options.headers = {
      'Content-Type': 'application/json'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function makeAuthRequest(url, token) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    options.headers = {
      'Authorization': `Bearer ${token}`
    };
    
    http.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function makeAuthPostRequest(url, body, token) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    options.method = 'POST';
    options.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

testAPI().catch(console.error);

