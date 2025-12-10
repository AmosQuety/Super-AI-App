import React, { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { ANALYZE_FACE } from "../../graphql/playground";
import { FaceCapture } from "../auth/FaceCapture";
import { Loader2, Sparkles, RefreshCcw, User, Smile, Activity, Camera } from "lucide-react";
import { motion } from "framer-motion"; 
import { useDelight } from "../../hooks/useDelight";

export default function MagicMirror() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzeMutation, { loading }] = useMutation(ANALYZE_FACE);
  const { triggerSuccess } = useDelight();

  const handleCapture = async (file: File) => {
    try {
      const { data } = await analyzeMutation({ variables: { image: file } });
      if (data.analyzeFaceAttribute.success) {
        setAnalysis(data.analyzeFaceAttribute.data);
        setIsFlipped(true); // Trigger the flip!
        triggerSuccess(); // 🎉 BOOM!
        
      }
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Is the Python Brain running?");
    }
  };

  const reset = () => {
    setIsFlipped(false); // Flip back to camera
    setTimeout(() => setAnalysis(null), 500); // Wait for animation to finish
  };

  return (
    <div className="max-w-md mx-auto perspective-1000"> {/* 3D Perspective Container */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Magic Mirror 🪞
        </h2>
        <p className="text-slate-400">Let the AI read your face.</p>
      </div>

      <div className="relative w-full h-[600px]">
        <motion.div
          className="w-full h-full relative preserve-3d"
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, animationDirection: "normal" }}
          style={{ transformStyle: "preserve-3d" }}
        >
          
          {/* === FRONT SIDE (CAMERA) === */}
          <div 
            className="absolute inset-0 backface-hidden bg-slate-800 rounded-3xl p-4 border border-slate-700 shadow-2xl flex flex-col"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex-1 flex flex-col items-center justify-center bg-black/20 rounded-2xl p-4">
               {/* Pass isFlipped so camera stops when hidden to save performance */}
               {!isFlipped && (
                 <FaceCapture 
                    onCapture={handleCapture}
                    onCancel={() => {}} 
                    loading={loading}
                    mode="login" 
                 />
               )}
               {loading && (
                 <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-2xl z-20">
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-2"/>
                        <p className="text-white font-mono animate-pulse">Reading Micro-expressions...</p>
                    </div>
                 </div>
               )}
            </div>
            <div className="mt-4 text-center">
               <p className="text-xs text-slate-500">Align your face within the frame</p>
            </div>
          </div>

          {/* === BACK SIDE (RESULTS) === */}
          <div 
            className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-black rounded-3xl p-8 border border-indigo-500/50 shadow-2xl flex flex-col overflow-hidden"
            style={{ 
              backfaceVisibility: "hidden", 
              transform: "rotateY(180deg)" 
            }}
          >
            {/* Decoration */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl"></div>
            
            <div className="text-center mb-8 relative z-10">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                <Sparkles className="text-yellow-400 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white">Analysis Complete</h3>
            </div>

            {analysis && (
              <div className="space-y-4 relative z-10 flex-1">
                {/* Result Items */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="text-blue-400 w-5 h-5" />
                    <span className="text-slate-300">Age</span>
                  </div>
                  <span className="text-2xl font-bold text-white">{analysis.age}</span>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="text-pink-400 w-5 h-5" />
                    <span className="text-slate-300">Gender</span>
                  </div>
                  <span className="text-xl font-bold text-white capitalize">{analysis.gender}</span>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smile className="text-yellow-400 w-5 h-5" />
                    <span className="text-slate-300">Emotion</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xl font-bold text-white capitalize">{analysis.emotion}</span>
                    <span className="text-xs text-green-400">{analysis.emotion_score?.toFixed(0)}% Match</span>
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={reset}
              className="w-full mt-auto py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition flex items-center justify-center gap-2 border border-white/10 group"
            >
              <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-500"/> 
              Scan Again
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
}