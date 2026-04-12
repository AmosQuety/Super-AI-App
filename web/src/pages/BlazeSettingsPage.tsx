import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { GET_ME, UPDATE_PREFERENCES } from "../graphql/users";
import { useToast } from "../components/ui/toastContext";
import { 
  Brain, 
  MessageCircle, 
  Globe, 
  Zap, 
  Code, 
  Loader2, 
  Save, 
  Layout, 
  CheckCircle2,
  Sparkles
} from "lucide-react";

interface UserPreferences {
  tone?: string;
  detail?: string;
  techDepth?: string;
  responseFormat?: string;
  role?: string;
  domain?: string;
  goals?: string;
  language?: string;
}

interface UserData {
  me: {
    id: string;
    preferences?: any;
  };
}

export default function BlazeSettingsPage() {
  const { addToast } = useToast();
  
  const { data, loading, error } = useQuery<UserData>(GET_ME, {
    fetchPolicy: 'network-only',
  });

  const [updatePreferences, { loading: updatingPrefs }] = useMutation(UPDATE_PREFERENCES);

  const [prefs, setPrefs] = useState<UserPreferences>({
    tone: "casual",
    detail: "detailed",
    techDepth: "intermediate",
    responseFormat: "mixed",
    role: "",
    domain: "",
    goals: "",
    language: "English"
  });

  useEffect(() => {
    if (data?.me?.preferences) {
      setPrefs({
        tone: data.me.preferences.tone || "casual",
        detail: data.me.preferences.detail || "detailed",
        techDepth: data.me.preferences.techDepth || "intermediate",
        responseFormat: data.me.preferences.responseFormat || "mixed",
        role: data.me.preferences.role || "",
        domain: data.me.preferences.domain || "",
        goals: data.me.preferences.goals || "",
        language: data.me.preferences.language || "English"
      });
    }
  }, [data]);

  const handleUpdatePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePreferences({ variables: { preferences: prefs } });
      addToast({ type: 'success', title: 'Intelligence Updated', message: 'Blaze has been personalized to your style.' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preferences';
      addToast({ type: 'error', title: 'Error', message: errorMessage });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-white">
        <Loader2 className="animate-spin mr-2" /> Initializing Blaze Intelligence...
      </div>
    );
  }

  if (error) return <div className="text-red-500 text-center p-10">Error: {error.message}</div>;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* HEADER SECTION */}
      <div className="mb-12 relative overflow-hidden bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/20 rounded-3xl p-8 lg:p-12">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Brain size={240} className="text-purple-500" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/40 group hover:scale-105 transition-transform duration-500">
             <Brain size={48} className="text-white group-hover:animate-pulse" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-3 tracking-tight">
              Blaze <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Intelligence</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-xl font-medium">
              Configure how Blaze interacts with you. Your preferences are injected into every conversation for a fully context-aware experience.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleUpdatePreferences} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT PANEL: Interaction Style */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 space-y-8">
            <div className="flex items-center gap-3 pb-6 border-b border-slate-700/50">
               <Sparkles className="text-purple-400" size={24} />
               <h2 className="text-xl font-bold text-white uppercase tracking-widest text-sm">Response behavior</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <MessageCircle size={14} className="text-blue-400" /> Tone & Personality
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["casual", "formal"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPrefs({...prefs, tone: t})}
                      className={`py-3 rounded-xl border transition-all text-sm font-bold ${
                        prefs.tone === t 
                        ? "bg-blue-500/10 border-blue-500/50 text-blue-400" 
                        : "bg-slate-900/50 border-slate-700/50 text-slate-500 hover:border-slate-600"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Verbosity Level</label>
                <div className="grid grid-cols-2 gap-2">
                  {["concise", "detailed"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPrefs({...prefs, detail: d})}
                      className={`py-3 rounded-xl border transition-all text-sm font-bold ${
                        prefs.detail === d 
                        ? "bg-purple-500/10 border-purple-500/50 text-purple-400" 
                        : "bg-slate-900/50 border-slate-700/50 text-slate-500 hover:border-slate-600"
                      }`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Zap size={14} className="text-amber-400" /> Technical Depth
                </label>
                <select 
                  value={prefs.techDepth}
                  onChange={e => setPrefs({...prefs, techDepth: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none appearance-none cursor-pointer"
                >
                  <option value="beginner">Beginner Friendly (Explain concepts)</option>
                  <option value="intermediate">Intermediate (Standard depth)</option>
                  <option value="expert">Expert (Concise, skip the basics)</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Layout size={14} className="text-emerald-400" /> Output Format
                </label>
                <select 
                  value={prefs.responseFormat}
                  onChange={e => setPrefs({...prefs, responseFormat: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none appearance-none cursor-pointer"
                >
                  <option value="prose">Narrative (Paragraphs)</option>
                  <option value="bullets">Systematic (Bullet Points)</option>
                  <option value="mixed">Mixed (Optimized Balance)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 space-y-8">
             <div className="flex items-center gap-3 pb-6 border-b border-slate-700/50">
               <Code className="text-emerald-400" size={24} />
               <h2 className="text-xl font-bold text-white uppercase tracking-widest text-sm">Professional context</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Your Primary Role</label>
                <input 
                  type="text" 
                  placeholder="e.g. Senior Frontend Architect"
                  value={prefs.role}
                  onChange={e => setPrefs({...prefs, role: e.target.value})}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Domain Expertise</label>
                <input 
                  type="text" 
                  placeholder="e.g. React, Docker, FinTech"
                  value={prefs.domain}
                  onChange={e => setPrefs({...prefs, domain: e.target.value})}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                   Primary Communication Language
                </label>
                <div className="relative group">
                  <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                   <input 
                    type="text" 
                    placeholder="e.g. English, Español, Français"
                    value={prefs.language}
                    onChange={e => setPrefs({...prefs, language: e.target.value})}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-500 italic">Blaze will answer in this language by default.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Current Focus & Save */}
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-3xl p-8 sticky top-24">
            <h3 className="text-lg font-bold text-white mb-6">Execution Focus</h3>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Current Goals</label>
                <textarea 
                  rows={6}
                  placeholder="What are you working on right now? (e.g. Learning Rust, Building an e-commerce backend)"
                  value={prefs.goals}
                  onChange={e => setPrefs({...prefs, goals: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-4 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-purple-500 outline-none resize-none transition-all"
                />
                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                  Tip: Briefly mention ongoing projects so Blaze can reference them in new chats.
                </p>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={updatingPrefs}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-4 rounded-2xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {updatingPrefs ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Save size={20} /> Update Blaze
                    </>
                  )}
                </button>
              </div>

              <div className="py-6 flex items-center gap-3 text-slate-500 border-t border-slate-800 mt-6">
                 <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                 </div>
                 <span className="text-xs font-medium">Changes apply immediately to all new conversations.</span>
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
