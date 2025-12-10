// src/pages/PlaygroundPage.tsx
import React, { useState } from "react";
import MagicMirror from "../components/playground/MagicMirror";
import TwinOMeter from "../components/playground/TwinOMeter";
import FindMe from "../components/playground/FindMe"; // <--- Import
import { Sparkles, Users, Search } from "lucide-react"; // <--- Import Search icon
import WorkspaceSelector from "../components/playground/WorkspaceSelector";
import CharacterManager from "../components/playground/CharacterManager";

export default function PlaygroundPage() {
  // Add 'find' to the type
  const [activeTab, setActiveTab] = useState<"mirror" | "twin" | "find">("mirror");

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Biometric Lab 🧪</h1>
            <p className="text-slate-400">Experiment with AI vision models.</p>
          </div>
          <WorkspaceSelector />
        </div>

        

        {/* TABS */}
        <div className="flex p-1 bg-slate-900 rounded-xl mb-8 w-fit border border-slate-800 overflow-x-auto">
          {/* Tab 1 */}
          <button
            onClick={() => setActiveTab("mirror")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "mirror" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles size={16} /> Magic Mirror
          </button>
          
          {/* Tab 2 */}
          <button
            onClick={() => setActiveTab("twin")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "twin" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            <Users size={16} /> Twin-O-Meter
          </button>

          {/* Tab 3: NEW */}
          <button
            onClick={() => setActiveTab("find")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "find" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            }`}
          >
            <Search size={16} /> Find Me
          </button>
        </div>

        {/* CONTENT SWITCHER */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {activeTab === "mirror" && <MagicMirror />}
          {activeTab === "twin" && <TwinOMeter />}
          {activeTab === "find" && <FindMe />}
          {activeTab === "manager" && <CharacterManager />}
        </div>

        {/* <div className="mt-16 border-t border-slate-800 pt-8">
            < />
        </div> */}

      </div>
    </div>
  );
}