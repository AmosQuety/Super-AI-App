// src/services/geminiAIService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CircuitBreaker } from "../IntelligentMatcher/safety/CircuitBreaker";
import axios from "axios";

const ALL_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "").split(",").map(k => k.trim()).filter(k => k);

export class GeminiAPIError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'GeminiAPIError';
  }
}

type GeminiModel = {
  name: string;
  supportedGenerationMethods?: string[];
};

export class GeminiAIService {
  // Circuit breaker per API key
  private breakers: Map<string, CircuitBreaker> = new Map();
  private cachedModelName: string | null = null;
  private currentKeyIndex: number = 0;

  constructor() {
    if (ALL_KEYS.length === 0) console.warn("⚠️ No Gemini API Keys found");
    
    // Initialize circuit breaker for each key
    ALL_KEYS.forEach(key => {
      this.breakers.set(key, new CircuitBreaker(3, 60000)); // 3 failures, 60s timeout
    });
  }

  // --- STRATEGY 3: KEY ROTATION ---
  private getNextKey() {
    if (ALL_KEYS.length === 0) throw new GeminiAPIError("No Gemini API Keys configured", 500);
    const key = ALL_KEYS[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % ALL_KEYS.length;
    return key;
  }

  private getBreakerForKey(key: string): CircuitBreaker {
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = new CircuitBreaker(3, 60000);
      this.breakers.set(key, breaker);
    }
    return breaker;
  }

  private async resolveBestModel(): Promise<string> {
    if (this.cachedModelName) return this.cachedModelName;
    try {
      const key = ALL_KEYS[0]; // Use first key for discovery
      const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const models = response.data.models as GeminiModel[];

      const usableModels = models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
      
      // Score: Flash is 1st choice (High quota), Pro is 2nd choice
      const scored = usableModels.map(m => ({
        name: m.name.replace("models/", ""),
        score: m.name.includes("1.5-flash") ? 100 : m.name.includes("pro") ? 50 : 10
      })).sort((a, b) => b.score - a.score);

      this.cachedModelName = scored[0]?.name || "gemini-1.5-flash";
      return this.cachedModelName!;
    } catch (error) {
      return "gemini-1.5-flash";
    }
  }

  async generateContent(prompt: string): Promise<string> {
    if (!prompt.trim()) throw new GeminiAPIError("Prompt cannot be empty", 400);

    let lastError: Error | null = null;
    const attemptedKeys: string[] = [];

    // Try all keys until one works
    for (let attempt = 0; attempt < ALL_KEYS.length; attempt++) {
      const currentKey = this.getNextKey();
      const keyLabel = `Key ${this.currentKeyIndex}`;
      attemptedKeys.push(keyLabel);
      
      const breaker = this.getBreakerForKey(currentKey);
      
      // Check circuit breaker state before attempting
      const breakerState = breaker.getState();
      if (breakerState.state === 'OPEN') {
        console.warn(`⚡ ${keyLabel} circuit is OPEN, skipping to next key`);
        continue;
      }
      
      try {
        return await breaker.execute(async () => {
          const genAI = new GoogleGenerativeAI(currentKey);
          const modelName = await this.resolveBestModel();
          const model = genAI.getGenerativeModel({ model: modelName });
          
          const result = await model.generateContent(prompt);
          const response = await result.response;
          return response.text();
        });
      } catch (error: any) {
        lastError = error;
        
        // Check triggers for skipping to next key:
        // 1. Rate limits (429, RESOURCE_EXHAUSTED)
        // 2. Circuit breaker open
        // 3. Permission/Configuration errors (403 SERVICE_DISABLED, 400 API_KEY_INVALID)
        const errorMessage = error.message || "";
        const isRateLimited = errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
        const isCircuitOpen = errorMessage.includes("Circuit breaker is open");
        const isKeyInvalid = errorMessage.includes("403") || errorMessage.includes("SERVICE_DISABLED") || errorMessage.includes("API_KEY_INVALID");
        
        // Log the specific error for debugging
        if (isRateLimited) {
          console.warn(`🔑 ${keyLabel} rate limited (429)`);
        } else if (isCircuitOpen) {
          console.warn(`⚡ ${keyLabel} circuit breaker tripped`);
        } else if (isKeyInvalid) {
          console.warn(`🚫 ${keyLabel} invalid or disabled (403/400): ${errorMessage.substring(0, 100)}...`);
        } else {
          console.error(`❌ ${keyLabel} unexpected error:`, errorMessage);
        }
        
        // Try next key if reusable failure
        if ((isRateLimited || isCircuitOpen || isKeyInvalid) && attempt < ALL_KEYS.length - 1) {
          continue; 
        }
        
        // If it's a different error (not rate limit/auth), throw immediately
        if (!isRateLimited && !isCircuitOpen && !isKeyInvalid) {
          throw new GeminiAPIError(errorMessage || "AI Service Failed", 500);
        }
      }
    }
    
    // All keys exhausted
    console.error(`❌ All API keys exhausted. Tried: ${attemptedKeys.join(", ")}`);
    throw new GeminiAPIError(
      "All Gemini API keys are currently rate-limited or unavailable. Please try again later.",
      429
    );
  }

  async getEmbedding(text: string): Promise<number[]> {
    // Try multiple keys for embedding as well
    for (let attempt = 0; attempt < ALL_KEYS.length; attempt++) {
      const currentKey = this.getNextKey();
      
      try {
        const genAI = new GoogleGenerativeAI(currentKey);
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text.replace(/\n/g, " "));
        return result.embedding.values;
      } catch (error: any) {
        const isRateLimited = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
        
        if (isRateLimited && attempt < ALL_KEYS.length - 1) {
          continue;
        }
        
        throw new GeminiAPIError("Failed to generate embedding", 500);
      }
    }
    
    throw new GeminiAPIError("All keys exhausted for embedding generation", 429);
  }

  // Utility method to check health of all keys
  getKeyHealthStatus(): { key: number; state: string }[] {
    return Array.from(this.breakers.entries()).map(([key, breaker], index) => ({
      key: index,
      state: breaker.getState().state
    }));
  }
}