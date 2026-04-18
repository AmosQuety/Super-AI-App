module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5173/'],
      startServerCommand: 'npm run dev',
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        chromeFlags: '--no-sandbox --disable-storage-reset',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        // Guard against regressions on bundle size metrics
        'total-byte-weight': ['error', { maxNumericValue: 4000000 }], // 4MB uncompressed JS/assets max
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 3000 }], // 3s
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
