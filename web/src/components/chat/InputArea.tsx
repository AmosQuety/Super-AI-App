// src/components/chat/InputArea.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Send, Paperclip, X, Image, FileText, AlertCircle, BookOpen, Zap } from "lucide-react";
import { useToast } from "../ui/toastContext";
import { useNetworkQuality } from "../../hooks/useNetworkQuality";

interface InputAreaProps {
  onSendMessage: (text: string, attachment?: File) => void;
  disabled?: boolean;
  isOnline?: boolean;
  onToggleContext?: () => void;
  contextOpen?: boolean;
  activeDocs?: number;
}

const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  disabled = false,
  isOnline = true,
  onToggleContext,
  contextOpen = false,
  activeDocs = 0,
}) => {
  const { showWarning } = useToast();
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const network = useNetworkQuality();
  // Override isOnline prop with our central hook's state
  const online = isOnline && !network.isOffline;
  
  // ── 30-Second Slow Network Banner Delay ──────────────────────────────────
  const [showSlowBanner, setShowSlowBanner] = useState(false);
  useEffect(() => {
    if (network.isSlowNetwork && online) {
      const timer = setTimeout(() => setShowSlowBanner(true), 30000);
      return () => clearTimeout(timer);
    } else {
      setShowSlowBanner(false);
    }
  }, [network.isSlowNetwork, online]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTextChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, []);

  const handleAttachmentChange = useCallback((file: File | null) => {
    if (!file) { setAttachment(null); return; }
    if (file.size > 10 * 1024 * 1024) {
      showWarning("Attachment Rejected", "Files must be smaller than 10MB.");
      return;
    }
    setAttachment(file);
  }, [showWarning]);

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleAttachmentChange(e.target.files?.[0] || null);
    if (e.target) e.target.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && online) setIsDragging(true);
  }, [disabled, online]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || !online) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleAttachmentChange(files[0]);
  }, [disabled, online, handleAttachmentChange]);

  const handleSendMessage = useCallback(() => {
    if (disabled || !online) return;
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    onSendMessage(trimmed, attachment || undefined);
    setText("");
    setAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [disabled, online, text, attachment, onSendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isSendDisabled = disabled || !online || (!text.trim() && !attachment);

  const getFileIcon = (file: File) =>
    file.type.startsWith("image/")
      ? <Image className="h-4 w-4 text-violet-400 flex-shrink-0" />
      : <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />;

  return (
    <div
      className="w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Network banners ─────────────────────────────────────────────── */}
      {!online ? (
        <div className="mb-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-300">Offline — messages will queue and send when reconnected.</span>
        </div>
      ) : showSlowBanner ? (
        <div className="mb-3 px-4 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-2">
          <Zap className="h-4 w-4 text-orange-400 flex-shrink-0" />
          <span className="text-xs text-orange-300">Slow network detected — requests may take longer.</span>
        </div>
      ) : null}

      {/* ── Attachment preview ───────────────────────────────────────────── */}
      {attachment && (
        <div className="mb-3 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {getFileIcon(attachment)}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{attachment.name}</p>
              <p className="text-[10px] text-slate-500">{(attachment.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button
            onClick={() => setAttachment(null)}
            className="p-1.5 ml-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Drag overlay ────────────────────────────────────────────────── */}
      {isDragging && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-[#1C2128] border-2 border-dashed border-blue-500/60 rounded-2xl p-10 text-center">
            <Paperclip className="h-10 w-10 text-blue-400 mx-auto mb-3" />
            <p className="text-white font-medium">Drop your file here</p>
            <p className="text-slate-400 text-sm mt-1">PDF, DOCX, TXT, images supported</p>
          </div>
        </div>
      )}

      {/* ── Main input container ─────────────────────────────────────────── */}
      <div className={`
        relative rounded-2xl transition-all duration-300 overflow-hidden
        bg-[#161B22]/60 backdrop-blur-xl
        ${isFocused
          ? "ring-1 ring-blue-500/50 shadow-lg shadow-blue-900/20"
          : "ring-1 ring-white/[0.07] hover:ring-white/10"
        }
        ${disabled ? "opacity-60" : ""}
        ${isDragging ? "ring-blue-500/50" : ""}
      `}>

        {/* Knowledge indicator strip */}
        {activeDocs > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-blue-600/5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-slate-400">
              <span className="text-emerald-400 font-semibold">{activeDocs} doc{activeDocs > 1 ? "s" : ""}</span> active in knowledge base
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 p-3">
          {/* Left action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
            {/* File attach */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || !online}
              className={`
                p-2 rounded-xl transition-all duration-200
                ${disabled || !online
                  ? "opacity-40 cursor-not-allowed text-slate-600"
                  : "text-slate-500 hover:text-white hover:bg-white/[0.06]"
                }
              `}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInputChange}
                disabled={disabled || !online}
                accept="image/*,.pdf,.doc,.docx,.txt,.md"
              />
            </button>

            {/* Knowledge base toggle */}
            {onToggleContext && (
              <button
                onClick={onToggleContext}
                disabled={disabled}
                className={`
                  p-2 rounded-xl transition-all duration-200 relative
                  ${contextOpen
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-slate-500 hover:text-white hover:bg-white/[0.06]"
                  }
                `}
                title="Knowledge base"
              >
                <BookOpen className="h-4 w-4" />
                {activeDocs > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#161B22]" />
                )}
              </button>
            )}
          </div>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              placeholder={
                !online
                  ? "Offline — reconnecting…"
                  : disabled
                    ? "Blaze is thinking…"
                    : "Ask anything "
              }
              className={`
                w-full bg-transparent text-white placeholder-slate-600
                focus:outline-none resize-none
                text-sm sm:text-[15px] leading-relaxed
                scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent
                py-2 px-1
                ${disabled || !online ? "cursor-not-allowed" : ""}
              `}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled || !online}
              style={{ minHeight: "40px", maxHeight: "180px" }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={isSendDisabled}
            className={`
              p-2.5 rounded-xl flex-shrink-0 transition-all duration-200
              ${isSendDisabled
                ? "bg-white/5 text-slate-600 cursor-not-allowed"
                : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 hover:scale-105 active:scale-95"
              }
            `}
            title={!online ? "Offline" : "Send message (Enter)"}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Footer hint */}
      <p className="mt-2 text-center text-[11px] text-slate-600">
        {!online
          ? "🔴 Offline"
          : "Enter to send  ·  Shift+Enter for new line"}
      </p>
    </div>
  );
};

export default InputArea;