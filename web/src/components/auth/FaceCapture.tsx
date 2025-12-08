import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, RefreshCw, X } from "lucide-react";

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

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
    }
  }, [webcamRef]);

  const retake = () => setImgSrc(null);

  const confirm = async () => {
    if (!imgSrc) return;

    // Convert Base64 to File object
    const res = await fetch(imgSrc);
    const blob = await res.blob();
    const file = new File([blob], "face_capture.jpg", { type: "image/jpeg" });
    
    onCapture(file);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 w-full animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700">
        
        {/* Overlay for UI coolness */}
        <div className="absolute inset-0 z-10 pointer-events-none border-[1px] border-white/20 rounded-2xl">
           {/* Face Guide Overlay */}
           <div className="absolute inset-0 flex items-center justify-center">
             <div className={`w-48 h-64 border-2 border-dashed rounded-[50%] transition-colors duration-500 ${imgSrc ? 'border-green-400' : 'border-blue-400/50'}`}></div>
           </div>
        </div>

        {imgSrc ? (
          <img src={imgSrc} alt="captured" className="w-full h-full object-cover transform scale-x-[-1]" />
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover transform scale-x-[-1]"
            videoConstraints={{ facingMode: "user" }}
          />
        )}
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-white">
          {mode === "login" ? "Verify Identity" : "Enroll Face"}
        </h3>
        <p className="text-sm text-slate-400">
          {imgSrc 
            ? "Photo looks good? Click Confirm." 
            : "Look at the camera and SMILE 🙂"}
        </p>
      </div>

      <div className="flex gap-4">
        {!imgSrc ? (
          <>
            <button
              onClick={onCancel}
              className="p-3 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              <X size={24} />
            </button>
            <button
              onClick={capture}
              className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/30"
            >
              <Camera size={24} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={retake}
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
              {loading ? "Processing..." : "Confirm"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};