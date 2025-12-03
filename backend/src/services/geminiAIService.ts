// src/services/geminiAIService.ts - FIXED VERSION
import axios, { AxiosError } from "axios";
import { CircuitBreaker } from "../IntelligentMatcher/safety/CircuitBreaker";
import { InputValidator } from "../IntelligentMatcher/safety/InputValidator";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TIMEOUT = 30000; // 30 seconds

export class GeminiAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorType?: string,
    public retryable?: boolean
  ) {
    super(message);
    this.name = 'GeminiAPIError';
  }
}

export class GeminiAIService {
  private breaker = new CircuitBreaker();
  private currentModel: string = 'gemini-pro-latest';
  private lastModelCheck: number = 0;
  private readonly MODEL_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

  private async discoverBestModel(): Promise<string> {
    const now = Date.now();
    
    if (now - this.lastModelCheck < this.MODEL_CHECK_INTERVAL) {
      console.log(`🔄 Using cached model: ${this.currentModel}`);
      return this.currentModel;
    }

    console.log('🔍 Discovering available Gemini models...');
    
    try {
      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`,
        { timeout: 10000 }
      );

      const models = response.data.models || [];
      console.log(`📊 Found ${models.length} available models`);

      const preferredModels = [
        models.find((model: any) => model.name.includes('pro-latest')),
        models.find((model: any) => model.name.includes('flash-latest')),
        models.find((model: any) => 
          model.name.includes('gemini-2.5-pro') && 
          !model.name.includes('preview') && 
          !model.name.includes('exp')
        ),
        models.find((model: any) => 
          model.name.includes('gemini-2.5-flash') && 
          !model.name.includes('preview') && 
          !model.name.includes('exp')
        ),
      ].filter(Boolean);

      const bestModel = preferredModels[0];
      
      if (bestModel) {
        const modelName = bestModel.name.replace('models/', '');
        console.log(`🎯 Selected model: ${modelName}`);
        this.currentModel = modelName;
        this.lastModelCheck = now;
        return modelName;
      }

      console.warn('⚠️ No preferred models found, using default');
      return 'gemini-pro-latest';

    } catch (error: any) {
      console.error('❌ Model discovery failed:', error.message);
      console.log('🔄 Falling back to cached/default model');
      return this.currentModel;
    }
  }

  private async getModel(): Promise<string> {
    return await this.discoverBestModel();
  }

  async generateContent(prompt: string) {
    console.log(`🔍 Validating prompt (length: ${prompt?.length || 0})`);
    console.log(`📝 Prompt preview: "${prompt?.substring(0, 100)}..."`);

    // Enhanced validation
    if (!prompt || typeof prompt !== 'string') {
      throw new GeminiAPIError("Prompt must be a string", 400, "VALIDATION_ERROR", false);
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
      throw new GeminiAPIError("Prompt cannot be empty", 400, "VALIDATION_ERROR", false);
    }

    // Input validation
    try {
      const validation = InputValidator.validateInput(trimmedPrompt);
      console.log(`🔍 InputValidator result:`, validation);
      
      if (!validation.valid && trimmedPrompt.length === 0) {
        throw new GeminiAPIError("Prompt validation failed", 400, "VALIDATION_ERROR", false);
      }
    } catch (validatorError: any) {
      console.error('❌ InputValidator error:', validatorError.message);
      if (trimmedPrompt.length === 0) {
        throw new GeminiAPIError("Prompt validation failed", 400, "VALIDATION_ERROR", false);
      }
    }

    if (!GEMINI_API_KEY) {
      throw new GeminiAPIError("Gemini API key not configured", 500, "CONFIGURATION_ERROR", false);
    }

    const modelName = await this.getModel();
    console.log(`🚀 Using model: ${modelName}`);
    console.log(`📤 Sending prompt to Gemini (${trimmedPrompt.length} chars)...`);

    try {
      // CRITICAL FIX: Remove TimeoutManager wrapper, let axios handle timeout directly
      const response = await this.breaker.execute(async () => {
        try {
          return await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
            {
              contents: [{ parts: [{ text: trimmedPrompt }] }],
            },
            {
              headers: { "Content-Type": "application/json" },
              timeout: GEMINI_TIMEOUT,
              // Add timeout config for better control
              timeoutErrorMessage: `Gemini API timeout after ${GEMINI_TIMEOUT}ms`,
            }
          );
        } catch (axiosError: any) {
          // Handle axios timeout specifically
          if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
            throw new GeminiAPIError(
              "AI service timeout - the request took too long. Please try again.",
              408,
              "TIMEOUT_ERROR",
              true
            );
          }
          // Re-throw other axios errors to be handled below
          throw axiosError;
        }
      });

      if (response.status !== 200) {
        console.error(`❌ Gemini API returned status ${response.status}`);
        
        let errorMessage = "AI service temporarily unavailable";
        let errorType = "API_ERROR";
        let retryable = true;

        switch (response.status) {
          case 400:
            errorMessage = "Invalid request to AI service";
            errorType = "BAD_REQUEST";
            retryable = false;
            break;
          case 401:
            errorMessage = "AI service authentication failed";
            errorType = "AUTH_ERROR";
            retryable = false;
            break;
          case 403:
            errorMessage = "AI service access denied";
            errorType = "ACCESS_DENIED";
            retryable = false;
            break;
          case 408:
            errorMessage = "AI service timeout - please try again";
            errorType = "TIMEOUT_ERROR";
            retryable = true;
            break;
          case 429:
            errorMessage = "AI service rate limit exceeded - please wait";
            errorType = "RATE_LIMIT";
            retryable = true;
            break;
          case 500:
            errorMessage = "AI service internal error";
            errorType = "SERVER_ERROR";
            retryable = true;
            break;
          case 503:
            errorMessage = "AI service temporarily unavailable";
            errorType = "SERVICE_UNAVAILABLE";
            retryable = true;
            break;
        }

        throw new GeminiAPIError(errorMessage, response.status, errorType, retryable);
      }

      if (!response.data?.candidates?.length) {
        console.error('❌ No candidates returned from Gemini API');
        throw new GeminiAPIError(
          "No response generated by AI service",
          500,
          "EMPTY_RESPONSE",
          true
        );
      }

      const aiResponse = response.data.candidates[0].content.parts[0].text;
      console.log(`✅ Gemini response received (${aiResponse?.length || 0} chars)`);

      return aiResponse;

    } catch (error: any) {
      console.error('❌ Gemini API call failed:', error.message);
      
      // If it's already our custom error, re-throw it
      if (error instanceof GeminiAPIError) {
        throw error;
      }

      // Handle circuit breaker errors
      if (error.message === 'Circuit breaker is open') {
        throw new GeminiAPIError(
          "AI service is temporarily unavailable due to repeated failures. Please try again in a moment.",
          503,
          "CIRCUIT_BREAKER_OPEN",
          true
        );
      }

      // Handle axios errors
      if (error.isAxiosError || error.code) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status || 500;
        const errorMessage = (axiosError.response?.data as any)?.error?.message || error.message;
        
        // Specific handling for timeout
        if (error.code === 'ECONNABORTED' || errorMessage.includes('timeout')) {
          throw new GeminiAPIError(
            "AI service timeout - the request took too long. Please try again with a shorter message.",
            408,
            "TIMEOUT_ERROR",
            true
          );
        }

        // Network errors
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new GeminiAPIError(
            "Cannot reach AI service - please check your internet connection",
            503,
            "NETWORK_ERROR",
            true
          );
        }
        
        throw new GeminiAPIError(
          `AI service error: ${errorMessage}`,
          statusCode,
          "NETWORK_ERROR",
          statusCode >= 500
        );
      }

      // Generic error
      throw new GeminiAPIError(
        `AI service error: ${error.message}`,
        500,
        "UNKNOWN_ERROR",
        true
      );
    }
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  async refreshModel(): Promise<string> {
    this.lastModelCheck = 0;
    return await this.discoverBestModel();
  }
}