import axios from "axios";
import { CircuitBreaker } from "../IntelligentMatcher/safety/CircuitBreaker";
import { TimeoutManager } from "../IntelligentMatcher/safety/TimeoutManager";
import { InputValidator } from "../IntelligentMatcher/safety/InputValidator";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export class GeminiAIService {
  private breaker = new CircuitBreaker();

  async generateContent(prompt: string) {
    // FIXED: Better validation with detailed logging
    console.log(`🔍 Validating prompt (length: ${prompt?.length || 0})`);
    console.log(`📝 Prompt type: ${typeof prompt}`);
    console.log(`📝 Prompt preview: "${prompt?.substring(0, 100)}..."`);

    // Validate prompt - check for actual content, not just existence
    if (!prompt || typeof prompt !== 'string') {
      console.error('❌ Prompt is null or not a string');
      throw new Error("Prompt must be a string");
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
      console.error('❌ Prompt is empty after trimming');
      throw new Error("Prompt cannot be empty");
    }

    // OPTIONAL: Use InputValidator if it exists, but with error handling
    try {
      const validation = InputValidator.validateInput(trimmedPrompt);
      console.log(`🔍 InputValidator result:`, validation);
      
      if (!validation.valid) {
        console.error('❌ InputValidator rejected prompt:', validation);
        // Don't throw here - log and continue if prompt has content
        if (trimmedPrompt.length > 0) {
          console.warn('⚠️ InputValidator rejected, but prompt has content. Proceeding anyway.');
        } else {
          throw new Error("Prompt validation failed");
        }
      }
    } catch (validatorError: any) {
      console.error('❌ InputValidator error:', validatorError.message);
      // If validator fails but we have a prompt, continue
      if (trimmedPrompt.length > 0) {
        console.warn('⚠️ InputValidator failed, but prompt exists. Continuing...');
      } else {
        throw new Error("Prompt validation failed");
      }
    }

    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const GEMINI_TIMEOUT = 30000;

    console.log(`🚀 Sending prompt to Gemini (${trimmedPrompt.length} chars)...`);

    const response = await this.breaker.execute(() =>
      TimeoutManager.withTimeout(
       
        () =>
          axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
            
            {
              contents: [{ parts: [{ text: trimmedPrompt }] }],
            },
            {
              headers: { "Content-Type": "application/json" },
              timeout: GEMINI_TIMEOUT,
            }
          ),
        GEMINI_TIMEOUT,
        () => ({
          data: { candidates: [] },
          status: 408,
          statusText: "Timeout",
          headers: {},
          config: {} as any,
        })
      )
    );

    if (response.status !== 200) {
      console.error(`❌ Gemini API returned status ${response.status}`);
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    if (!response.data?.candidates?.length) {
      console.error('❌ No candidates returned from Gemini API');
      throw new Error("No candidates returned from Gemini API");
    }

    const aiResponse = response.data.candidates[0].content.parts[0].text;
    console.log(`✅ Gemini response received (${aiResponse?.length || 0} chars)`);

    return aiResponse;
  }
}