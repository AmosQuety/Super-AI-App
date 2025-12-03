// FILE: IntelligentMatcher.ts
// Optimized and cleaned version

// ==================== TYPES ====================

export interface MatchResult {
  match: string | null;
  confidence: number;
  suggestedResponse: string | null;
  algorithmUsed: string;
  processingTime: number;
  debug?: {
    candidates: string[];
    scores: { [key: string]: { [algorithm: string]: number } };
    preprocessing: {
      original: string;
      normalized: string;
      tokens: string[];
      stemmed: string[];
    };
  };
}

export interface CustomResponses {
  [key: string]: string;
}

export interface MatcherConfig {
  confidenceThreshold: number;
  useLevenshtein: boolean;
  useJaroWinkler: boolean;
  useNgrams: boolean;
  maxNgramSize: number;
  minNgramSize: number;
  enableStemming: boolean;
  enableStopwordRemoval: boolean;
  maxProcessingTimeMs: number;
  enableDebugMode: boolean;
  enableLearning: boolean;
  minFrequencyForSuggestion: number;
  maxInputLength: number;
}

interface LearningPattern {
  input: string;
  frequency: number;
  firstSeen: number;
  lastSeen: number;
  suggestedKey?: string;
  suggestedResponse?: string;
}

interface AlgorithmWeights {
  levenshtein: number;
  jaroWinkler: number;
  ngram: number;
  exact: number;
}

// ==================== TEXT PREPROCESSOR ====================

class TextPreprocessor {
  private static readonly STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
    "to", "was", "were", "will", "with", "you", "your", "me", "my",
    "i", "we", "us", "they", "them", "their", "this", "these", "those",
    "what", "who", "when", "where", "why", "how", "can", "could", "would",
    "should", "might", "may", "must", "do", "does", "did", "have", "had",
    "been", "being", "am", "just", "now", "then", "here", "there", "very",
    "really", "quite", "pretty", "so", "too", "well", "also", "oh", "hey",
    "hi", "hello", "yeah", "yes", "no", "ok", "okay", "please", "thanks",
    "thank", "bro", "dude", "man",
  ]);

  private static readonly CONTRACTIONS_MAP: Map<string, string> = new Map([
    ["won't", "will not"], ["can't", "cannot"], ["n't", " not"],
    ["'re", " are"], ["'ve", " have"], ["'ll", " will"], ["'d", " would"],
    ["'m", " am"], ["'s", " is"], ["what's", "what is"], ["who's", "who is"],
    ["where's", "where is"], ["when's", "when is"], ["why's", "why is"],
    ["how's", "how is"], ["that's", "that is"], ["there's", "there is"],
    ["here's", "here is"], ["it's", "it is"], ["he's", "he is"],
    ["she's", "she is"], ["let's", "let us"], ["i'm", "i am"],
    ["you're", "you are"], ["we're", "we are"], ["they're", "they are"],
    ["you've", "you have"], ["we've", "we have"], ["they've", "they have"],
    ["i've", "i have"], ["you'll", "you will"], ["we'll", "we will"],
    ["they'll", "they will"], ["i'll", "i will"], ["he'll", "he will"],
    ["she'll", "she will"], ["you'd", "you would"], ["we'd", "we would"],
    ["they'd", "they would"], ["i'd", "i would"], ["he'd", "he would"],
    ["she'd", "she would"],
  ]);

  private static readonly STEMMING_RULES = [
    { suffix: "ies", replacement: "y", minLength: 4 },
    { suffix: "ied", replacement: "y", minLength: 4 },
    { suffix: "ying", replacement: "y", minLength: 5 },
    { suffix: "ing", replacement: "", minLength: 4 },
    { suffix: "ly", replacement: "", minLength: 4 },
    { suffix: "ed", replacement: "", minLength: 4 },
    { suffix: "es", replacement: "", minLength: 4 },
    { suffix: "s", replacement: "", minLength: 3 },
    { suffix: "er", replacement: "", minLength: 4 },
  ];

  /**
   * Comprehensive text normalization pipeline
   */
  static normalize(
    text: string,
    options: Partial<Pick<MatcherConfig, 'enableStemming' | 'enableStopwordRemoval'>> = {}
  ): {
    normalized: string;
    tokens: string[];
    stemmed: string[];
    original: string;
  } {
    let normalized = text.toLowerCase().trim();

    // Handle contractions
    for (const [contraction, expansion] of this.CONTRACTIONS_MAP) {
      normalized = normalized.replace(new RegExp(contraction, "gi"), expansion);
    }

    // Remove special characters but keep apostrophes and hyphens
    normalized = normalized.replace(/[^\w\s'-]/g, " ");

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, " ").trim();

    // Tokenize
    let tokens = normalized.split(/\s+/).filter((token) => token.length > 0);

    // Remove stop words if enabled
    if (options.enableStopwordRemoval !== false) {
      tokens = tokens.filter((token) => !this.STOP_WORDS.has(token));
    }

    // Apply stemming if enabled
    let stemmed = tokens;
    if (options.enableStemming !== false) {
      stemmed = tokens.map((token) => this.stem(token));
    }

    return {
      normalized: stemmed.join(" "),
      tokens,
      stemmed,
      original: text,
    };
  }

  /**
   * Simple Porter-like stemmer
   */
  private static stem(word: string): string {
    if (word.length < 3) return word;

    for (const rule of this.STEMMING_RULES) {
      if (word.length >= rule.minLength && word.endsWith(rule.suffix)) {
        const stem = word.slice(0, -rule.suffix.length) + rule.replacement;
        if (stem.length >= 2) {
          return stem;
        }
      }
    }

    return word;
  }
}

