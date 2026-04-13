import React, { useState, useRef } from 'react';
import {
  Zap, AlertCircle, ShieldCheck, UserCheck, Settings,
  ChevronDown, ChevronUp, Music4, RefreshCw,
  Mic, Square, Upload, CheckCircle2, Trash2, Loader2
} from 'lucide-react';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import { REGISTER_VOICE, CLONE_VOICE, GET_VOICE_JOB_STATUS } from '../graphql/voice';
import { useVoiceIntelligence } from '../contexts/VoiceIntelligenceContext';
import ProcessingState from './loading/ProcessingState';
import { useToast } from './ui/toastContext';
import { useBrowserNotification } from '../hooks/useBrowserNotification';
import logger from '../utils/logger';

interface RegisterVoiceData {
  registerVoice: { success: boolean; message: string };
}

interface CloneVoiceData {
  cloneVoice: { success: boolean; jobId?: string; status?: string; error?: string };
}

interface VoiceJobStatusData {
  getVoiceJobStatus: {
    status: string;
    success: boolean;
    audioUrl?: string;
    error?: string;
    message?: string;
  };
}


export default function VoiceLab() {
  const { showWarning, showInfo, showSuccess, showError } = useToast();
  const { requestPermission, notifyWhenReady } = useBrowserNotification();
  // TTS State (for synthesis input)
  const [ttsText, setTtsText] = useState("In a world where technology moves at the speed of light, waiting is no longer an option. We have bridged the gap between human thought and digital execution. By the time you finish hearing this sentence, the next one is already prepared and waiting for you. This isn't just a recording; it is a live synthesis of intelligence, running entirely within your local device");
  // ... rest of state
  const [phase, setPhase] = useState<'consent' | 'enrollment' | 'generation'>('consent');
  const [hasConsent, setHasConsent] = useState(false);

  // Audio Metrics & Transcript from context
  const { audioMetrics, transcript } = useVoiceIntelligence();

  // Mutations
  const [registerVoice] = useMutation<RegisterVoiceData>(REGISTER_VOICE);
  const [cloneVoiceMutation] = useMutation<CloneVoiceData>(CLONE_VOICE);

  // Advanced Parameters (for UI sliders)
  const [inferTimestep, setInferTimestep] = useState(32);
  const [pW, setPW] = useState(1.4);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [tW, setTW] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Existing states
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<File | null>(null);
  const [cloningStatus, setCloningStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [spaceStatus, setSpaceStatus] = useState<string>('Ready');
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // -- Recording Logic --
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported MIME type — browsers always encode WebM regardless
      // of what you pass, so we detect and use the real type to keep ext + content-type consistent
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const ext = mimeType.startsWith('audio/webm') ? 'webm' : 'mp4';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        if (blob.size > 3 * 1024 * 1024) {
          showWarning("File Too Large", "Recording is over 3MB. Please capture a shorter sample for optimal AI processing.");
          return;
        }
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: actualMime });
        setAudioBlob(file);
        setAudioUrl(URL.createObjectURL(file));
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      logger.error("Error accessing microphone", err);
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
      if (file.size > 3 * 1024 * 1024) {
        showWarning("File Too Large", "Please upload a sample smaller than 3MB to prevent memory crashes on the AI server.");
        e.target.value = ''; // Reset input
        return;
      }
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const handleSyncTranscript = () => {
    if (transcript.trim()) {
      setTtsText(transcript);
    }
  };

  const handleRegisterVoice = async () => {
    if (!audioBlob) return;
    setCloningStatus('uploading');
    setSpaceStatus('Syncing Biometrics with Backend...');

    try {
      const { data } = await registerVoice({
        variables: { referenceAudio: audioBlob }
      });

      if (data?.registerVoice?.success) {
        setPhase('generation');
        setCloningStatus('idle');
        setSpaceStatus('Ready');
      } else {
        setCloningStatus('error');
        setSpaceStatus(data?.registerVoice?.message || 'Registration failed');
      }
    } catch (err: any) {
      logger.error("Registration Error", err);
      setCloningStatus('error');

      const errorMessage = err.graphQLErrors?.[0]?.message
        || err.networkError?.result?.errors?.[0]?.message
        || err.message
        || 'Connection to server failed.';

      setSpaceStatus(errorMessage);
    }
  };

  // Polling query for job status
  const [getJobStatus, { data: jobStatusData }] = useLazyQuery<VoiceJobStatusData>(GET_VOICE_JOB_STATUS, {
    fetchPolicy: 'network-only'
  });

  // Handle job status updates
  React.useEffect(() => {
    const job = jobStatusData?.getVoiceJobStatus;
    if (!job) return;

    if (job.status === 'COMPLETED' && job.audioUrl) {
      setClonedAudioUrl(job.audioUrl);
      setCloningStatus('done');
      setSpaceStatus('Done');
      setCurrentJobId(null);
      showSuccess("Synthesis Complete", "Your neural voice clone is ready to play.");
      notifyWhenReady("Synthesis Complete", { body: "Your neural voice clone is ready to play." });
    } else if (job.status === 'FAILED') {
      setCloningStatus('error');
      setSpaceStatus(job.error || 'Synthesis failed');
      setCurrentJobId(null);
      showError("Synthesis Error", job.error || "Your voice cloning job failed.");
      notifyWhenReady("Synthesis Error", { body: "Your voice cloning job failed. Please check the logs." });
    } else {
      setSpaceStatus(job.message || 'Synthesizing Neural Speech...');
    }
  }, [jobStatusData]);

  // Polling effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentJobId && (cloningStatus === 'processing' || cloningStatus === 'uploading')) {
      interval = setInterval(() => {
        getJobStatus({ variables: { jobId: currentJobId } });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [currentJobId, cloningStatus, getJobStatus]);

  const handleCloneVoice = async () => {
    if (!ttsText.trim()) return;
    setCloningStatus('processing');
    setSpaceStatus('Initiating Neural Synthesis...');
    setClonedAudioUrl(null);
    void requestPermission();
    showInfo("Running in background", "You can leave this tab. We’ll notify you when the voice is ready.");

    try {
      const { data } = await cloneVoiceMutation({
        variables: {
          text: ttsText,
          referenceAudio: phase === 'enrollment' ? audioBlob : undefined
        }
      });

      if (data?.cloneVoice?.success && data.cloneVoice.jobId) {
        setCurrentJobId(data.cloneVoice.jobId);
        setSpaceStatus('Job Queued — Synthesizing...');
      } else {
        setCloningStatus('error');
        setSpaceStatus(data?.cloneVoice?.error || 'Synthesis initiation failed');
      }
    } catch (err: any) {
      logger.error("Local Clone Error", err);
      setCloningStatus('error');

      const errorMessage = err.graphQLErrors?.[0]?.message
        || err.networkError?.result?.errors?.[0]?.message
        || err.message
        || 'Connection to AI server failed. Please try again.';

      setSpaceStatus(errorMessage);
    }
  };


  // --- Phase Rendering Helpers ---

  const renderConsentPhase = () => (
    <div className="max-w-2xl mx-auto space-y-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold text-theme-primary mb-2">Voice Cloning Consent</h2>
        <p className="text-theme-secondary">Please provide authorization to proceed with neural cloning.</p>
      </div>

      <div className="bg-theme-secondary p-8 rounded-3xl border border-theme-light shadow-theme-xl">
        <div className="space-y-6">
          <div className="p-4 bg-theme-input rounded-2xl border border-theme-light">
            <label className="text-[10px] font-bold text-theme-tertiary uppercase tracking-widest block mb-2">Verification Script</label>
            <p className="text-lg font-medium text-theme-primary leading-relaxed italic">
              "I authorize Xemora to create a digital clone of my voice for personal use."
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <input
              type="checkbox"
              id="tos"
              checked={hasConsent}
              onChange={(e) => setHasConsent(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-theme-light text-blue-600 focus:ring-blue-500 bg-theme-input"
            />
            <label htmlFor="tos" className="text-sm text-theme-secondary leading-snug">
              I confirm I have the legal right to clone this voice and agree to the <span className="text-blue-600 dark:text-blue-400 font-bold cursor-pointer underline">Terms of Service</span>.
            </label>
          </div>

          <button
            onClick={() => setPhase('enrollment')}
            disabled={!hasConsent}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 active:translate-y-0"
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
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mic className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-3xl font-bold text-theme-primary mb-2">Voice Enrollment</h2>
        <p className="text-theme-secondary">Record a high-quality sample to train your neural clone.</p>
      </div>

      <div className="bg-theme-secondary p-8 rounded-3xl border border-theme-light shadow-theme-xl">
        <div className="space-y-8">
          {/* Recording UI */}
          {!audioUrl ? (
            <div className="flex flex-col items-center justify-center border-3 border-dashed border-theme-light rounded-3xl p-12 hover:bg-theme-input transition-all group">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-red-500 animate-pulse scale-110 shadow-[0_0_40px_rgba(239,68,68,0.6)]' : 'bg-theme-tertiary group-hover:bg-red-500/10 hover:scale-105 shadow-theme-md group-hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-theme-light'}`}
              >
                {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-theme-secondary group-hover:text-red-500 transition-colors" />}
              </button>

              <div className="mt-8 text-center">
                <p className="text-lg font-bold text-theme-primary mb-1">
                  {isRecording ? 'Capturing Biometrics...' : 'Reference Audio'}
                </p>
                <p className="text-sm text-theme-tertiary mb-6 font-medium">Capture a 10s sample for best results</p>

                {isRecording && (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-2 justify-center">
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
                    {transcript && (
                      <div className="px-6 py-3 bg-theme-input rounded-xl border border-theme-light animate-in fade-in duration-300">
                        <p className="text-xs text-theme-tertiary italic">"{transcript}..."</p>
                      </div>
                    )}
                  </div>
                )}

                {!isRecording && (
                  <label className="cursor-pointer bg-theme-secondary border-2 border-theme-light px-6 py-2 rounded-xl text-sm font-bold hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-300 flex items-center gap-2 mx-auto w-fit hover:-translate-y-0.5">
                    <Upload className="w-4 h-4 text-red-500" />
                    Upload .wav
                    <input type="file" accept="audio/wav,audio/mp3" className="hidden" onChange={handleFileUpload} />
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="p-6 bg-green-500/10 border-2 border-dashed border-green-500/30 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-theme-lg shadow-green-500/20">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-theme-primary">Sample Captured</p>
                    <p className="text-xs text-theme-tertiary">Neural signature extracted</p>
                  </div>
                </div>
                <button onClick={() => setAudioUrl(null)} className="p-3 bg-theme-tertiary rounded-xl text-theme-tertiary hover:text-red-500 transition-all shadow-theme-sm">
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-theme-input p-4 rounded-2xl border border-theme-light">
                <audio controls src={audioUrl} className="w-full h-10" />
              </div>

              <button
                onClick={handleRegisterVoice}
                disabled={cloningStatus === 'uploading'}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {cloningStatus === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
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
        <div className="bg-theme-secondary p-6 rounded-3xl border border-theme-light shadow-theme-xl overflow-hidden relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-theme-tertiary uppercase tracking-widest flex items-center gap-2">
              <Music4 className="w-4 h-4 text-orange-500" />
              Reference Audio
            </h3>
            <button onClick={() => setPhase('enrollment')} className="text-[10px] font-bold text-orange-500 hover:underline uppercase tracking-widest">
              Re-enroll
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 bg-theme-input p-3 rounded-2xl border border-theme-light">
              <audio src={audioUrl || ''} controls className="w-full h-8" />
            </div>
          </div>
        </div>

        {/* Synthesis Input */}
        <div className="bg-theme-secondary p-8 rounded-3xl border border-theme-light shadow-theme-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-tertiary uppercase tracking-widest flex items-center gap-2">
              Text to Generate
            </h3>
            <button
              onClick={handleSyncTranscript}
              disabled={!transcript.trim()}
              className="text-[10px] font-bold text-orange-500 hover:text-orange-600 disabled:opacity-30 flex items-center gap-1 uppercase tracking-widest transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              Sync with Transcript
            </button>
          </div>
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            className="w-full h-40 p-5 bg-theme-input rounded-2xl border-2 border-theme-light focus:border-orange-500 focus:ring-0 resize-none transition-all text-lg font-medium leading-relaxed text-theme-primary"
            placeholder="Enter the text you want to synthesize..."
          />

          {/* Advanced Options */}
          <div className="border border-theme-light rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-6 py-4 flex items-center justify-between bg-theme-tertiary/50 hover:bg-theme-tertiary transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-theme-tertiary" />
                <span className="text-sm font-bold text-theme-secondary">Advanced Options</span>
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-6 bg-theme-secondary border-t border-theme-light space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-theme-tertiary uppercase tracking-widest block">Infer Timestep</label>
                    <input
                      type="range" min="1" max="100"
                      value={inferTimestep}
                      onChange={(e) => setInferTimestep(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-theme-tertiary rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="text-[10px] font-black text-theme-tertiary text-right">{inferTimestep}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-theme-tertiary uppercase tracking-widest block">Intelligibility (p_w)</label>
                    <input
                      type="range" min="0" max="10" step="0.1"
                      value={pW}
                      onChange={(e) => setPW(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-theme-tertiary rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="text-[10px] font-black text-theme-tertiary text-right">{pW.toFixed(1)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-theme-tertiary uppercase tracking-widest block">Similarity (t_w)</label>
                  <input
                    type="range" min="0" max="10" step="0.1"
                    value={tW}
                    onChange={(e) => setTW(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-theme-tertiary rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="text-[10px] font-black text-theme-tertiary text-right">{tW.toFixed(1)}</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCloneVoice}
            disabled={!audioBlob || !ttsText.trim() || cloningStatus === 'uploading' || cloningStatus === 'processing'}
            className="w-full py-4 bg-orange-600 hover:bg-orange-600/90 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_35px_rgba(234,88,12,0.6)] hover:-translate-y-1 active:translate-y-0 text-lg group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 w-0 group-hover:w-full transition-all duration-500 ease-out z-0"></div>
            <span className="relative z-10 flex items-center gap-2">
              {cloningStatus === 'uploading' || cloningStatus === 'processing' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 group-hover:scale-110 transition-transform" />}
              Generate Speech
            </span>
          </button>
        </div>

        <div className="px-6 py-2">
          <p className="text-[10px] font-bold text-theme-tertiary uppercase tracking-widest flex items-center gap-2">
            Neural Engine
          </p>
        </div>
      </div>

      {/* Right Column: Output & Visualization */}
      <div className="space-y-6">
        <div className="bg-theme-secondary rounded-3xl border border-theme-light shadow-theme-xl min-h-[500px] flex flex-col overflow-hidden">
          <div className="p-6 border-b border-theme-light flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-tertiary uppercase tracking-widest">
              Generated Audio
            </h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${cloningStatus === 'done' ? 'bg-green-500' : cloningStatus === 'error' ? 'bg-red-500' : 'bg-orange-500 animate-pulse'}`} />
              <span className="text-[10px] font-bold text-theme-tertiary uppercase tracking-widest">{spaceStatus}</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col p-8">
            {cloningStatus === 'idle' && !clonedAudioUrl && (
              <div className="flex-1 flex flex-col items-center justify-center text-theme-tertiary">
                <Music4 className="w-32 h-32 mb-4 opacity-5" />
                <p className="font-bold text-theme-tertiary uppercase tracking-[0.3em] text-[10px]">Awaiting Synthesis</p>
              </div>
            )}

            {(cloningStatus === 'uploading' || cloningStatus === 'processing') && (
              <div className="flex-1 flex flex-col space-y-8 animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center text-center">
                  <h4 className="text-xl font-bold text-theme-primary">Neural Pathway Folding...</h4>
                  <p className="text-xs text-theme-tertiary italic mt-1 pb-4">MegaTTS3 is processing your biometric sample</p>
                </div>

                <div className="flex-1 w-full relative min-h-[300px]">
                  <ProcessingState operationLabel="Folding Neural Pathways" />
                </div>
              </div>
            )}

            {cloningStatus === 'done' && clonedAudioUrl && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in scale-in-95 duration-500">
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-xl shadow-green-500/30">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
                <div className="text-center">
                  <h4 className="text-2xl font-black text-theme-primary italic tracking-tighter">SYNTHESIS COMPLETE</h4>
                  <p className="text-sm text-theme-tertiary mt-1 uppercase tracking-widest font-bold">Neural Clone Active</p>
                </div>

                <div className="w-full bg-theme-input p-6 rounded-3xl border-2 border-theme-light shadow-inner">
                  <audio src={clonedAudioUrl} controls autoPlay className="w-full h-12" />
                  <div className="mt-4 flex justify-between text-[10px] font-bold text-theme-tertiary uppercase tracking-widest">
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
                  <h4 className="text-xl font-bold text-theme-primary">Neural Synapse Failed</h4>
                  <p className="text-sm text-theme-tertiary mt-2">{spaceStatus}</p>
                </div>
                <p className="text-xs text-theme-tertiary text-center px-4">
                  Please ensure your microphone is connected and try a shorter text sample.
                </p>
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
