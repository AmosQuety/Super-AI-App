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
  private readonly maxHistorySize = 1000;
  private readonly memoryMonitor: MemoryMonitor;

  constructor(matcher: IntelligentMatcher) {
    this.matcher = matcher;
    this.memoryMonitor = new MemoryMonitor();
  }
  
  analyzeInput(input: string): PatternAnalysis {
    // Memory safety check
    if (this.memoryMonitor.isMemoryCritical()) {
      this.clearHistory();
    }

    const result = this.matcher.findBestMatch(input);
    this.addToHistory(input);
    
    const analysis: PatternAnalysis = {
      input,
      matched: result.match !== null,
      confidence: result.confidence,
      suggestedKey: result.match,
      recommendedAddition: this.shouldRecommendAddition(input, result)
    };
    
    if (analysis.recommendedAddition) {
      const { pattern, response } = this.generateRecommendation(input);
      analysis.recommendedPattern = pattern;
      analysis.recommendedResponse = response;
    }
    
    return analysis;
  }
  
  private shouldRecommendAddition(input: string, result: MatchResult): boolean {
    // Don't recommend if it already matches well
    if (result.confidence > 0.6) return false;
    
    // Don't recommend very short inputs
    if (input.length < 3) return false;
    
    // Check if this is a frequent pattern
    const frequency = this.getFrequency(input);
    
    // Recommend if seen multiple times with low confidence
    return frequency >= 2 && result.confidence < 0.4;
  }
  
  private addToHistory(input: string): void {
    this.history.push(input);
    
    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-Math.floor(this.maxHistorySize * 0.8));
    }
  }
  
  private getFrequency(input: string): number {
    const normalized = input.toLowerCase().trim();
    return this.history.filter(item => 
      item.toLowerCase().trim() === normalized).length;
  }
  
  private generateRecommendation(input: string): { pattern: string, response: string } {
    // Simple heuristic-based response generation
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('what') && lowerInput.includes('name')) {
      return { 
        pattern: 'what is your name', 
        response: 'My name is Blaze. How can I help you?' 
      };
    }
    
    if (lowerInput.includes('who') && lowerInput.includes('create')) {
      return { 
        pattern: 'who created you', 
        response: 'I was developed by a talented developer.' 
      };
    }
    
    if (lowerInput.includes('how') && lowerInput.includes('are')) {
      return { 
        pattern: 'how are you', 
        response: 'I\'m doing well, thank you for asking!' 
      };
    }
    
    if (lowerInput.includes('joke')) {
      return { 
        pattern: 'tell me a joke', 
        response: 'Why did the chatbot cross the road? To get to the other server!' 
      };
    }
    
    // Default fallback
    return { 
      pattern: input, 
      response: `I'm not sure how to respond to "${input}". Can you try asking something else?` 
    };
  }
  
  getHistory(): string[] {
    return [...this.history];
  }
  
  clearHistory(): void {
    this.history = [];
  }
}

export default PatternAnalyzer;