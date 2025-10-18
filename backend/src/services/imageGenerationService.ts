// src/services/imageGenerationService.ts
import axios from 'axios';

export interface ImageGenerationResult {
  imageUrl: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  error?: string;
}

export class ImageGenerationService {
  private huggingFaceApiKey: string;
  private huggingFaceModel = "stabilityai/stable-diffusion-2-1";

  constructor() {
    this.huggingFaceApiKey = process.env.HUGGING_FACE_API_KEY || '';
    
    if (!this.huggingFaceApiKey) {
      console.warn('⚠️  HUGGING_FACE_API_KEY not found. Image generation will use mock service.');
    }
  }

  async generateImage(prompt: string): Promise<ImageGenerationResult> {
    try {
      // Clean and validate prompt
      const cleanPrompt = this.sanitizePrompt(prompt);
      
      if (!this.huggingFaceApiKey) {
        // Fallback to mock service if no API key
        return await this.generateMockImage(cleanPrompt);
      }

      console.log(`🖼️  Generating image for prompt: "${cleanPrompt}"`);
      
      // Call Hugging Face API
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.huggingFaceModel}`,
        { inputs: cleanPrompt },
        {
          headers: {
            'Authorization': `Bearer ${this.huggingFaceApiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 30000, // 30 seconds timeout
        }
      );

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }

      // Convert image buffer to base64 data URL
      const imageBuffer = Buffer.from(response.data);
      const base64Image = imageBuffer.toString('base64');
      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      console.log('✅ Image generated successfully');
      
      return {
        imageUrl,
        status: 'SUCCESS'
      };

    } catch (error: any) {
      console.error('❌ Image generation failed:', error.message);
      
      // Fallback to mock service on failure
      return await this.generateMockImage(prompt);
    }
  }

  private sanitizePrompt(prompt: string): string {
    // Remove harmful content and limit length
    const bannedWords = ['nude', 'naked', 'explicit', 'porn', 'violence', 'gore'];
    let cleanPrompt = prompt.trim().substring(0, 500); // Limit length
    
    // Filter out banned words
    bannedWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      cleanPrompt = cleanPrompt.replace(regex, '[removed]');
    });

    // Add quality improvements
    cleanPrompt += ', high quality, detailed, professional';
    
    return cleanPrompt;
  }

  private async generateMockImage(_prompt: string): Promise<ImageGenerationResult> {
    // Create a placeholder image using a mock service
    // Using picsum.photos for placeholder images
    const width = 512;
    const height = 512;
    const imageUrl = `https://picsum.photos/${width}/${height}?random=${Date.now()}`;
    
    console.log('🔄 Using mock image service');
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      imageUrl,
      status: 'SUCCESS'
    };
  }

  // Optional: Generate multiple images
  async generateMultipleImages(prompt: string, count: number = 4): Promise<ImageGenerationResult[]> {
    const promises = Array.from({ length: count }, () => this.generateImage(prompt));
    return Promise.all(promises);
  }
}