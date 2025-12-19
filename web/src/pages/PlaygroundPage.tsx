// src/pages/PlaygroundPage.tsx
import React, { useState } from "react";
import MagicMirror from "../components/playground/MagicMirror";
import TwinOMeter from "../components/playground/TwinOMeter";
import FindMe from "../components/playground/FindMe";
import CharacterManager from "../components/playground/CharacterManager";
import WorkspaceSelector from "../components/playground/WorkspaceSelector";
import { Sparkles, Users, Search, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";
import { ErrorBoundary } from "../components/ui/ErrorBoundary/ErrorBoundary";

export default function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<"mirror" | "twin" | "find">("mirror");

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 overflow-hidden group ${
        activeTab === id 
          ? "text-white bg-slate-800 shadow-lg ring-1 ring-white/10" 
          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
      }`}
    >
      <Icon size={18} className={activeTab === id ? "text-violet-400" : "text-slate-500 group-hover:text-slate-300"} />
      <span className="relative z-10">{label}</span>
      {activeTab === id && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-slate-800 rounded-xl z-0"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-4 md:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B0F19] to-[#0B0F19]">
      <div className="max-w-6xl mx-auto space-y-8">
        <ErrorBoundary>
        {/* TOP BAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
           
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 flex items-center gap-3">
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
                Biometric Lab
              </span>
              <FlaskConical className="text-violet-500 animate-pulse" size={32} />
            </h1>
            <p className="text-slate-400 text-lg">
              Experiment with AI vision models in your own universe.
            </p>
          </div>
          
          <WorkspaceSelector />
        </div>

        {/* TABS */}
        <div className="flex justify-center md:justify-start">
          <div className="flex p-1.5 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800/50 gap-1 overflow-x-auto">
            <TabButton id="mirror" label="Magic Mirror" icon={Sparkles} />
            <TabButton id="twin" label="Twin-O-Meter" icon={Users} />
            <TabButton id="find" label="Crowd Scanner" icon={Search} />
          </div>
        </div>

        {/* MAIN EXPERIMENT STAGE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: The Experiment UI */}
          <div className="lg:col-span-2">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-3xl p-1 md:p-8 min-h-[500px]"
            >
              {activeTab === "mirror" && <MagicMirror />}
              {activeTab === "twin" && <TwinOMeter />}
              {activeTab === "find" && <FindMe />}
            </motion.div>
          </div>

          {/* RIGHT: The Database Manager (Always visible) */}
          <div className="lg:col-span-1">
             <div className="sticky top-8">
                <CharacterManager />
             </div>
          </div>
    
        </div>
        </ErrorBoundary>
      </div>
      
    </div>
  );
}