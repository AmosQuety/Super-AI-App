import { IntelligentMatcher, MatchResult } from "./IntelligentMatcher";

interface PatternAnalysis {
  input: string;
  matched: boolean;
  confidence: number;
  suggestedKey: string | null;
  recommendedAddition: boolean;
  recommendedPattern?: string;
  recommendedResponse?: string;
}

class PatternAnalyzer {
  private matcher: IntelligentMatcher;
  private history: string[] = [];
  private readonly maxHistorySize = 500; // Reduced from 1000
  private simpleHistory: Set<string> = new Set();

  constructor(matcher: IntelligentMatcher) {
    this.matcher = matcher;
  }

  /**
   * Analyze user input and provide insights
   */
  async analyzeInput(input: string): Promise<PatternAnalysis> {
    try {
      const result = await this.matcher.findBestMatch(input);
      this.addToHistory(input);

      const analysis: PatternAnalysis = {
        input,
        matched: result.match !== null,
        confidence: result.confidence,
        suggestedKey: result.match,
        recommendedAddition: this.shouldRecommendAddition(input, result),
      };

      if (analysis.recommendedAddition) {
        const { pattern, response } = this.generateRecommendation(input);
        analysis.recommendedPattern = pattern;
        analysis.recommendedResponse = response;
      }

      return analysis;
    } catch (error) {
      console.error("Pattern analysis failed:", error);
      return this.createFallbackAnalysis(input);
    }
  }

  /**
   * Determine if we should recommend adding this pattern to responses
   */
  private shouldRecommendAddition(input: string, result: MatchResult): boolean {
    // Don't recommend if it already matches well
    if (result.confidence > 0.6) return false;

    // Don't recommend very short inputs
    if (input.trim().length < 3) return false;

    // Check if this is a frequent pattern (seen at least 3 times)
    const frequency = this.getFrequency(input);
    return frequency >= 3 && result.confidence < 0.4;
  }

  /**
   * Add input to history with size management
   */
  private addToHistory(input: string): void {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Add to both collections
    this.history.push(trimmedInput);
    this.simpleHistory.add(trimmedInput.toLowerCase());

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      // Remove oldest entries
      const itemsToRemove = this.history.length - this.maxHistorySize;
      const removed = this.history.splice(0, itemsToRemove);
      
      // Also clean simpleHistory
      removed.forEach(item => {
        this.simpleHistory.delete(item.toLowerCase());
      });
    }
  }

  /**
   * Get frequency of similar inputs in history
   */
  private getFrequency(input: string): number {
    const normalized = input.toLowerCase().trim();
    if (!normalized) return 0;

    // Use simpleHistory for faster lookups
    let count = 0;
    for (const item of this.simpleHistory) {
      if (item.includes(normalized) || normalized.includes(item)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Generate recommendation for unmatched patterns
   */
  private generateRecommendation(input: string): { pattern: string; response: string } {
    const lowerInput = input.toLowerCase().trim();

    // Intent detection for common patterns
    if (lowerInput.includes("what") && lowerInput.includes("name")) {
      return {
        pattern: "what is your name",
        response: "My name is Blaze. How can I help you?",
      };
    }

    if (
      lowerInput.includes("who") &&
      (lowerInput.includes("create") || lowerInput.includes("made") || lowerInput.includes("develop"))
    ) {
      return {
        pattern: "who created you",
        response: "I was developed by a talented developer.",
      };
    }

    if (lowerInput.includes("how") && lowerInput.includes("are")) {
      return {
        pattern: "how are you",
        response: "I'm doing well, thank you for asking!",
      };
    }

    if (lowerInput.includes("joke") || lowerInput.includes("funny")) {
      return {
        pattern: "tell me a joke",
        response: "Why did the chatbot cross the road? To get to the other server!",
      };
    }

    if (lowerInput.includes("help") || lowerInput.includes("assist")) {
      return {
        pattern: "can you help me",
        response: "Absolutely! What do you need help with?",
      };
    }

    // Default fallback - keep it simple
    return {
      pattern: this.extractKeyPhrase(input),
      response: `I'm not sure how to respond to "${input}". Can you try asking something else?`,
    };
  }

  /**
   * Extract key phrase from input for pattern suggestion
   */
  private extractKeyPhrase(input: string): string {
    const words = input.toLowerCase().trim().split(/\s+/);
    
    // Remove common filler words
    const fillerWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "is", "are", "was", "were", "am", "please", "hey",
      "hi", "hello", "okay", "ok", "well", "so", "then", "now", "just",
    ]);

    const meaningfulWords = words.filter(word => 
      word.length > 2 && !fillerWords.has(word)
    );

    return meaningfulWords.slice(0, 5).join(" ") || input.slice(0, 30);
  }

  /**
   * Create fallback analysis when matcher fails
   */
  private createFallbackAnalysis(input: string): PatternAnalysis {
    return {
      input,
      matched: false,
      confidence: 0,
      suggestedKey: null,
      recommendedAddition: false,
      recommendedPattern: input.slice(0, 50),
      recommendedResponse: "I encountered an error. Please try again.",
    };
  }

  /**
   * Get history for debugging/analytics
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Get unique history items (case-insensitive)
   */
  getUniqueHistory(): string[] {
    return Array.from(this.simpleHistory);
  }

  /**
   * Get statistics about history
   */
  getHistoryStats(): {
    total: number;
    unique: number;
    avgLength: number;
  } {
    const total = this.history.length;
    const unique = this.simpleHistory.size;
    const avgLength = total > 0 
      ? this.history.reduce((sum, item) => sum + item.length, 0) / total 
      : 0;

    return { total, unique, avgLength };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.simpleHistory.clear();
  }

  /**
   * Export history data
   */
  exportHistory(): {
    recent: string[];
    frequentPatterns: Array<{ pattern: string; count: number }>;
  } {
    const recent = this.history.slice(-20); // Last 20 entries
    
    // Count frequency of patterns
    const patternCount = new Map<string, number>();
    this.history.forEach(item => {
      const key = item.toLowerCase().trim();
      patternCount.set(key, (patternCount.get(key) || 0) + 1);
    });

    const frequentPatterns = Array.from(patternCount.entries())
      .filter(([_, count]) => count > 2)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    return { recent, frequentPatterns };
  }
}

export default PatternAnalyzer;
export type { PatternAnalysis };