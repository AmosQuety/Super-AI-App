// src/services/huggingface.service.ts
import { HfInference } from '@huggingface/inference';
import { logger } from '../utils/logger';

export class HuggingFaceService {
  private static instance: HuggingFaceService;
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  
  // ✅ FIX: Use a truly free model that doesn't require paid providers
  private readonly MODEL = "black-forest-labs/FLUX.1-schnell";
  // Alternative free models:
  // private readonly MODEL = "stabilityai/stable-diffusion-2-1";
  // private readonly MODEL = "prompthero/openjourney-v4";

  private constructor() {
    const keys = process.env.HUGGING_FACE_API_KEYS || process.env.HUGGING_FACE_API_KEY || "";
    this.apiKeys = keys.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (this.apiKeys.length === 0) {
      logger.error('❌ Hugging Face API keys not configured.');
    } else {
      logger.info(`✅ Loaded ${this.apiKeys.length} Hugging Face API key(s)`);
    }
  }

  public static getInstance(): HuggingFaceService {
    if (!HuggingFaceService.instance) {
      HuggingFaceService.instance = new HuggingFaceService();
    }
    return HuggingFaceService.instance;
  }

  private rotateKey() {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    logger.warn(`🔄 Rotating Hugging Face Key to index ${this.currentKeyIndex}`);
  }

