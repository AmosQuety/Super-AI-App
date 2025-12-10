import React, { useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMutation } from '@apollo/client/react';
import { gql } from "@apollo/client";
import { Plus, Box, Check, Trash2, Loader2 } from 'lucide-react';
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
    <div className="relative z-50">
      {/* TRIGGER BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl border border-slate-700 transition-all w-full md:w-64 justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
            {activeWorkspace?.name[0].toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400 font-medium">Current Workspace</p>
            <p className="text-sm font-bold truncate max-w-[120px]">{activeWorkspace?.name}</p>
          </div>
        </div>
        <Box size={16} className="text-slate-500" />
      </button>

      {/* DROPDOWN MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full mt-2 left-0 w-full md:w-72 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden"
          >
            <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => { setActiveWorkspace(ws); setIsOpen(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeWorkspace?.id === ws.id 
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30" 
                      : "hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {activeWorkspace?.id === ws.id && <Check size={16} />}
                </button>
              ))}
            </div>

            {/* CREATE NEW SECTION */}
            <div className="p-3 border-t border-slate-700 bg-slate-900/50">
              {isCreating ? (
                <div className="flex gap-2">
                  <input 
                    autoFocus
                    placeholder="Name (e.g. Marvel)"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                  <button 
                    onClick={handleCreate}
                    disabled={loading}
                    className="p-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsCreating(true)}
                  className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-dashed border-slate-700 hover:border-slate-500"
                >
                  <Plus size={16} /> Create New Workspace
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}