// ==================== SIMILARITY ALGORITHMS ====================

class SimilarityAlgorithms {
  /**
   * Optimized Levenshtein distance
   */
  static levenshtein(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    // Use single array for memory efficiency
    const currentRow = new Array(len2 + 1);
    for (let i = 0; i <= len2; i++) currentRow[i] = i;
    
    for (let i = 1; i <= len1; i++) {
      const previousRow = [...currentRow];
      currentRow[0] = i;
      
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        currentRow[j] = Math.min(
          previousRow[j] + 1,      // deletion
          currentRow[j - 1] + 1,   // insertion
          previousRow[j - 1] + cost // substitution
        );
      }
    }
    
    const distance = currentRow[len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }

  /**
   * Jaro-Winkler similarity
   */
  static jaroWinkler(s1: string, s2: string, prefixScale: number = 0.1): number {
    if (s1 === s2) return 1;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0 || len2 === 0) return 0;
    
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    
    let matches = 0;
    
    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);
      
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0;
    
    // Count transpositions
    let transpositions = 0;
    let k = 0;
    
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    
    const jaro = (
      matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches
    ) / 3;
    
    // Winkler prefix bonus
    let prefix = 0;
    const maxPrefix = Math.min(4, len1, len2);
    for (let i = 0; i < maxPrefix; i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }
    
    return jaro + prefix * prefixScale * (1 - jaro);
  }

  /**
   * N-gram similarity
   */
  static ngramSimilarity(s1: string, s2: string, n: number = 2): number {
    if (s1 === s2) return 1;
    
    const ngrams1 = this.generateNgrams(s1, n);
    const ngrams2 = this.generateNgrams(s2, n);
    
    if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;
    
    let intersection = 0;
    for (const gram of ngrams1) {
      if (ngrams2.has(gram)) intersection++;
    }
    
    const union = ngrams1.size + ngrams2.size - intersection;
    return intersection / union;
  }

  /**
   * Generate n-grams from string
   */
  private static generateNgrams(str: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    if (str.length === 0) return ngrams;
    
    const words = str.split(/\s+/);
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(" ");
      if (ngram.trim()) ngrams.add(ngram);
    }
    
    return ngrams;
  }
}

// ==================== MAIN INTELLIGENT MATCHER ====================

export class IntelligentMatcher {
  private customResponses: CustomResponses;
  private responseKeys: string[];
  private config: MatcherConfig;
  private preprocessedKeys: Map<string, ReturnType<typeof TextPreprocessor.normalize>>;
  private ngramIndex: Map<string, Set<string>>;
  private learningPatterns: Map<string, LearningPattern>;
  private weights: AlgorithmWeights;

