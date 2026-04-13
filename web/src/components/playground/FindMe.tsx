import React, { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { FIND_FACE } from "../../graphql/playground";
import { Upload, Search, Download, X, User, Users, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useDelight } from "../../hooks/useDelight";
import { useToast } from "../ui/toastContext";
import logger from "../../utils/logger";

// --- TYPE DEFINITIONS ---
interface FindFaceResult {
  success: boolean;
  matches: number;
  faces_scanned?: number;
  processed_image: string;
  error?: string;
}

interface FindFaceData {
  findFaceInCrowd: FindFaceResult;
}

export default function FindMe() {
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [crowdFile, setCrowdFile] = useState<File | null>(null);
  const [targetPreview, setTargetPreview] = useState<string | null>(null);
  const [crowdPreview, setCrowdPreview] = useState<string | null>(null);
  const { triggerSuccess } = useDelight();
  const { showSuccess, showError } = useToast();
  const [result, setResult] = useState<FindFaceResult | null>(null);
  
  // This mutation takes longer, so we handle loading state carefully
  const [findMutation, { loading }] = useMutation<FindFaceData>(FIND_FACE);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'target' | 'crowd') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      
      if (type === 'target') {
        setTargetFile(file);
        setTargetPreview(url);
      } else {
        setCrowdFile(file);
        setCrowdPreview(url);
      }
      setResult(null); // Reset previous results
    }
  };

  const handleScan = async () => {
    if (!targetFile || !crowdFile) return;
    
    try {
      const { data } = await findMutation({ 
        variables: { target: targetFile, crowd: crowdFile } 
      });
      
      if (data?.findFaceInCrowd.success) {
        setResult(data.findFaceInCrowd);
        if (data.findFaceInCrowd.matches > 0) triggerSuccess();
        const scanned = data.findFaceInCrowd.faces_scanned;
        const matchCount = data.findFaceInCrowd.matches;
        showSuccess(
          matchCount > 0 ? "Target Located" : "Scan Complete — No Match",
          matchCount > 0
            ? `Found ${matchCount} match(es) across ${scanned} detected face(s).`
            : `Scanned ${scanned} face(s) — target not identified. Try a clearer photo.`
        );
      } else {
        showError("Identification Failed", data?.findFaceInCrowd.error || "The AI could not identify a clear match.");
      }
    } catch (err: any) {
      logger.error("Crowd scan failed", err);
      showError("System Error", err.message || "Could not connect to the biometric engine.");
    }
  };

  const downloadResult = () => {
    if (!result?.processed_image) return;
    const link = document.createElement("a");
    link.href = result.processed_image;
    link.download = "investigation_result.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-theme-primary mb-2 bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-400 dark:to-emerald-500 bg-clip-text text-transparent">
          Crowd Scanner 🕵️‍♂️
        </h2>
        <p className="text-theme-secondary font-medium">Upload a target face and find them inside a group photo.</p>
      </div>

      {/* --- UPLOAD SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* TARGET (1 Column) */}
        <div className="md:col-span-1 space-y-2">
          <label className="text-sm font-bold text-theme-secondary flex items-center gap-2 uppercase tracking-tight">
            <User size={16} className="text-blue-500 dark:text-blue-400"/> The Target (You)
          </label>
          <div className="relative group w-full aspect-[3/4] bg-theme-tertiary/20 rounded-2xl border-2 border-dashed border-theme-medium hover:border-violet-500 transition-all flex flex-col items-center justify-center overflow-hidden shadow-inner">
            {targetPreview ? (
              <>
                <img src={targetPreview} alt="Target" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setTargetFile(null); setTargetPreview(null); setResult(null); }}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition shadow-lg"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-theme-tertiary mb-2 group-hover:text-violet-500 transition-all" />
                <span className="text-xs text-theme-tertiary font-bold uppercase tracking-widest text-center px-4">Upload Target Face</span>
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'target')} />
              </>
            )}
          </div>
        </div>

        {/* CROWD (2 Columns) */}
        <div className="md:col-span-2 space-y-2">
          <label className="text-sm font-bold text-theme-secondary flex items-center gap-2 uppercase tracking-tight">
            <Users size={16} className="text-emerald-500 dark:text-green-400"/> The Crowd (Group Photo)
          </label>
          <div className="relative group w-full aspect-video bg-theme-tertiary/20 rounded-2xl border-2 border-dashed border-theme-medium hover:border-emerald-500 transition-all flex flex-col items-center justify-center overflow-hidden shadow-inner">
            {crowdPreview ? (
              <>
                <img src={crowdPreview} alt="Crowd" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setCrowdFile(null); setCrowdPreview(null); setResult(null); }}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition shadow-lg"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-theme-tertiary mb-2 group-hover:text-emerald-500 transition-all" />
                <span className="text-xs text-theme-tertiary font-bold uppercase tracking-widest text-center px-4">Upload Crowd Image</span>
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'crowd')} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- ACTION BUTTON --- */}
      <div className="text-center mb-10">
        <button
          onClick={handleScan}
          disabled={!targetFile || !crowdFile || loading}
          className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-green-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto min-w-[250px]"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Scanning Crowd...
            </>
          ) : (
            <>
              <Search /> Start Investigation
            </>
          )}
        </button>
        <p className="text-[10px] text-theme-tertiary font-bold uppercase tracking-widest mt-4">Note: Large photos may take 10-20 seconds for deep neural analysis.</p>
      </div>

      {/* --- RESULTS SECTION --- */}
      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-theme-secondary rounded-3xl overflow-hidden border border-theme-light shadow-theme-xl"
        >
          <div className="p-4 bg-theme-tertiary/20 border-b border-theme-light flex justify-between items-center">
            <h3 className="text-lg font-bold text-theme-primary flex items-center gap-2">
              Results Found: <span className="text-green-400 text-xl">{result.matches}</span>
            </h3>
            <button 
              onClick={downloadResult}
              className="px-4 py-2 bg-theme-tertiary hover:bg-theme-secondary text-theme-primary rounded-lg text-sm font-bold flex items-center gap-2 transition border border-theme-light"
            >
              <Download size={16} /> Download Result
            </button>
          </div>
          
          <div className="relative">
            {/* The Base64 Image returned from Python */}
            <img 
              src={result.processed_image} 
              alt="Processed Result" 
              className="w-full h-auto"
            />
            
            {result.matches === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-red-500/90 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-xl">
                  <AlertCircle /> No matches found.
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}