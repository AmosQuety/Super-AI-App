import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Globe } from 'lucide-react';

interface ProcessingStateProps {
  operationLabel?: string;
  progress?: number;
}

export default function ProcessingState({ operationLabel = "Synthesizing", progress }: ProcessingStateProps) {
  const [dots, setDots] = useState('');

  // Typing dots animation
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden rounded-2xl bg-[#0a0f18] border border-slate-800">

      {/* Background ambient pulses */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-96 h-96 bg-emerald-500/10 rounded-full blur-[80px]"
      />
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.05, 0.2, 0.05] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute w-80 h-80 bg-blue-500/10 rounded-full blur-[60px]"
      />

      {/* Main Core Spinner */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          {/* Outer rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-32 h-32 rounded-full border-t-2 border-r-2 border-emerald-500/40 border-dashed absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
          {/* Inner rotating ring (counter) */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-full border-b-2 border-l-2 border-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />

          {/* Central Core */}
          <div className="w-16 h-16 bg-slate-900 rounded-full border border-slate-700 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] z-20 relative">
            <Brain className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Text Area */}
        <div className="mt-12 text-center space-y-4">
          <h3 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-1 font-mono">
            {operationLabel}
            <span className="inline-block w-4 text-left text-emerald-400">{dots}</span>
          </h3>

          {progress !== undefined && (
            <div className="w-64 max-w-full mx-auto">
              <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
                <span>Progress</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          <div className="pt-4 max-w-sm mx-auto">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 shadow-inner backdrop-blur-sm">
              <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-200">Cloud Processing Active</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  You can safely switch tabs or close this window. We will keep working, and if notification permission is enabled we will alert you. Even without push delivery, your result can always be recovered from the <span className="text-slate-300 font-medium">Recent AI Tasks</span> panel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