  constructor(
    customResponses: CustomResponses,
    config: Partial<MatcherConfig> = {}
  ) {
    this.customResponses = customResponses;
    this.responseKeys = Object.keys(customResponses);
    this.learningPatterns = new Map();

    // Default configuration - optimized for chat applications
    this.config = {
      confidenceThreshold: 0.65,          // Slightly lowered for better matching
      useLevenshtein: true,
      useJaroWinkler: true,
      useNgrams: true,
      maxNgramSize: 3,
      minNgramSize: 2,
      enableStemming: true,
      enableStopwordRemoval: true,
      maxProcessingTimeMs: 50,            // Faster processing
      enableDebugMode: false,
      enableLearning: true,
      minFrequencyForSuggestion: 2,       // More sensitive to patterns
      maxInputLength: 500,                // Reasonable chat limit
      ...config,
    };

    // Optimized algorithm weights
    this.weights = {
      exact: 1.0,
      jaroWinkler: 0.4,      // Increased weight for better prefix matching
      levenshtein: 0.35,     // Good for typos
      ngram: 0.25,           // Good for word order
    };

    this.preprocessedKeys = new Map();
    this.ngramIndex = new Map();
    this.buildIndexes();
  }

  /**
   * Main public entry point for matching with robust error handling
   */
  public async findBestMatch(userInput: string): Promise<MatchResult> {
    const startTime = performance.now();
    
    try {
      // Quick input validation
      if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
        return this.createEmptyResult(startTime);
      }

      // Limit input size for safety and performance
      const safeInput = userInput.substring(0, this.config.maxInputLength).trim();
      
      // Call core matching logic
      const result = await this.performMatch(safeInput, startTime);
      
      // Record learning pattern if enabled
      if (this.config.enableLearning && result.match === null) {
        this.recordLearningPattern(safeInput, true);
      }
      
      return result;
      
    } catch (error) {
      console.warn('IntelligentMatcher error:', error);
      return {
        match: null,
        confidence: 0,
        suggestedResponse: "I'm having trouble understanding. Can you try rephrasing?",
        algorithmUsed: "error",
        processingTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Core matching logic
   */
  private async performMatch(userInput: string, startTime: number): Promise<MatchResult> {
    // Preprocessing
    const inputProcessing = TextPreprocessor.normalize(userInput, {
      enableStemming: this.config.enableStemming,
      enableStopwordRemoval: this.config.enableStopwordRemoval,
    });

    // Fast path: Exact match
    const exactMatch = this.findExactMatch(inputProcessing.normalized);
    if (exactMatch) {
      return this.buildResult({
        match: exactMatch,
        confidence: 1.0,
        algorithmUsed: "exact",
        processingTime: performance.now() - startTime,
        preprocessing: inputProcessing,
      });
    }

    // Get candidate matches
    const candidates = this.getCandidates(inputProcessing.normalized);
    if (candidates.length === 0) {
      return this.buildResult({
        match: null,
        confidence: 0,
        algorithmUsed: "none",
        processingTime: performance.now() - startTime,
        preprocessing: inputProcessing,
      });
    }

    // Score candidates
    const bestCandidate = this.scoreCandidates(inputProcessing, candidates);
    const processingTime = performance.now() - startTime;

    // Performance warning
    if (processingTime > this.config.maxProcessingTimeMs) {
      console.warn(`Processing took ${processingTime.toFixed(1)}ms (limit: ${this.config.maxProcessingTimeMs}ms)`);
    }

    // Return best match if confidence threshold met
    if (bestCandidate.confidence >= this.config.confidenceThreshold) {
      return this.buildResult({
        match: bestCandidate.key,
        confidence: bestCandidate.confidence,
        algorithmUsed: bestCandidate.primaryAlgorithm,
        suggestedResponse: this.customResponses[bestCandidate.key],
        processingTime,
        preprocessing: inputProcessing,
      });
    }

    // No confident match found
    return this.buildResult({
      match: null,
      confidence: bestCandidate.confidence,
      algorithmUsed: bestCandidate.primaryAlgorithm,
      processingTime,
      preprocessing: inputProcessing,
    });
  }

  /**
   * Build preprocessing and search indexes
   */
  private buildIndexes(): void {
    // Preprocess all response keys
    for (const key of this.responseKeys) {
      const processed = TextPreprocessor.normalize(key, {
        enableStemming: this.config.enableStemming,
        enableStopwordRemoval: this.config.enableStopwordRemoval,
      });
      
      this.preprocessedKeys.set(key, processed);

      // Build n-gram index
      if (this.config.useNgrams) {
        for (let n = this.config.minNgramSize; n <= this.config.maxNgramSize; n++) {
          const ngrams = this.generateNgrams(processed.normalized, n);
          for (const ngram of ngrams) {
            if (!this.ngramIndex.has(ngram)) {
              this.ngramIndex.set(ngram, new Set());
            }
            this.ngramIndex.get(ngram)!.add(key);
          }
        }
      }
    }
  }

  /**
   * Find exact matches
   */
  private findExactMatch(normalizedInput: string): string | null {
    for (const [key, processed] of this.preprocessedKeys) {
      if (processed.normalized === normalizedInput) {
        return key;
      }
    }
    return null;
  }

  /**
   * Get candidate matches using n-gram index
   */
  private getCandidates(normalizedInput: string): string[] {
    const candidates = new Set<string>();
    
    if (this.config.useNgrams && this.ngramIndex.size > 0) {
      const inputNgrams = this.generateNgrams(normalizedInput, this.config.minNgramSize);
      
      for (const ngram of inputNgrams) {
        const matches = this.ngramIndex.get(ngram);
        if (matches) {
          for (const match of matches) {
            candidates.add(match);
          }
        }
      }
    }
    
    // Fallback: include all keys if few candidates
    if (candidates.size < 3 && this.responseKeys.length < 50) {
      for (const key of this.responseKeys) {
        candidates.add(key);
      }
    }
    
    return Array.from(candidates);
  }

  /**
   * Score all candidates and return the best one
   */
  private scoreCandidates(
    inputProcessing: ReturnType<typeof TextPreprocessor.normalize>,
    candidates: string[]
  ): { key: string; confidence: number; primaryAlgorithm: string } {
    let bestScore = -1;
    let bestCandidate = { key: "", confidence: 0, primaryAlgorithm: "none" };
    
    for (const candidate of candidates) {
      const candidateProcessing = this.preprocessedKeys.get(candidate);
      if (!candidateProcessing) continue;
      
      const scores = this.calculateScores(inputProcessing, candidateProcessing);
      const confidence = this.combineScores(scores);
      const primaryAlgorithm = this.getPrimaryAlgorithm(scores);
      
      if (confidence > bestScore) {
        bestScore = confidence;
        bestCandidate = { key: candidate, confidence, primaryAlgorithm };
      }
    }
    
    return bestCandidate;
  }

  /**
   * Calculate similarity scores using enabled algorithms
   */
  private calculateScores(
    input: ReturnType<typeof TextPreprocessor.normalize>,
    candidate: ReturnType<typeof TextPreprocessor.normalize>
  ): { [algorithm: string]: number } {
    const scores: { [algorithm: string]: number } = {};
    
    if (this.config.useLevenshtein) {
      scores.levenshtein = SimilarityAlgorithms.levenshtein(
        input.normalized,
        candidate.normalized
      );
    }
    
    if (this.config.useJaroWinkler) {
      scores.jaroWinkler = SimilarityAlgorithms.jaroWinkler(
        input.normalized,
        candidate.normalized
      );
    }
    
    if (this.config.useNgrams) {
      scores.ngram = SimilarityAlgorithms.ngramSimilarity(
        input.normalized,
        candidate.normalized
      );
    }
    
    return scores;
  }

  /**
   * Combine algorithm scores using weighted average
   */
  private combineScores(scores: { [algorithm: string]: number }): number {
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const [algorithm, score] of Object.entries(scores)) {
      const weight = this.weights[algorithm as keyof AlgorithmWeights] || 0.1;
      weightedSum += score * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Determine which algorithm contributed most
   */
  private getPrimaryAlgorithm(scores: { [algorithm: string]: number }): string {
    let maxContribution = 0;
    let primaryAlgorithm = "hybrid";
    
    for (const [algorithm, score] of Object.entries(scores)) {
      const weight = this.weights[algorithm as keyof AlgorithmWeights] || 0.1;
      const contribution = score * weight;
      
      if (contribution > maxContribution) {
        maxContribution = contribution;
        primaryAlgorithm = algorithm;
      }
    }
    
    return primaryAlgorithm;
  }

  /**
   * Generate n-grams
   */
  private generateNgrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    const tokens = text.split(/\s+/);
    
    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(" ");
      if (ngram.trim()) ngrams.add(ngram);
    }
    
    return ngrams;
  }

  /**
   * Record learning patterns
   */
  private recordLearningPattern(userInput: string, noMatch: boolean): void {
    const normalizedInput = userInput.toLowerCase().trim();
    const now = Date.now();
    
    if (this.learningPatterns.has(normalizedInput)) {
      const pattern = this.learningPatterns.get(normalizedInput)!;
      pattern.frequency++;
      pattern.lastSeen = now;
    } else {
      this.learningPatterns.set(normalizedInput, {
        input: userInput,
        frequency: 1,
        firstSeen: now,
        lastSeen: now,
        ...(noMatch && this.generateSuggestion(userInput)),
      });
    }
  }

  /**
   * Generate suggestions for unmatched patterns
   */
  private generateSuggestion(userInput: string): {
    suggestedKey?: string;
    suggestedResponse?: string;
  } {
    const normalized = userInput.toLowerCase();
    
    // Look for similar patterns
    for (const [key] of this.preprocessedKeys) {
      if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
        return {
          suggestedKey: key,
          suggestedResponse: this.customResponses[key],
        };
      }
    }
    
    return {};
  }

