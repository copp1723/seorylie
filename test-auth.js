#!/usr/bin/env node

// Simple authentication test script
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testAuth() {
  console.log('🔐 Testing Authentication Flow...\n');

  try {
    // Test 1: Try to access user endpoint without authentication
    console.log('1. Testing unauthenticated access to /api/user');
    const unauthResponse = await fetch(`${BASE_URL}/api/user`);
    console.log(`   Status: ${unauthResponse.status} ${unauthResponse.statusText}`);
    
    if (unauthResponse.status === 401) {
      console.log('   ✅ Correctly returns 401 for unauthenticated access\n');
    }

    // Test 2: Login with super admin credentials
    console.log('2. Testing login with super admin credentials');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    console.log(`   Status: ${loginResponse.status} ${loginResponse.statusText}`);
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('   ✅ Login successful!');
      console.log(`   User: ${loginData.username} (${loginData.role})`);
      console.log(`   Email: ${loginData.email}\n`);

      // Extract session cookie
      const cookies = loginResponse.headers.get('set-cookie');
      console.log('   Session cookie:', cookies ? 'Present' : 'Missing\n');

      // Test 3: Try authenticated request
      console.log('3. Testing authenticated access to /api/user');
      const authResponse = await fetch(`${BASE_URL}/api/user`, {
        headers: {
          'Cookie': cookies || ''
        }
      });

      console.log(`   Status: ${authResponse.status} ${authResponse.statusText}`);
      
      if (authResponse.ok) {
        const userData = await authResponse.json();
        console.log('   ✅ Authenticated access successful!');
        console.log(`   Current user: ${userData.username} (${userData.role})\n`);
      } else {
        console.log('   ❌ Authenticated access failed\n');
      }

    } else {
      const errorData = await loginResponse.json();
      console.log('   ❌ Login failed:', errorData.error);
      
      // Test with dealership admin credentials as fallback
      console.log('\n   Trying with dealership admin credentials...');
      const fallbackLoginResponse = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'admin_user',
          password: 'admin123'
        })
      });

      console.log(`   Status: ${fallbackLoginResponse.status} ${fallbackLoginResponse.statusText}`);
      
      if (fallbackLoginResponse.ok) {
        const fallbackData = await fallbackLoginResponse.json();
        console.log('   ✅ Dealership admin login successful!');
        console.log(`   User: ${fallbackData.username} (${fallbackData.role})\n`);
      } else {
        const fallbackError = await fallbackLoginResponse.json();
        console.log('   ❌ Dealership admin login failed:', fallbackError.error);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the development server is running: npm run dev');
  }
}

// Run the test
testAuth();