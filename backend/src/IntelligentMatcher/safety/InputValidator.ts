// FILE: safety/InputValidator.ts - FIXED VERSION
export class InputValidator {
  // FIXED: Increased limit for file content + user message
  private static readonly MAX_INPUT_LENGTH = 50000; // 50KB should be enough for most documents
  
  private static readonly MEMORY_CHECK_ENABLED = false;
  
  static validateInput(input: string): { valid: boolean; error?: string } {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Input must be a non-empty string' };
    }
    
    if (input.trim().length === 0) {
      return { valid: false, error: 'Input cannot be empty or just whitespace' };
    }
    
    if (input.length > this.MAX_INPUT_LENGTH) {
      return { 
        valid: false, 
        error: `Input exceeds maximum length of ${this.MAX_INPUT_LENGTH} characters (got ${input.length})` 
      };
    }
    
    // FIXED: More targeted malicious pattern detection
    // Only check for actual code injection attempts, not common words
    if (this.containsMaliciousPatterns(input)) {
      return { valid: false, error: 'Input contains potentially malicious patterns' };
    }
    
    if (this.MEMORY_CHECK_ENABLED && !this.checkMemoryConstraints()) {
      return { valid: false, error: 'System memory constraints exceeded' };
    }
    
    return { valid: true };
  }
  
  private static containsMaliciousPatterns(input: string): boolean {
    // FIXED: More specific patterns that won't block normal document content
    const maliciousPatterns = [
      // SQL Injection - but only if they're clearly malicious
      /'\s*OR\s*'1'\s*=\s*'1/gi,
      /'\s*OR\s*1\s*=\s*1/gi,
      /UNION\s+SELECT/gi,
      /DROP\s+TABLE/gi,
      /DELETE\s+FROM/gi,
      
      // Code execution attempts - but only dangerous ones
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /<script[^>]*>/gi,
      /<iframe[^>]*>/gi,
      
      // Only flag require/exec if they look like actual function calls
      /require\s*\(\s*['"`]/gi,
      /exec\s*\(\s*['"`]/gi,
      
      // XSS attempts
      /javascript\s*:/gi,
      /on\w+\s*=\s*['"`]/gi, // onclick="..." etc
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(input));
  }
  
  private static checkMemoryConstraints(): boolean {
    return true; // Always return true to bypass memory checks
  }
}