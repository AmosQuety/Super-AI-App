// src/components/playground/CharacterManager.tsx
import React, { useState } from "react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useMutation, useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { FaceCapture } from "../auth/FaceCapture";
import { ADD_FACE } from "../../graphql/users"; 
import { useToast } from "../ui/toastContext";
import { Plus, User, Search, Users, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GET_FACES = gql`
  query GetWorkspaceFaces($workspaceId: ID!) {
    myWorkspaces {
      id
      faces { id, name, imageUrl, createdAt }
    }
  }
`;

const VERIFY_IN_WORKSPACE = gql`
  mutation VerifyInWorkspace($image: Upload!, $workspaceId: String!) {
    verifyFaceInWorkspace(image: $image, workspaceId: $workspaceId) {
      success, message, user { name }
    }
  }
`;

export default function CharacterManager() {
  const { activeWorkspace } = useWorkspace();
  const { addToast } = useToast();
  const [mode, setMode] = useState<"view" | "add" | "test">("view");
  const [charName, setCharName] = useState("");
  
  const [addFace, { loading: adding }] = useMutation(ADD_FACE);
  const [verifyFace, { loading: verifying }] = useMutation(VERIFY_IN_WORKSPACE);
  const { data, refetch } = useQuery(GET_FACES, { skip: !activeWorkspace });

  const currentFaces = data?.myWorkspaces.find((w: any) => w.id === activeWorkspace?.id)?.faces || [];

  const handleEnroll = async (file: File) => {
    if (!charName.trim()) {
      addToast({ type: 'error', title: 'Missing Name', message: 'Name your character first!' });
      return;
    }
    try {
      const { data } = await addFace({ 
        variables: { image: file, workspaceId: activeWorkspace?.id, characterName: charName } 
      });
      if (data.addFace.success) {
        addToast({ type: 'success', title: 'Success', message: `Added ${charName}!` });
        setMode("view"); setCharName(""); refetch();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.addFace.message });
      }
    } catch (e: any) { console.error(e); }
  };

  const handleTest = async (file: File) => {
    try {
      const { data } = await verifyFace({ variables: { image: file, workspaceId: activeWorkspace?.id } });
      if (data.verifyFaceInWorkspace.success) {
        addToast({ type: 'success', title: 'MATCH FOUND!', message: data.verifyFaceInWorkspace.message });
      } else {
        addToast({ type: 'error', title: 'No Match', message: 'Not found in this universe.' });
      }
    } catch (e: any) { console.error(e); }
  };

  if (!activeWorkspace) return null;

  return (
    <div className="bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden">
      {/* HEADER */}
      <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/80">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-violet-400" /> Squad Management
          </h2>
          <p className="text-slate-400 text-sm">Manage the identities in <span className="text-violet-300 font-bold">{activeWorkspace.name}</span></p>
        </div>
        
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button 
            onClick={() => setMode("view")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === "view" ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            View All
          </button>
          <button 
            onClick={() => setMode("test")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${mode === "test" ? "bg-amber-500/20 text-amber-300" : "text-slate-400 hover:text-white"}`}
          >
            <Search size={14} /> Test
          </button>
          <button 
            onClick={() => setMode("add")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${mode === "add" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Plus size={14} /> Add New
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="p-6 bg-slate-950/30 min-h-[300px]">
        <AnimatePresence mode="wait">
          
          {/* VIEW LIST MODE */}
          {mode === "view" && (
            <motion.div 
              key="view"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
            >
              {currentFaces.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <User size={32} opacity={0.5} />
                  </div>
                  <p>This universe is empty.</p>
                  <button onClick={() => setMode("add")} className="text-violet-400 hover:underline mt-2">Add the first character</button>
                </div>
              ) : (
                currentFaces.map((face: any) => (
                  <div key={face.id} className="group bg-slate-800 rounded-2xl p-3 border border-slate-700 hover:border-violet-500 transition-all hover:-translate-y-1 shadow-lg">
                    <div className="aspect-square bg-slate-900 rounded-xl mb-3 overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <span className="text-xs text-white font-medium">Face ID Active</span>
                      </div>
                      <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-950">
                        <User size={32} />
                      </div>
                    </div>
                    <h3 className="font-bold text-white text-center truncate text-sm">{face.name}</h3>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* ADD MODE */}
          {mode === "add" && (
            <motion.div key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-md mx-auto">
              <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-violet-500/20 text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Plus size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white">New Identity</h3>
                  <p className="text-slate-400 text-sm">Who are we adding to {activeWorkspace.name}?</p>
                </div>

                <div className="space-y-4">
                  <input 
                    autoFocus
                    value={charName}
                    onChange={e => setCharName(e.target.value)}
                    placeholder="Character Name (e.g. Tony Stark)"
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500 outline-none text-center font-medium placeholder:text-slate-600"
                  />
                  <div className="bg-slate-900/50 rounded-2xl p-2 border border-slate-700/50">
                    <FaceCapture 
                      onCapture={handleEnroll}
                      onCancel={() => setMode("view")}
                      loading={adding}
                      mode="register"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TEST MODE */}
          {mode === "test" && (
            <motion.div key="test" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto">
              <div className="bg-slate-800 rounded-3xl p-6 border border-amber-500/30 shadow-2xl shadow-amber-900/20">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Simulation Mode</h3>
                  <p className="text-slate-400 text-sm">Testing recognition inside <span className="text-white font-bold">{activeWorkspace.name}</span></p>
                </div>
                
                <div className="bg-slate-900/50 rounded-2xl p-2 border border-slate-700/50">
                  <FaceCapture 
                      onCapture={handleTest}
                      onCancel={() => setMode("view")}
                      loading={verifying}
                      mode="login"
                  />
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}