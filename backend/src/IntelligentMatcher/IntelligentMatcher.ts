import { CircuitBreaker } from "./safety/CircuitBreaker";
import { TimeoutManager } from "./safety/TimeoutManager";

interface MatchResult {
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
  error?: string; // Added missing property
}

interface CustomResponses {
  [key: string]: string;
}

interface MatcherConfig {
  confidenceThreshold: number;
  useLevenshtein: boolean;
  useJaroWinkler: boolean;
  useCosineSimilarity: boolean;
  useNgrams: boolean;
  useSemanticSimilarity: boolean;
  maxNgramSize: number;
  minNgramSize: number;
  enableStemming: boolean;
  enableStopwordRemoval: boolean;
  enableSpellCheck: boolean;
  maxProcessingTimeMs: number;
  enableDebugMode: boolean;
  enableLearning: boolean;
  minFrequencyForSuggestion: number;
  maxInputLength: number;
  enableSafetyFeatures: boolean;
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
  cosine: number;
  ngram: number;
  semantic: number;
  exact: number;
}

/**
 * Factory function for creating optimized matcher instances
 */
export function createIntelligentMatcher(
  customResponses: CustomResponses,
  options: {
    optimizeFor?: "speed" | "accuracy" | "balanced";
    debugMode?: boolean;
    enableLearning?: boolean;
  } = {}
): IntelligentMatcher {
  const {
    optimizeFor = "balanced",
    debugMode = false,
    enableLearning = true,
  } = options;

  let config: Partial<MatcherConfig>;

  switch (optimizeFor) {
    case "speed":
      config = {
        confidenceThreshold: 0.6,
        useLevenshtein: false,
        useJaroWinkler: true,
        useCosineSimilarity: false,
        useNgrams: true,
        useSemanticSimilarity: false,
        enableStemming: false,
        enableStopwordRemoval: true,
        maxProcessingTimeMs: 5,
        enableDebugMode: debugMode,
        enableLearning,
      };
      break;

    case "accuracy":
      config = {
        confidenceThreshold: 0.8,
        useLevenshtein: true,
        useJaroWinkler: true,
        useCosineSimilarity: true,
        useNgrams: true,
        useSemanticSimilarity: true,
        enableStemming: true,
        enableStopwordRemoval: true,
        maxProcessingTimeMs: 15,
        enableDebugMode: debugMode,
        enableLearning,
      };
      break;

    default: // balanced
      config = {
        confidenceThreshold: 0.7,
        useLevenshtein: true,
        useJaroWinkler: true,
        useCosineSimilarity: true,
        useNgrams: true,
        useSemanticSimilarity: true,
        enableStemming: true,
        enableStopwordRemoval: true,
        maxProcessingTimeMs: 10,
        enableDebugMode: debugMode,
        enableLearning,
      };
  }

  return new IntelligentMatcher(customResponses, config);
}

/**
 * Utility class for testing and validation
 */
export class MatcherTester {
  /**
   * Generate comprehensive test cases
   */
  static generateTestCases(customResponses: CustomResponses): Array<{
    input: string;
    expectedMatch: string;
    category: string;
  }> {
    const testCases: Array<{
      input: string;
      expectedMatch: string;
      category: string;
    }> = [];

    for (const [key] of Object.entries(customResponses)) {
      // Exact matches
      testCases.push({
        input: key,
        expectedMatch: key,
        category: "exact",
      });

      // Case variations
      testCases.push({
        input: key.toUpperCase(),
        expectedMatch: key,
        category: "case_variation",
      });

      // With extra spaces
      testCases.push({
        input: key.replace(/\s+/g, "  "),
        expectedMatch: key,
        category: "spacing_variation",
      });

      // With punctuation
      testCases.push({
        input: key + "?",
        expectedMatch: key,
        category: "punctuation_variation",
      });

      // With filler words
      testCases.push({
        input: "hey " + key + " please",
        expectedMatch: key,
        category: "filler_words",
      });

      // Synonym variations (basic)
      if (key.includes("what is your name")) {
        testCases.push({
          input: "what are you called",
          expectedMatch: key,
          category: "synonym_variation",
        });
      }

      if (key.includes("who developed you")) {
        testCases.push({
          input: "who made you",
          expectedMatch: key,
          category: "synonym_variation",
        });
        testCases.push({
          input: "who created you",
          expectedMatch: key,
          category: "synonym_variation",
        });
      }
    }

    return testCases;
  }

