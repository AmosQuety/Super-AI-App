// Test script for gen.pollinations.ai API
// Run with: node testPollinationsAPI.js

const fetch = require('node-fetch');

const API_KEY = 'sk_EcQQaEnLAAUlaqCtktRib1K2OqO3uiKo';
const BASE_URL = 'https://gen.pollinations.ai/image';

async function testAPI() {
  console.log('🧪 Testing gen.pollinations.ai API\n');
  
  // Test 1: Simple prompt
  console.log('Test 1: Simple prompt "a cat"');
  const prompt1 = encodeURIComponent('a cat');
  const url1 = `${BASE_URL}/${prompt1}?width=512&height=512&model=flux`;
  
  console.log(`URL: ${url1}`);
  
  try {
    const response = await fetch(url1, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error body: ${errorText}`);
    } else {
      console.log('✅ Success! Image generated.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Complex prompt (like Ronaldo)
  console.log('Test 2: Complex prompt "Cristiano Ronaldo carrying a world cup trophy"');
  const prompt2 = encodeURIComponent('Cristiano Ronaldo carrying a world cup trophy');
  const url2 = `${BASE_URL}/${prompt2}?width=1024&height=1024&model=flux`;
  
  console.log(`URL: ${url2.substring(0, 120)}...`);
  
  try {
    const response = await fetch(url2, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error body: ${errorText}`);
    } else {
      console.log('✅ Success! Image generated.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: Check account balance
  console.log('Test 3: Check account balance');
  try {
    const balanceResponse = await fetch('https://gen.pollinations.ai/account/balance', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    console.log(`Status: ${balanceResponse.status}`);
    
    if (balanceResponse.ok) {
      const balance = await balanceResponse.json();
      console.log(`Pollen balance: ${JSON.stringify(balance)}`);
    } else {
      const errorText = await balanceResponse.text();
      console.log(`Error: ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI().catch(console.error);