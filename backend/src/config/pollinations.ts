// src/config/pollinations.ts
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration loaded from environment

// POLLINATIONS.AI CONFIGURATION
// ✅ Using authenticated gen.pollinations.ai API (no rate limits with secret key)
// Get your key at: https://enter.pollinations.ai
export const POLLINATIONS_CONFIG = {
  BASE_URL: 'https://gen.pollinations.ai/image',
  API_KEY: process.env.POLLINATIONS_API_KEY || '', // REQUIRED for gen.pollinations.ai
  MODEL: 'flux', // flux, turbo, gptimage, kontext, seedream, etc.
  TIMEOUT: 120000,
  MAX_RETRIES: 2,
} as const;

export const IMAGE_GENERATION_CONFIG = {
  DEFAULT_WIDTH: 1024,
  DEFAULT_HEIGHT: 1024,
  DEFAULT_NEGATIVE_PROMPT: 'blurry, low quality, distorted, watermark',
  MAX_PROMPT_LENGTH: 500,
  MAX_IMAGES_PER_REQUEST: 4,
} as const;

