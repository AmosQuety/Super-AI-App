// src/services/geminiAIService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CircuitBreaker } from "../IntelligentMatcher/safety/CircuitBreaker";
import axios from "axios"; // <--- We need Axios for discovery

// 1. Load Keys
const ALL_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "").split(",").map(k => k.trim()).filter(k => k);

export class GeminiAPIError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'GeminiAPIError';
  }
}

// Type definition for the REST API response
type GeminiModel = {
  name: string;
  supportedGenerationMethods?: string[];
  state?: string; // "ACTIVE" | "DEPRECATED"
};

export class GeminiAIService {
  private breaker = new CircuitBreaker();
  private cachedModelName: string | null = null;

  constructor() {
    if (ALL_KEYS.length === 0) console.warn("⚠️ No Gemini API Keys found");
  }

  private getRandomKey() {
    if (ALL_KEYS.length === 0) throw new GeminiAPIError("No Gemini API Keys configured", 500);
    const randomIndex = Math.floor(Math.random() * ALL_KEYS.length);
    return ALL_KEYS[randomIndex];
  }

  private getClient(key: string) {
    return new GoogleGenerativeAI(key);
  }

  // 👇 FIXED: Use Axios to list models because SDK doesn't support it
  private async resolveBestModel(): Promise<string> {
    if (this.cachedModelName) return this.cachedModelName;

    console.log("🔍 Auto-detecting best Gemini model via REST API...");
    
    // Pick a key for discovery
    const key = this.getRandomKey();

    try {
      // Direct REST call to Google
      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );

      const models = response.data.models as GeminiModel[];

      // 1. Filter for usable text generation models
      const usableModels = models.filter(m => 
        // Must support generation
        m.supportedGenerationMethods?.includes("generateContent") &&
        // Must be pro or flash (avoid vision-only or ultra-legacy ones)
        (m.name.includes("gemini") || m.name.includes("pro") || m.name.includes("flash"))
      );

      if (!usableModels.length) {
        console.warn("⚠️ No active models found via API, falling back to default.");
        return "gemini-1.5-flash";
      }

      // 2. Score them
      const scoreModel = (name: string) => {
        const n = name.toLowerCase();
        
        // 🛑 DOWNGRADE 2.5-Pro (It has 0 quota on free tier often)
        if (n.includes("2.5-pro")) return 0; 

        // 🚀 PREFER FLASH (High limits, fast, good for RAG)
        if (n.includes("1.5-flash")) return 100; 
        if (n.includes("flash")) return 90;

        // ⚠️ USE PRO CAUTIOUSLY (Lower limits)
        if (n.includes("1.5-pro")) return 50;
        if (n.includes("pro")) return 40;
        
        return 10;
      };

      // 3. Sort by score
      const ranked = usableModels
        .map(m => ({ name: m.name, score: scoreModel(m.name) }))
        .sort((a, b) => b.score - a.score);

      const bestModel = ranked[0].name;
      console.log(`✅ Best Model Selected: ${bestModel}`);
      
      // The API returns "models/gemini-1.5-pro", but SDK usually wants just "gemini-1.5-pro"
      // However, SDK handles "models/" prefix fine usually. Let's keep it clean:
      this.cachedModelName = bestModel.replace("models/", ""); 
      return this.cachedModelName!;

    } catch (error) {
      console.error("❌ Model Discovery Failed:", error);
      return "gemini-1.5-flash"; // Safe Fallback
    }
  }

  // 1. Chat Generation
  async generateContent(prompt: string): Promise<string> {
    if (!prompt.trim()) throw new GeminiAPIError("Prompt cannot be empty", 400);

    return await this.breaker.execute(async () => {
      try {
        const currentKey = this.getRandomKey();
        const genAI = this.getClient(currentKey);
        
        // Dynamic Model Selection
        const modelName = await this.resolveBestModel();
        
        console.log(`📤 Sending prompt to ${modelName}...`);
      
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (innerError: any) {
            // 🚨 IF PRO FAILS, RETRY WITH FLASH
            if (innerError.message?.includes("429") && !modelName.includes("flash")) {
                console.warn(`⚠️ ${modelName} hit rate limit. Retrying with gemini-1.5-flash...`);
                const safeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await safeModel.generateContent(prompt);
                const response = await result.response;
                return response.text();
            }
            throw innerError; // Throw other errors
        }
      
      } catch (error: any) {
        console.error("Gemini Generation Error:", error.message);
        if (error.message?.includes("429")) {
          throw new GeminiAPIError("Rate limit exceeded. Please try again.", 429);
        }
        if (error.message?.includes("not found")) {
            this.cachedModelName = null; // Clear cache to retry discovery
        }
        throw new GeminiAPIError(error.message || "AI Service Failed", 500);
      }
    });
  }

  // 2. RAG Embeddings
  async getEmbedding(text: string): Promise<number[]> {
    try {
      const cleanText = text.replace(/\n/g, " ");
      const currentKey = this.getRandomKey();
      const genAI = this.getClient(currentKey);
      
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      
      const result = await model.embedContent(cleanText);
      return result.embedding.values;
    } catch (error: any) {
      console.error("Gemini Embedding Error:", error.message);
      throw new GeminiAPIError("Failed to generate embedding", 500);
    }
  }
}