  /**
   * Run comprehensive test suite
   */
  static async runTestSuite(
    matcher: IntelligentMatcher,
    testCases?: Array<{
      input: string;
      expectedMatch: string;
      category: string;
    }>
  ): Promise<{
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
    categoryResults: {
      [category: string]: { passed: number; total: number; rate: number };
    };
    failures: Array<{
      input: string;
      expected: string;
      actual: string | null;
      confidence: number;
    }>;
  }> {
    if (!testCases) {
      const responses = matcher.exportState().customResponses;
      testCases = this.generateTestCases(responses);
    }

    const results = {
      totalTests: testCases.length,
      passed: 0,
      failed: 0,
      successRate: 0,
      categoryResults: {} as {
        [category: string]: { passed: number; total: number; rate: number };
      },
      failures: [] as Array<{
        input: string;
        expected: string;
        actual: string | null;
        confidence: number;
      }>,
    };

    // Initialize category tracking
    for (const testCase of testCases) {
      if (!results.categoryResults[testCase.category]) {
        results.categoryResults[testCase.category] = {
          passed: 0,
          total: 0,
          rate: 0,
        };
      }
      results.categoryResults[testCase.category].total++;
    }

    // Run tests
    for (const testCase of testCases) {
      const result = await matcher.findBestMatch(testCase.input);
      const passed = result.match === testCase.expectedMatch;

      if (passed) {
        results.passed++;
        results.categoryResults[testCase.category].passed++;
      } else {
        results.failed++;
        results.failures.push({
          input: testCase.input,
          expected: testCase.expectedMatch,
          actual: result.match,
          confidence: result.confidence,
        });
      }
    }

    // Calculate rates
    results.successRate = results.passed / results.totalTests;
    for (const category of Object.keys(results.categoryResults)) {
      const cat = results.categoryResults[category];
      cat.rate = cat.passed / cat.total;
    }

    return results;
  }
}

/**
 * Advanced text preprocessing utilities
 */
class TextPreprocessor {
  private static readonly STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "were",
    "will",
    "with",
    "you",
    "your",
    "me",
    "my",
    "i",
    "we",
    "us",
    "they",
    "them",
    "their",
    "this",
    "these",
    "those",
    "what",
    "who",
    "when",
    "where",
    "why",
    "how",
    "can",
    "could",
    "would",
    "should",
    "might",
    "may",
    "must",
    "do",
    "does",
    "did",
    "have",
    "had",
    "been",
    "being",
    "am",
    "is",
    "are",
    "was",
    "were",
    "just",
    "now",
    "then",
    "here",
    "there",
    "very",
    "really",
    "quite",
    "pretty",
    "so",
    "too",
    "well",
    "also",
    "oh",
    "hey",
    "hi",
    "hello",
    "yeah",
    "yes",
    "no",
    "ok",
    "okay",
    "please",
    "thanks",
    "thank",
    "bro",
    "dude",
    "man",
  ]);

  private static readonly CONTRACTIONS_MAP = new Map([
    ["won't", "will not"],
    ["can't", "cannot"],
    ["n't", " not"],
    ["'re", " are"],
    ["'ve", " have"],
    ["'ll", " will"],
    ["'d", " would"],
    ["'m", " am"],
    ["'s", " is"],
    ["what's", "what is"],
    ["who's", "who is"],
    ["where's", "where is"],
    ["when's", "when is"],
    ["why's", "why is"],
    ["how's", "how is"],
    ["that's", "that is"],
    ["there's", "there is"],
    ["here's", "here is"],
    ["it's", "it is"],
    ["he's", "he is"],
    ["she's", "she is"],
    ["let's", "let us"],
    ["i'm", "i am"],
    ["you're", "you are"],
    ["we're", "we are"],
    ["they're", "they are"],
    ["you've", "you have"],
    ["we've", "we have"],
    ["they've", "they have"],
    ["i've", "i have"],
    ["you'll", "you will"],
    ["we'll", "we will"],
    ["they'll", "they will"],
    ["i'll", "i will"],
    ["he'll", "he will"],
    ["she'll", "she will"],
    ["you'd", "you would"],
    ["we'd", "we would"],
    ["they'd", "they would"],
    ["i'd", "i would"],
    ["he'd", "he would"],
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
    { suffix: "est", replacement: "", minLength: 5 },
    { suffix: "ment", replacement: "", minLength: 6 },
    { suffix: "ness", replacement: "", minLength: 6 },
    { suffix: "able", replacement: "", minLength: 6 },
    { suffix: "ible", replacement: "", minLength: 6 },
    { suffix: "tion", replacement: "", minLength: 6 },
    { suffix: "sion", replacement: "", minLength: 6 },
  ];

  /**
   * Comprehensive text normalization pipeline
   */
  static normalize(
    text: string,
    options: Partial<MatcherConfig> = {}
  ): {
    normalized: string;
    tokens: string[];
    stemmed: string[];
    original: string;
  } {
    const original = text;
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
      original,
    };
  }

  /**
   * Advanced Porter-like stemmer
   */
  private static stem(word: string): string {
    if (word.length < 3) return word;

    for (const rule of this.STEMMING_RULES) {
      if (word.length >= rule.minLength && word.endsWith(rule.suffix)) {
        const stem = word.slice(0, -rule.suffix.length) + rule.replacement;
        // Avoid over-stemming by ensuring the stem is reasonable
        if (stem.length >= 2) {
          return stem;
        }
      }
    }

    return word;
  }

  /**
   * Extract semantic features from text
   */
  static extractFeatures(text: string): {
    questionWords: string[];
    entities: string[];
    actionVerbs: string[];
    sentiment: "positive" | "negative" | "neutral";
  } {
    const normalized = text.toLowerCase();
    const tokens = normalized.split(/\s+/);

    const questionWords = tokens.filter((token) =>
      ["what", "who", "when", "where", "why", "how", "which", "whose"].includes(
        token
      )
    );

    const actionVerbs = tokens.filter((token) =>
      [
        "make",
        "create",
        "build",
        "develop",
        "design",
        "do",
        "help",
        "assist",
        "tell",
        "show",
        "explain",
        "teach",
        "learn",
        "work",
        "function",
      ].includes(token)
    );

    // Simple entity recognition (can be enhanced)
    const entities = tokens.filter(
      (token) =>
        token.charAt(0).toUpperCase() === token.charAt(0) && token.length > 1
    );

    // Basic sentiment analysis
    const positiveWords = [
      "good",
      "great",
      "awesome",
      "nice",
      "love",
      "like",
      "best",
    ];
    const negativeWords = [
      "bad",
      "terrible",
      "hate",
      "worst",
      "awful",
      "sucks",
    ];

    const positiveCount = tokens.filter((token) =>
      positiveWords.includes(token)
    ).length;
    const negativeCount = tokens.filter((token) =>
      negativeWords.includes(token)
    ).length;

    let sentiment: "positive" | "negative" | "neutral" = "neutral";
    if (positiveCount > negativeCount) sentiment = "positive";
    else if (negativeCount > positiveCount) sentiment = "negative";

    return { questionWords, entities, actionVerbs, sentiment };
  }
}

