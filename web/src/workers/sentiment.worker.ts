// src/workers/sentiment.worker.ts
import { pipeline } from '@xenova/transformers';

// Singleton to hold the model pipeline
let classifier: any = null;

const initialize = async () => {
  if (!classifier) {
    console.log("Loading sentiment model...");
    // Using a quantized model for browser performance
    classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    console.log("Sentiment model loaded.");
  }
};

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, text } = event.data;

  if (type === 'init') {
    try {
        await initialize();
        self.postMessage({ status: 'ready' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ status: 'error', error: message });
    }
    return;
  }

  if (type === 'analyze') {
    if (!classifier) {
        await initialize();
    }
    try {
      const output = await classifier(text);
      // output is like [{ label: 'POSITIVE', score: 0.99 }]
      self.postMessage({ status: 'result', output });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ status: 'error', error: message });
    }
  }
});
