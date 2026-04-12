// src/resolvers/imageGenerationResolvers.ts
import { logger } from '../utils/logger';
import { IMAGE_GENERATION_CONFIG } from '../config/pollinations'; // ✅ CHANGED: Import from pollinations config
import { AIManager } from '../utils/aiManager';
import { GraphQLError } from 'graphql';

/**
 * STRATEGY: SPAM PREVENTION (In-Memory)
 * This prevents a single user from clicking "Generate" 50 times in one second.
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const checkSpamLimit = (userId: string, limit = 10, windowMs = 60000): boolean => {
  const key = `img_gen_spam_${userId}`;
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
  
  if (userData.count >= limit) return false;
  
  userData.count++;
  return true;
};

export const imageGenerationResolvers = {
  Query: {
    /**
     * Checks if the Pollinations service is available.
     */
    aiImageGenerationStatus: async (_: any, __: any, context: any) => {
      try {
        const status = await context.huggingFaceService.checkModelStatus();
        
        return {
          available: status.available,
          message: status.message,
          model: 'pollinations.ai/flux-pro', // ✅ CHANGED: Updated model name
          maxPromptLength: IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH,
          defaultDimensions: `${IMAGE_GENERATION_CONFIG.DEFAULT_WIDTH}x${IMAGE_GENERATION_CONFIG.DEFAULT_HEIGHT}`,
        };
      } catch (error: any) {
        logger.error('Error checking image generation status', { error: error.message });
        return {
          available: false,
          message: error.message || 'Unable to check status',
          model: 'pollinations.ai/flux-pro', // ✅ CHANGED: Updated model name
          maxPromptLength: IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH,
          defaultDimensions: `${IMAGE_GENERATION_CONFIG.DEFAULT_WIDTH}x${IMAGE_GENERATION_CONFIG.DEFAULT_HEIGHT}`,
        };
      }
    },
  },

  Mutation: {
    /**
     * Main image generation mutation with 5-layer protection:
     * 1. Auth check
     * 2. Spam protection (per minute)
     * 3. Prompt Caching (check if already generated)
     * 4. Global Quota (per day)
     * 5. Input Validation
     */
    generateAIImage: async (_: any, { input }: any, context: any) => {
      const startTime = Date.now();
      const userId = context.user?.userId || context.user?.id;

      if (!userId) {
        throw new GraphQLError('You must be logged in to generate images.', {
            extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      
      try {
        const {
          prompt,
          negativePrompt,
          width = IMAGE_GENERATION_CONFIG.DEFAULT_WIDTH,
          height = IMAGE_GENERATION_CONFIG.DEFAULT_HEIGHT,
          numImages = 1,
        } = input;

        // --- 1. ROBUST VALIDATION ---
        if (!prompt || typeof prompt !== 'string') throw new Error('Prompt is required');
        if (numImages > 4) throw new Error('Maximum of 4 images per request');
        if (width > 1024 || height > 1024) throw new Error('Max dimensions are 1024x1024');
        if (prompt.length > IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH) {
          throw new Error(`Prompt exceeds max length of ${IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH}`);
        }

        // --- 2. SPAM PROTECTION ---
        // 5 requests per minute limit
        if (!checkSpamLimit(userId, 5, 60000)) {
          throw new Error('You are doing that too fast. Please wait a minute.');
        }

        // --- 3. PROMPT CACHING ---
        // Only use cache if user wants 1 image (variants need fresh generation)
        if (numImages === 1) {
            const cachedImage = await AIManager.getCachedImage(prompt);
            if (cachedImage) {
                logger.info('🎯 Image Cache Hit', { userId, prompt: prompt.substring(0, 30) });
                return {
                    success: true,
                    images: [cachedImage],
                    model: 'pollinations.ai/flux-pro', // ✅ CHANGED: Updated model name
                    timestamp: new Date().toISOString(),
                    generationTime: `${Date.now() - startTime}ms`,
                };
            }
        }

        // --- 4. GLOBAL QUOTA CHECK ---
        // Check if user has used their daily 5-image allowance
        await AIManager.checkQuota(userId, 'image');

        // --- 5. EXECUTE GENERATION ---
        // ✅ Note: Pollinations doesn't use negative_prompt parameter, but we keep it for API compatibility
        const result = await context.huggingFaceService.generateImages({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt, // Kept for compatibility, not used by Pollinations
          width: Math.min(width, 1024),
          height: Math.min(height, 1024),
          num_images: Math.min(numImages, 4),
        });

        const duration = Date.now() - startTime;
        
        if (result.success && result.images?.length > 0) {
          // --- 6. UPDATE USAGE & CACHE ---
          await AIManager.incrementUsage(userId, 'image');
          
          // Cache the first image of the result for future identical prompts
          await AIManager.cacheImage(prompt, result.images[0]);

          // --- 7. PERSIST TO DB (for profile activity counter) ---
          try {
            await context.prisma.imageGeneration.create({
              data: {
                userId,
                prompt: prompt.trim(),
                imageUrl: result.images[0],
                status: 'COMPLETED',
              },
            });
          } catch (dbErr: any) {
            // Non-fatal: don't block the user if DB write fails
            logger.warn('⚠️ Failed to persist image generation record', { error: dbErr.message, userId });
          }

          logger.info('✅ AI Image generation completed', {
            userId,
            numImages: result.images.length,
            duration: `${duration}ms`,
            service: 'Pollinations.ai'
          });
        }

        return {
          ...result,
          generationTime: `${duration}ms`,
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('❌ AI Image generation failed', {
          error: error.message,
          userId,
          duration: `${duration}ms`,
        });
        
        return {
          success: false,
          images: [],
          error: error.message || 'Failed to generate images',
          model: 'pollinations.ai/flux-pro', // ✅ CHANGED: Updated model name
          timestamp: new Date().toISOString(),
          generationTime: `${duration}ms`,
        };
      }
    },

    /**
     * Variants generation: Fixed at 4 images.
     * Always bypasses cache to ensure unique variety.
     */
    generateAIImageVariants: async (_: any, { prompt }: any, context: any) => {
      const startTime = Date.now();
      const userId = context.user?.userId || context.user?.id;

      if (!userId) throw new GraphQLError('Authentication required');
      
      try {
        // Spam limit for variants is tighter (3 per minute)
        if (!checkSpamLimit(userId, 3, 60000)) {
          throw new Error('Rate limit exceeded for variants.');
        }
        
        if (!prompt || typeof prompt !== 'string') throw new Error('Prompt is required');

        // Check global daily quota
        await AIManager.checkQuota(userId, 'image');

        // Generate 4 variants
        const result = await context.huggingFaceService.generateImages({
          prompt: prompt.trim(),
          num_images: 4,
        });

        const duration = Date.now() - startTime;
        
        if (result.success) {
            await AIManager.incrementUsage(userId, 'image');

            // Persist to DB for profile activity counter
            try {
              if (result.images?.length > 0) {
                await context.prisma.imageGeneration.create({
                  data: {
                    userId,
                    prompt: prompt.trim(),
                    imageUrl: result.images[0],
                    status: 'COMPLETED',
                  },
                });
              }
            } catch (dbErr: any) {
              logger.warn('⚠️ Failed to persist variants record', { error: dbErr.message, userId });
            }

            logger.info('✅ AI Variants completed', { 
              userId, 
              duration: `${duration}ms`,
              service: 'Pollinations.ai'
            });
        }

        return {
          ...result,
          timestamp: new Date().toISOString(),
          generationTime: `${duration}ms`,
        };
      } catch (error: any) {
        return {
          success: false,
          images: [],
          error: error.message || 'Failed to generate image variants',
          model: 'pollinations.ai/flux-pro', // ✅ CHANGED: Updated model name
          timestamp: new Date().toISOString(),
          generationTime: `${Date.now() - startTime}ms`,
        };
      }
    },
  },
};