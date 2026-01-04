// src/components/settings/FaceSettings.tsx
import  { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { GET_ME, REMOVE_FACE } from "../../graphql/users";
import { FaceCapture } from "../auth/FaceCapture";
import { useToast } from "../ui/toastContext";
import { Shield, Trash2, CheckCircle, ScanFace } from "lucide-react";

// --- TYPE DEFINITIONS ---
interface User {
  id: string;
  hasFaceRegistered?: boolean;
}

interface GetMeData {
  me: User;
}

interface RegisterUserFaceResult {
  success: boolean;
  message: string;
}

interface RegisterUserFaceData {
  registerUserFace: RegisterUserFaceResult;
}

interface RemoveFaceResult {
  success: boolean;
  message?: string;
}

interface RemoveFaceData {
  removeFace: RemoveFaceResult;
}

// 👇 NEW SPECIFIC MUTATION FOR LOGIN
const REGISTER_USER_FACE = gql`
  mutation RegisterUserFace($image: Upload!) {
    registerUserFace(image: $image) {
      success
      message
    }
  }
`;

export default function FaceSettings() {
  const { addToast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);
  
  const { data, refetch } = useQuery<GetMeData>(GET_ME);
  const hasFace = data?.me?.hasFaceRegistered;

  // 👇 USE THE NEW MUTATION
  const [registerUserFace, { loading: adding }] = useMutation<RegisterUserFaceData>(REGISTER_USER_FACE);
  const [removeFaceMutation, { loading: removing }] = useMutation<RemoveFaceData>(REMOVE_FACE);

  const handleRegister = async (file: File) => {
    try {
      // 👇 SIMPLE CALL: No workspace ID needed
      const { data: responseData } = await registerUserFace({ variables: { image: file } });
      
      if (responseData?.registerUserFace.success) {
        addToast({ type: 'success', title: 'Biometrics Enabled', message: responseData.registerUserFace.message });
        setIsCapturing(false);
        refetch(); 
      } else {
        addToast({ type: 'error', title: 'Enrollment Failed', message: responseData?.registerUserFace.message || 'Registration failed' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      addToast({ type: 'error', title: 'Error', message: errorMessage });
    }
  };

  const handleRemove = async () => {
    if(!window.confirm("Disable Face ID? You will need your password to login.")) return;
    try {
      const { data: responseData } = await removeFaceMutation();
      if (responseData?.removeFace.success) {
        addToast({ type: 'success', title: 'Disabled', message: "Face ID removed." });
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
            <div className="p-3 bg-indigo-500/10 rounded-xl">
                <ScanFace className="text-indigo-400 w-6 h-6" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-white">Face ID Login</h2>
                <p className="text-slate-400 text-sm">Secure your account with AI Biometrics</p>
            </div>
        </div>
        {hasFace ? (
             <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/30 flex items-center gap-1">
                <CheckCircle size={12}/> Active
            </span>
        ) : (
            <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-400 text-xs font-medium border border-slate-600 flex items-center gap-1">
                Inactive
            </span>
        )}
      </div>

      {isCapturing ? (
        <div className="animate-in fade-in zoom-in duration-300">
            <FaceCapture 
                onCapture={handleRegister} 
                onCancel={() => setIsCapturing(false)} 
                loading={adding}
                mode="register"
            />
        </div>
      ) : (
        <div className="space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700 text-sm text-slate-400 flex gap-3">
                <Shield className="w-5 h-5 text-indigo-400 shrink-0" />
                <p>
                    We use <strong>Liveness Detection</strong> (Smile Check) to ensure security. Your face data is encrypted.
                </p>
            </div>
          
          <div className="flex gap-3 pt-2">
            {!hasFace ? (
              <button
                onClick={() => setIsCapturing(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2"
              >
                <ScanFace size={18} /> Set up Face ID
              </button>
            ) : (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition flex items-center gap-2 font-medium"
              >
                <Trash2 size={18} /> Disable Face ID
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}