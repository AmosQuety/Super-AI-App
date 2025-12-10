import React, { useState } from "react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useMutation, useQuery, gql } from "@apollo/client/react";
import { FaceCapture } from "../auth/FaceCapture";
import { ADD_FACE } from "../../graphql/users"; // You might need to export this form users.ts or create a new file
import { useToast } from "../ui/toastContext";
import { Plus, User, Trash2, Loader2, Search } from "lucide-react";

// Query to get faces for the active workspace
const GET_FACES = gql`
  query GetWorkspaceFaces($workspaceId: ID!) {
    myWorkspaces {
      id
      faces {
        id
        name
        imageUrl
        createdAt
      }
    }
  }
`;

// Mutation to test recognition in this workspace
const VERIFY_IN_WORKSPACE = gql`
  mutation VerifyInWorkspace($image: Upload!, $workspaceId: String!) {
    verifyFaceInWorkspace(image: $image, workspaceId: $workspaceId) {
      success
      message
      user {
        name
      }
    }
  }
`;

export default function CharacterManager() {
  const { activeWorkspace } = useWorkspace();
  const { addToast } = useToast();
  
  const [mode, setMode] = useState<"list" | "add" | "test">("list");
  const [charName, setCharName] = useState("");
  
  // Mutations
  const [addFace, { loading: adding }] = useMutation(ADD_FACE);
  const [verifyFace, { loading: verifying }] = useMutation(VERIFY_IN_WORKSPACE);
  
  // Fetch faces (We filter client-side for simplicity, or you can write a specific query)
  const { data, refetch } = useQuery(GET_FACES, { 
    skip: !activeWorkspace 
  });

  // Filter to find the active workspace's faces
  const currentFaces = data?.myWorkspaces.find((w: any) => w.id === activeWorkspace?.id)?.faces || [];

  const handleEnroll = async (file: File) => {
    if (!charName.trim()) {
      addToast({ type: 'error', title: 'Missing Name', message: 'Please enter a character name first.' });
      return;
    }

    try {
      const { data } = await addFace({ 
        variables: { 
          image: file,
          workspaceId: activeWorkspace?.id,  // <--- Linking to Workspace!
          characterName: charName            // <--- Naming the character!
        } 
      });

      if (data.addFace.success) {
        addToast({ type: 'success', title: 'Character Added', message: `Added ${charName} to ${activeWorkspace?.name}` });
        setMode("list");
        setCharName("");
        refetch();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.addFace.message });
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleTest = async (file: File) => {
    try {
      const { data } = await verifyFace({
        variables: {
          image: file,
          workspaceId: activeWorkspace?.id
        }
      });

      if (data.verifyFaceInWorkspace.success) {
        addToast({ type: 'success', title: 'MATCH FOUND!', message: data.verifyFaceInWorkspace.message });
      } else {
        addToast({ type: 'error', title: 'No Match', message: 'Character not found in this workspace.' });
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  if (!activeWorkspace) return <div className="text-slate-500 text-center p-10">Select a workspace to manage characters.</div>;

  return (
    <div className="max-w-4xl mx-auto mt-8">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {activeWorkspace.name} <span className="text-sm font-normal text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">ID: {activeWorkspace.id.slice(0,4)}...</span>
          </h2>
          <p className="text-slate-400 text-sm">Manage identities in this universe.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setMode(mode === "test" ? "list" : "test")}
            className={`px-4 py-2 rounded-xl border transition flex items-center gap-2 ${mode === "test" ? "bg-yellow-500/10 border-yellow-500 text-yellow-500" : "border-slate-600 text-slate-300 hover:text-white"}`}
          >
            <Search size={18} /> Test Recognition
          </button>
          <button 
            onClick={() => setMode("add")}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} /> Add Character
          </button>
        </div>
      </div>

      {/* --- MODE: LIST FACES --- */}
      {mode === "list" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {currentFaces.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
              <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No characters yet.</p>
              <button onClick={() => setMode("add")} className="text-indigo-400 hover:underline mt-2">Add the first one</button>
            </div>
          ) : (
            currentFaces.map((face: any) => (
              <div key={face.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-indigo-500 transition group relative">
                <div className="w-full aspect-square bg-slate-900 rounded-lg mb-3 overflow-hidden">
                   {/* In a real app, you'd serve the image via a static URL from Python/Node */}
                   <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-950">
                      <User size={32} />
                   </div>
                </div>
                <h3 className="font-bold text-white truncate">{face.name}</h3>
                <p className="text-xs text-slate-500">Added just now</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* --- MODE: ADD CHARACTER --- */}
      {mode === "add" && (
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">New Identity</h3>
              <p className="text-slate-400 text-sm">Who are we adding to {activeWorkspace.name}?</p>
            </div>

            <input 
              autoFocus
              value={charName}
              onChange={e => setCharName(e.target.value)}
              placeholder="Character Name (e.g. Tony Stark)"
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-center text-lg"
            />

            <div className="bg-black/20 rounded-2xl p-4">
              <FaceCapture 
                onCapture={handleEnroll}
                onCancel={() => setMode("list")}
                loading={adding}
                mode="register"
              />
            </div>
          </div>
        </div>
      )}

      {/* --- MODE: TEST RECOGNITION --- */}
      {mode === "test" && (
        <div className="bg-slate-800 rounded-2xl p-6 border border-yellow-500/30 animate-in fade-in slide-in-from-bottom-4">
          <div className="max-w-md mx-auto text-center">
            <h3 className="text-xl font-bold text-white mb-2">Simulation Mode 🧪</h3>
            <p className="text-slate-400 text-sm mb-6">
              Upload a photo to see if the AI recognizes them <strong>only within {activeWorkspace.name}</strong>.
            </p>
            
            <FaceCapture 
                onCapture={handleTest}
                onCancel={() => setMode("list")}
                loading={verifying}
                mode="login"
            />
          </div>
        </div>
      )}

    </div>
  );
}