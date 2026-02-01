// src/services/voice/VoiceBiometricsService.ts

export interface AudioMetrics {
    vol: number;      // Volume/Amplitude
    pitch: number;    // Dominant frequency
    clarity: number;  // Spectral flatness/clarity equivalent
  }
  
  export class VoiceBiometricsService {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private dataArray: Uint8Array | null = null;
    private isActive: boolean = false;
  
    constructor() {
      // Lazy init to respect browser autoplay policies
    }
  
    public async start(stream: MediaStream) {
      if (this.isActive) return;
  
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        
        // Configure analyser for voice
        this.analyser.fftSize = 2048; // Good balance for voice
        this.analyser.smoothingTimeConstant = 0.8;
  
        this.source = this.audioContext.createMediaStreamSource(stream);
        this.source.connect(this.analyser);
        
        // We don't connect to destination (speakers) to avoid feedback loops
        // this.analyser.connect(this.audioContext.destination);
  
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.isActive = true;
      } catch (error) {
        console.error("Failed to initialize VoiceBiometrics:", error);
      }
    }
  
    public stop() {
      if (!this.isActive) return;
  
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
      
      // Don't close AudioContext immediately if you plan to reuse it, 
      // but for "stop" semantics we often suspend or close.
      if (this.audioContext && this.audioContext.state !== 'closed') {
         this.audioContext.suspend();
      }
  
      this.isActive = false;
    }
  
    public getMetrics(): AudioMetrics {
      if (!this.isActive || !this.analyser || !this.dataArray) {
        return { vol: 0, pitch: 0, clarity: 0 };
      }
  
      this.analyser.getByteFrequencyData(this.dataArray as any);
  
      // 1. Calculate Volume (RMS)
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length;
      const vol = average / 255; // Normalize 0-1
  
      // 2. Simple Pitch Estimation (Dominant Frequency)
      // Note: FF is linear. Index * SampleRate / FFTSize = Frequency
      let maxVal = -1;
      let maxIndex = -1;
      
      // Optimization: Only search typical voice range (80Hz - 3000Hz)
      // 48000Hz / 2048 ~= 23.4Hz per bin.
      // 80Hz ~= bin 3. 3000Hz ~= bin 128.
      const sampleRate = this.audioContext?.sampleRate || 44100;
      const binWidth = sampleRate / this.analyser.fftSize;
      
      for (let i = 2; i < 200; i++) { 
         if (this.dataArray[i] > maxVal) {
           maxVal = this.dataArray[i];
           maxIndex = i;
         }
      }
      
      const pitch = maxIndex * binWidth;
  
      // 3. Clarity (Mocked via high-freq content presence vs noise)
      // Complex spectral flatness is expensive, using a simple heuristic
      const clarity = maxVal / 255;
  
      return { vol, pitch, clarity };
    }
  
    public generateVoiceHash(): string {
       if (!this.dataArray) return "0000";

       // clear noise
       const SIGNIFICANT_BIN_THRESHOLD = 50; 
       let fingerprint = "";
       
       // Create a simple spectral signature from peaks in lower-mid frequencies (voice range)
       // We scan bins 5 to 100 (approx 100Hz to 2000Hz)
       for (let i = 5; i < 100; i += 5) {
          const val = this.dataArray[i];
          fingerprint += val > SIGNIFICANT_BIN_THRESHOLD ? "1" : "0";
       }
       
       // Convert binary string to hex for compactness
       const hex = parseInt(fingerprint, 2).toString(16);
       return `vfp_${hex}_${this.audioContext?.sampleRate ?? 0}`;
    }
  }
