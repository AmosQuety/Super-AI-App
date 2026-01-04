import PlaygroundGrid from "../components/playground/PlaygroundGrid";
import CharacterManager from "../components/playground/CharacterManager";
import WorkspaceSelector from "../components/playground/WorkspaceSelector";
import { FlaskConical } from "lucide-react";

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12">
        
         {/* TOP BAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <div className="flex items-center gap-3 mb-2">
                {/* Changed badge to be subtle glass */}
                <div className="p-2 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md">
                    <FlaskConical className="text-violet-400" size={24} />
                </div>
                <span className="text-sm font-bold tracking-widest text-violet-300 uppercase">AI Experiments</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white drop-shadow-2xl">
              Biometric Lab
            </h1>
            <p className="text-slate-400 text-lg mt-4 max-w-xl leading-relaxed">
              Explore computer vision models. Train custom datasets, analyze micro-expressions, and perform 1:N identification.
            </p>
          </div>
          
          <WorkspaceSelector />
        </div>

        {/* --- LIQUID GRID SYSTEM --- */}
        <PlaygroundGrid />

        {/* DATABASE MANAGER (Separate Section) */}
        <div className="pt-12 border-t border-white/5">
             <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Database Control</h2>
                <p className="text-slate-400">Manage the identities in your active universe.</p>
             </div>
             <CharacterManager />
        </div>

      </div>
    </div>
  );
}