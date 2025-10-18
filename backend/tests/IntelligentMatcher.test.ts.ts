
import IntelligentMatcher, { createIntelligentMatcher } from '../IntelligentMatcher';
import customResponses from '../customResponses';

describe('IntelligentMatcher', () => {
  let matcher: IntelligentMatcher;

  beforeEach(() => {
    matcher = createIntelligentMatcher(customResponses, {
      maxProcessingTimeMs: 15 // Slightly higher for tests
    });
  });

  test('should instantiate with custom responses', () => {
    expect(matcher).toBeInstanceOf(IntelligentMatcher);
  });

  test('should find exact matches', () => {
    const result = matcher.findBestMatch('hello');
    expect(result.confidence).toBe(1.0);
    expect(result.match).toBe('hello');
    expect(result.suggestedResponse).toBe('Hi there! How can I help you today?');
  });

  test('should handle variations with high confidence', () => {
    const tests = [
      { input: 'who made you', expected: 'who developed you' },
      { input: 'whats your name', expected: 'what is your name' },
      { input: 'how r u', expected: 'how are you' },
      { input: 'tell me a joke please', expected: 'tell me a joke' },
    ];

    tests.forEach(({ input, expected }) => {
      const result = matcher.findBestMatch(input);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.match).toBe(expected);
    });
  });

  test('should handle typos and misspellings', () => {
    const tests = [
      { input: 'whut is yor name', expected: 'what is your name' },
      { input: 'hoo are yoo', expected: 'who are you' },
      { input: 'wat can u do', expected: 'what can you do' },
    ];

    tests.forEach(({ input, expected }) => {
      const result = matcher.findBestMatch(input);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.match).toBe(expected);
    });
  });

  test('should return low confidence for unrelated inputs', () => {
    const tests = [
      'what is the capital of france',
      'how to make pizza',
      'quantum physics explained',
    ];

    tests.forEach(input => {
      const result = matcher.findBestMatch(input);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.match).toBeNull();
    });
  });

  test('should handle very short inputs', () => {
    const tests = [
      { input: 'hi', expected: 'hi' },
      { input: 'hey', expected: 'hey' },
      { input: 'yo', expected: null }, // Not in custom responses
    ];

    tests.forEach(({ input, expected }) => {
      const result = matcher.findBestMatch(input);
      if (expected) {
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.match).toBe(expected);
      } else {
        expect(result.confidence).toBeLessThan(0.5);
      }
    });
  });

  test('should perform within time constraints', () => {
    const startTime = performance.now();
    
    // Test multiple inputs
    for (let i = 0; i < 20; i++) {
      matcher.findBestMatch('what can you do for me');
    }
    
    const totalTime = performance.now() - startTime;
    const avgTime = totalTime / 20;
    
    expect(avgTime).toBeLessThan(10); // Should be under 10ms on average
  });

  test('should handle empty input', () => {
    const result = matcher.findBestMatch('');
    expect(result.confidence).toBe(0);
    expect(result.match).toBeNull();
  });

  test('should allow configuration updates', () => {
    const originalThreshold = matcher.getConfig().confidenceThreshold;
    matcher.updateConfig({ confidenceThreshold: 0.9 });
    
    expect(matcher.getConfig().confidenceThreshold).toBe(0.9);
    
    // Reset
    matcher.updateConfig({ confidenceThreshold: originalThreshold });
  });

  test('should handle adding new responses', () => {
    const newResponses = {
      'what is the weather': 'I cannot provide real-time weather information.',
      'how old are you': 'I am an AI, so I do not have an age in the traditional sense.'
    };
    
    matcher.addResponses(newResponses);
    
    const result = matcher.findBestMatch('what is the weather like today');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.match).toBe('what is the weather');
  });
});

// Performance benchmark utility
export const runPerformanceBenchmark = (matcher: IntelligentMatcher, iterations: number = 1000): void => {
  const testInputs = [
    'hello',
    'what is your name',
    'who made you',
    'how are you',
    'tell me a joke',
    'what can you do',
    'unknown query that should not match',
    'hi how are you doing today',
  ];

  console.log('Running performance benchmark...');
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    const input = testInputs[i % testInputs.length];
    matcher.findBestMatch(input);
  }
  
  const totalTime = performance.now() - startTime;
  const avgTime = totalTime / iterations;
  
  console.log(`Total time for ${iterations} iterations: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per query: ${avgTime.toFixed(3)}ms`);
  console.log(`Queries per second: ${(1000 / avgTime).toFixed(0)}`);
};

// Example usage
if (typeof window !== 'undefined') {
  // Run benchmark in browser
  setTimeout(() => {
    runPerformanceBenchmark(matcher, 1000);
  }, 1000);
}