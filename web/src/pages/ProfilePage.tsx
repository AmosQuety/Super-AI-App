import { useQuery } from "@apollo/client/react";
import { GET_ME } from "../graphql/users";
import { useAuth } from "../hooks/useAuth";
import {
  User,
  Brain,
  FileText,
  MessageSquare,
  Globe,
  Code,
  Loader2,
  ShieldCheck,
  ChevronRight,
  Zap,
  CheckCircle2,
  Mic,
  MessageCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

interface UserData {
  me: {
    id: string;
    email: string;
    name?: string;
    role: string;
    preferences?: any;
    totalChats?: number;
    totalMessages?: number;
    totalVoiceJobs?: number;
    totalDocuments?: number;
    documents?: any[];
    isActive: boolean;
    hasFaceRegistered?: boolean;
    hasVoiceRegistered?: boolean;
  };
}

export default function ProfilePage() {
  const { signOut, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery<UserData>(GET_ME, {
    fetchPolicy: 'network-only',
  });

  if (authLoading || (loading && !data)) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-white">
        <Loader2 className="animate-spin mr-2" /> Synching Identity...
      </div>
    );
  }

  if (error) return <div className="text-red-500 text-center p-10">Error: {error.message}</div>;
  if (!data?.me) return <div className="text-white text-center p-10">Identity context lost. Please sign in.</div>;

  const me = data.me;
  const prefs = me.preferences || {};
  const firstLetter = me.name?.[0]?.toUpperCase() || me.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-700">

      {/* 1. IDENTITY HEADER */}
      <div className="relative overflow-hidden bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 md:p-12">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] -ml-32 -mb-32" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Avatar Area */}
          <div className="group relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-5xl font-black text-white shadow-2xl p-1">
              <div className="w-full h-full bg-slate-900 rounded-[1.4rem] flex items-center justify-center">
                {firstLetter}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center border-4 border-slate-900 shadow-lg" title="Identity Verified">
              <ShieldCheck className="text-white" size={20} />
            </div>
          </div>

          {/* Info Area */}
          <div className="text-center md:text-left flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{me.name || 'Anonymous User'}</h1>
              <span className="inline-flex px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {me.role} Access
              </span>
            </div>

            <p className="text-slate-400 text-lg mb-6 flex items-center justify-center md:justify-start gap-2">
              <Globe size={18} className="text-blue-400/50" /> {me.email}
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              {prefs.role && (
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-sm font-bold">
                  <User size={14} /> {prefs.role}
                </div>
              )}
              {prefs.domain && (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-bold">
                  <Code size={14} /> {prefs.domain}
                </div>
              )}
            </div>
          </div>

          {/* Main Actions */}
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-950 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all shadow-xl"
            >
              <User size={18} className="text-indigo-600" /> Edit Profile
            </button>
            <button
              onClick={signOut}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-slate-300 rounded-2xl font-bold text-sm hover:bg-red-500/10 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* 2. ACTIVITY STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-8 group hover:bg-slate-800/50 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <MessageSquare className="text-blue-400" />
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1">Conversations</p>
          <h3 className="text-4xl font-black text-white">{me.totalChats || 0}</h3>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-8 group hover:bg-slate-800/50 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <MessageCircle className="text-pink-400" />
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1">Messages Sent</p>
          <h3 className="text-4xl font-black text-white">{me.totalMessages || 0}</h3>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-8 group hover:bg-slate-800/50 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Mic className="text-purple-400" />
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1">Voice Generations</p>
          <h3 className="text-4xl font-black text-white">{me.totalVoiceJobs || 0}</h3>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-8 group hover:bg-slate-800/50 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <FileText className="text-amber-400" />
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1">Documents</p>
          <h3 className="text-4xl font-black text-white">{me.totalDocuments || me.documents?.length || 0}</h3>
        </div>
      </div>

      {/* 3. BLAZE PERSONA SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-[2rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <Brain className="text-purple-400" /> Active Persona
            </h3>
            <Link to="/blaze-settings" className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 group">
              Refine <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tone</p>
                <p className="text-white font-bold capitalize">{prefs.tone || 'Balanced'}</p>
              </div>
              <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Technicality</p>
                <p className="text-white font-bold capitalize">{prefs.techDepth || 'Standard'}</p>
              </div>
            </div>

            <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-900">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Zap size={12} className="text-amber-400" /> Current Goal
              </p>
              <p className="text-slate-300 text-sm leading-relaxed italic">
                "{prefs.goals || 'No active goal set. Personalize Blaze to increase collaboration efficiency.'}"
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/10 rounded-[2rem] p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Workspace Intelligence</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Xemora uses your identity embeddings to provide a seamless, secure AI experience across your workspaces.
            </p>
            
            <div className="grid grid-cols-1 gap-3">
              <div className={`flex items-center justify-between p-4 rounded-2xl border ${me.hasFaceRegistered ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${me.hasFaceRegistered ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                    <ShieldCheck size={16} className={me.hasFaceRegistered ? 'text-emerald-400' : 'text-slate-500'} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Face ID Enrollment</p>
                    <p className="text-[10px] text-slate-500">{me.hasFaceRegistered ? 'Identity Verified' : 'Not Configured'}</p>
                  </div>
                </div>
                {me.hasFaceRegistered ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <CheckCircle2 size={12} strokeWidth={3} />
                  </div>
                ) : (
                   <Link to="/settings" className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300">Set Up</Link>
                )}
              </div>

              <div className={`flex items-center justify-between p-4 rounded-2xl border ${me.hasVoiceRegistered ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${me.hasVoiceRegistered ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                    <Brain size={16} className={me.hasVoiceRegistered ? 'text-emerald-400' : 'text-slate-500'} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Voice Identity</p>
                    <p className="text-[10px] text-slate-500">{me.hasVoiceRegistered ? 'Voice Model Active' : 'Not Profiled'}</p>
                  </div>
                </div>
                {me.hasVoiceRegistered ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <CheckCircle2 size={12} strokeWidth={3} />
                  </div>
                ) : (
                   <Link to="/settings" className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300">Profile</Link>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest font-black">
            <span>Membership: {me.isActive ? 'Active' : 'Suspended'}</span>
            <span>ID: {me.id.substring(0, 8)}</span>
          </div>
        </div>
      </div>

    </div>
  );
}