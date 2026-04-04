/// <reference lib="webworker" />
// src/services/voice/tts.worker.ts
let tts: any = null;
const ctx: DedicatedWorkerGlobalScope = self as any;

// Helper to encode Float32Array to WAV (moved to worker to save main thread time)
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, 1, true); // Number of channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

self.onmessage = async (event: MessageEvent) => {
  const { type, text, voice } = event.data;

  if (type === 'load') {
    try {
      ctx.postMessage({ type: 'status', status: 'loading', message: 'Downloading model...' });
      
      const { KokoroTTS } = await import('kokoro-js');
      
      tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
        dtype: "q8",
        device: "wasm",
        // @ts-ignore
        progress_callback: (p: any) => {
            if (p.status === 'progress') {
                ctx.postMessage({ type: 'progress', progress: p.progress, file: p.file });
            }
        }
      });

      ctx.postMessage({ type: 'status', status: 'ready', message: 'Engine Ready' });
    } catch (err: any) {
      ctx.postMessage({ type: 'error', message: err.message || "Failed to download local neural assets." });
    }
  }

  if (type === 'generate') {
    if (!tts) {
      ctx.postMessage({ type: 'error', message: 'Neural engine not ready. Wait for initialization.' });
      return;
    }

    try {
      ctx.postMessage({ type: 'status', status: 'generating', message: 'Analyzing text structure...' });
      
      const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
      const allSamples: Float32Array[] = [];
      let totalLength = 0;
      let samplingRate = 24000;

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;

        ctx.postMessage({ 
          type: 'status', 
          status: 'generating', 
          message: `Synthesizing Neural Pathway (${i + 1}/${sentences.length})...`,
        });

        // Add a sanity check for extremely long text
        if (sentence.length > 500) {
           console.warn("Sentence too long for browser-local synthesis, splitting further...");
        }

        const result = await tts.generate(sentence, {
          voice: voice || "af_heart",
        });

        if (result.audio) {
          allSamples.push(result.audio);
          totalLength += result.audio.length;
          if (result.samplingRate) samplingRate = result.samplingRate;
        } else {
           throw new Error(`Synthesis engine returned null on part ${i + 1}. This usually indicates a memory limit was hit.`);
        }
      }

      if (totalLength === 0) throw new Error("No audio was generated from the provided text.");

      ctx.postMessage({ type: 'status', status: 'generating', message: 'Merging audio synapses...' });

      // Concatenate carefully
      const mergedSamples = new Float32Array(totalLength);
      let offset = 0;
      for (const samples of allSamples) {
        mergedSamples.set(samples, offset);
        offset += samples.length;
      }

      // Encode WAV
      const audioBlob = encodeWAV(mergedSamples, samplingRate);
      const arrayBuffer = await audioBlob.arrayBuffer();

      ctx.postMessage({ 
        type: 'chunk', 
        audio: arrayBuffer, 
        isFinal: true 
      }, [arrayBuffer]);

      ctx.postMessage({ type: 'status', status: 'done', message: 'Synchronization complete' });
    } catch (err: any) {
      console.error("Worker Generation Error:", err);
      ctx.postMessage({ type: 'error', message: `Neural Synthesis Failed: ${err.message || 'Fatal Worker Error'}` });
    }
  }

};


