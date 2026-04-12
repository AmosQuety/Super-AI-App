// src/components/chat/ContextPanel.tsx
import React, { Suspense, lazy } from "react";
import { BookOpen, X, FileText, CheckCircle2, Clock, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";

const DocumentUploader = lazy(() => import("./DocumentUploader"));

interface ActiveDoc {
  id: string;
  filename: string;
  status: "ready" | "processing" | "failed";
  selected: boolean;
}

interface ContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocs: ActiveDoc[];
  historyLoading: boolean;
  onUploadSuccess: (msg: string) => void;
  onUploadError: (msg: string) => void;
  onToggleDoc: (id: string) => void;
}

const statusIcon = (status: ActiveDoc["status"]) => {
  if (status === "ready") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "processing") return <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
  return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
};
const statusLabel = (status: ActiveDoc["status"]) => {
  if (status === "ready") return <span className="text-emerald-400">Ready</span>;
  if (status === "processing") return <span className="text-amber-400">Processing…</span>;
  return <span className="text-red-400">Failed</span>;
};

const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onClose,
  activeDocs,
  historyLoading,
  onUploadSuccess,
  onUploadError,
  onToggleDoc,
}) => {
  if (!isOpen) return null;

  const selectedCount = activeDocs.filter(d => d.selected && d.status === "ready").length;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-72 bg-[#0D1117] border-l border-white/[0.07] z-40 flex flex-col shadow-2xl lg:relative lg:z-auto lg:shadow-none transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Active Context</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selection banner */}
        {activeDocs.length > 0 && (
          <div className="px-5 py-2 bg-blue-500/5 border-b border-blue-500/10 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              <span className="text-blue-400 font-semibold">{selectedCount}</span> of {activeDocs.filter(d => d.status === "ready").length} doc{activeDocs.filter(d => d.status === "ready").length !== 1 ? "s" : ""} in context
            </span>
            {selectedCount > 0 && (
              <button
                onClick={() => activeDocs.forEach(d => d.selected && onToggleDoc(d.id))}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors font-medium"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {activeDocs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500 leading-relaxed">
                No knowledge documents yet.<br />Upload one below to enhance AI responses.
              </p>
            </div>
          ) : (
            activeDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => doc.status === "ready" && onToggleDoc(doc.id)}
                disabled={doc.status !== "ready"}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left group
                  ${doc.selected && doc.status === "ready"
                    ? "bg-blue-500/[0.08] border-blue-500/30 hover:border-blue-500/50"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/10 opacity-60 hover:opacity-80"
                  }
                  ${doc.status !== "ready" ? "cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {/* File icon */}
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors
                  ${doc.selected && doc.status === "ready"
                    ? "bg-blue-600/20 border-blue-500/40"
                    : "bg-white/5 border-white/10"
                  }`}
                >
                  <FileText className={`w-4 h-4 ${doc.selected && doc.status === "ready" ? "text-blue-400" : "text-slate-500"}`} />
                </div>

                {/* Name + status */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${doc.selected && doc.status === "ready" ? "text-white" : "text-slate-400"}`}>
                    {doc.filename}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {statusIcon(doc.status)}
                    <span className="text-[10px]">{statusLabel(doc.status)}</span>
                  </div>
                </div>

                {/* Toggle icon */}
                {doc.status === "ready" && (
                  <div className="flex-shrink-0 transition-transform group-hover:scale-105">
                    {doc.selected
                      ? <ToggleRight className="w-5 h-5 text-blue-400" />
                      : <ToggleLeft className="w-5 h-5 text-slate-600" />
                    }
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Upload section */}
        <div className="px-4 py-4 border-t border-white/[0.07]">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3 font-semibold">Upload Document</p>
          <Suspense fallback={
            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
          }>
            <DocumentUploader
              disabled={historyLoading}
              onStatus={(type, message) => {
                if (type === "success") onUploadSuccess(message);
                else onUploadError(message);
              }}
            />
          </Suspense>
        </div>
      </aside>
    </>
  );
};

export default ContextPanel;
