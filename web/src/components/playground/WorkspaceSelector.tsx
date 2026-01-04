// src/components/playground/WorkspaceSelector.tsx
import  { useState } from 'react';
import { useWorkspace } from '../../contexts/useWorkspace';
import { useMutation } from '@apollo/client/react';
import {  gql } from '@apollo/client';
import { Plus,  Check, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ui/toastContext';

const CREATE_WORKSPACE = gql`
  mutation CreateWorkspace($name: String!) {
    createWorkspace(name: $name) {
      id
      name
    }
  }
`;

export default function WorkspaceSelector() {
  const { workspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  
  const [createWorkspace, { loading }] = useMutation(CREATE_WORKSPACE);
  const { showSuccess } = useToast();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createWorkspace({ variables: { name: newName } });
      showSuccess("Universe Created", `Welcome to ${newName}!`);
      setNewName("");
      setIsCreating(false);
      refreshWorkspaces();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative z-50 w-full md:w-auto">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-72 flex items-center justify-between bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-md border border-slate-700 p-2 rounded-2xl transition-all shadow-lg group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
            {activeWorkspace?.name[0].toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Universe</p>
            <p className="text-sm font-bold text-white truncate max-w-[140px]">{activeWorkspace?.name}</p>
          </div>
        </div>
        <div className="pr-3 text-slate-500 group-hover:text-white transition-colors">
            <ChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full mt-2 left-0 w-full bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden ring-1 ring-white/10"
          >
            <div className="p-2 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => { setActiveWorkspace(ws); setIsOpen(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    activeWorkspace?.id === ws.id 
                      ? "bg-violet-600/20 text-violet-300 border border-violet-500/30" 
                      : "hover:bg-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  <span className="font-medium">{ws.name}</span>
                  {activeWorkspace?.id === ws.id && <Check size={16} className="text-violet-400" />}
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-slate-800 bg-black/20">
              {isCreating ? (
                <div className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2">
                  <input 
                    autoFocus
                    placeholder="Name (e.g. Marvel)"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                  <button 
                    onClick={handleCreate}
                    disabled={loading}
                    className="p-2 bg-violet-600 rounded-lg text-white hover:bg-violet-500 transition-colors"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsCreating(true)}
                  className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all border border-dashed border-slate-700 hover:border-slate-500"
                >
                  <Plus size={16} /> Create New Universe
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}