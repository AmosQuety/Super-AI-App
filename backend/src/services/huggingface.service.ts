// src/services/huggingface.service.ts
import { HfInference } from '@huggingface/inference';
import { logger } from '../utils/logger';

export interface ImageGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
}

export interface ImageGenerationResponse {
  success: boolean;
  images?: string[]; // base64 encoded images
  error?: string;
  model: string;
  timestamp: string;
}

export class HuggingFaceService {
  private static instance: HuggingFaceService;
  private isAvailable: boolean = true;
  private hf: HfInference;
  
  // WORKING MODEL - FLUX.1-schnell is fast, free, and Apache 2.0 licensed
  private readonly MODEL = "black-forest-labs/FLUX.1-schnell";

  private constructor() {
    const apiKey = process.env.HUGGING_FACE_API_KEY;
    
    if (!apiKey) {
      logger.warn('Hugging Face API key not configured. Image generation will be disabled.');
      this.isAvailable = false;
    }
    
    // Initialize the new Inference Client
    this.hf = new HfInference(apiKey);
    
    logger.info('HuggingFace service initialized', { 
      model: this.MODEL,
      available: this.isAvailable 
    });
  }

  public static getInstance(): HuggingFaceService {
    if (!HuggingFaceService.instance) {
      HuggingFaceService.instance = new HuggingFaceService();
    }
    return HuggingFaceService.instance;
  }

  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'Hugging Face service not configured',
        model: this.MODEL,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const {
        prompt,
        negative_prompt,
        width = 1024,
        height = 1024,
        num_images = 1,
      } = request;

      logger.info('Generating images with Hugging Face', { 
        model: this.MODEL,
        promptLength: prompt.length,
        dimensions: `${width}x${height}`,
        numImages: num_images,
      });

      const images: string[] = [];

      // Generate requested number of images
      for (let i = 0; i < num_images; i++) {
        try {
          logger.info(`Starting generation for image ${i + 1}/${num_images}`);
          
          // Use the new textToImage method with proper parameters
          const result = await this.hf.textToImage({
            model: this.MODEL,
            inputs: prompt,
            parameters: {
              negative_prompt,
              width,
              height,
              num_inference_steps: 4, // FLUX.1-schnell works best with 1-4 steps
            },
          });

          logger.info(`Result received for image ${i + 1}, type: ${typeof result}`);

          // FIXED: Handle both Blob and already-encoded string responses
          let base64Image: string;
          
          if (typeof result === 'string') {
            // Already a base64 string or data URL
            base64Image = result.startsWith('data:') ? result : `data:image/png;base64,${result}`;
            logger.info('Result is already a string');
          } else if (result && typeof result === 'object' && 'arrayBuffer' in result) {
            // It's a Blob-like object
            logger.info('Converting Blob to base64...');
            const arrayBuffer = await (result as any).arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const buffer = Buffer.from(uint8Array);
            base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
          } else {
            // Try to handle as ArrayBuffer or any other binary data
            logger.info('Attempting to convert unknown type to base64...');
            try {
              const buffer = Buffer.from(result as any);
              base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
            } catch (bufferError) {
              logger.error('Unknown result type:', typeof result, bufferError);
              throw new Error(`Unexpected result type: ${typeof result}`);
            }
          }
          
          images.push(base64Image);
          
          logger.info(`Image ${i + 1}/${num_images} generated successfully, base64 length: ${base64Image.length}`);
        } catch (imgError: any) {
          logger.error(`Failed to generate image ${i + 1}`, { 
            error: imgError.message,
            stack: imgError.stack,
          });
          
          // Continue with other images instead of failing completely
          if (i === 0) {
            // If first image fails, throw error
            throw imgError;
          }
        }
      }

      if (images.length === 0) {
        throw new Error('Failed to generate any images');
      }

      logger.info(`Successfully generated ${images.length} images`);

      return {
        success: true,
        images,
        model: this.MODEL,
        timestamp: new Date().toISOString(),
      };

    } catch (error: any) {
      logger.error('Image generation failed', { 
        error: error.message,
        stack: error.stack,
      });
      
      return {
        success: false,
        error: this.getErrorMessage(error),
        model: this.MODEL,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private getErrorMessage(error: any): string {
    // Handle common errors with helpful messages
    if (error.message?.includes('401')) {
      return 'Invalid API key. Please check your HUGGING_FACE_API_KEY.';
    }
    if (error.message?.includes('429')) {
      return 'Rate limit exceeded. Please try again in a few moments.';
    }
    if (error.message?.includes('503')) {
      return 'Model is loading. Please wait 20-30 seconds and try again.';
    }
    if (error.message?.includes('Blob') || error.message?.includes('arrayBuffer')) {
      return 'Image conversion error. Please try again.';
    }
    return error.message || 'Failed to generate images';
  }

  async checkModelStatus(): Promise<{ available: boolean; message: string }> {
    if (!this.isAvailable) {
      return { 
        available: false, 
        message: 'API key not configured' 
      };
    }

    try {
      logger.info('Checking model status...');
      
      // Try a simple generation to check if the model is available
      const result = await this.hf.textToImage({
        model: this.MODEL,
        inputs: "test",
        parameters: {
          width: 256,
          height: 256,
          num_inference_steps: 1,
        },
      });

      logger.info('Model status check successful', { resultType: typeof result });

      return {
        available: true,
        message: 'Model is available and ready',
      };
    } catch (error: any) {
      logger.warn('Model status check failed', { error: error.message });
      
      // Model might be loading - this is common and not necessarily an error
      if (error.message?.includes('503') || error.message?.includes('loading')) {
        return {
          available: true,
          message: 'Model is loading (this is normal for first use)',
        };
      }
      
      return { 
        available: false, 
        message: error.message || 'Failed to reach Hugging Face API' 
      };
    }
  }
}