  async generateImages(request: any): Promise<any> {
    const { prompt, negative_prompt, width = 1024, height = 1024 } = request;

    // Track which keys we've tried
    const attemptedKeys = new Set<number>();

    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const keyIndex = this.currentKeyIndex;
      
      // Prevent infinite loops
      if (attemptedKeys.has(keyIndex)) {
        logger.error(`🔁 Already tried key ${keyIndex}, breaking loop`);
        break;
      }
      attemptedKeys.add(keyIndex);

      const apiKey = this.apiKeys[keyIndex];
      const hf = new HfInference(apiKey);

      try {
        logger.info(`🎨 Attempting image generation with key ${keyIndex}/${this.apiKeys.length - 1}`);
        
        const result = await hf.textToImage({
          model: this.MODEL,
          inputs: prompt,
          parameters: {
            negative_prompt: negative_prompt || "blurry, distorted, low quality, watermark",
            width: Math.min(width, 1024),
            height: Math.min(height, 1024),
            num_inference_steps: 20, // Reduced for faster generation
          },
          wait_for_model: true,
          use_cache: false,
        });

        // Conversion logic
        const arrayBuffer = await (result as any).arrayBuffer();
        const base64Image = `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;

        logger.info(`✅ Image generation successful with key ${keyIndex}`);
        return { success: true, images: [base64Image], model: this.MODEL };

      } catch (error: any) {
        const errorMsg = error.message || JSON.stringify(error);
        
        logger.error(`❌ Key ${keyIndex} failed:`, {
          error: errorMsg.substring(0, 200),
          attempt: attempt + 1,
          totalKeys: this.apiKeys.length
        });

        // ✅ FIX: More aggressive rotation - try next key for ANY error except auth failures
        const isAuthError = errorMsg.includes('401') || 
                           errorMsg.includes('Invalid API key') ||
                           errorMsg.includes('Unauthorized');
        
        if (isAuthError) {
          // If it's an auth error, this key is definitely bad - skip it permanently
          logger.error(`🔐 Authentication failed for key ${keyIndex} - key is invalid`);
          this.rotateKey();
          continue;
        }
        
        // For any other error, rotate and try the next key
        this.rotateKey();
        
        // If we haven't tried all keys yet, continue
        if (attempt < this.apiKeys.length - 1) {
          continue;
        }
        
        // If this was the last key, return the error
        return { 
          success: false, 
          error: this.getDetailedErrorMessage(error),
          errorType: this.categorizeError(errorMsg)
        };
      }
    }

    return { 
      success: false, 
      error: "All API keys failed. This could mean: 1) Keys are invalid, 2) Model requires paid tier, 3) Service is down. Try switching to a free model like 'black-forest-labs/FLUX.1-schnell'",
      errorType: 'ALL_KEYS_EXHAUSTED'
    };
  }

  // --- WRAPPERS ---
  async generateImage(prompt: string): Promise<any> {
    const result = await this.generateImages({ prompt });
    
    if (!result.success) {
      return { 
        imageUrl: '', 
        status: 'FAILED' as const, 
        error: result.error 
      };
    }
    
    return { 
      imageUrl: result.images[0], 
      status: 'SUCCESS' as const 
    };
  }

  async generateMultipleImages(prompt: string, count: number): Promise<any[]> {
    const result = await this.generateImages({ prompt, num_images: count });
    if (!result.success) return [];
    return result.images.map((img: string) => ({ imageUrl: img, status: 'SUCCESS' }));
  }

  async checkModelStatus(): Promise<{ available: boolean; message: string }> {
    // Quick test with minimal resources
    for (let i = 0; i < this.apiKeys.length; i++) {
      const hf = new HfInference(this.apiKeys[this.currentKeyIndex]);
      
      try {
        logger.info(`🔍 Checking model status with key ${this.currentKeyIndex}`);
        
        await hf.textToImage({
          model: this.MODEL,
          inputs: "test",
          parameters: { 
            width: 256, 
            height: 256, 
            num_inference_steps: 1 
          },
          wait_for_model: true,
          use_cache: true // Use cache for status checks
        });

        logger.info(`✅ Model is available`);
        return { available: true, message: 'Model is active and ready' };
        
      } catch (error: any) {
        const errorMsg = error.message || "";
        
        logger.warn(`⚠️ Status check failed for key ${this.currentKeyIndex}: ${errorMsg.substring(0, 100)}`);
        
        if (errorMsg.includes('503') || errorMsg.includes('loading')) {
          return { available: true, message: 'Model is loading, try again in 20 seconds' };
        }
        
        // Try next key
        this.rotateKey();
        continue;
      }
    }
    
    return { 
      available: false, 
      message: 'Service temporarily unavailable. All keys failed status check.' 
    };
  }

  private categorizeError(errorMsg: string): string {
    if (errorMsg.includes('401') || errorMsg.includes('Invalid API')) return 'AUTHENTICATION';
    if (errorMsg.includes('429')) return 'RATE_LIMIT';
    if (errorMsg.includes('503')) return 'SERVICE_UNAVAILABLE';
    if (errorMsg.includes('balance') || errorMsg.includes('credits')) return 'INSUFFICIENT_CREDITS';
    if (errorMsg.includes('fal-ai') || errorMsg.includes('provider')) return 'PROVIDER_ERROR';
    return 'UNKNOWN';
  }

  private getDetailedErrorMessage(error: any): string {
    const msg = error.message || "";
    
    // Authentication errors
    if (msg.includes('401')) {
      return 'Invalid API key. Please check your Hugging Face API keys.';
    }
    
    // Credit/billing errors
    if (msg.includes('balance is depleted') || msg.includes('Insufficient credits')) {
      return 'Hugging Face account has insufficient credits. Consider upgrading or using a free model.';
    }
    
    // Provider errors (THIS IS YOUR ISSUE)
    if (msg.includes('fal-ai') || msg.includes('provider')) {
      return 'Model requires paid provider (fal-ai). Switch to a free model like "black-forest-labs/FLUX.1-schnell" or "stabilityai/stable-diffusion-2-1"';
    }
    
    // Rate limiting
    if (msg.includes('429')) {
      return 'Rate limit reached. All keys are temporarily exhausted.';
    }
    
    // Service issues
    if (msg.includes('503')) {
      return 'Model is currently loading. Please wait 20-30 seconds and try again.';
    }
    
    return msg.substring(0, 200) || 'Failed to generate images';
  }

  private getErrorMessage(error: any): string {
    return this.getDetailedErrorMessage(error);
  }
}