/**
 * Advanced similarity algorithms collection
 */
class SimilarityAlgorithms {
  /**
   * Levenshtein distance with optimizations
   */
  static levenshtein(s1: string, s2: string): number {
    // Input validation
    if (typeof s1 !== "string" || typeof s2 !== "string") {
      throw new Error("Both inputs must be strings");
    }

    const len1 = s1.length;
    const len2 = s2.length;

    // Memory safety check
    if (len1 > 1000 || len2 > 1000) {
      // Fallback to simpler algorithm for large inputs
      return this.jaroWinkler(s1, s2);
    }

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;
    if (s1 === s2) return 0;

    // Use two arrays instead of matrix for memory efficiency
    let prevRow = new Array(len2 + 1);
    let currRow = new Array(len2 + 1);

    // Initialize first row with bounds checking
    for (let i = 0; i <= len2; i++) {
      if (i >= prevRow.length) break; // Safety check
      prevRow[i] = i;
    }

    for (let i = 1; i <= len1; i++) {
      if (i >= currRow.length) break; // Safety check
      currRow[0] = i;

      for (let j = 1; j <= len2; j++) {
        if (j >= currRow.length) break; // Safety check

        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        currRow[j] = Math.min(
          prevRow[j] + 1, // deletion
          currRow[j - 1] + 1, // insertion
          prevRow[j - 1] + cost // substitution
        );
      }

      // Swap arrays with bounds checking
      if (prevRow.length === currRow.length) {
        [prevRow, currRow] = [currRow, prevRow];
      }
    }

    const distance = prevRow[len2];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - distance / maxLen;
  }