  /**
   * Helper to build MatchResult object
   */
  private buildResult(params: {
    match: string | null;
    confidence: number;
    algorithmUsed: string;
    processingTime: number;
    preprocessing?: ReturnType<typeof TextPreprocessor.normalize>;
    suggestedResponse?: string | null;
  }): MatchResult {
    const result: MatchResult = {
      match: params.match,
      confidence: params.confidence,
      suggestedResponse: params.suggestedResponse !== undefined 
        ? params.suggestedResponse 
        : params.match 
          ? this.customResponses[params.match] 
          : null,
      algorithmUsed: params.algorithmUsed,
      processingTime: params.processingTime,
    };
    
    // Add debug info if enabled
    if (this.config.enableDebugMode && params.preprocessing) {
      result.debug = {
        candidates: [],
        scores: {},
        preprocessing: params.preprocessing,
      };
    }
    
    return result;
  }

  /**
   * Create empty result
   */
  private createEmptyResult(startTime: number): MatchResult {
    return {
      match: null,
      confidence: 0,
      suggestedResponse: null,
      algorithmUsed: "none",
      processingTime: performance.now() - startTime,
    };
  }

  // ==================== PUBLIC API ====================

  /**
   * Add new responses and rebuild indexes
   */
  public addResponses(newResponses: CustomResponses): void {
    Object.assign(this.customResponses, newResponses);
    this.responseKeys = Object.keys(this.customResponses);
    this.buildIndexes();
  }

