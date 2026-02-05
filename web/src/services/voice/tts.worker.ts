/// <reference lib="webworker" />
// src/services/voice/tts.worker.ts
import { KokoroTTS } from 'kokoro-js';

const ctx: DedicatedWorkerGlobalScope = self as any;


let tts: any = null;

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
      
      tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
        dtype: "q8",
        device: "wasm",
        // @ts-ignore - progress_callback is common in transformers.js wrappers
        progress_callback: (p: any) => {
            if (p.status === 'progress') {
                ctx.postMessage({ type: 'progress', progress: p.progress, file: p.file });
            }
        }
      });


      ctx.postMessage({ type: 'status', status: 'ready', message: 'Engine Ready' });
    } catch (err: any) {
      ctx.postMessage({ type: 'error', message: err.message });
    }
  }

  if (type === 'generate') {
    if (!tts) {
      ctx.postMessage({ type: 'error', message: 'Model not loaded' });
      return;
    }

    try {
      ctx.postMessage({ type: 'status', status: 'generating', message: 'Analyzing text structure...' });
      
      // Split text into sentences for "streaming" effect
      const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;

        ctx.postMessage({ 
          type: 'status', 
          status: 'generating', 
          message: `Synthesizing sentence ${i+1}/${sentences.length}...`,
          chunkIndex: i,
          totalChunks: sentences.length
        });

        const result = await tts.generate(sentence, {
          voice: voice || "af_heart",
        });

        let audioBlob: Blob;
        if (result.toBlob) {
          audioBlob = await result.toBlob();
        } else if (result.audio && result.sampling_rate) {
          audioBlob = encodeWAV(result.audio, result.sampling_rate);
        } else {
          throw new Error("Invalid audio format returned");
        }

        const arrayBuffer = await audioBlob.arrayBuffer();
        ctx.postMessage({ 
          type: 'chunk', 
          audio: arrayBuffer, 
          index: i, 
          isLast: i === sentences.length - 1 
        }, [arrayBuffer]);
      }

      ctx.postMessage({ type: 'status', status: 'ready', message: 'Playback complete' });
    } catch (err: any) {
      ctx.postMessage({ type: 'error', message: err.message });
    }
  }
};


