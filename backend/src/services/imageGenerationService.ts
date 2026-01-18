import axios from 'axios';

export interface ImageGenerationResult {
  imageUrl: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  error?: string;
}

export class ImageGenerationService {
  // 1. Change to an array of keys
  private huggingFaceApiKeys: string[];
  private huggingFaceModel = "stabilityai/stable-diffusion-2-1";

  constructor() {
    // 2. Store all keys provided in the environment variable
    const keys = process.env.HUGGING_FACE_API_KEYS?.split(',') || [];
    this.huggingFaceApiKeys = keys.map(key => key.trim()).filter(key => key.length > 0);
    
    if (this.huggingFaceApiKeys.length === 0) {
      console.warn('⚠️  No HUGGING_FACE_API_KEYS found. Image generation will use mock service.');
    } else {
      console.log(`🔑 Loaded ${this.huggingFaceApiKeys.length} API keys for rotation.`);
    }
  }

  async generateImage(prompt: string): Promise<ImageGenerationResult> {
    const cleanPrompt = this.sanitizePrompt(prompt);

    // Fallback if no keys at all
    if (this.huggingFaceApiKeys.length === 0) {
      return await this.generateMockImage(cleanPrompt);
    }

    // 3. Loop through all available keys
    for (let i = 0; i < this.huggingFaceApiKeys.length; i++) {
      const currentKey = this.huggingFaceApiKeys[i];
      
      try {
        console.log(`🖼️  Generating (Key ${i + 1}/${this.huggingFaceApiKeys.length}) for: "${cleanPrompt}"`);
        
        const response = await axios.post(
          `https://api-inference.huggingface.co{this.huggingFaceModel}`,
          { inputs: cleanPrompt },
          {
            headers: {
              'Authorization': `Bearer ${currentKey}`,
              'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
            timeout: 30000,
          }
        );

        if (response.status === 200) {
          const imageBuffer = Buffer.from(response.data);
          const base64Image = imageBuffer.toString('base64');
          return {
            imageUrl: `data:image/jpeg;base64,${base64Image}`,
            status: 'SUCCESS'
          };
        }
      } catch (error: any) {
        const statusCode = error.response?.status;
        
        // 4. Check if key is exhausted (429 = Too Many Requests, 503 = Service Overloaded)
        if (statusCode === 429 || statusCode === 503) {
          console.warn(`⚠️  Key ${i + 1} exhausted (Status ${statusCode}). Trying next key...`);
          continue; // Move to the next key in the for-loop
        }

        // For other errors (like invalid prompt), stop and show error
        console.error(`❌ Permanent error with key ${i + 1}:`, error.message);
        break; 
      }
    }

    // 5. If the loop finishes and no key worked
    console.error('🚫 All API keys exhausted or failed.');
    return await this.generateMockImage(prompt);
  }

  private sanitizePrompt(prompt: string): string {
    const bannedWords = ['nude', 'naked', 'explicit', 'porn', 'violence', 'gore'];
    let cleanPrompt = prompt.trim().substring(0, 500);
    bannedWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      cleanPrompt = cleanPrompt.replace(regex, '[removed]');
    });
    cleanPrompt += ', high quality, detailed, professional';
    return cleanPrompt;
  }

  private async generateMockImage(_prompt: string): Promise<ImageGenerationResult> {
    const imageUrl = `https://picsum.photos{Date.now()}`;
    console.log('🔄 Using mock image service');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { imageUrl, status: 'SUCCESS' };
  }

  async generateMultipleImages(prompt: string, count: number = 4): Promise<ImageGenerationResult[]> {
    const promises = Array.from({ length: count }, () => this.generateImage(prompt));
    return Promise.all(promises);
  }
}
