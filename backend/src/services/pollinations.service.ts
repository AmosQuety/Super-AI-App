// src/services/pollinations.service.ts

import { resolve } from 'path';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

import { POLLINATIONS_CONFIG } from '../config/pollinations';

export class PollinationsService {
  private static instance: PollinationsService;
  
  // Authenticated API endpoint - requires secret key
  private readonly BASE_URL = "https://gen.pollinations.ai/image";
  private readonly API_KEY: string;

  private constructor() {
    this.API_KEY = process.env.POLLINATIONS_API_KEY || '';
    
    if (this.API_KEY) {
      logger.info('✅ Pollinations.ai Image Service initialized with API key');
    } else {
      logger.warn('⚠️ Pollinations.ai running in anonymous mode (rate limits apply)');
      logger.warn('   Get your free API key at: https://enter.pollinations.ai');
      // Fallback API key from config if not in env (optional safety net)
      if (!this.API_KEY && POLLINATIONS_CONFIG.API_KEY) {
        this.API_KEY = POLLINATIONS_CONFIG.API_KEY;
        logger.info('   ...Recovered API key from config file');
      }
    }
  }

  public static getInstance(): PollinationsService {
    if (!PollinationsService.instance) {
      PollinationsService.instance = new PollinationsService();
    }
    return PollinationsService.instance;
  }

  async generateImages(request: any): Promise<any> {
    const { 
      prompt, 
      width = 1024, 
      height = 1024,
      num_images = 1 
    } = request;

    try {
      logger.info(`🎨 Generating ${num_images} image(s) with Pollinations.ai`, { prompt });
      
      // Generate images IN PARALLEL to reduce wait time
      // Using Promise.all with the increased timeout to handle concurrency
      const imagePromises = Array.from({ length: num_images }).map(async (_, i) => {
        // Use a proper seed range (standard int32: 0 to 2147483647)
        const baseSeed = Math.floor(Date.now() / 1000);
        const seed = (baseSeed + i + Math.floor(Math.random() * 10000)) % 2147483647;
        const encodedPrompt = encodeURIComponent(prompt.trim());
        const model = POLLINATIONS_CONFIG.MODEL || 'flux';
        
        // gen.pollinations.ai API format: /image/{prompt}?param=value
        // Explicitly specifying model to avoid "Invalid option" errors
        const imageUrl = `${this.BASE_URL}/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=${model}`;
        
        logger.info(`📡 Fetching image ${i + 1}/${num_images}`, { 
          seed, 
          prompt: prompt.substring(0, 50),
          authenticated: !!this.API_KEY,
          url: imageUrl.substring(0, 150)
        });
        
        // Build headers with API key (Authorization: Bearer)
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageGenerator/1.0)',
        };
        
        // Add API key - gen.pollinations.ai REQUIRES Authorization header
        if (this.API_KEY) {
          headers['Authorization'] = `Bearer ${this.API_KEY}`;
        } else {
          throw new Error('API key is required for gen.pollinations.ai');
        }
        
        // Fetch the image and convert to base64
        const response = await fetch(imageUrl, { headers });
        
        if (!response.ok) {
          // Try to get error details from response body
          let errorDetails = `${response.status} ${response.statusText}`;
          try {
            const errorBody = await response.text();
            if (errorBody) {
              errorDetails += ` - ${errorBody.substring(0, 200)}`;
            }
          } catch (e) {
            // Ignore if we can't read error body
          }
          throw new Error(`Pollinations API error: ${errorDetails}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const base64Image = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
        
        logger.info(`✓ Image ${i + 1} generated successfully`);
        
        return base64Image;
      });

      const images = await Promise.all(imagePromises);

      logger.info(`✅ Successfully generated ${images.length} image(s) for prompt: "${prompt.substring(0, 50)}..."`);
      
      return { 
        success: true, 
        images: images,
        model: 'flux' // Matching the actual model used
      };

    } catch (error: any) {
      logger.error(`❌ Pollinations generation failed: ${error.message}`, { prompt });
      
      return { 
        success: false, 
        error: this.getErrorMessage(error),
        images: [],
        model: 'flux' // Required field even on error
      };
    }
  }

  // --- WRAPPERS (Keep same interface as HuggingFace service) ---
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
    return result.images.map((img: string) => ({ 
      imageUrl: img, 
      status: 'SUCCESS' as const
    }));
  }

  async checkModelStatus(): Promise<{ available: boolean; message: string }> {
    try {
      // Test with a simple request to the authenticated endpoint
      const testUrl = `${this.BASE_URL}/test?width=128&height=128&model=flux`;
      const headers: Record<string, string> = {};
      
      if (this.API_KEY) {
        headers['Authorization'] = `Bearer ${this.API_KEY}`;
      }
      
      const response = await fetch(testUrl, { method: 'HEAD', headers });
      
      if (response.ok || response.status === 404) {
        // 404 is OK - means the endpoint exists but the specific image doesn't
        return { 
          available: true, 
          message: 'Pollinations.ai (gen.pollinations.ai) is active and ready' 
        };
      }
      
      return { 
        available: false, 
        message: `Pollinations.ai returned status ${response.status}` 
      };
      
    } catch (error: any) {
      return { 
        available: false, 
        message: `Service check failed: ${error.message}` 
      };
    }
  }

  private getErrorMessage(error: any): string {
    return error.message || 'Failed to generate images with Pollinations.ai';
  }
}

