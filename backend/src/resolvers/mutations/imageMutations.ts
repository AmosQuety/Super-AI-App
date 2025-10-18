// src/resolvers/mutations/imageMutations.ts - UPDATED
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { AppContext } from "../types/context";

export const imageMutations = {
  generateImage: async (
    _: any,
    { userId, prompt }: { userId: string; prompt: string },
    context: AppContext
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to generate images");
    }

    if (!prompt || prompt.trim().length === 0) {
      throw new UserInputError("Prompt cannot be empty");
    }

    if (prompt.length > 1000) {
      throw new UserInputError("Prompt too long. Maximum 1000 characters.");
    }

    try {
      console.log(`🎨 Starting image generation for user ${userId}: "${prompt}"`);
      
      // Use the actual image generation service
      const generationResult = await context.imageGenerationService.generateImage(prompt);
      
      if (generationResult.status !== 'SUCCESS') {
        throw new Error(generationResult.error || 'Image generation failed');
      }

      // Save to database
      const imageGeneration = await context.prisma.imageGeneration.create({
        data: {
          userId,
          prompt: prompt.trim(),
          imageUrl: generationResult.imageUrl,
          status: 'COMPLETED',
        },
      });

      console.log(`✅ Image generated successfully: ${imageGeneration.id}`);
      
      return imageGeneration;

    } catch (error: any) {
      console.error('❌ Image generation error:', error);
      
      // Save failed attempt for debugging
      await context.prisma.imageGeneration.create({
        data: {
          userId,
          prompt: prompt.trim(),
          imageUrl: '',
          status: 'FAILED',
        },
      });

      throw new UserInputError(`Failed to generate image: ${error.message}`);
    }
  },

  // Optional: Generate multiple images at once
  generateMultipleImages: async (
    _: any,
    { userId, prompt, count = 4 }: { userId: string; prompt: string; count?: number },
    context: AppContext
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to generate images");
    }

    if (count > 8) {
      throw new UserInputError("Cannot generate more than 8 images at once");
    }

    const generationResults = await context.imageGenerationService.generateMultipleImages(prompt, count);
    
    const createdImages = await Promise.all(
      generationResults.map(async (result, index) => {
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

    return createdImages.filter(img => img.status === 'COMPLETED');
  },
};