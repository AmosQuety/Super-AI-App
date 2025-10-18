// Create this file as: backend/src/test-custom-responses.ts
// Run it with: npx ts-node src/test-custom-responses.ts

import customResponses from './customResponses';

// Test function to check custom response matching
function testCustomResponse(input: string) {
  console.log(`\n--- Testing input: "${input}" ---`);
  
  const normalizedPrompt = input.toLowerCase().trim();
  console.log(`Normalized: "${normalizedPrompt}"`);
  
  // Check for exact matches first
  let customMessage = customResponses[normalizedPrompt];
  
  if (customMessage) {
    console.log(`✅ Found exact match: "${customMessage}"`);
    return customMessage;
  }
  
  // Try with trailing space
  customMessage = customResponses[normalizedPrompt + " "];
  if (customMessage) {
    console.log(`✅ Found with trailing space: "${customMessage}"`);
    return customMessage;
  }
  
  console.log(`❌ No custom response found`);
  console.log(`Available keys that start with "${normalizedPrompt.charAt(0)}":`, 
    Object.keys(customResponses).filter(key => key.startsWith(normalizedPrompt.charAt(0))));
  
  return null;
}

// Test cases
const testCases = [
  "Hello",
  "hello", 
  "HELLO",
  "hi",
  "what is your name",
  "How are you",
  "tell me a joke",
  "nonexistent prompt"
];

console.log("=== TESTING CUSTOM RESPONSES ===");
testCases.forEach(testCase => {
  testCustomResponse(testCase);
});

console.log("\n=== ALL AVAILABLE KEYS ===");
console.log(Object.keys(customResponses).sort());