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
  ShieldCheck,
  UserCheck,
  Settings,
  ChevronDown,
  ChevronUp,
  Music4
} from 'lucide-react';
import SnakeGame from './playground/SnakeGame';
import { Client } from '@gradio/client';
import { useVoiceIntelligence } from '../contexts/VoiceIntelligenceContext';

export default function VoiceLab() {
  // TTS State
  const [ttsText, setTtsText] = useState("In a world where technology moves at the speed of light, waiting is no longer an option. We have bridged the gap between human thought and digital execution. By the time you finish hearing this sentence, the next one is already prepared and waiting for you. This isn't just a recording; it is a live synthesis of intelligence, running entirely within your local device");
  
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'loading' | 'ready' | 'generating' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Initializing Engine...');
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);


  // Worker & Buffer Ref
  const workerRef = useRef<Worker | null>(null);
  const audioChunksBuffer = useRef<ArrayBuffer[]>([]);

  // Workflow Phases: 1. Consent, 2. Enrollment, 3. Generation
  const [phase, setPhase] = useState<'consent' | 'enrollment' | 'generation'>('consent');
  const [hasConsent, setHasConsent] = useState(false);
  
  // Audio Metrics from context
  const { audioMetrics } = useVoiceIntelligence();

  // MegaTTS3 Parameters
  const [inferTimestep, setInferTimestep] = useState(32);
  const [pW, setPW] = useState(1.4);
  const [tW, setTW] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Existing states
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [cloningStatus, setCloningStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [spaceStatus, setSpaceStatus] = useState<string>('Ready');
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);
  const [hfToken, setHfToken] = useState<string>(''); 
  const [hfSpaceId, setHfSpaceId] = useState<string>('mrfakename/MegaTTS3-Voice-Cloning');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize Worker
  useEffect(() => {
    const worker = new Worker(new URL('../services/voice/tts.worker.ts', import.meta.url), {
        type: 'module'
    });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, status, message, progress, audio, error } = event.data;

      switch (type) {
        case 'status':
          setTtsStatus(status as any);
          setStatusMessage(message);
          if (status === 'ready') setTtsProgress(100);
          break;
        case 'progress':
          const normP = progress <= 1 ? Math.round(progress * 100) : Math.round(progress);
          setTtsProgress(normP);
          setStatusMessage(`Downloading: ${normP}%`);
          break;
        case 'chunk':
          // Single final chunk containing merged WAV
          const blob = new Blob([audio], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          setFinalAudioUrl(url);
          setTtsStatus('done');
          setStatusMessage('Synchronization Complete');
          break;
        case 'error':
          setTtsStatus('error');
          setStatusMessage(`Error: ${error || message}`);
          break;
      }
    };

    worker.postMessage({ type: 'load' });

    return () => {
      worker.terminate();
    };
  }, []);



  // -- TTS Logic --
  const handleGenerateTTS = async () => {
    if (!workerRef.current || !ttsText.trim()) return;
    setFinalAudioUrl(null);
    setTtsStatus('generating');
    audioChunksBuffer.current = [];
    workerRef.current.postMessage({ type: 'generate', text: ttsText });
  };


  const handleResetTTS = () => {
    setFinalAudioUrl(null);
    setTtsStatus('ready');
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

  const handleCloneVoice = async () => {
    if (!audioBlob || !ttsText.trim()) return;
    setCloningStatus('uploading');
    setSpaceStatus('Connecting to MegaTTS3...');

    try {
      const client = await Client.connect(hfSpaceId, {
        token: (hfToken as any) || undefined
      }); 
      
      setCloningStatus('processing');
      setSpaceStatus('Synthesizing Neural Speech...');

      // MegaTTS3 Endpoint: /generate_speech
      const result = await client.predict("/generate_speech", {
        inp_audio: audioBlob,
        inp_text: ttsText,
        infer_timestep: inferTimestep,
        p_w: pW,
        t_w: tW,
      });

      if (result.data && (result.data as any)[0]) {
          setClonedAudioUrl((result.data as any)[0].url);
          setCloningStatus('done');
      } else {
          setCloningStatus('error');
          setSpaceStatus('Unexpected response format');
      }
    } catch (err: any) {
      console.error("MegaTTS3 Error:", err);
      setCloningStatus('error');
      
      const errorMessage = err.message || "";
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setSpaceStatus('Auth Required (HF Token)');
        setShowTokenInput(true);
      } else if (errorMessage.includes('metadata') || errorMessage.includes('Space') || errorMessage.includes('not found')) {
        setSpaceStatus('Space Unavailable or Private');
        setShowTokenInput(true); 
      } else {
        setSpaceStatus(`Error: ${errorMessage.substring(0, 30)}${errorMessage.length > 30 ? '...' : ''}`);
      }
    }
  };


  // --- Phase Rendering Helpers ---

  const renderConsentPhase = () => (
    <div className="max-w-2xl mx-auto space-y-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Voice Cloning Consent</h2>
        <p className="text-slate-500 dark:text-slate-400">Please provide authorization to proceed with neural cloning.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Verification Script</label>
            <p className="text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed italic">
              "I authorize Xemora to create a digital clone of my voice for personal use."
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50">
            <input 
              type="checkbox" 
              id="tos" 
              checked={hasConsent} 
              onChange={(e) => setHasConsent(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="tos" className="text-sm text-slate-600 dark:text-slate-400 leading-snug">
              I confirm I have the legal right to clone this voice and agree to the <span className="text-blue-600 dark:text-blue-400 font-bold cursor-pointer underline">Terms of Service</span>.
            </label>
          </div>

          <button
            onClick={() => setPhase('enrollment')}
            disabled={!hasConsent}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
          >
            <UserCheck className="w-5 h-5" />
            Begin Enrollment
          </button>
        </div>
      </div>
    </div>
  );

  const renderEnrollmentPhase = () => (
    <div className="max-w-2xl mx-auto space-y-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mic className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Voice Enrollment</h2>
        <p className="text-slate-500 dark:text-slate-400">Record a high-quality sample to train your neural clone.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="space-y-8">
          {/* Recording UI */}
          {!audioUrl ? (
            <div className="flex flex-col items-center justify-center border-3 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-12 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse scale-110 shadow-xl shadow-red-500/50' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 shadow-md'}`}
              >
                {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-slate-600 dark:text-slate-400 group-hover:text-red-500" />}
              </button>
              
              <div className="mt-8 text-center">
                  <p className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                    {isRecording ? 'Capturing Biometrics...' : 'Reference Audio'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Capture a 10s sample for best results</p>
                  
                  {isRecording && (
                    <div className="flex items-center gap-2 mb-6 justify-center">
                       <div className="flex items-end gap-1 h-6">
                          {[...Array(8)].map((_, i) => (
                            <div 
                              key={i} 
                              className="w-1 bg-red-500 rounded-full transition-all duration-75"
                              style={{ 
                                height: `${Math.max(20, Math.random() * (audioMetrics.vol * 150))}%`,
                                opacity: 0.7 + (i * 0.04)
                              }} 
                            />
                          ))}
                       </div>
                       <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Live Noise Level</span>
                    </div>
                  )}

                  {!isRecording && (
                    <label className="cursor-pointer bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 px-6 py-2 rounded-xl text-sm font-bold hover:border-red-500 transition-all flex items-center gap-2 mx-auto w-fit">
                      <Upload className="w-4 h-4 text-red-500" />
                      Upload .wav
                      <input type="file" accept="audio/wav" className="hidden" onChange={handleFileUpload} />
                    </label>
                  )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
                <div className="p-6 bg-green-50 dark:bg-green-900/10 border-2 border-dashed border-green-200 dark:border-green-800/50 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Sample Captured</p>
                      <p className="text-xs text-slate-500">Neural signature extracted</p>
                    </div>
                  </div>
                  <button onClick={() => setAudioUrl(null)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 transition-all shadow-sm">
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl">
                   <audio controls src={audioUrl} className="w-full h-10" />
                </div>

                <button
                  onClick={() => setPhase('generation')}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20"
                >
                  Confirm & Finalize
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderGenerationPhase = () => (
    <div className="grid lg:grid-cols-2 gap-8 items-start animate-in fade-in duration-700">
      {/* Left Column: Input & Configuration */}
      <div className="space-y-6">
        {/* Reference Audio Preview */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Music4 className="w-4 h-4 text-orange-500" />
              Reference Audio
            </h3>
            <button onClick={() => setPhase('enrollment')} className="text-[10px] font-bold text-orange-500 hover:underline uppercase tracking-widest">
              Re-enroll
            </button>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <audio src={audioUrl || ''} controls className="w-full h-8" />
             </div>
          </div>
        </div>

        {/* Synthesis Input */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Text to Generate
            </h3>
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              className="w-full h-40 p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-slate-100 dark:border-slate-800 focus:border-orange-500 focus:ring-0 resize-none transition-all text-lg font-medium leading-relaxed"
              placeholder="Enter the text you want to synthesize..."
            />
          </div>

          {/* Advanced Options */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Advanced Options</span>
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showAdvanced && (
              <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Infer Timestep</label>
                      <input 
                        type="range" min="1" max="100" 
                        value={inferTimestep} 
                        onChange={(e) => setInferTimestep(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="text-[10px] font-black text-slate-500 text-right">{inferTimestep}</div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Intelligibility (p_w)</label>
                      <input 
                        type="range" min="0" max="10" step="0.1"
                        value={pW} 
                        onChange={(e) => setPW(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="text-[10px] font-black text-slate-500 text-right">{pW.toFixed(1)}</div>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Similarity (t_w)</label>
                   <input 
                      type="range" min="0" max="10" step="0.1"
                      value={tW} 
                      onChange={(e) => setTW(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="text-[10px] font-black text-slate-500 text-right">{tW.toFixed(1)}</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCloneVoice}
            disabled={!audioBlob || !ttsText.trim() || cloningStatus === 'uploading' || cloningStatus === 'processing'}
            className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 text-lg"
          >
            {cloningStatus === 'uploading' || cloningStatus === 'processing' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
            Generate Speech
          </button>
        </div>

        {/* HF Space Settings (Mini) */}
        <div className="flex items-center gap-4 px-6">
           <button onClick={() => setShowSettings(!showSettings)} className="text-[10px] font-bold text-slate-400 hover:text-blue-500 flex items-center gap-2 uppercase tracking-widest">
              <Settings className="w-3 h-3" />
              API Topology
           </button>
           {showSettings && (
             <input 
               type="text" 
               value={hfSpaceId} 
               onChange={(e) => setHfSpaceId(e.target.value)}
               className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 text-[10px] py-1 focus:border-blue-500"
               placeholder="Space ID"
             />
           )}
        </div>
      </div>

      {/* Right Column: Output & Visualization */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl min-h-[500px] flex flex-col overflow-hidden">
           <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest shadow-orange-500/20">
                Generated Audio
              </h3>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${cloningStatus === 'done' ? 'bg-green-500' : cloningStatus === 'error' ? 'bg-red-500' : 'bg-orange-500 animate-pulse'}`} />
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{spaceStatus}</span>
              </div>
           </div>

           <div className="flex-1 flex flex-col p-8">
              {cloningStatus === 'idle' && !clonedAudioUrl && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-800">
                   <Music4 className="w-32 h-32 mb-4 opacity-5" />
                   <p className="font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] text-[10px]">Awaiting Synthesis</p>
                </div>
              )}

              {(cloningStatus === 'uploading' || cloningStatus === 'processing') && (
                <div className="flex-1 flex flex-col space-y-8 animate-in zoom-in-95 duration-500">
                   <div className="flex flex-col items-center text-center">
                       <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
                       <h4 className="text-xl font-bold text-slate-800 dark:text-white">Neural Pathway Folding...</h4>
                       <p className="text-xs text-slate-500 italic mt-1">MegaTTS3 is processing your biometric sample</p>
                   </div>
                   
                   <div className="flex-1 bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative min-h-[300px]">
                      <SnakeGame />
                   </div>
                </div>
              )}

              {cloningStatus === 'done' && clonedAudioUrl && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in scale-in-95 duration-500">
                   <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-xl shadow-green-500/30">
                      <CheckCircle2 className="w-12 h-12 text-white" />
                   </div>
                   <div className="text-center">
                      <h4 className="text-2xl font-black text-slate-900 dark:text-white italic tracking-tighter">SYNTHESIS COMPLETE</h4>
                      <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest font-bold">Neural Clone Active</p>
                   </div>
                   
                   <div className="w-full bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-inner">
                      <audio src={clonedAudioUrl} controls autoPlay className="w-full h-12" />
                      <div className="mt-4 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         <span>MegaTTS3 Model v1.0</span>
                         <span>Ready for Export</span>
                      </div>
                   </div>

                   <button onClick={() => { setCloningStatus('idle'); setClonedAudioUrl(null); }} className="text-xs font-bold text-orange-500 hover:underline uppercase tracking-widest">
                      Generate New Variant
                   </button>
                </div>
              )}

              {cloningStatus === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in shake duration-500">
                   <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-10 h-10 text-red-500" />
                   </div>
                   <div className="text-center max-w-xs">
                      <h4 className="text-xl font-bold text-slate-900 dark:text-white">Neural Synapse Failed</h4>
                      <p className="text-sm text-slate-500 mt-2">{spaceStatus}</p>
                   </div>
                   {showTokenInput && (
                     <div className="w-full space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authentication Required</p>
                        <input 
                          type="password" 
                          value={hfToken} 
                          onChange={(e) => setHfToken(e.target.value)}
                          placeholder="hf_..."
                          className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={handleCloneVoice} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Retry Connection</button>
                     </div>
                   )}
                   <button onClick={() => setCloningStatus('idle')} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                      Reset Engine
                   </button>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-12 p-2">
      <div className="max-w-7xl mx-auto">
        {phase === 'consent' && renderConsentPhase()}
        {phase === 'enrollment' && renderEnrollmentPhase()}
        {phase === 'generation' && renderGenerationPhase()}
      </div>
    </div>
  );
}
