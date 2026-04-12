import { Suspense, lazy } from "react";
const PlaygroundGrid = lazy(() => import("../components/playground/PlaygroundGrid"));
const CharacterManager = lazy(() => import("../components/playground/CharacterManager"));
import WorkspaceSelector from "../components/playground/WorkspaceSelector";
import { FlaskConical } from "lucide-react";

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-theme-primary text-theme-primary p-4 md:p-8 relative overflow-hidden transition-colors duration-500">
      <div className="max-w-7xl mx-auto space-y-12">
        
         {/* TOP BAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <div className="flex items-center gap-3 mb-2">
                {/* Subtle glass effect with theme variables */}
                <div className="p-2 bg-theme-secondary border border-theme-light rounded-lg shadow-theme-sm">
                    <FlaskConical className="text-violet-500 dark:text-violet-400" size={24} />
                </div>
                <span className="text-sm font-bold tracking-widest text-violet-600 dark:text-violet-300 uppercase">AI Experiments</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-theme-primary drop-shadow-2xl">
              Biometric Lab
            </h1>
            <p className="text-theme-secondary text-lg mt-4 max-w-xl leading-relaxed">
              Explore computer vision models. Train custom datasets, analyze micro-expressions, and perform 1:N identification.
            </p>
          </div>
          
          <WorkspaceSelector />
        </div>

        {/* --- LIQUID GRID SYSTEM --- */}
        <Suspense fallback={<div className="h-96 w-full flex items-center justify-center bg-theme-secondary rounded-xl animate-pulse text-theme-tertiary">Loading Grid...</div>}>
          <PlaygroundGrid />
        </Suspense>

        {/* DATABASE MANAGER (Separate Section) */}
        <div className="pt-12 border-t border-theme-light">
             <div className="mb-8">
                <h2 className="text-2xl font-bold text-theme-primary">Database Control</h2>
                <p className="text-theme-secondary">Manage the identities in your active universe.</p>
             </div>
             <Suspense fallback={<div className="h-64 w-full flex items-center justify-center bg-theme-secondary rounded-xl animate-pulse text-theme-tertiary">Loading Characters...</div>}>
               <CharacterManager />
             </Suspense>
        </div>

      </div>
    </div>
  );
}