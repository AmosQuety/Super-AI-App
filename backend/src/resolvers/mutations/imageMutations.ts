// src/resolvers/mutations/imageMutations.ts
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { AppContext } from "../types/context";
import { AIManager } from "../../utils/aiManager";
import { logger } from "../../utils/logger";

// Define the interface for the generation result to satisfy TypeScript
interface ImageGenerationResult {
  imageUrl: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  error?: string;
}

export const imageMutations = {
  generateImage: async (
    _: any,
    { prompt }: { prompt: string },
    context: AppContext
  ) => {
    // 1. Auth Check
    const userId = context.user?.userId || (context.user as any)?.id;
    if (!userId) throw new AuthenticationError("You must be logged in to generate images");

    // 2. Robust Input Validation
    if (!prompt || prompt.trim().length === 0) {
      throw new UserInputError("Prompt cannot be empty");
    }
    if (prompt.length > 1000) {
      throw new UserInputError("Prompt too long. Maximum 1000 characters.");
    }

    try {
      // 3. Strategy 2: Prompt Caching (Check if this exact prompt was made before)
      const cachedUrl = await AIManager.getCachedImage(prompt);
      if (cachedUrl) {
        logger.info(`🎯 Cache hit for prompt: ${prompt.substring(0, 30)}...`);
        return await context.prisma.imageGeneration.create({
          data: {
            userId,
            prompt: prompt.trim(),
            imageUrl: cachedUrl,
            status: 'COMPLETED',
          },
        });
      }

      // 4. Strategy 1: Global Daily Quota Check
      await AIManager.checkQuota(userId, 'image');

      logger.info(`🎨 Generating image for user ${userId}: "${prompt}"`); // ✅ CHANGED: Using logger instead of console.log
      
      // 5. Execution
      // ✅ Note: imageGenerationService now points to PollinationsService
      const generationResult = await context.imageGenerationService.generateImage(prompt);
      
      if (generationResult.status !== 'SUCCESS') {
        throw new Error(generationResult.error || 'Image generation failed');
      }

      // 6. Strategy 1 & 2: Update Usage and Cache the result
      await AIManager.incrementUsage(userId, 'image');
      await AIManager.cacheImage(prompt, generationResult.imageUrl);

      // 7. Save to Database
      return await context.prisma.imageGeneration.create({
        data: {
          userId,
          prompt: prompt.trim(),
          imageUrl: generationResult.imageUrl,
          status: 'COMPLETED',
        },
      });

    } catch (error: any) {
      logger.error('❌ Image generation error:', error); // ✅ CHANGED: Using logger
      
      // Still log the failure in the DB for user history/debugging
      await context.prisma.imageGeneration.create({
        data: {
          userId,
          prompt: prompt.trim(),
          imageUrl: '',
          status: 'FAILED',
        },
      });

      throw new UserInputError(error.message || "Failed to generate image");
    }
  },

  generateMultipleImages: async (
    _: any,
    { prompt, count = 4 }: { prompt: string; count?: number },
    context: AppContext
  ) => {
    const userId = context.user?.userId || (context.user as any)?.id;
    if (!userId) throw new AuthenticationError("You must be logged in");

    if (count > 8) throw new UserInputError("Maximum 8 images at once");

    // Check quota before starting the batch
    await AIManager.checkQuota(userId, 'image');

    // ✅ Note: imageGenerationService now points to PollinationsService
    const generationResults: ImageGenerationResult[] = await context.imageGenerationService.generateMultipleImages(prompt, count);
    
    const createdImages = await Promise.all(
      generationResults.map(async (result: ImageGenerationResult, index: number) => {
        return await context.prisma.imageGeneration.create({
          data: {
            userId,
            prompt: `${prompt} (variant ${index + 1})`,
            imageUrl: result.imageUrl,
            status: result.status === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
          },
        });
      })
    );

    // Only increment usage once for a batch to be fair to users
    await AIManager.incrementUsage(userId, 'image');

    return createdImages.filter((img: any) => img.status === 'COMPLETED');
  },
};