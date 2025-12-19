// src/components/ui/ErrorDisplay.tsx
import React, { useState } from 'react';
import { AlertTriangle, RefreshCcw, Copy, Check, ChevronDown, ChevronRight, Bug } from 'lucide-react';

interface ErrorDisplayProps {
  error: Error;
  resetErrorBoundary?: () => void;
  errorId?: string;
}

export default function ErrorDisplay({ error, resetErrorBoundary, errorId }: ErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `Error: ${error.message}\nID: ${errorId}\nStack: ${error.stack}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-red-500/10 p-6 border-b border-red-500/20 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">System Malfunction</h2>
          <p className="text-red-200/80 text-sm">
            The application encountered a critical error and could not continue.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-black/30 rounded-lg p-4 border border-slate-700 font-mono text-sm text-red-300 break-words">
            {error.message}
          </div>

          {errorId && (
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-800/50 p-2 rounded">
              <span>Error ID:</span>
              <span className="font-mono text-slate-400">{errorId}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={resetErrorBoundary}
              className="flex-1 bg-white text-slate-900 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2"
            >
              <RefreshCcw size={18} /> Reload System
            </button>
            
            <button
              onClick={handleCopy}
              className="px-4 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition border border-slate-700"
              title="Copy Error Details"
            >
              {copied ? <Check size={18} className="text-green-400"/> : <Copy size={18} />}
            </button>
          </div>

          {/* Developer Details */}
          <div className="pt-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-300 transition"
            >
              <span className="flex items-center gap-1"><Bug size={12}/> Technical Details</span>
              {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </button>
            
            {isExpanded && (
              <div className="mt-3 p-3 bg-black rounded-lg border border-slate-800 overflow-x-auto">
                <pre className="text-[10px] text-slate-400 font-mono leading-relaxed">
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}