  /**
   * Get learning patterns for analysis
   */
  public getLearningPatterns(): LearningPattern[] {
    return Array.from(this.learningPatterns.values()).sort(
      (a, b) => b.frequency - a.frequency
    );
  }

  /**
   * Clear learning patterns
   */
  public clearLearningPatterns(): void {
    this.learningPatterns.clear();
  }

  /**
   * Get current configuration
   */
  public getConfig(): MatcherConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<MatcherConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.buildIndexes();
  }

  /**
   * Get performance statistics
   */
  public getStats(): {
    totalResponses: number;
    ngramIndexSize: number;
    learningPatterns: number;
  } {
    return {
      totalResponses: this.responseKeys.length,
      ngramIndexSize: this.ngramIndex.size,
      learningPatterns: this.learningPatterns.size,
    };
  }
}

// ==================== FACTORY FUNCTION ====================

/**
 * Factory function for creating optimized matcher instances
 */
export function createIntelligentMatcher(
  customResponses: CustomResponses,
  options: {
    optimizeFor?: "speed" | "accuracy" | "balanced";
    debugMode?: boolean;
  } = {}
): IntelligentMatcher {
  const { optimizeFor = "balanced", debugMode = false } = options;
  
  let config: Partial<MatcherConfig>;
  
  switch (optimizeFor) {
    case "speed":
      config = {
        confidenceThreshold: 0.6,
        useLevenshtein: false,
        useJaroWinkler: true,
        useNgrams: true,
        enableStemming: false,
        maxProcessingTimeMs: 20,
        enableDebugMode: debugMode,
      };
      break;
      
    case "accuracy":
      config = {
        confidenceThreshold: 0.75,
        useLevenshtein: true,
        useJaroWinkler: true,
        useNgrams: true,
        enableStemming: true,
        maxProcessingTimeMs: 100,
        enableDebugMode: debugMode,
      };
      break;
      
    default: // balanced
      config = {
        confidenceThreshold: 0.65,
        useLevenshtein: true,
        useJaroWinkler: true,
        useNgrams: true,
        enableStemming: true,
        maxProcessingTimeMs: 50,
        enableDebugMode: debugMode,
      };
  }
  
  return new IntelligentMatcher(customResponses, config);
}

