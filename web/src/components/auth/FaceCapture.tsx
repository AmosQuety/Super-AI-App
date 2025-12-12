import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, RefreshCw, X, UploadCloud, Image as ImageIcon } from "lucide-react";

interface FaceCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  loading?: boolean;
  mode?: "login" | "register";
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ 
  onCapture, 
  onCancel, 
  loading = false,
  mode = "login" 
}) => {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [useWebcam, setUseWebcam] = useState(true); // Toggle state

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) setImgSrc(imageSrc);
  }, [webcamRef]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImgSrc(URL.createObjectURL(file));
      // We store the file directly for later use if needed, 
      // but confirm() handles both webcam blob and uploaded file logic below.
    }
  };

  const confirm = async () => {
    if (!imgSrc) return;

    // Convert to File object
    const res = await fetch(imgSrc);
    const blob = await res.blob();
    const file = new File([blob], "face_capture.jpg", { type: "image/jpeg" });
    
    onCapture(file);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 w-full animate-in fade-in duration-300">
      
      {/* TOGGLE BUTTONS */}
      <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 mb-2">
        <button 
          onClick={() => { setUseWebcam(true); setImgSrc(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${useWebcam ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
        >
          <Camera size={16} /> Webcam
        </button>
        <button 
          onClick={() => { setUseWebcam(false); setImgSrc(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${!useWebcam ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
        >
          <ImageIcon size={16} /> Upload
        </button>
      </div>

      <div className="relative w-full max-w-sm aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700 flex items-center justify-center group">
        
        {imgSrc ? (
          <img src={imgSrc} alt="captured" className="w-full h-full object-cover" />
        ) : useWebcam ? (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full h-full object-cover transform scale-x-[-1]"
              videoConstraints={{ facingMode: "user" }}
            />
            {/* Overlay */}
            <div className="absolute inset-0 pointer-events-none border-[1px] border-white/20 rounded-2xl">
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-48 h-64 border-2 border-dashed border-blue-400/50 rounded-[50%]"></div>
               </div>
            </div>
          </>
        ) : (
          /* UPLOAD MODE UI */
          <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full bg-slate-800 hover:bg-slate-700 transition-colors">
            <UploadCloud size={48} className="text-slate-500 mb-2 group-hover:text-blue-400 transition-colors" />
            <span className="text-slate-400 text-sm">Click to upload photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        )}
      </div>

      <div className="flex gap-4">
        {!imgSrc ? (
          useWebcam ? (
            <button
              onClick={capture}
              className="p-4 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/30"
            >
              <Camera size={24} />
            </button>
          ) : null
        ) : (
          <>
            <button
              onClick={() => setImgSrc(null)}
              disabled={loading}
              className="px-6 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition flex items-center gap-2"
            >
              <RefreshCw size={18} /> Retake
            </button>
            <button
              onClick={confirm}
              disabled={loading}
              className="px-6 py-2 rounded-xl bg-green-600 text-white hover:bg-green-500 transition shadow-lg shadow-green-500/30 flex items-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : "Confirm"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};