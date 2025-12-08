// src/config/huggingface.ts
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.HUGGING_FACE_API_KEY;

// Diagnostic Logging
console.log('🔧 [HuggingFace Config] Initializing...');
console.log('  - API Key present:', !!apiKey);
console.log('  - API Key length:', apiKey?.length || 0);
console.log('  - Starts with hf_:', apiKey?.startsWith('hf_') || false);

// WORKING MODEL CONFIGURATION
// FLUX.1-schnell is:
// - Fast (1-4 inference steps)
// - Free to use
// - Apache 2.0 licensed (commercial use allowed)
// - High quality output
export const HUGGING_FACE_CONFIG = {
  API_KEY: apiKey || '',
  MODEL: 'black-forest-labs/FLUX.1-schnell',
  TIMEOUT: 120000,
  MAX_RETRIES: 3,
} as const;

export const IMAGE_GENERATION_CONFIG = {
  DEFAULT_WIDTH: 1024,  // FLUX works best at 1024x1024
  DEFAULT_HEIGHT: 1024,
  DEFAULT_STEPS: 4,     // FLUX.1-schnell optimized for 1-4 steps
  DEFAULT_GUIDANCE_SCALE: 0, // FLUX.1-schnell doesn't use guidance
  DEFAULT_NEGATIVE_PROMPT: 'blurry, low quality, distorted',
  MAX_PROMPT_LENGTH: 500,
} as const;

// Validation
if (!HUGGING_FACE_CONFIG.API_KEY) {
  console.error('❌ [HuggingFace Config] HUGGING_FACE_API_KEY is not set!');
  console.error('   Get your free API key from: https://huggingface.co/settings/tokens');
} else if (!HUGGING_FACE_CONFIG.API_KEY.startsWith('hf_')) {
  console.warn('⚠️  [HuggingFace Config] API key format may be incorrect');
} else {
  console.log('✅ [HuggingFace Config] Configuration loaded successfully');
  console.log(`   Using model: ${HUGGING_FACE_CONFIG.MODEL}`);
}