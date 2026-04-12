// src/components/chat/Message.tsx
import React, { useState, useCallback } from "react";
import { useToast } from "../ui/toastContext";
import {
  Copy,
  Trash2,
  User,
  AlertCircle,
  RefreshCw,
  Check,
  Bookmark,
  Edit3,
  FileText,
  Download,
  Eye,
} from "lucide-react";

interface MessageProps {
  message: {
    id: string;
    text: string;
    sender: "user" | "bot";
    timestamp: Date;
    attachment?: File | null;
    status?: "sending" | "sent" | "error" | "retrying";
    error?: string;
    retryCount?: number;
    fileName?: string;
    fileUri?: string;
    fileMimeType?: string;
  };
  onDelete: (messageId: string) => void;
  onRetry?: (message: MessageProps["message"]) => void;
  onSuggestionClick?: (suggestion: string) => void;
  isThinking?: boolean;
  style?: React.CSSProperties;
}

const SUGGESTIONS: Record<string, string[]> = {
  default: ["Tell me more", "Summarize this", "Give me an example"],
  code: ["Explain this code", "Refactor this", "Add error handling"],
  list: ["Expand on point 1", "Compare these options", "What's your recommendation?"],
};

const Message: React.FC<MessageProps> = ({
  message,
  onDelete,
  onRetry,
  onSuggestionClick,
  isThinking = false,
  style,
}) => {
  const isUserMessage = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Copy Failed", "Unable to copy message to clipboard.");
    }
  }, [message.text, showError]);

  const handleEdit = useCallback(() => {
    if (!editText.trim()) {
      showError("Invalid Message", "Message cannot be empty.");
      return;
    }
    showSuccess("Message Updated", "Your message has been updated.");
    setIsEditing(false);
  }, [editText, showSuccess, showError]);

  const formatTime = useCallback((date: Date) => {
    return new Intl.DateTimeFormat("default", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date);
  }, []);

  // Detect content type for smart suggestions
  const getSuggestions = () => {
    const text = message.text.toLowerCase();
    if (text.includes("```") || text.includes("function") || text.includes("const ")) return SUGGESTIONS.code;
    if (text.includes("- ") || text.includes("1.") || text.includes("\u2022")) return SUGGESTIONS.list;
    return SUGGESTIONS.default;
  };

  // Show suggestions only for bot messages that are sent and long enough
  const shouldShowSuggestions = !isUserMessage && message.status === "sent" && message.text.length > 40;

  // ── Thinking Indicator ─────────────────────────────────────────────────────
  if (isThinking) {
    return (
      <div className="flex w-full mb-6 justify-start animate-fade-in" style={style}>
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-600 shadow-lg shadow-blue-900/30">
            <span className="text-lg font-black text-slate-950/80 select-none tracking-tighter cursor-default">X</span>
          </div>
          <div className="bg-[#161B22] border border-white/8 rounded-2xl rounded-tl-sm px-5 py-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase">Blaze</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 0.15, 0.3].map((delay, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Inline Markdown Renderer ───────────────────────────────────────────────
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={i} className="italic text-blue-200">{part.slice(1, -1)}</em>;
      if (part.startsWith("`") && part.endsWith("`"))
        return (
          <code key={i} className="px-1.5 py-0.5 bg-black/40 text-blue-300 rounded text-[0.82em] font-mono border border-white/10">
            {part.slice(1, -1)}
          </code>
        );
      return <span key={i}>{part}</span>;
    });
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const blocks = text.split(/(```[\s\S]*?```)/g);
    return blocks.map((block, bi) => {
      if (block.startsWith("```") && block.endsWith("```")) {
        const inner = block.slice(3, -3);
        const langMatch = inner.match(/^(\w+)\n/);
        const lang = langMatch ? langMatch[1] : "";
        const code = langMatch ? inner.slice(lang.length + 1) : inner;
        return (
          <div key={bi} className="my-4 bg-[#0D1117] rounded-xl border border-white/10 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-white/5 border-b border-white/10">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{lang || "code"}</span>
              <button
                onClick={() => navigator.clipboard.writeText(code.trim())}
                className="text-[10px] text-slate-400 hover:text-blue-400 transition-colors font-medium"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto leading-relaxed">
              <code>{code.trim()}</code>
            </pre>
          </div>
        );
      }
      return block.split("\n").map((line, li) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={`${bi}-${li}`} className="h-2" />;
        if (trimmed.startsWith("### ")) return <h3 key={`${bi}-${li}`} className="text-base font-bold mt-4 mb-2 text-white">{renderInline(trimmed.slice(4))}</h3>;
        if (trimmed.startsWith("## ")) return <h2 key={`${bi}-${li}`} className="text-lg font-bold mt-5 mb-2 text-white border-b border-white/10 pb-1">{renderInline(trimmed.slice(3))}</h2>;
        if (trimmed.startsWith("# ")) return <h1 key={`${bi}-${li}`} className="text-xl font-bold mt-6 mb-3 text-white">{renderInline(trimmed.slice(2))}</h1>;
        if (trimmed.startsWith("- ") || trimmed.startsWith("* "))
          return (
            <div key={`${bi}-${li}`} className="flex items-start gap-3 my-1.5 pl-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5 flex-shrink-0" />
              <span className="text-sm leading-relaxed text-slate-200">{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch)
          return (
            <div key={`${bi}-${li}`} className="flex items-start gap-3 my-1.5 pl-1">
              <span className="text-xs font-bold text-blue-400 mt-1 min-w-[1.4rem]">{numMatch[1]}.</span>
              <span className="text-sm leading-relaxed text-slate-200">{renderInline(numMatch[2])}</span>
            </div>
          );
        return (
          <p key={`${bi}-${li}`} className="text-sm sm:text-[15px] leading-relaxed mb-2 last:mb-0 text-slate-200">
            {renderInline(line)}
          </p>
        );
      });
    });
  };

  // ── File Card Component ───────────────────────────────────────────────────
  const FileCard = ({ name, uri, mime }: { name: string; uri?: string; mime?: string }) => {
    const extension = name.split(".").pop()?.toUpperCase() || "FILE";
    
    return (
      <div className="flex flex-col gap-2 mb-3">
        <div className="group/file relative flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/10 hover:border-blue-500/50 hover:bg-black/30 transition-all duration-300">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover/file:scale-105 transition-transform">
            <FileText className="w-5 h-5 text-blue-400" />
            <div className="absolute -top-1 -left-1 px-1.5 py-0.5 rounded-md bg-blue-600 text-[8px] font-black text-white uppercase tracking-tighter border border-blue-400/30">
              {extension}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate pr-6">{name}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-medium">
              {mime?.split("/")[1] || "Document"} • Ready
            </p>
          </div>

          {uri && (
            <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
              <a 
                href={uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title="View"
              >
                <Eye className="w-3.5 h-3.5" />
              </a>
              <a 
                href={uri} 
                download={name}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── User Message ───────────────────────────────────────────────────────────
  if (isUserMessage) {
    return (
      <div className="flex justify-end mb-4 group" style={style}>
        <div className="flex items-end gap-2 max-w-[75%] sm:max-w-[65%] flex-row-reverse">
          {/* Avatar */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>

          <div className="flex flex-col items-end gap-1">
            {/* Bubble */}
            <div className={`px-4 py-3 rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-900/30 ${message.status === "error" ? "ring-1 ring-red-500" : ""}`}>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-2 bg-white/10 rounded-lg text-white text-sm focus:outline-none resize-none"
                    rows={3}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                      if (e.key === "Escape") { setEditText(message.text); setIsEditing(false); }
                    }}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleEdit} className="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">Save</button>
                    <button onClick={() => { setEditText(message.text); setIsEditing(false); }} className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {(message.fileName || message.attachment) && (
                    <FileCard 
                      name={message.fileName || message.attachment?.name || "Shared File"} 
                      uri={message.fileUri}
                      mime={message.fileMimeType || message.attachment?.type}
                    />
                  )}
                  <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
                </>
              )}
              {message.status === "sending" && (
                <div className="mt-1 flex justify-end">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                </div>
              )}
              {message.status === "retrying" && (
                <div className="mt-1 flex items-center gap-1 justify-end">
                  <RefreshCw className="w-3 h-3 text-white/60 animate-spin" />
                  <span className="text-[10px] text-white/60">Retrying {message.retryCount}/3</span>
                </div>
              )}
            </div>

            {/* Timestamp + actions row */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pr-1">
              <span className="text-[11px] text-slate-500">{formatTime(message.timestamp)}</span>
              <button onClick={() => setIsEditing(true)} className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all" title="Edit">
                <Edit3 className="w-3 h-3" />
              </button>
              <button onClick={handleCopyToClipboard} className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all" title="Copy">
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <button onClick={() => onDelete(message.id)} className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all" title="Delete">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Error state */}
            {message.status === "error" && onRetry && (
              <div className="flex items-center gap-2 mt-1">
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Failed to send</span>
                <button onClick={() => onRetry(message)} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── AI Message ─────────────────────────────────────────────────────────────
  const suggestions = getSuggestions();
  return (
    <div className="flex justify-start mb-6 group" style={style}>
      <div className="flex items-start gap-3 w-full max-w-[88%] sm:max-w-[80%] lg:max-w-[75%]">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-600 shadow-lg shadow-blue-900/30 mt-1">
          <span className="text-lg font-black text-slate-950/80 select-none tracking-tighter cursor-default">X</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + timestamp */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase">Blaze</span>
            <span className="text-[11px] text-slate-600">{formatTime(message.timestamp)}</span>
          </div>

          {/* Card */}
          <div className="relative bg-[#1C2128] border border-white/[0.10] rounded-2xl rounded-tl-sm px-5 py-4 shadow-xl shadow-black/30 border-l-[3px] border-l-blue-500/70">
            <div className="text-slate-200 leading-relaxed">
              {renderFormattedText(message.text)}
            </div>

            {/* Hover action bar */}
            <div className="absolute -top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 bg-[#1C2128] border border-white/10 rounded-lg px-2 py-1 shadow-xl">
              <button onClick={handleCopyToClipboard} className="p-1 rounded text-slate-400 hover:text-white transition-colors" title="Copy">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <div className="w-px h-3 bg-white/10" />
              <button onClick={() => setBookmarked(b => !b)} className="p-1 rounded text-slate-400 hover:text-amber-400 transition-colors" title="Bookmark">
                <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? "fill-amber-400 text-amber-400" : ""}`} />
              </button>
              <div className="w-px h-3 bg-white/10" />
              <button onClick={() => onDelete(message.id)} className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Follow-up suggestions */}
          {shouldShowSuggestions && onSuggestionClick && (
            <div className="flex flex-wrap gap-2 mt-3">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onSuggestionClick(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-slate-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(Message);