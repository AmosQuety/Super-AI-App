// src/components/chat/Message.tsx
import React, { useState, useCallback } from "react";
import { useToast } from "../ui/toastContext";
import { Menu, Transition } from "@headlessui/react";
import {
  MoreHorizontal,
  Copy,
  Edit3,
  Trash2,
  User,
  Bot,
  AlertCircle,
  RefreshCw,
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
  };
  onDelete: (messageId: string) => void;
  onRetry?: (message: MessageProps['message']) => void;
  isThinking?: boolean;
  style?: React.CSSProperties;
}

const Message: React.FC<MessageProps> = ({ 
  message, 
  onDelete, 
  onRetry, 
  isThinking = false, 
  style 
}) => {
  const isUserMessage = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const { showSuccess, showError } = useToast();
  


  // REFACTOR: Enhanced copy functionality with better feedback
  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      showSuccess("Copied!", "Message copied to clipboard.");
    } catch (error) {
      console.error("Failed to copy text:", error);
      showError("Copy Failed", "Unable to copy message to clipboard.");
    }
  }, [message.text, showSuccess, showError]);

  // REFACTOR: Enhanced edit functionality with validation
  const handleEdit = useCallback(() => {
    if (!editText.trim()) {
      showError("Invalid Message", "Message cannot be empty.");
      return;
    }

    if (editText.trim() !== message.text) {
      // In a real implementation, this would call an API to update the message
      showSuccess("Message Updated", "Your message has been updated.");
    }
    
    setIsEditing(false);
  }, [editText, message.text, showSuccess, showError]);

  const handleCancelEdit = useCallback(() => {
    setEditText(message.text);
    setIsEditing(false);
  }, [message.text]);

  const formatTime = useCallback((date: Date) => {
    return new Intl.DateTimeFormat('default', { 
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: true 
    }).format(date);
  }, []);

  // REFACTOR: Enhanced thinking indicator with smooth animation
  if (isThinking) {
    return (
      <div 
        className="flex w-full mb-6 group justify-start animate-fade-in"
        style={style}
      >
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-theme-tertiary">
            <Bot className="w-5 h-5 text-theme-secondary" />
          </div>
          <div className="bg-theme-input p-4 rounded-2xl rounded-tl-none shadow-theme-md">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <div className="text-xs text-theme-tertiary mt-2">
              AI is thinking...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // REFACTOR: Message status indicators
  const renderStatusIndicator = () => {
    switch (message.status) {
      case "sending":
        return (
          <div className="flex items-center space-x-1 text-xs text-blue-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span>Sending...</span>
          </div>
        );
      case "retrying":
        return (
          <div className="flex items-center space-x-1 text-xs text-yellow-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Retrying... ({message.retryCount}/3)</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center space-x-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>Failed to send</span>
          </div>
        );
      default:
        return null;
    }
  };

  // REFACTOR: Render basic Markdown bold and italics securely
  const renderFormattedText = (text: string) => {
    // Split by **text** or *text* capturing the delimiters
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic">{part.slice(1, -1)}</em>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div 
    className={`flex w-full mb-4 sm:mb-6 group ${isUserMessage ? "justify-end" : "justify-start"}`}
    style={style}
  >
    <div className={`flex items-end gap-2 sm:gap-3 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ${isUserMessage ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
        isUserMessage 
          ? 'bg-blue-500 hover:bg-blue-600' 
          : 'bg-theme-tertiary hover:bg-theme-input'
      }`}>
        {isUserMessage ? 
          <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" /> : 
          <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-theme-secondary" />
        }
      </div>

      {/* Message Bubble & Content */}
      <div className={`flex-1 p-2 sm:p-4 rounded-2xl shadow-theme-md transition-all duration-300 ${
        isUserMessage 
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-none hover:opacity-90' 
            : 'bg-theme-secondary text-theme-primary rounded-bl-none hover:bg-theme-tertiary border border-theme-light'
        } ${message.status === "error" ? 'border border-red-400' : ''}`}>
          
        <div className="flex justify-between items-center mb-1 sm:mb-2">
          <span className="text-xs sm:text-sm font-bold">
            {isUserMessage ? 'You' : 'Assistant'}
          </span>
          <span className={`text-xs ${isUserMessage ? 'text-blue-100' : 'text-theme-tertiary'}`}>
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Status Indicator */}
        {renderStatusIndicator()}

        {isEditing ? (
          <div className="space-y-2 sm:space-y-3">
            <textarea 
              value={editText} 
              onChange={(e) => setEditText(e.target.value)} 
              className="w-full p-2 border border-blue-300 rounded-lg bg-blue-400/50 text-white focus:outline-none focus:ring-2 focus:ring-white text-sm sm:text-base" 
              autoFocus 
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEdit();
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
            />
            <div className="flex space-x-2">
              <button 
                onClick={handleEdit} 
                className="px-3 py-1 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition-colors"
              >
                Save
              </button>
              <button 
                onClick={handleCancelEdit} 
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
              {renderFormattedText(message.text)}
            </p>
            
            {/* Error message with retry option */}
            {message.status === "error" && onRetry && (
              <div className="mt-3 p-3 bg-red-500/20 rounded-lg border border-red-500/30">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-red-200 font-medium mb-1">
                      Failed to send message
                    </div>
                    <div className="text-xs text-red-300 mb-2">
                      {message.error || "An unknown error occurred"}
                    </div>
                    <button
                      onClick={() => onRetry(message)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Menu */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center hidden sm:block flex-shrink-0">
        <Menu as="div" className="relative">
          <Menu.Button 
            className="p-2 rounded-full hover:bg-theme-tertiary transition-colors"
            disabled={message.status === "sending" || message.status === "retrying"}
          >
            <MoreHorizontal className="w-4 h-4 text-theme-tertiary" />
          </Menu.Button>
          <Transition 
            as={React.Fragment} 
            enter="transition ease-out duration-100" 
            enterFrom="transform opacity-0 scale-95" 
            enterTo="transform opacity-100 scale-100" 
            leave="transition ease-in duration-75" 
            leaveFrom="transform opacity-100 scale-100" 
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className={`absolute ${isUserMessage ? "right-0" : "left-0"} top-8 w-48 rounded-xl shadow-theme-lg bg-theme-secondary border border-theme-light ring-1 ring-black ring-opacity-5 z-10`}>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button 
                      onClick={handleCopyToClipboard}
                      className={`${active ? 'bg-theme-tertiary' : ''} flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-theme-primary transition-colors`}
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </button>
                  )}
                </Menu.Item>
                {isUserMessage && message.status === "sent" && (
                  <Menu.Item>
                    {({ active }) => (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className={`${active ? 'bg-theme-tertiary' : ''} flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-theme-primary transition-colors`}
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    )}
                  </Menu.Item>
                )}
                {message.status === "error" && onRetry && (
                  <Menu.Item>
                    {({ active }) => (
                      <button 
                        onClick={() => onRetry(message)}
                        className={`${active ? 'bg-yellow-100/50 dark:bg-yellow-900/30' : ''} flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 transition-colors`}
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Retry</span>
                      </button>
                    )}
                  </Menu.Item>
                )}
                <Menu.Item>
                  {({ active }) => (
                    <button 
                      onClick={() => onDelete(message.id)}
                      className={`${active ? 'bg-red-100/50 dark:bg-red-900/30' : ''} flex items-center space-x-3 w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 transition-colors`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </div>
  </div>
  );
};

export default React.memo(Message);