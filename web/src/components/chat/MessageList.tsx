import React, { useRef, useEffect } from "react";
import Message from "./Message";
import { MessageType } from "./ChatContainer";

interface MessageListProps {
  messages: MessageType[];
  isDarkMode: boolean;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  isLoading?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isDarkMode,
  onDeleteMessage,
  onEditMessage,
  isLoading = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleDelete = (messageId: string) => {
    onDeleteMessage(messageId);
  };

  const handleEdit = (messageId: string, newText: string) => {
    if (onEditMessage) {
      onEditMessage(messageId, newText);
    }
  };

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="text-lg font-medium mb-2">No messages yet</h3>
          <p className="text-sm">Start a conversation by sending a message!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
    >
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          isDarkMode={isDarkMode}
          onDelete={handleDelete}
          onEdit={onEditMessage ? handleEdit : undefined}
        />
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl max-w-[70%]">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