  /**
   * Jaro-Winkler similarity with prefix scaling
   */
  static jaroWinkler(
    s1: string,
    s2: string,
    prefixScale: number = 0.1
  ): number {
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0 && len2 === 0) return 1;
    if (len1 === 0 || len2 === 0) return 0;
    if (s1 === s2) return 1;

    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);

    let matches = 0;

    // Identify matches
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

    const jaro =
      (matches / len1 +
        matches / len2 +
        (matches - transpositions / 2) / matches) /
      3;

    // Winkler modification
    let prefix = 0;
    for (let i = 0; i < Math.min(4, len1, len2); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + prefix * prefixScale * (1 - jaro);
  }

  /**
   * N-gram similarity with configurable n
   */
  static ngramSimilarity(s1: string, s2: string, n: number = 2): number {
    const ngrams1 = this.generateNgrams(s1, n);
    const ngrams2 = this.generateNgrams(s2, n);

    if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

    const intersection = new Set(
      [...ngrams1].filter((gram) => ngrams2.has(gram))
    );
    const union = new Set([...ngrams1, ...ngrams2]);

    return intersection.size / union.size;
  }

  /**
   * Generate n-grams from string
   */
  private static generateNgrams(str: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    const padded = `${"#".repeat(n - 1)}${str}${"#".repeat(n - 1)}`;

    for (let i = 0; i <= padded.length - n; i++) {
      ngrams.add(padded.substring(i, i + n));
    }

    return ngrams;
  }

  /**
   * Cosine similarity using term frequency vectors
   */
  static cosineSimilarity(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 && tokens2.length === 0) return 1;
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    // Create vocabulary
    const vocab = new Set([...tokens1, ...tokens2]);
    const vocabArray = Array.from(vocab);

    // Create frequency vectors
    const vector1 = vocabArray.map(
      (term) => tokens1.filter((t) => t === term).length
    );
    const vector2 = vocabArray.map(
      (term) => tokens2.filter((t) => t === term).length
    );

    // Calculate dot product
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vocabArray.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  /**
   * Semantic similarity using simple word embeddings simulation
   */
  static semanticSimilarity(tokens1: string[], tokens2: string[]): number {
    // This is a simplified semantic similarity
    // In production, you'd use actual word embeddings (Word2Vec, GloVe, etc.)

    const semanticGroups = new Map([
      [
        "greeting",
        new Set([
          "hello",
          "hi",
          "hey",
          "greetings",
          "good",
          "morning",
          "afternoon",
          "evening",
        ]),
      ],
      [
        "identity",
        new Set([
          "name",
          "who",
          "what",
          "identity",
          "called",
          "am",
          "are",
          "is",
        ]),
      ],
      [
        "creation",
        new Set([
          "made",
          "created",
          "built",
          "developed",
          "designed",
          "programmed",
          "coded",
        ]),
      ],
      [
        "capability",
        new Set([
          "can",
          "able",
          "do",
          "help",
          "assist",
          "capable",
          "abilities",
          "skills",
        ]),
      ],
      [
        "status",
        new Set([
          "how",
          "doing",
          "feeling",
          "are",
          "status",
          "condition",
          "state",
        ]),
      ],
      [
        "humor",
        new Set([
          "joke",
          "funny",
          "laugh",
          "comedy",
          "humor",
          "amusing",
          "entertaining",
        ]),
      ],
      [
        "gratitude",
        new Set(["thank", "thanks", "grateful", "appreciate", "appreciation"]),
      ],
      [
        "farewell",
        new Set(["bye", "goodbye", "farewell", "later", "see", "leaving"]),
      ],
    ]);

    let maxSimilarity = 0;

    // Find semantic group matches - fixed unused variable
    for (const [, words] of semanticGroups) {
      const group1Matches = tokens1.filter((token) => words.has(token)).length;
      const group2Matches = tokens2.filter((token) => words.has(token)).length;

      if (group1Matches > 0 && group2Matches > 0) {
        const similarity =
          Math.min(group1Matches, group2Matches) /
          Math.max(group1Matches, group2Matches);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }

    return maxSimilarity;
  }
}

/**
 * Main Intelligent Matcher class
 */
export class IntelligentMatcher {
  private customResponses: CustomResponses;
  private responseKeys: string[];
  private config: MatcherConfig;
  private preprocessedKeys: Map<
    string,
    ReturnType<typeof TextPreprocessor.normalize>
  >;
  private ngramIndex: Map<string, Set<string>>;
  private learningPatterns: Map<string, LearningPattern>;
  private weights: AlgorithmWeights;
  // Remove unused variables
  // private circuitBreaker: CircuitBreaker;
  // private timeoutManager: TimeoutManager;

