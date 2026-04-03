import React, { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Mic, Shield, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { GET_VOICE_LOGIN_CHALLENGE } from "../../graphql/users";
import { VoiceCapture } from "./VoiceCapture";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../ui/toastContext";

interface VoiceLoginProps {
  onCancel: () => void;
  email?: string;
}

interface ChallengeData {
  getVoiceLoginChallenge: string;
}

export const VoiceLogin: React.FC<VoiceLoginProps> = ({ onCancel, email: initialEmail }) => {
  const [email, setEmail] = useState(initialEmail || "");
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(!!initialEmail);
  const { loginWithVoice } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  const { data, loading: loadingChallenge, error: challengeError, refetch: refetchChallenge } = useQuery<ChallengeData>(
    GET_VOICE_LOGIN_CHALLENGE,
    {
      variables: { email },
      skip: !isEmailSubmitted,
      fetchPolicy: "network-only",
    }
  );

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setIsEmailSubmitted(true);
    }
  };

  const handleCapture = async (file: File) => {
    if (!data?.getVoiceLoginChallenge) return;

    try {
      setIsVerifying(true);
      const message = await loginWithVoice(email, data.getVoiceLoginChallenge, file);
      showSuccess("Access Granted", message);
      // Navigation happens in AuthContext or parent
    } catch (err: any) {
      showError("Verification Failed", err.message || "Voice signature did not match.");
      // Optional: Refetch challenge on failure to prevent replay attacks during the same session
      refetchChallenge();
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isEmailSubmitted) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-700/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-400">
            <Mic size={32} />
          </div>
          <h2 className="text-xl font-bold text-white">Voice Identity Login</h2>
          <p className="text-slate-400 text-sm mt-1">Enter your email to begin verification</p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            required
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-600/20"
          >
            Continue to Voice Check
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-slate-400 hover:text-white text-sm transition"
          >
            Back to Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-700/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setIsEmailSubmitted(false)} className="text-slate-400 hover:text-white transition">
           <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Security Challenge <Shield className="w-4 h-4 text-emerald-400" />
          </h2>
          <p className="text-slate-500 text-xs">{email}</p>
        </div>
      </div>

      {loadingChallenge ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <RefreshCw className="text-indigo-400 animate-spin" size={32} />
          <p className="text-slate-400 text-sm">Generating Secure Challenge...</p>
        </div>
      ) : challengeError ? (
        <div className="text-center py-8 space-y-4">
          <div className="bg-red-500/10 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm text-left border border-red-500/20">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <p>{challengeError.message}</p>
          </div>
          <button 
            onClick={() => setIsEmailSubmitted(false)}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-700 text-center space-y-3 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-20">
               <Shield size={40} className="text-indigo-500" />
            </div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Please speak these digits clearly:</p>
            <div className="text-4xl font-mono font-bold text-white tracking-[0.3em] py-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {data?.getVoiceLoginChallenge}
            </div>
            <p className="text-slate-500 text-[10px]">Your voice signature and spoken phrase will be verified.</p>
          </div>

          <VoiceCapture 
            onCapture={handleCapture}
            onCancel={onCancel}
            loading={isVerifying}
          />
          
          <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center gap-1 mt-4">
             <div className="flex items-center gap-2 text-emerald-400">
                <Shield className="w-4 h-4" />
                <span className="text-xs font-semibold">AES-256 Encrypted Biometrics</span>
             </div>
             <p className="text-[10px] text-emerald-400/70 text-center">Your voiceprint is encrypted at rest and never shared.</p>
          </div>
          <p className="text-center text-[10px] text-slate-500 mt-2">
             * Powered by Advanced Speaker Recognition & Anti-Replay Liveness Checks.
          </p>
        </div>
      )}
    </div>
  );
};
