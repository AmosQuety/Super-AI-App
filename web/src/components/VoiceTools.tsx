// src/components/VoiceTools.tsx
import  { useState } from "react";
import { 
  Mic, 
  Square, 
  Play, 
  Volume2, 
  Download, 
  Copy,
  Check,
  Activity,
  Smile,
  Meh,
  Loader2,
  CheckCircle2,
  FlaskConical,
  AlertCircle
} from "lucide-react";
import { useVoiceIntelligence } from "../contexts/VoiceIntelligenceContext";
import VoiceLab from "./VoiceLab";
import LoadingGameEngine from "./loading/LoadingGameEngine";
import { useEffect, useRef } from "react";

export default function VoiceTools() {
  const { 
    isListening, 
    transcript, 
    interimTranscript, 
    startListening, 
    stopListening,
    audioMetrics,
    sentiment
  } = useVoiceIntelligence();

  const [ttsText, setTtsText] = useState("In a world where technology moves at the speed of light, waiting is no longer an option. We have bridged the gap between human thought and digital execution.");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'intelligence' | 'lab'>('intelligence');

  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'loading' | 'ready' | 'generating' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Initializing Engine...');
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);


  const workerRef = useRef<Worker | null>(null);
  const audioChunksBuffer = useRef<ArrayBuffer[]>([]);

  // Initialize Local TTS Worker
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

    worker.onerror = (e) => {
      console.error("Local TTS Worker failed to spawn:", e);
      setTtsStatus('error');
      setStatusMessage('Neural engine failed to initialize due to missing hardware acceleration or module error.');
    };

    worker.postMessage({ type: 'load' });
    return () => worker.terminate();
  }, []);



  const handleGenerateLocalTTS = () => {
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



  // Combine transcripts for display
  const fullDisplay = (transcript + " " + interimTranscript).trim();
  const wordCount = fullDisplay ? fullDisplay.split(/\s+/).length : 0;

  // Copy transcript
  const handleCopyTranscript = async () => {
    if (!fullDisplay) return;
    try {
      await navigator.clipboard.writeText(fullDisplay);
      setCopied(true);
      console.log("word count:", wordCount);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy", error);
    }
  };

  // Save transcript
  const handleSaveTranscript = () => {
    if (!fullDisplay) return;
    const blob = new Blob([fullDisplay], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-700">
      <div className="text-center mb-12">
        <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
          Voice Intelligence Layer
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Interact with Xemora using secure, local-first voice technology.
        </p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'intelligence' 
                ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Activity className="w-5 h-5" />
            Intelligence Layer
          </button>
          <button
            onClick={() => setActiveTab('lab')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'lab' 
                ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FlaskConical className="w-5 h-5" />
            Cloning Lab
          </button>
        </div>
      </div>

      {activeTab === 'lab' ? (
        <VoiceLab />
      ) : (
        <div className="grid lg:grid-cols-2 gap-8">

        
        {/* --- LEFT: SPEECH TO TEXT & INTELLIGENCE --- */}
        <div className="space-y-6">
          
          {/* Main Recorder Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
            
            {/* Background Pulse Effect when listening */}
            {isListening && (
               <div className="absolute top-0 right-0 p-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse pointer-events-none" />
            )}

            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-500 ${isListening ? 'bg-red-500 shadow-red-500/30' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}>
                  <Mic className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Live Transcription
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                     <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
                     <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                       {isListening ? 'Microphone Active' : 'Ready to record'}
                     </p>
                  </div>
                </div>
              </div>

               {/* Biometric Visualizer (Mini) */}
               {isListening && (
                 <div className="flex items-end gap-1 h-8">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                        style={{ 
                          height: `${Math.max(20, Math.random() * (audioMetrics.vol * 100))}%`,
                          opacity: 0.7 + (i * 0.05)
                        }} 
                      />
                    ))}
                 </div>
               )}
            </div>

            {/* Transcript Area */}
            <div className="min-h-[18rem] p-5 border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white relative overflow-y-auto mb-6 transition-colors focus-within:border-blue-500/50">
               {fullDisplay ? (
                 <p className="whitespace-pre-wrap break-words leading-relaxed text-lg">
                   {transcript} <span className="text-blue-500 dark:text-blue-400 animate-pulse">{interimTranscript}</span>
                 </p>
               ) : (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                    <Mic className="w-8 h-8 mb-2 opacity-20" />
                    <span className="italic">Try saying "Go to Dashboard", "Switch to Dark Mode", or "Logout"...</span>
                 </div>
               )}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={isListening ? stopListening : startListening} 
                className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 shadow-lg transform active:scale-95 ${
                  isListening 
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" 
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                }`}
              >
                {isListening ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Start Listening
                  </>
                )}
              </button>

              <div className="flex gap-2">
                 <button 
                  onClick={handleCopyTranscript}
                  disabled={!fullDisplay}
                  className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  title="Copy Text"
                >
                  {copied ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6" />}
                </button>
                <button 
                  onClick={handleSaveTranscript}
                  disabled={!fullDisplay}
                  className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  title="Download"
                >
                  <Download className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Metrics & Sentiment Card */}
          <div className="grid grid-cols-2 gap-4">
             {/* Biometric Card */}
             <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4 text-violet-500">
                   <Activity className="w-6 h-6" />
                   <h3 className="font-bold text-slate-700 dark:text-slate-200">Voice Bio</h3>
                </div>
                <div className="space-y-4">
                   <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Volume</span>
                        <span>{Math.round(audioMetrics.vol * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-violet-500 transition-all duration-100" style={{ width: `${Math.min(100, audioMetrics.vol * 100)}%` }} />
                      </div>
                   </div>
                   <div>
                       <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Pitch (Est.)</span>
                        <span>{Math.round(audioMetrics.pitch)} Hz</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${Math.min(100, (audioMetrics.pitch / 500) * 100)}%` }} />
                      </div>
                   </div>
                </div>
             </div>

             {/* Sentiment Card */}
             <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4 text-pink-500">
                   {sentiment?.label === 'POSITIVE' ? <Smile className="w-6 h-6" /> : <Meh className="w-6 h-6" />}
                   <h3 className="font-bold text-slate-700 dark:text-slate-200">Emotion</h3>
                </div>
                {sentiment ? (
                  <div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white">
                      {sentiment.label}
                    </div>
                    <div className="text-sm text-slate-500">
                      Confidence: {Math.round(sentiment.score * 100)}%
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic mt-2">
                    Speak longer phrases to detect emotion...
                  </div>
                )}
             </div>
          </div>

        </div>

        {/* --- RIGHT: TEXT TO SPEECH --- */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 h-fit min-h-[500px] flex flex-col">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Volume2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Advanced Neural Voice
              </h2>

              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Local-first synthesis engine
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            {/* STATE A: IDLE */}
            {ttsStatus !== 'generating' && ttsStatus !== 'done' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div>
                  <label htmlFor="tts-text" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Cerebral Input
                  </label>
                  <textarea 
                    id="tts-text" 
                    value={ttsText} 
                    onChange={(e) => setTtsText(e.target.value)} 
                    className={`w-full h-48 p-4 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none transition-all duration-300 text-lg ${ttsStatus === 'error' ? 'border-red-500 dark:border-red-500/50' : 'border-slate-200 dark:border-slate-700'}`} 
                  />
                  
                  {ttsStatus === 'error' && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {statusMessage}
                      </p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleGenerateLocalTTS} 
                  disabled={!ttsText.trim() || ttsStatus === 'loading'} 
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]"
                >
                  <Play className="w-5 h-5" />
                  Initialize Synthesis
                </button>
              </div>
            )}

            {/* STATE B: LOADING / GENERATING */}
            {ttsStatus === 'generating' && (
              <div className="space-y-6 flex-1 flex flex-col animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center">
                   <div className="relative">
                      <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" />
                      <Loader2 className="w-10 h-10 animate-spin text-purple-500 relative z-10" />
                   </div>
                   <h3 className="text-lg font-bold mt-4 text-slate-900 dark:text-white">Synthesizing Neural Pathway...</h3>
                   <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">{statusMessage}</p>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">
                      <span>Progress</span>
                      <span>{ttsProgress}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" 
                        style={{ width: `${ttsProgress}%` }} 
                      />
                   </div>
                </div>

                {/* Loading Game Wrapper */}
                <div className="flex-1 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative min-h-[300px]">
                   <LoadingGameEngine />
                </div>
                
                <p className="text-center text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                  Game controls: Use keyboard, tap, or click
                </p>
              </div>
            )}

            {/* STATE C: FINISHED */}
            {ttsStatus === 'done' && (
              <div className="space-y-8 flex-1 flex flex-col justify-center animate-in scale-in-95 duration-700">
                <div className="bg-green-50/50 dark:bg-green-900/10 border-2 border-dashed border-green-200 dark:border-green-800/50 rounded-3xl p-10 flex flex-col items-center text-center">
                   <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-500/20">
                      <CheckCircle2 className="w-10 h-10 text-white" />
                   </div>
                   <h3 className="text-2xl font-black text-slate-900 dark:text-white italic tracking-tighter">DATA LINK ESTABLISHED</h3>
                   <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-8">
                      Local neural synthesis complete. Your sample is ready for immediate synchronization.
                   </p>
                   
                   {finalAudioUrl && (
                    <div className="w-full bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
                       <audio controls src={finalAudioUrl} className="w-full h-12" autoPlay />
                    </div>
                   )}
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleResetTTS} 
                    className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Mic className="w-5 h-5" />
                    Synthesize New Thought
                  </button>
                  <p className="text-center text-[10px] text-slate-500 uppercase font-bold tracking-widest">Local Engine Ready</p>
                </div>
              </div>
            )}
          </div>
        </div>


        </div>
      )}
    </div>

  );
}