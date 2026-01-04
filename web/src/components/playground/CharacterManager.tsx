import { useState } from "react";
import { useWorkspace } from "../../contexts/useWorkspace";
import { useMutation, useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { FaceCapture } from "../auth/FaceCapture";
import { useToast } from "../ui/toastContext";
import { Plus, User, Search, Users, Sparkles, RefreshCw, X, CheckCircle2, Fingerprint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- TYPE DEFINITIONS ---
interface Face {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: string;
}

interface Workspace {
  id: string;
  name: string;
  faces: Face[];
}

interface GetFacesData {
  myWorkspaces: Workspace[];
}

interface AddCharacterData {
  addWorkspaceCharacter: {
    success: boolean;
    message: string;
  };
}

interface VerifyFaceData {
  verifyFaceInWorkspace: {
    success: boolean;
    message: string;
    user?: {
      name: string;
    };
  };
}

// --- QUERIES ---
const GET_FACES = gql`
  query GetWorkspaceFaces {
    myWorkspaces {
      id
      name
      faces { id, name, imageUrl, createdAt }
    }
  }
`;

const ADD_WORKSPACE_CHARACTER = gql`
  mutation AddWorkspaceCharacter($image: Upload!, $workspaceId: ID!, $name: String!) {
    addWorkspaceCharacter(image: $image, workspaceId: $workspaceId, name: $name) {
      success
      message
    }
  }
`;

const VERIFY_IN_WORKSPACE = gql`
  mutation VerifyInWorkspace($image: Upload!, $workspaceId: String!) {
    verifyFaceInWorkspace(image: $image, workspaceId: $workspaceId) {
      success
      message
      user { name }
    }
  }
`;

export default function CharacterManager() {
  const { activeWorkspace } = useWorkspace();
  const { addToast } = useToast();
  const [mode, setMode] = useState<"view" | "add" | "test">("view");
  const [charName, setCharName] = useState("");
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  
  // New State for Test Results
  const [testResult, setTestResult] = useState<{ 
    success: boolean; 
    name?: string; 
    message?: string; 
    confidence?: number 
  } | null>(null);

  const { data, loading, refetch } = useQuery<GetFacesData>(GET_FACES, {
    fetchPolicy: "network-only",
    skip: !activeWorkspace
  });

  const [addCharacter, { loading: adding }] = useMutation<AddCharacterData>(ADD_WORKSPACE_CHARACTER, {
    onCompleted: () => refetch()
  });

  const [verifyFace, { loading: verifying }] = useMutation<VerifyFaceData>(VERIFY_IN_WORKSPACE);

  const currentFaces = data?.myWorkspaces.find((w: Workspace) => w.id === activeWorkspace?.id)?.faces || [];

  const handleEnroll = async (file: File) => {
    if (!charName.trim()) return addToast({ type: 'error', title: 'Missing Name', message: 'Name your character!' });
    
    try {
      const { data: responseData } = await addCharacter({ 
        variables: { image: file, workspaceId: activeWorkspace?.id, name: charName } 
      });

      if (responseData?.addWorkspaceCharacter.success) {
        addToast({ type: 'success', title: 'Added', message: `${charName} joined the squad.` });
        setMode("view");
        setCharName("");
      } else {
        addToast({ type: 'error', title: 'Error', message: responseData?.addWorkspaceCharacter.message || 'Failed to add character' });
      }
    } catch (e) { 
      console.error(e);
      addToast({ type: 'error', title: 'Error', message: 'Failed to add character' });
    }
  };

  const handleTest = async (file: File) => {
    setTestResult(null); // Reset previous result
    try {
      const { data: responseData } = await verifyFace({ 
        variables: { image: file, workspaceId: activeWorkspace?.id } 
      });
      
      const response = responseData?.verifyFaceInWorkspace;

      if (response?.success) {
        // Extract confidence from message "Match Found: Name (99.5%)"
        const match = response.message.match(/\(([^)]+)%\)/);
        const confidence = match ? parseFloat(match[1]) : 90;

        setTestResult({
          success: true,
          name: response.user?.name,
          message: response.message,
          confidence
        });
      } else {
        setTestResult({
          success: false,
          message: "No match found in this universe."
        });
      }
    } catch (e) { 
      console.error(e);
      setTestResult({
        success: false,
        message: "Error during verification"
      });
    }
  };

  const resetTest = () => {
    setTestResult(null);
  };

  if (!activeWorkspace) return null;

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
      
      {/* HEADER */}
      <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-violet-400" /> 
            {activeWorkspace.name}
            <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">
                {currentFaces.length} Faces
            </span>
          </h2>
        </div>
        
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-lg">
          <button 
            onClick={() => { setMode("view"); setTestResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${mode === "view" ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            List
          </button>
          <button 
            onClick={() => { setMode("test"); setTestResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${mode === "test" ? "bg-amber-500/20 text-amber-300" : "text-slate-400 hover:text-white"}`}
          >
            <Search size={14} /> Test
          </button>
          <button 
            onClick={() => { setMode("add"); setTestResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${mode === "add" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="p-6 min-h-[400px]">
        <AnimatePresence mode="wait">
          
          {/* === 1. LIST VIEW === */}
          {mode === "view" && (
            <motion.div 
              key="view"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4"
            >
              {/* Add New Ghost Card */}
              <button
                onClick={() => setMode("add")}
                className="group flex flex-col items-center justify-center bg-slate-800/30 hover:bg-slate-800 rounded-2xl p-2 border-2 border-dashed border-slate-700 hover:border-violet-500 transition-all aspect-square"
              >
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-2 group-hover:bg-violet-500/20 group-hover:text-violet-400 transition-colors">
                   <Plus size={24} />
                </div>
                <span className="text-sm font-medium text-slate-400 group-hover:text-white">Add New</span>
              </button>

              {/* List Faces */}
              {loading ? (
                 <div className="col-span-2 flex items-center text-slate-500 gap-2"><RefreshCw className="animate-spin" size={16}/> Loading...</div>
              ) : (
                currentFaces.map((face: Face) => (
                  <div key={face.id} className="group bg-slate-800 rounded-2xl p-2 border border-slate-700 hover:border-violet-500 transition-all hover:-translate-y-1 shadow-lg relative overflow-hidden">
                    <div className="aspect-square bg-slate-950 rounded-xl mb-2 overflow-hidden relative border border-slate-700/50">
                        {face.imageUrl && !imgError[face.id] ? (
                          <img 
                            src={face.imageUrl} 
                            alt={face.name}
                            className="w-full h-full object-cover object-top"
                            onError={() => setImgError(prev => ({...prev, [face.id]: true}))}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-950">
                              <User size={32} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-center px-1 pb-1">
                        <h3 className="font-bold text-white text-sm truncate" title={face.name}>{face.name}</h3>
                        <p className="text-[10px] text-slate-500 truncate">{new Date(face.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* === 2. ADD MODE === */}
          {mode === "add" && (
            <motion.div key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-md mx-auto">
              <div className="bg-slate-800 rounded-3xl p-1 border border-slate-700 shadow-2xl">
                <div className="bg-slate-900/50 p-6 rounded-t-3xl border-b border-slate-700/50 text-center relative">
                  <button onClick={() => setMode("view")} className="absolute left-4 top-4 text-slate-500 hover:text-white"><X size={20}/></button>
                  <h3 className="text-xl font-bold text-white">Enroll Character</h3>
                  <p className="text-slate-400 text-sm">Add a new face to {activeWorkspace.name}</p>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Name</label>
                      <input 
                        autoFocus
                        value={charName}
                        onChange={e => setCharName(e.target.value)}
                        placeholder="e.g. Tony Stark"
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500 outline-none font-medium placeholder:text-slate-600"
                      />
                  </div>
                  <div className="bg-black/20 rounded-2xl p-2 border border-slate-700/50">
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

          {/* === 3. TEST MODE (UPDATED!) === */}
          {mode === "test" && (
            <motion.div key="test" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto">
              
              {!testResult ? (
                // --- STATE A: CAMERA ---
                <div className="bg-slate-800 rounded-3xl p-6 border border-amber-500/30 shadow-2xl shadow-amber-900/10">
                  <div className="text-center mb-6 relative">
                    <button onClick={() => setMode("view")} className="absolute left-0 top-0 text-slate-500 hover:text-white"><X size={20}/></button>
                    <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2"><Sparkles className="text-amber-400"/> Simulation Mode</h3>
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
              ) : (
                // --- STATE B: RESULT CARD ---
                <div className={`rounded-3xl p-1 border shadow-2xl ${testResult.success ? "bg-green-900/20 border-green-500/50" : "bg-red-900/20 border-red-500/50"}`}>
                    <div className="bg-slate-900/80 p-8 rounded-2xl text-center">
                        <div className="mb-6">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto border-4 ${testResult.success ? "bg-green-500/20 border-green-500 text-green-400" : "bg-red-500/20 border-red-500 text-red-400"}`}>
                                {testResult.success ? <CheckCircle2 size={40} /> : <Fingerprint size={40} />}
                            </div>
                        </div>
                        
                        <h2 className="text-3xl font-bold text-white mb-2">
                            {testResult.success ? "Identity Verified" : "Access Denied"}
                        </h2>
                        
                        {testResult.success && (
                            <div className="mb-6">
                                <p className="text-slate-400 text-sm uppercase tracking-widest mb-1">Identified As</p>
                                <p className="text-2xl font-bold text-green-400">{testResult.name}</p>
                                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                                    <span className="text-xs font-mono text-green-300">{testResult.confidence}% Confidence</span>
                                </div>
                            </div>
                        )}

                        {!testResult.success && (
                            <p className="text-slate-400 mb-6">
                                No matching identity found in the <strong>{activeWorkspace.name}</strong> universe.
                            </p>
                        )}

                        <button 
                            onClick={resetTest}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition flex items-center justify-center gap-2 font-medium"
                        >
                            <RefreshCw size={18} /> Test Another
                        </button>
                    </div>
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}