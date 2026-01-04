import  { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Users, Search, X, ArrowRight } from "lucide-react";
import MagicMirror from "./MagicMirror";
import TwinOMeter from "./TwinOMeter";
import FindMe from "./FindMe";

// 1. Configuration for our "Bento Cards"
const FEATURES = [
  {
    id: "mirror",
    title: "Magic Mirror",
    subtitle: "AI Age & Emotion Analysis",
    description: "Look into the digital mirror. The AI analyzes micro-expressions to determine your age, gender, and emotional state in real-time.",
    icon: Sparkles,
    color: "from-violet-600 to-indigo-600",
    component: <MagicMirror />,
    colSpan: "col-span-1 md:col-span-2", // Big card
  },
  {
    id: "twin",
    title: "Twin-O-Meter",
    subtitle: "Face Verification",
    description: "Compare two faces to calculate a similarity percentage using geodesic distance vectors.",
    icon: Users,
    color: "from-amber-500 to-orange-600",
    component: <TwinOMeter />,
    colSpan: "col-span-1",
  },
  {
    id: "find",
    title: "Crowd Scanner",
    subtitle: "1:N Identification",
    description: "Upload a target face and a group photo. The AI will scan the crowd and pinpoint the target.",
    icon: Search,
    color: "from-emerald-500 to-teal-600",
    component: <FindMe />,
    colSpan: "col-span-1 md:col-span-3", // Wide card
  },
];

export default function PlaygroundGrid() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="w-full relative">
      {/* --- THE BENTO GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map((feature) => (
          <motion.div
            key={feature.id}
            layoutId={`card-${feature.id}`} // <--- The Magic ID
            onClick={() => setSelectedId(feature.id)}
            className={`${feature.colSpan} relative group cursor-pointer overflow-hidden rounded-3xl bg-white/5 backdrop-blur-lg border border-white/10 shadow-2xl hover:shadow-violet-500/10 hover:border-white/20 transition-all duration-500`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Background Gradient Effect */}
            <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

            <div className="p-8 h-full flex flex-col justify-between relative z-10">
              <div>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white shadow-lg mb-6`}>
                  <feature.icon size={24} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 font-medium">{feature.subtitle}</p>
                <p className="text-slate-500 text-sm mt-4 leading-relaxed">{feature.description}</p>
              </div>
              
              <div className="mt-8 flex items-center text-sm font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                Launch Experiment <ArrowRight size={16} className="ml-2" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* --- THE EXPANDED OVERLAY --- */}
      <AnimatePresence>
        {selectedId && (
          <>
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
            />

            {/* The Expanded Card */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
              {FEATURES.map((feature) => {
                if (feature.id !== selectedId) return null;
                return (
                  <motion.div
                    key={feature.id}
                    layoutId={`card-${feature.id}`} // <--- Connecting the magic
                    className="w-full max-w-5xl max-h-[90vh] bg-slate-900/90 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col pointer-events-auto"
                  >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white shadow-md`}>
                                <feature.icon size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">{feature.title}</h2>
                                <p className="text-slate-400 text-sm">{feature.subtitle}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedId(null)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* The Actual Component */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#0B0F19]">
                        {feature.component}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}