// src/components/chat/InputArea.tsx
import React, { useState, useRef, useCallback } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Send, Paperclip, X, Image, FileText, AlertCircle } from "lucide-react";
import { useTheme } from "../../contexts/useTheme";

interface InputAreaProps {
  onSendMessage: (text: string, attachment?: File) => void;
  disabled?: boolean;
  isOnline?: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  disabled = false,
  isOnline = true,
}) => {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // REFACTOR: Memoized text change handler with auto-resize
  const handleTextChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, []);

  // REFACTOR: Enhanced file handling with drag & drop
  const handleAttachmentChange = useCallback((file: File | null) => {
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      setAttachment(file);
    } else {
      setAttachment(null);
    }
  }, []);

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleAttachmentChange(file);
    if (e.target) e.target.value = "";
  };

  // REFACTOR: Drag and drop functionality
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && isOnline) {
      setIsDragging(true);
    }
  }, [disabled, isOnline]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled || !isOnline) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleAttachmentChange(files[0]);
    }
  }, [disabled, isOnline, handleAttachmentChange]);

  // REFACTOR: Enhanced send message with validation
  const handleSendMessage = useCallback(() => {
    if (disabled || !isOnline) return;
    
    const trimmedText = text.trim();
    if (trimmedText === "" && !attachment) return;

    onSendMessage(trimmedText, attachment || undefined);
    setText("");
    setAttachment(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [disabled, isOnline, text, attachment, onSendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4 text-purple-400 flex-shrink-0" />;
    }
    return <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />;
  };

  const isSendDisabled = disabled || !isOnline || (text.trim() === "" && !attachment);

  return (
    <div 
      className="px-4 pb-6 pt-2 bg-transparent dark:bg-transparent backdrop-blur-sm"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Offline Warning */}
      {!isOnline && (
        <div className="mb-3 p-3 bg-yellow-500/20 backdrop-blur rounded-xl border border-yellow-500/30 flex items-center space-x-2 animate-slide-in">
          <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          <span className="text-sm text-yellow-200">
            You are offline. Messages will be sent when connection is restored.
          </span>
        </div>
      )}

      {/* Attachment Preview */}
      {attachment && (
        <div className={`mb-3 p-3 backdrop-blur rounded-xl border flex items-center justify-between animate-slide-in ${
          theme === 'dark'
            ? 'bg-white/10 border-white/20'
            : 'bg-black/5 border-gray-200'
        }`}>
          <div className="flex items-center space-x-3 text-sm min-w-0 flex-1">
            {getFileIcon(attachment)}
            <div className="min-w-0 flex-1">
              <span className="text-white font-medium truncate block">
                {attachment.name}
              </span>
              <span className="text-purple-200 text-xs">
                {(attachment.size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
          <button 
            onClick={() => setAttachment(null)} 
            className="p-1.5 rounded-full text-purple-200 hover:bg-white/20 hover:text-red-300 transition-all duration-200 flex-shrink-0 ml-2 backdrop-blur"
            title="Remove attachment"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-purple-500/20 backdrop-blur flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border-2 border-dashed border-purple-400 text-center">
            <Paperclip className="h-12 w-12 text-purple-300 mx-auto mb-4" />
            <div className="text-white text-lg font-medium">Drop your file here</div>
            <div className="text-purple-200 text-sm">Attach files to your message</div>
          </div>
        </div>
      )}

      {/* Main Input Container */}
      <div className={`
       relative backdrop-blur-xl border rounded-2xl transition-all duration-300
        ${theme === 'dark'
          ? isFocused
            ? 'border-purple-500/60 shadow-lg shadow-purple-500/20 bg-gray-900/60'
            : 'border-white/10 hover:border-white/20 bg-gray-900/60'
          : isFocused
            ? 'border-purple-500/60 shadow-lg shadow-purple-500/20 bg-white/60'
            : 'border-gray-200 hover:border-gray-300 bg-white/60'
        }
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
        ${isDragging ? 'border-purple-400 shadow-lg shadow-purple-400/30' : ''}
      `}>


        <div className="flex items-end p-3 space-x-3">
          {/* Attachment Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || !isOnline}
            className={`
              p-2.5 rounded-xl transition-all duration-300 flex-shrink-0
              ${disabled || !isOnline
                ? 'opacity-40 cursor-not-allowed' 
                : 'bg-white/10 hover:bg-white/20 text-purple-300 hover:text-purple-200 hover:scale-105'
              }
              backdrop-blur border border-white/10
            `}
            aria-label="Attach file"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
            <input 
              ref={fileInputRef} 
              type="file" 
              className="hidden" 
              onChange={handleFileInputChange} 
              disabled={disabled || !isOnline}
              accept="image/*,.pdf,.doc,.docx,.txt" 
            />
          </button>
          
          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              placeholder={
                !isOnline ? "Offline - waiting for connection..." :
                disabled ? "AI is thinking..." : 
                "Type your message... (or drag & drop files)"
              }
              className={`
                w-full p-3 bg-transparent text-white placeholder-purple-200/60 
                focus:outline-none resize-none scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-transparent
                text-base leading-relaxed transition-all duration-300
                ${disabled || !isOnline ? 'cursor-not-allowed' : ''}
              `}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled || !isOnline}
              style={{ minHeight: "48px" }}
            />
            
            {/* Focus indicator */}
            {isFocused && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></div>
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={isSendDisabled}
            className={`
              p-3 rounded-xl focus:outline-none transition-all duration-300 transform 
              flex-shrink-0 backdrop-blur border
              ${isSendDisabled
                ? 'bg-gray-700/50 border-gray-600/50 text-gray-400 cursor-not-allowed scale-100' 
                : `
                  bg-gradient-to-r from-purple-600 to-blue-600 border-purple-500/50 
                  text-white shadow-lg hover:shadow-purple-500/30 
                  hover:scale-105 active:scale-95
                  hover:from-purple-700 hover:to-blue-700
                `
              }
            `}
            title={!isOnline ? "Offline - cannot send messages" : "Send message"}
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>

        {/* Subtle glow effect when focused */}
        {isFocused && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 -z-10 blur-sm"></div>
        )}
      </div>

      {/* Helper text */}
      <div className="mt-2 text-center">
        <p className={`text-xs ${
          theme === 'dark' ? 'text-purple-300/60' : 'text-gray-500'
        }`}>
          {!isOnline ? "🔴 Offline - Reconnect to send messages" : "Press Enter to send, Shift+Enter for new line"}
        </p>
      </div>
    </div>
  );
};

export default InputArea;