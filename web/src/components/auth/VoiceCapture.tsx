import React, { useRef, useState } from "react";
import { Mic, Square, RefreshCw, UploadCloud, Volume2 } from "lucide-react";

interface VoiceCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const VoiceCapture: React.FC<VoiceCaptureProps> = ({ 
  onCapture, 
  onCancel,
  loading = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not found.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const confirm = () => {
    if (!audioBlob) return;
    const file = new File([audioBlob], "voice_enrollment.wav", { type: "audio/wav" });
    onCapture(file);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 w-full animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm h-48 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700 flex flex-col items-center justify-center p-6 text-center">
        {audioUrl ? (
          <div className="space-y-4 w-full">
            <div className="p-3 bg-blue-500/10 rounded-xl inline-block mx-auto">
               <Volume2 className="text-blue-400 w-8 h-8" />
            </div>
            <p className="text-white font-medium text-sm">Sample Recorded</p>
            <audio src={audioUrl} controls className="w-full h-8" />
          </div>
        ) : isRecording ? (
          <div className="space-y-4">
             <div className="w-16 h-16 bg-red-500 rounded-full animate-pulse flex items-center justify-center mx-auto text-white shadow-lg shadow-red-500/50">
                <Square size={24} fill="white" />
             </div>
             <div>
                <p className="text-red-400 font-bold animate-pulse">Capturing Neural Signature...</p>
                <p className="text-slate-500 text-xs mt-1">Please speak clearly for 5-10 seconds</p>
             </div>
          </div>
        ) : (
          <div className="space-y-4 group">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400 group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-colors">
               <Mic size={32} />
            </div>
            <div>
               <p className="text-white font-semibold">Voice Registration</p>
               <p className="text-slate-400 text-xs mt-1">Record or upload an audio sample</p>
            </div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors border border-slate-700 mt-2">
               <UploadCloud size={14} /> Upload Sample
               <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {!audioUrl ? (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-4 rounded-full transition shadow-lg ${isRecording ? "bg-red-500 hover:bg-red-400 shadow-red-500/30" : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/30"} text-white`}
          >
            {isRecording ? <Square size={24} /> : <Mic size={24} />}
          </button>
        ) : (
          <>
            <button
              onClick={() => { setAudioUrl(null); setAudioBlob(null); }}
              disabled={loading}
              className="px-6 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition flex items-center gap-2"
            >
              <RefreshCw size={18} /> Retake
            </button>
            <button
              onClick={confirm}
              disabled={loading}
              className="px-6 py-2 rounded-xl bg-green-600 text-white hover:bg-green-500 transition shadow-lg shadow-green-500/30 flex items-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : "Confirm Registration"}
            </button>
          </>
        )}
        <button onClick={onCancel} disabled={loading} className="px-4 text-slate-500 hover:text-white text-sm transition font-medium">Cancel</button>
      </div>
    </div>
  );
};
