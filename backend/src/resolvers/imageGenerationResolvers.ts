// src/resolvers/imageGenerationResolvers.ts
import { logger } from '../utils/logger';
import { IMAGE_GENERATION_CONFIG } from '../config/huggingface';

// Simple in-memory rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (userId: string, limit = 10, windowMs = 60000): boolean => {
  const key = `img_gen_${userId}`;
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  const userData = rateLimitStore.get(key)!;
  
  if (now > userData.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userData.count >= limit) {
    return false;
  }
  
  userData.count++;
  return true;
};

export const imageGenerationResolvers = {
  Query: {
    aiImageGenerationStatus: async (_: any, __: any, context: any) => {
      try {
        const status = await context.huggingFaceService.checkModelStatus();
        
        return {
          available: status.available,
          message: status.message,
          model: 'black-forest-labs/FLUX.1-schnell',
          maxPromptLength: IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH,
          defaultDimensions: `${IMAGE_GENERATION_CONFIG.DEFAULT_WIDTH}x${IMAGE_GENERATION_CONFIG.DEFAULT_HEIGHT}`,
        };
      } catch (error: any) {
        logger.error('Error checking image generation status', { error: error.message });
        return {
          available: false,
          message: error.message || 'Unable to check status',
          model: 'black-forest-labs/FLUX.1-schnell',
          maxPromptLength: IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH,
          defaultDimensions: `${IMAGE_GENERATION_CONFIG.DEFAULT_WIDTH}x${IMAGE_GENERATION_CONFIG.DEFAULT_HEIGHT}`,
        };
      }
    },
  },

  Mutation: {
    generateAIImage: async (_: any, { input }: any, context: any) => {
      const startTime = Date.now();
      
      try {
        const userId = context.user?.id || 'anonymous';
        
        // Rate limiting: 5 requests per minute
        if (!checkRateLimit(userId, 5, 60000)) {
          throw new Error('Rate limit exceeded. Please try again in a minute.');
        }
        
        const {
          prompt,
          negativePrompt,
          width = IMAGE_GENERATION_CONFIG.DEFAULT_WIDTH,
          height = IMAGE_GENERATION_CONFIG.DEFAULT_HEIGHT,
          numImages = 1,
        } = input;

        // Validate
        if (!prompt || typeof prompt !== 'string') {
          throw new Error('Prompt is required and must be a string');
        }

        if (numImages > 4) {
          throw new Error('Maximum of 4 images per request');
        }

        if (width > 1024 || height > 1024) {
          throw new Error('Maximum dimensions are 1024x1024');
        }

        if (prompt.length > IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH) {
          throw new Error(`Prompt exceeds maximum length of ${IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH} characters`);
        }

        // Generate images
        const result = await context.huggingFaceService.generateImages({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt,
          width: Math.min(width, 1024),
          height: Math.min(height, 1024),
          num_images: Math.min(numImages, 4),
        });

        const duration = Date.now() - startTime;
        
        logger.info('AI Image generation completed', {
          userId,
          promptLength: prompt.length,
          numImages: result.images?.length || 0,
          duration: `${duration}ms`,
          success: result.success,
        });

        return {
          ...result,
          generationTime: `${duration}ms`,
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('AI Image generation failed', {
          error: error.message,
          duration: `${duration}ms`,
        });
        
        return {
          success: false,
          images: [],
          error: error.message || 'Failed to generate images',
          model: 'black-forest-labs/FLUX.1-schnell',
          timestamp: new Date().toISOString(),
          generationTime: `${duration}ms`,
        };
      }
    },

    generateAIImageVariants: async (_: any, { prompt }: any, context: any) => {
      const startTime = Date.now();
      
      try {
        const userId = context.user?.id || 'anonymous';
        
        // Stricter rate limiting for variants: 3 requests per minute
        if (!checkRateLimit(userId, 3, 60000)) {
          throw new Error('Rate limit exceeded. Please try again in a minute.');
        }
        
        if (!prompt || typeof prompt !== 'string') {
          throw new Error('Prompt is required and must be a string');
        }

        // Generate 4 variants
        const result = await context.huggingFaceService.generateImages({
          prompt: prompt.trim(),
          num_images: 4,
        });

        const duration = Date.now() - startTime;
        
        logger.info('AI Image variants generation completed', {
          userId,
          promptLength: prompt.length,
          numImages: result.images?.length || 0,
          duration: `${duration}ms`,
          success: result.success,
        });

        return {
          ...result,
          generationTime: `${duration}ms`,
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('AI Image variants generation failed', {
          error: error.message,
          duration: `${duration}ms`,
        });
        
        return {
          success: false,
          images: [],
          error: error.message || 'Failed to generate image variants',
          model: 'black-forest-labs/FLUX.1-schnell',
          timestamp: new Date().toISOString(),
          generationTime: `${duration}ms`,
        };
      }
    },
  },
};