  constructor(
    customResponses: CustomResponses,
    config: Partial<MatcherConfig> = {}
  ) {
    this.customResponses = customResponses;
    this.responseKeys = Object.keys(customResponses);
    this.learningPatterns = new Map();
    // Remove unused initializations
    // this.circuitBreaker = new CircuitBreaker();
    // this.timeoutManager = new TimeoutManager();

    // Default configuration optimized for performance and accuracy
    this.config = {
      confidenceThreshold: 0.85,
      useLevenshtein: true,
      useJaroWinkler: true,
      useCosineSimilarity: true,
      useNgrams: true,
      useSemanticSimilarity: true,
      maxNgramSize: 3,
      minNgramSize: 2,
      enableStemming: true,
      enableStopwordRemoval: true,
      enableSpellCheck: false,
      maxProcessingTimeMs: 10,
      enableDebugMode: false,
      enableLearning: true,
      minFrequencyForSuggestion: 3,
      maxInputLength: 1000,
      enableSafetyFeatures: true,
      ...config,
    };

    // Algorithm weights optimized through testing
    this.weights = {
      exact: 1.0,
      jaroWinkler: 0.35,
      levenshtein: 0.25,
      cosine: 0.2,
      semantic: 0.15,
      ngram: 0.05,
    };

    this.preprocessedKeys = new Map();
    this.ngramIndex = new Map();

    this.buildIndexes();
  }

 private validateInput(input: string): void {
  // Simple, safe validation without memory checks
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  const trimmedInput = input.trim();
  
  if (trimmedInput.length === 0) {
    throw new Error('Input cannot be empty');
  }
  
  if (trimmedInput.length > (this.config.maxInputLength || 1000)) {
    throw new Error(`Input too long. Maximum ${this.config.maxInputLength} characters allowed.`);
  }
  
  // Basic safety checks
  if (trimmedInput.length > 10000) { // Additional safety net
    throw new Error('Input exceeds safety limits');
  }
}

  private async safeFindBestMatch(userInput: string): Promise<MatchResult> {
    const circuitBreaker = new CircuitBreaker();

    return circuitBreaker.execute(async () => {
      return TimeoutManager.withTimeout(
        () => Promise.resolve(this._performMatch(userInput)),
        this.config.maxProcessingTimeMs,
        () => this.createFallbackResult(userInput)
      );
    });
  }

  private createFallbackResult(userInput: string): MatchResult {
    // Simple fallback matching for critical failures
    const normalized = userInput.toLowerCase().trim();

    for (const [key] of this.preprocessedKeys) {
      if (
        normalized.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(normalized)
      ) {
        return {
          match: key,
          confidence: 0.5,
          suggestedResponse: this.customResponses[key],
          algorithmUsed: "fallback",
          processingTime: 0,
        };
      }
    }

    return this.createEmptyResult(performance.now());
  }

  /**
   * Helper to build a MatchResult object
   */
  private buildResult(params: {
    match: string | null;
    confidence: number;
    algorithmUsed: string;
    processingTime: number;
    preprocessing?: ReturnType<typeof TextPreprocessor.normalize>;
    candidates?: string[];
    scores?: { [key: string]: { [algorithm: string]: number } };
    suggestedResponse?: string | null; // Added missing property
  }): MatchResult {
    const result: MatchResult = {
      match: params.match,
      confidence: params.confidence,
      suggestedResponse:
        params.suggestedResponse !== undefined
          ? params.suggestedResponse
          : params.match
          ? this.customResponses[params.match]
          : null,
      algorithmUsed: params.algorithmUsed,
      processingTime: params.processingTime,
    };

    if (
      this.config.enableDebugMode &&
      params.preprocessing &&
      params.candidates &&
      params.scores
    ) {
      result.debug = {
        candidates: params.candidates,
        scores: params.scores,
        preprocessing: params.preprocessing,
      };
    }

    return result;
  }

