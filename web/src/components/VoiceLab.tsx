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
  Zap,
  AlertCircle,
  BrainCircuit,
  Sparkles
} from 'lucide-react';



import { Client } from '@gradio/client';

export default function VoiceLab() {
  // TTS State
  const [ttsText, setTtsText] = useState("In a world where technology moves at the speed of light, waiting is no longer an option. We have bridged the gap between human thought and digital execution. By the time you finish hearing this sentence, the next one is already prepared and waiting for you. This isn't just a recording; it is a live synthesis of intelligence, running entirely within your local device");
//  "Welcome to Xemora. This voice is being generated instantly, right here in your browser, with zero latency. Pretty cool, right?"
    
  const [isGenerating, setIsGenerating] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'loading' | 'ready' | 'generating' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Initializing Engine...');
  const [synapses, setSynapses] = useState(0); // For mini-game

  // Worker & Audio Queue Ref
  const workerRef = useRef<Worker | null>(null);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);


  // Cloning State
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [cloningStatus, setCloningStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [spaceStatus, setSpaceStatus] = useState<string>('Ready');
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);
  const [hfToken, setHfToken] = useState<string>(''); // For private spaces
  const [showTokenInput, setShowTokenInput] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize Worker
  useEffect(() => {
    // Create worker using Vite-compatible syntax
    const worker = new Worker(new URL('../services/voice/tts.worker.ts', import.meta.url), {
        type: 'module'
    });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, status, message, progress, audio, error } = event.data;


      switch (type) {
        case 'status':
          setTtsStatus(status);
          setStatusMessage(message);
          if (status === 'ready') setTtsProgress(100);
          break;
        case 'progress':
          // Normalize progress (handle both 0-1 and 0-100)
          const normP = progress <= 1 ? Math.round(progress * 100) : Math.round(progress);
          setTtsProgress(normP);
          setStatusMessage(`Downloading: ${normP}%`);
          break;
        case 'chunk':
          const blob = new Blob([audio], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          const audioTag = new Audio(url);
          
          audioQueueRef.current.push(audioTag);
          if (!isPlayingRef.current) {
            playNextInQueue();
          }
          break;
        case 'error':
          setIsGenerating(false);
          setTtsStatus('error');
          setStatusMessage(`Error: ${error || message}`);
          break;
      }
    };

    const playNextInQueue = () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            return;
        }
        isPlayingRef.current = true;
        const nextAudio = audioQueueRef.current.shift();
        if (nextAudio) {
            nextAudio.onended = () => playNextInQueue();
            nextAudio.play().catch(e => console.error("Audio playback blocked:", e));
        }
    };

    // Load model
    worker.postMessage({ type: 'load' });

    return () => {
      worker.terminate();
    };
  }, []);

  // Neural Synapse Game Component (Inline for simplicity)
  const SynapseGame = () => (
    <div className="relative h-48 bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden group cursor-crosshair">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
         <BrainCircuit className="w-12 h-12 text-blue-400 mb-2 animate-pulse" />
         <p className="text-xs text-blue-300 font-bold uppercase tracking-widest">Neural Synapse Linker</p>
         <p className="text-[10px] text-slate-500 mt-1">Hover over floating energy to "optimize" the thinking brain</p>
         <div className="mt-3 flex items-center gap-2">
            <span className="text-xl font-black text-white">{synapses}</span>
            <span className="text-[10px] text-slate-400">Links Established</span>
         </div>
      </div>
      
      {/* Moving Synapses */}
      {[...Array(6)].map((_, i) => (
        <div 
          key={i}
          onMouseEnter={() => setSynapses(s => s + 1)}
          className="absolute w-4 h-4 bg-teal-400/20 hover:bg-teal-400 rounded-full blur-sm hover:blur-none transition-all cursor-pointer animate-float"
          style={{ 
            top: `${20 + Math.random() * 60}%`, 
            left: `${10 + Math.random() * 80}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${3 + Math.random() * 2}s`
          }}
        >
          <Sparkles className="w-full h-full text-white/50 scale-50" />
        </div>
      ))}
    </div>
  );


  // -- TTS Logic --
  const handleGenerateTTS = async () => {
    if (!workerRef.current || !ttsText.trim() || ttsStatus !== 'ready') return;
    setIsGenerating(true);
    workerRef.current.postMessage({ type: 'generate', text: ttsText });
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
    setSpaceStatus('Connecting...');

    try {
      // Connect with optional token
      const client = await Client.connect("lucataco/xtts-v2", {
        token: hfToken as any
      }); 
      
      setCloningStatus('processing');
      setSpaceStatus('Synthesizing...');

      const result = await client.predict("/predict", {
        prompt: ttsText,
        language: "en",
        audio_file_path: audioBlob,
      });

      if (result.data && (result.data as any)[0]) {
          setClonedAudioUrl((result.data as any)[0].url);
          setCloningStatus('done');
      } else {
          setCloningStatus('error');
          setSpaceStatus('Unexpected response format');
      }
    } catch (err: any) {
      console.error("Cloning Error:", err);
      setCloningStatus('error');
      setSpaceStatus(err.message.includes('401') ? 'Auth Required (HF Token)' : 'Cloning Failed');
      if (err.message.includes('401')) setShowTokenInput(true);
    } finally {
      // Keep status visible
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
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
          <div className={`w-2 h-2 rounded-full ${ttsStatus === 'ready' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            {statusMessage}
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
            disabled={isGenerating || ttsStatus !== 'ready'}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {isGenerating ? 'Synthesizing...' : 'Generate Local Audio'}
          </button>

          {/* Progress Bar for Loading/Generating */}
          {(ttsStatus === 'loading' || isGenerating) && (
            <div className="mt-4 space-y-4">
              <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-300" 
                  style={{ width: `${ttsProgress}%` }} 
                />
              </div>
              
              {isGenerating && <SynapseGame />}
              
              <div className="flex justify-between items-center text-[10px] font-medium text-slate-500 uppercase tracking-tighter">
                <div className="flex items-center gap-1.5">
                   <div className="w-1 h-1 bg-purple-500 rounded-full animate-ping" />
                   {statusMessage}
                </div>
                <span>{ttsProgress}% Total Progress</span>
              </div>
            </div>
          )}
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

            {cloningStatus === 'error' && (
              <div className="mt-4 flex flex-col gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold uppercase">
                  <AlertCircle className="w-4 h-4" />
                  {spaceStatus}
                </div>
                {showTokenInput && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500">This Space is private. Please enter a <a href="https://huggingface.co/settings/tokens" target="_blank" className="underline">Hugging Face Token</a>:</p>
                    <input 
                      type="password" 
                      value={hfToken} 
                      onChange={(e) => setHfToken(e.target.value)}
                      placeholder="hf_..."
                      className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )}

            {cloningStatus !== 'idle' && cloningStatus !== 'error' && (
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
