// src/config/huggingface.ts
import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

const apiKey = process.env.HUGGING_FACE_API_KEY;

logger.debug('[huggingface] initializing config');

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
  logger.warn('[huggingface] API key is not configured');
} else if (!HUGGING_FACE_CONFIG.API_KEY.startsWith('hf_')) {
  logger.warn('[huggingface] API key format may be incorrect');
} else {
  logger.debug('[huggingface] configuration loaded');
}