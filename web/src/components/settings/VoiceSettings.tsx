// src/components/settings/VoiceSettings.tsx
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { GET_ME, REGISTER_VOICE, REMOVE_VOICE } from "../../graphql/users";
import { VoiceCapture } from "../auth/VoiceCapture";
import { useToast } from "../ui/toastContext";
import { Mic, CheckCircle, Volume2, Shield, Trash2, RefreshCw } from "lucide-react";

interface User {
  id: string;
  hasVoiceRegistered?: boolean;
}

interface GetMeData {
  me: User;
}

interface RegisterVoiceData {
  registerVoice: {
    success: boolean;
    message: string;
  };
}

interface RemoveVoiceData {
  removeVoice: {
    success: boolean;
    message: string;
  };
}

export default function VoiceSettings() {
  const { addToast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);
  
  const { data, refetch } = useQuery<GetMeData>(GET_ME);
  const hasVoice = data?.me?.hasVoiceRegistered;

  const [registerVoice, { loading: adding }] = useMutation<RegisterVoiceData>(REGISTER_VOICE);
  const [removeVoice, { loading: removing }] = useMutation<RemoveVoiceData>(REMOVE_VOICE);

  const handleRegister = async (file: File) => {
    try {
      const { data: responseData } = await registerVoice({ variables: { audio: file } });
      
      if (responseData?.registerVoice.success) {
        addToast({ type: 'success', title: 'Voice Profile Ready', message: responseData.registerVoice.message });
        setIsCapturing(false);
        refetch(); 
      } else {
        addToast({ type: 'error', title: 'Registration Failed', message: responseData?.registerVoice.message || 'Failed to register voice profile' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      addToast({ type: 'error', title: 'Error', message: errorMessage });
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Permanently delete your voice identity? This will disable voice-based login and instant synthesis.")) return;
    try {
      const { data: responseData } = await removeVoice();
      if (responseData?.removeVoice.success) {
        addToast({ type: 'success', title: 'Deleted', message: responseData.removeVoice.message });
        refetch();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      addToast({ type: 'error', title: 'Error', message: errorMessage });
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-xl">
                <Mic className="text-blue-400 w-6 h-6" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-white">Voice Identity</h2>
                <p className="text-slate-400 text-sm">Enable one-click voice cloning</p>
            </div>
        </div>
        {hasVoice ? (
             <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium border border-blue-500/30 flex items-center gap-1">
                <CheckCircle size={12}/> Registered
            </span>
        ) : (
            <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-400 text-xs font-medium border border-slate-600 flex items-center gap-1">
                Not Enrolled
            </span>
        )}
      </div>

      {isCapturing ? (
        <div className="animate-in fade-in zoom-in duration-300">
            <VoiceCapture 
                onCapture={handleRegister} 
                onCancel={() => setIsCapturing(false)} 
                loading={adding}
            />
        </div>
      ) : (
        <div className="space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700 text-sm text-slate-400 flex gap-3">
                <Shield className="w-5 h-5 text-blue-400 shrink-0" />
                <p>
                    By enrolling your voice, you enable <strong>Instant Synthesis</strong>. We extract your unique speaker embedding for secure neural cloning.
                </p>
            </div>
          
          <div className="flex flex-wrap gap-3 pt-2">
            {!hasVoice ? (
              <button
                onClick={() => setIsCapturing(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition font-medium shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                <Volume2 size={18} /> Register Voice Profile
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsCapturing(true)}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-xl transition flex items-center gap-2 font-medium"
                >
                  <RefreshCw size={18} /> Update Voice Profile
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition flex items-center gap-2 font-medium"
                >
                  <Trash2 size={18} /> Delete Voice Identity
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
