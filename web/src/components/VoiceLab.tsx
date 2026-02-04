import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Play, 
  Volume2, 
  Upload, 
  Loader2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Zap
} from 'lucide-react';
import { KokoroTTS } from 'kokoro-js';
import { Client } from '@gradio/client';

export default function VoiceLab() {
  // TTS State
  const [ttsText, setTtsText] = useState("Kokoro is a 82M parameter TTS model that runs entirely in your browser.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsModel, setTtsModel] = useState<any>(null);

  // Cloning State
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [cloningStatus, setCloningStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [spaceStatus, setSpaceStatus] = useState<string>('Ready');
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize Kokoro
  useEffect(() => {
    async function initKokoro() {
      try {
        const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
          dtype: "q8", // 8-bit quantization for low resource
          device: "wasm", // Fallback to wasm for 4GB RAM machines
        });
        setTtsModel(tts);
      } catch (err) {
        console.error("Failed to load Kokoro:", err);
      }
    }
    initKokoro();
  }, []);

  // -- TTS Logic --
  const handleGenerateTTS = async () => {
    if (!ttsModel || !ttsText.trim()) return;
    setIsGenerating(true);
    setTtsProgress(0);
    try {
      const audio = await ttsModel.generate(ttsText, {
        voice: "af_heart", // default voice
      });
      
      const url = URL.createObjectURL(audio.blob);
      const audioTag = new Audio(url);
      audioTag.play();
    } catch (err) {
      console.error("TTS Generation Error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // -- Recording Logic --
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  // -- Cloning Logic (HF Space Placeholder) --
  const handleCloneVoice = async () => {
    if (!audioBlob) return;
    setCloningStatus('uploading');
    setSpaceStatus('Waking up Space...');

    try {
      // Connect to a hypothetical XTTS v2 Space
      // This is a template: replace with actual Space ID e.g., "coqui/xtts" 
      const client = await Client.connect("lucataco/xtts-v2"); 
      
      setCloningStatus('processing');
      setSpaceStatus('Synthesizing...');

      const result = await client.predict("/predict", {
        prompt: ttsText,
        language: "en",
        audio_file_path: audioBlob,
      });

      // Handle Gradio response (this depends on the specific Space API)
      if (result.data && (result.data as any)[0]) {
          setClonedAudioUrl((result.data as any)[0].url);
          setCloningStatus('done');
      }
    } catch (err) {
      console.error("Cloning Error:", err);
      setCloningStatus('error');
    } finally {
      setSpaceStatus('Ready');
    }
  };

  return (
    <div className="space-y-8 p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-500" />
            Voice Lab
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Local TTS with Kokoro-82M & Cloud Voice Cloning
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
          <div className={`w-2 h-2 rounded-full ${ttsModel ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            {ttsModel ? 'Kokoro Engine Ready' : 'Loading Engine...'}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Text-to-Speech (Kokoro) */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-purple-500" />
            Browser Synthesis
          </h3>
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-slate-100 dark:border-slate-700 focus:border-purple-500 focus:ring-0 resize-none mb-4 transition-all"
            placeholder="Type text to speak..."
          />
          <button
            onClick={handleGenerateTTS}
            disabled={isGenerating || !ttsModel}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Generate Local Audio
          </button>
        </div>

        {/* Cloning Lab */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5 text-red-500" />
            Voice Cloning Lab
          </h3>
          
          <div className="space-y-4">
            {/* Record / Upload UI */}
            {!audioUrl ? (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 hover:bg-red-50'}`}
                  >
                    {isRecording ? <Square className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-slate-600 dark:text-slate-400" />}
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Record 5-10s sample or</p>
                <label className="cursor-pointer bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Upload .wav
                  <input type="file" accept="audio/wav" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium">Reference Loaded</span>
                </div>
                <button onClick={() => setAudioUrl(null)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}

            <button
              onClick={handleCloneVoice}
              disabled={!audioBlob || cloningStatus === 'uploading' || cloningStatus === 'processing'}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
            >
              {cloningStatus === 'uploading' || cloningStatus === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              Clone & Generate
            </button>

            {/* Status Bar */}
            {cloningStatus !== 'idle' && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 mb-1">
                    <span>{spaceStatus}</span>
                    <span>{cloningStatus === 'done' ? '100%' : '...'}</span>
                  </div>
                  <div className="h-1.5 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-blue-500 transition-all duration-500 ${cloningStatus === 'processing' ? 'w-2/3 animate-pulse' : cloningStatus === 'done' ? 'w-full' : 'w-1/3'}`} 
                    />
                  </div>
                </div>
              </div>
            )}

            {clonedAudioUrl && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl">
                 <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-2 uppercase tracking-wider">Cloned Result</p>
                 <audio controls src={clonedAudioUrl} className="w-full h-8" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
