import React, { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { COMPARE_FACES } from "../../graphql/playground";
import { Upload, X, ArrowRightLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TwinOMeter() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [preview1, setPreview1] = useState<string | null>(null);
  const [preview2, setPreview2] = useState<string | null>(null);
  
  const [result, setResult] = useState<any>(null);
  
  const [compareMutation, { loading }] = useMutation(COMPARE_FACES);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      
      if (slot === 1) { setFile1(file); setPreview1(url); }
      else { setFile2(file); setPreview2(url); }
      
      setResult(null); // Reset results on new upload
    }
  };

  const runComparison = async () => {
    if (!file1 || !file2) return;
    
    try {
      const { data } = await compareMutation({ 
        variables: { image1: file1, image2: file2 } 
      });
      
      if (data.compareFaces.success) {
        setResult(data.compareFaces.data);
      } else {
        alert("Error: " + data.compareFaces.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("Comparison failed. Check console.");
    }
  };

  // --- REUSABLE UPLOAD BOX ---
  const UploadBox = ({ slot, preview, file }: { slot: 1 | 2, preview: string | null, file: File | null }) => (
    <div className="relative group w-full aspect-square bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 hover:border-purple-500 transition-colors flex flex-col items-center justify-center overflow-hidden">
      {preview ? (
        <>
          <img src={preview} alt="Upload" className="w-full h-full object-cover" />
          <button 
            onClick={() => {
                if(slot===1) { setFile1(null); setPreview1(null); }
                else { setFile2(null); setPreview2(null); }
                setResult(null);
            }}
            className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition"
          >
            <X size={16} />
          </button>
        </>
      ) : (
        <>
          <Upload className="w-8 h-8 text-slate-400 mb-2 group-hover:text-purple-400 transition" />
          <span className="text-sm text-slate-400 font-medium">Upload Photo {slot === 1 ? "A" : "B"}</span>
          <input 
            type="file" 
            accept="image/*"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => handleFileChange(e, slot)}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
          Twin-O-Meter 👯‍♂️
        </h2>
        <p className="text-slate-400">Compare two faces to see if they match.</p>
      </div>

      {/* --- COMPARISON AREA --- */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
        <UploadBox slot={1} preview={preview1} file={file1} />
        
        {/* VS Badge */}
        <div className="shrink-0 w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center border border-slate-700 font-black text-slate-500 z-10 shadow-xl">
          VS
        </div>
        
        <UploadBox slot={2} preview={preview2} file={file2} />
      </div>

      {/* --- ACTION BUTTON --- */}
      <div className="text-center mb-8">
        <button
          onClick={runComparison}
          disabled={!file1 || !file2 || loading}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-purple-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto min-w-[200px]"
        >
          {loading ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />}
          {loading ? "Calculating..." : "Compare Faces"}
        </button>
      </div>

      {/* --- RESULTS SECTION --- */}
      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 border ${result.verified ? "bg-green-900/20 border-green-500/50" : "bg-red-900/20 border-red-500/50"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {result.verified ? <CheckCircle2 className="text-green-400" /> : <XCircle className="text-red-400" />}
              {result.verified ? "It's a Match!" : "Different People"}
            </h3>
            <span className="text-2xl font-mono font-bold text-white">
              {result.similarity_score}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-4 bg-slate-800 rounded-full overflow-hidden mb-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${result.similarity_score}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full ${result.verified ? "bg-green-500" : "bg-red-500"}`}
            />
          </div>
          <p className="text-xs text-slate-400 text-right">
            Threshold: 60% similarity needed
          </p>
        </motion.div>
      )}
    </div>
  );
}