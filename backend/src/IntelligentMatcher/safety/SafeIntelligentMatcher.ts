// SafeIntelligentMatcher.ts
import { IntelligentMatcher, MatchResult } from "../IntelligentMatcher";
// import customResponses from "../customResponses";

export class SafeIntelligentMatcher {
  private matcher: IntelligentMatcher;
  private isEnabled: boolean = true;

  constructor(customResponses: any) {
    this.matcher = new IntelligentMatcher(customResponses, {
      enableSafetyFeatures: false, // Disable problematic safety features
      maxInputLength: 500,
      maxProcessingTimeMs: 50,
    });
  }

  async findBestMatch(input: string): Promise<MatchResult> {
    if (!this.isEnabled) {
      return this.createFallbackResult();
    }

    try {
      // Basic input validation
      if (!input || input.trim().length === 0) {
        return this.createEmptyResult();
      }

      // Limit input size for safety
      const safeInput = input.substring(0, 500).trim();

      return await this.matcher.findBestMatch(safeInput);
    } catch (error) {
      console.warn("IntelligentMatcher error, using fallback:", error);
      return this.createFallbackResult();
    }
  }

  private createFallbackResult(): MatchResult {
    return {
      match: null,
      confidence: 0,
      suggestedResponse: null,
      algorithmUsed: "fallback",
      processingTime: 0,
    };
  }

  private createEmptyResult(): MatchResult {
    return {
      match: null,
      confidence: 0,
      suggestedResponse: null,
      algorithmUsed: "empty",
      processingTime: 0,
    };
  }

  // Enable/disable the matcher if needed
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}
