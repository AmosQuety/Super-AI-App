// src/services/voice/SentimentService.ts

export interface SentimentResult {
    label: 'POSITIVE' | 'NEGATIVE';
    score: number;
  }
  
  export class SentimentService {
    private worker: Worker | null = null;
    private isReady: boolean = false;
  
    constructor() {
      // Initialize later
    }
  
    public init() {
      if (this.worker) return;
  
      // Vite syntax for web workers
      this.worker = new Worker(new URL('../../workers/sentiment.worker.ts', import.meta.url), {
        type: 'module'
      });
  
      this.worker.onmessage = (event) => {
        const { status, error } = event.data;
        if (status === 'ready') {
            this.isReady = true;
            console.log("Sentiment Service Ready");
        }
        if (status === 'error') {
            console.error("Sentiment Worker Error:", error);
        }
      };
      
      this.worker.postMessage({ type: 'init' });
    }
  
    public async analyze(text: string): Promise<SentimentResult | null> {
      if (!this.worker || !this.isReady) {
          // If not ready, try init? Or just return null for now to avoid blocking.
          if(!this.worker) this.init();
          return null;
      }
  
      return new Promise((resolve) => {
         const handler = (event: MessageEvent) => {
            const { status, output } = event.data;
            if (status === 'result') {
                this.worker?.removeEventListener('message', handler);
                resolve(output[0] as SentimentResult);
            }
         };
         
         // Attach one-time listener (naive implementation, better to use IDs for requests)
         this.worker?.addEventListener('message', handler);
         this.worker?.postMessage({ type: 'analyze', text });
      });
    }
  
    public terminate() {
      this.worker?.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