  /**
   * Build preprocessing and search indexes
   */
  private buildIndexes(): void {
    const startTime = performance.now();

    // Preprocess all response keys
    for (const key of this.responseKeys) {
      const processed = TextPreprocessor.normalize(key, this.config);
      this.preprocessedKeys.set(key, processed);

      // Build n-gram index for fast candidate selection
      if (this.config.useNgrams) {
        for (
          let n = this.config.minNgramSize;
          n <= this.config.maxNgramSize;
          n++
        ) {
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

    const indexingTime = performance.now() - startTime;
    if (this.config.enableDebugMode) {
      console.log(`Index building completed in ${indexingTime.toFixed(2)}ms`);
    }
  }

  /**
   * Main public entry point for matching.
   * This function orchestrates whether to use safety features.
   */
  public async findBestMatch(userInput: string): Promise<MatchResult> {
    if (this.config.enableSafetyFeatures) {
      // If safety is on, go through the circuit breaker and timeout manager
      return this.safeFindBestMatch(userInput);
    } else {
      // Otherwise, call the core logic directly
      return this._performMatch(userInput);
    }
  }


  /**
   * Main matching function with comprehensive algorithm combination
   */
  private async _performMatch(userInput: string): Promise<MatchResult> {
    const startTime = performance.now();

    try {
      //  Step 1: Input Validation & Safety
      if (this.config.enableSafetyFeatures) {
        this.validateInput(userInput);
      }
      if (!userInput || userInput.trim().length === 0) {
        return this.createEmptyResult(startTime);
      }

      //  Step 2: Preprocessing
      const inputProcessing = TextPreprocessor.normalize(
        userInput,
        this.config
      );

      //  Step 3: Exact Match (fast path)
      const exactMatch = this.findExactMatch(inputProcessing.normalized);
      if (exactMatch) {
        return this.buildResult({
          match: exactMatch,
          confidence: 1.0,
          algorithmUsed: "exact",
          processingTime: performance.now() - startTime,
          preprocessing: inputProcessing,
          candidates: [exactMatch],
          scores: { [exactMatch]: { exact: 1.0 } },
        });
      }

      //  Step 4: Generate Candidates
      const candidates = this.getCandidates(inputProcessing.normalized);
      if (candidates.length === 0) {
        return this.handleNoMatches(userInput, inputProcessing, startTime);
      }

      //  Step 5: Score Candidates
      const scoredCandidates = this.scoreAllCandidates(
        inputProcessing,
        candidates
      );
      const bestCandidate = scoredCandidates[0]; // Already sorted by confidence
      const processingTime = performance.now() - startTime;

      
      //  Step 7: Learning (if enabled)
      if (this.config.enableLearning) {
        this.recordLearningPattern(
          userInput,
          bestCandidate.confidence < this.config.confidenceThreshold
        );
      }

      //  Step 8: Performance Guardrail
      if (processingTime > this.config.maxProcessingTimeMs) {
        console.warn(
          `⚠️ Processing time ${processingTime.toFixed(
            2
          )}ms exceeded limit of ${this.config.maxProcessingTimeMs}ms`
        );
      }

      //  Step 9: Final Result
      return this.buildResult({
        match:
          bestCandidate.confidence >= this.config.confidenceThreshold
            ? bestCandidate.key
            : null,
        confidence: bestCandidate.confidence,
        algorithmUsed: bestCandidate.primaryAlgorithm,
        suggestedResponse:
          bestCandidate.confidence >= this.config.confidenceThreshold
            ? this.customResponses[bestCandidate.key]
            : null,
        processingTime,
        preprocessing: inputProcessing,
        candidates,
        scores: this.buildDebugScores(scoredCandidates),
      });
    } catch (error: any) {
      //  Step 10: Fail-Safe Error Handling
      console.error(`❌ Matching failed for input: ${userInput}`, error);

      const result: MatchResult = {
        match: null,
        confidence: 0,
        suggestedResponse: "System temporarily unavailable. Please try again.",
        algorithmUsed: "error",
        processingTime: performance.now() - startTime,
        error: error.message, // Now this is allowed
      };

      return result;
    }
  }

  /**
   * Find exact matches with various normalizations
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
   * Get candidate matches using multiple selection strategies
   */
  private getCandidates(normalizedInput: string): string[] {
    const candidates = new Set<string>();

    // Strategy 1: N-gram based candidate selection (fastest)
    if (this.config.useNgrams && this.ngramIndex.size > 0) {
      const inputNgrams = this.generateNgrams(
        normalizedInput,
        this.config.minNgramSize
      );

      for (const ngram of inputNgrams) {
        const matches = this.ngramIndex.get(ngram);
        if (matches) {
          matches.forEach((match) => candidates.add(match));
        }
      }
    }

    // Strategy 2: Token overlap for fallback
    if (candidates.size < 3) {
      const inputTokens = new Set(normalizedInput.split(/\s+/));

      for (const [key, processed] of this.preprocessedKeys) {
        const keyTokens = new Set(processed.tokens);
        const intersection = new Set(
          [...inputTokens].filter((token) => keyTokens.has(token))
        );

        // At least 50% token overlap or 2+ tokens in common
        if (
          intersection.size >=
          Math.min(
            2,
            Math.floor(Math.min(inputTokens.size, keyTokens.size) * 0.5)
          )
        ) {
          candidates.add(key);
        }
      }
    }

    // Strategy 3: Include all if we have a small dataset or very few candidates
    if (candidates.size < 2 && this.responseKeys.length < 20) {
      this.responseKeys.forEach((key) => candidates.add(key));
    }

    return Array.from(candidates);
  }

  /**
   * Score all candidates using hybrid algorithm approach
   */
  private scoreAllCandidates(
    inputProcessing: ReturnType<typeof TextPreprocessor.normalize>,
    candidates: string[]
  ) {
    const scoredCandidates = candidates.map((candidate) => {
      const candidateProcessing = this.preprocessedKeys.get(candidate)!;
      const scores = this.calculateAllScores(
        inputProcessing,
        candidateProcessing,
        candidate
      );
      const confidence = this.combineScores(scores,
        inputProcessing.normalized.length, 
        candidateProcessing.normalized.length
        );
      const primaryAlgorithm = this.getPrimaryAlgorithm(scores);

      return {
        key: candidate,
        confidence,
        scores,
        primaryAlgorithm,
      };
    });

    // Sort by confidence (descending)
    return scoredCandidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate scores using all enabled algorithms
   */
  private calculateAllScores(
    input: ReturnType<typeof TextPreprocessor.normalize>,
    candidate: ReturnType<typeof TextPreprocessor.normalize>,
    _candidateKey: string // Prefix with underscore to indicate unused
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

    if (this.config.useCosineSimilarity) {
      scores.cosine = SimilarityAlgorithms.cosineSimilarity(
        input.stemmed,
        candidate.stemmed
      );
    }

    if (this.config.useNgrams) {
      scores.ngram = SimilarityAlgorithms.ngramSimilarity(
        input.normalized,
        candidate.normalized
      );
    }

    if (this.config.useSemanticSimilarity) {
      scores.semantic = SimilarityAlgorithms.semanticSimilarity(
        input.tokens,
        candidate.tokens
      );
    }

    return scores;
  }

  /**
   * Combine algorithm scores using weighted average
   */
  private combineScores(
    scores: { [algorithm: string]: number }, 
    inputLength: number,
    candidateLength: number
  ): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [algorithm, score] of Object.entries(scores)) {
      const weight = this.weights[algorithm as keyof AlgorithmWeights] || 0.1;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    const initialConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

     // +++ START: ADD THIS NEW LOGIC +++
    // Apply a penalty for significant length differences
    const lengthRatio = Math.min(inputLength, candidateLength) / Math.max(inputLength, candidateLength);
    const lengthPenalty = Math.pow(lengthRatio, 0.5); // Use a gentle curve (sqrt)
    const finalConfidence = initialConfidence * lengthPenalty;
    // +++ END: ADD THIS NEW LOGIC +++

    return finalConfidence;
  }

  /**
   * Determine which algorithm contributed most to the final score
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
   * Generate n-grams for a given string
   */
  private generateNgrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    const tokens = text.split(/\s+/);

    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(" ");
      if (ngram.trim().length > 0) {
        ngrams.add(ngram);
      }
    }

    return ngrams;
  }

  /**
   * Handle cases where no good matches are found
   */
  private handleNoMatches(
    userInput: string,
    inputProcessing: ReturnType<typeof TextPreprocessor.normalize>,
    startTime: number
  ): MatchResult {
    if (this.config.enableLearning) {
      this.recordLearningPattern(userInput, true);
    }

    return {
      match: null,
      confidence: 0,
      suggestedResponse: null,
      algorithmUsed: "none",
      processingTime: performance.now() - startTime,
      ...(this.config.enableDebugMode && {
        debug: {
          candidates: [],
          scores: {},
          preprocessing: inputProcessing,
        },
      }),
    };
  }

  /**
   * Create empty result for invalid inputs
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

  /**
   * Record learning patterns for future improvements
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
        ...(noMatch && this.generateSuggestionForPattern(userInput)),
      });
    }
  }

  /**
   * Generate suggestions for unmatched patterns
   */
  private generateSuggestionForPattern(userInput: string): {
    suggestedKey?: string;
    suggestedResponse?: string;
  } {
    // Simple suggestion generation - can be enhanced
    const normalized = userInput.toLowerCase();

    for (const [key] of this.preprocessedKeys) {
      if (
        normalized.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(normalized)
      ) {
        return {
          suggestedKey: key,
          suggestedResponse: this.customResponses[key],
        };
      }
    }

    return {};
  }

  /**
   * Build debug scores for detailed analysis
   */
  private buildDebugScores(
    scoredCandidates: Array<{
      key: string;
      confidence: number;
      scores: { [algorithm: string]: number };
    }>
  ): { [key: string]: { [algorithm: string]: number } } {
    const debugScores: { [key: string]: { [algorithm: string]: number } } = {};

    for (const candidate of scoredCandidates) {
      debugScores[candidate.key] = candidate.scores;
    }

    return debugScores;
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    totalRequests: number;
    averageProcessingTime: number;
    successRate: number;
    cacheHitRate: number;
    algorithmUsage: { [algorithm: string]: number };
  } {
    // Simplified implementation - you'd track these metrics in production
    return {
      totalRequests: 0,
      averageProcessingTime: 0,
      successRate: 0,
      cacheHitRate: 0,
      algorithmUsage: {},
    };
  }

  /**
   * Process multiple inputs for batch operations
   */
  public async processBatch(
    inputs: string[]
  ): Promise<{ input: string; result: MatchResult }[]> {
    const results = [];

    for (const input of inputs) {
      try {
        const result = await this.findBestMatch(input);
        results.push({ input, result });
      } catch (error) {
        results.push({
          input,
          result: {
            match: null,
            confidence: 0,
            suggestedResponse: null,
            algorithmUsed: "error",
            processingTime: 0,
            error: (error as Error).message,
          },
        });
      }
    }

    return results;
  }

  /**
   * Run comprehensive tests to validate matching accuracy
   */
  public async runTests(): Promise<{
    total: number;
    passed: number;
    failed: number;
    accuracy: number;
    details: Array<{
      input: string;
      expected: string | null;
      actual: string | null;
      confidence: number;
      passed: boolean;
    }>;
  }> {
    const testCases = [
      // Exact matches
      { input: "hello", expectedMatch: "hello" },
      { input: "HELLO", expectedMatch: "hello" },
      { input: "  hello  ", expectedMatch: "hello" },

      // Similar matches
      { input: "helo", expectedMatch: "hello" },
      { input: "helloo", expectedMatch: "hello" },
      { input: "hallo", expectedMatch: "hello" },

      // Semantic matches
      { input: "hi there", expectedMatch: "hello" },
      { input: "good morning", expectedMatch: "hello" },
      { input: "hey", expectedMatch: "hello" },

      // No matches
      { input: "xyzabc", expectedMatch: null },
      { input: "", expectedMatch: null },
    ];

    let passed = 0;
    const details = [];

    for (const testCase of testCases) {
      const result = await this.findBestMatch(testCase.input);
      const actualMatch = result.match;
      const passedTest = actualMatch === testCase.expectedMatch;

      if (passedTest) passed++;

      details.push({
        input: testCase.input,
        expected: testCase.expectedMatch,
        actual: actualMatch,
        confidence: result.confidence,
        passed: passedTest,
      });
    }

    return {
      total: testCases.length,
      passed,
      failed: testCases.length - passed,
      accuracy: passed / testCases.length,
      details,
    };
  }

  /**
   * Update configuration dynamically
   */
  public updateConfig(newConfig: Partial<MatcherConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.buildIndexes(); // Rebuild indexes if needed
  }

  /**
   * Get current configuration
   */
  public getConfig(): MatcherConfig {
    return { ...this.config };
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
   * Export current state for persistence
   */
  public exportState(): {
    config: MatcherConfig;
    learningPatterns: LearningPattern[];
    customResponses: CustomResponses;
  } {
    return {
      config: this.config,
      learningPatterns: this.getLearningPatterns(),
      customResponses: this.customResponses,
    };
  }

  /**
   * Import state from previous session
   */
  public importState(state: {
    config?: MatcherConfig;
    learningPatterns?: LearningPattern[];
    customResponses?: CustomResponses;
  }): void {
    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }
    if (state.learningPatterns) {
      this.learningPatterns = new Map(
        state.learningPatterns.map((pattern) => [pattern.input, pattern])
      );
    }
    if (state.customResponses) {
      this.customResponses = state.customResponses;
      this.responseKeys = Object.keys(state.customResponses);
    }

    this.buildIndexes();
  }

  
public async findBestMatchWithLogging(userInput: string): Promise<MatchResult> {
  console.time('IntelligentMatcher');
  try {
    const result = await this.findBestMatch(userInput);
    console.timeEnd('IntelligentMatcher');
    console.log('Matcher result:', {
      input: userInput,
      match: result.match,
      confidence: result.confidence,
      time: result.processingTime
    });
    return result;
  } catch (error) {
    console.timeEnd('IntelligentMatcher');
    console.error('Matcher error:', error);
    throw error;
  }
}
}

// Export supporting types and utilities
export { TextPreprocessor, SimilarityAlgorithms };

// Export types for external use
export type { MatchResult, CustomResponses, MatcherConfig, LearningPattern };
