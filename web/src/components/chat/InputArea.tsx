import React, { useState, useRef, ChangeEvent, KeyboardEvent } from "react";
import {
  PaperAirplaneIcon,
  PaperClipIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

interface InputAreaProps {
  onSendMessage: (text: string, attachment?: File) => void;
  disabled?: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  disabled = false,
}) => {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px"; // 160px max height
    }
  };

  const handleAttachmentChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 10 * 1024 * 1024) {
      // 10MB limit
      alert("File size must be less than 10MB");
      return;
    }
    setAttachment(file);
    // Clear the input value so the same file can be selected again
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleSendMessage = () => {
    if (disabled) return;

    const trimmedText = text.trim();
    if (trimmedText === "" && !attachment) return;

    onSendMessage(trimmedText, attachment || undefined);
    setText("");
    setAttachment(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  return (
    <div className="px-6 pb-6 pt-2 shrink-0">
      <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        {attachment && (
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm">
              <PaperClipIcon className="h-3 w-3 text-cyan-300" />
              <span className="text-gray-200 truncate max-w-xs">
                {attachment.name}
              </span>
              <span className="text-gray-400">
                ({(attachment.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={removeAttachment}
              className="text-gray-400 hover:text-red-400 transition-colors"
              title="Remove attachment"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>
        )}

        <div className="flex items-end p-2 space-x-2">
          <textarea
            ref={textareaRef}
            placeholder={disabled ? "AI is thinking..." : "Type a message..."}
            className="w-full p-3 bg-transparent text-gray-200 placeholder-gray-400 focus:outline-none resize-none scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            style={{ minHeight: "52px" }}
          />

          <div className="flex items-center space-x-2">
            <label
              htmlFor="attachment-input"
              className={`cursor-pointer p-3 rounded-full transition-colors duration-200 group ${
                disabled
                  ? "text-gray-500 cursor-not-allowed"
                  : "text-gray-400 hover:bg-white/10 hover:text-cyan-300"
              }`}
            >
              <PaperClipIcon className="h-6 w-6 transition-transform duration-200 group-hover:rotate-12" />
              <input
                ref={fileInputRef}
                type="file"
                id="attachment-input"
                className="hidden"
                onChange={handleAttachmentChange}
                disabled={disabled}
                accept="image/*,.pdf,.doc,.docx,.txt"
                title="Attach a file"
              />
            </label>

            <button
              onClick={handleSendMessage}
              disabled={disabled || (text.trim() === "" && !attachment)}
              className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-400 transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              title="Send message"
            >
              <PaperAirplaneIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputArea;
