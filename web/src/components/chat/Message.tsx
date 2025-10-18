import React, { useState } from "react";
import { toast } from "react-toastify";
import { Menu, Transition } from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

interface MessageProps {
  message: {
    id: string;
    text: string;
    sender: "user" | "bot";
    timestamp: Date;
    attachment?: File | null;
  };
  onDelete: (messageId: string) => void;
  onEdit?: (messageId: string, newText: string) => void;
}

const Message: React.FC<MessageProps> = ({ message, onDelete, onEdit }) => {
  const isUserMessage = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [isHovered, setIsHovered] = useState(false);

  const messageClass = isUserMessage
    ? "bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-lg shadow-purple-600/30 ml-auto"
    : "bg-gradient-to-br from-slate-800 to-slate-700 backdrop-blur-lg text-gray-100 border border-white/10 shadow-xl mr-auto";

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(message.text);
    toast.success("Message copied to clipboard!", {
      position: "top-right",
      autoClose: 2000,
      theme: "dark",
      style: {
        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        color: "white",
        borderRadius: "12px",
      },
    });
  };

  const handleEdit = () => {
    if (onEdit && editText.trim() !== "" && editText.trim() !== message.text) {
      onEdit(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.text);
    setIsEditing(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <fieldset
      className={`flex w-full mb-6 group transition-all duration-300 ${
        isUserMessage ? "justify-end" : "justify-start"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`max-w-[85%] md:max-w-[75%] lg:max-w-[65%] group relative transform transition-transform duration-300 ${
          isHovered ? "scale-[1.01]" : ""
        }`}
      >
        {/* Message bubble with enhanced styling */}
        <div
          className={`rounded-3xl p-5 ${messageClass} relative overflow-hidden`}
        >
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center space-x-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow-inner
                ${
                  isUserMessage
                    ? "bg-white/20 text-white"
                    : "bg-gradient-to-r from-cyan-400 to-purple-500 text-white"
                }`}
              >
                {message.sender === "user" ? "U" : "AI"}
              </div>
              <span
                className={`text-sm font-medium capitalize ${
                  isUserMessage ? "text-white/90" : "text-gray-300"
                }`}
              >
                {message.sender === "user" ? "You" : "Assistant"}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`text-xs ${
                  isUserMessage ? "text-white/70" : "text-gray-400"
                }`}
              >
                {formatTime(message.timestamp)}
              </span>
            </div>
          </div>

          {/* Message content */}
          {isEditing ? (
            <div className="space-y-4 relative z-10">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-4 border border-white/20 rounded-2xl bg-black/30 backdrop-blur text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent resize-none"
                rows={4}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEdit();
                  }
                  if (e.key === "Escape") {
                    handleCancelEdit();
                  }
                }}
                placeholder="Edit your message..."
              />
              <div className="flex space-x-3">
                <button
                  onClick={handleEdit}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-green-400 hover:to-emerald-400 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl text-sm font-medium hover:from-gray-500 hover:to-gray-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 prose prose-invert prose-p:my-0 prose-p:text-white/90">
              <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
                {message.text}
              </p>
            </div>
          )}
        </div>

        {/* Action menu */}
        {!isEditing && (
          <div
            className={`absolute -top-3 ${
              isUserMessage ? "left-0" : "right-0"
            } opacity-0 group-hover:opacity-100 transition-all duration-300 flex space-x-1`}
          >
            <Menu as="div" className="relative">
              <Menu.Button className="p-2 bg-slate-800/80 backdrop-blur-lg rounded-full border border-white/10 shadow-xl hover:bg-slate-700/80 transition-all duration-300 transform hover:scale-110">
                <EllipsisVerticalIcon className="h-4 w-4 text-white" />
              </Menu.Button>
              <Transition
                as={React.Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items
                  className={`absolute ${
                    isUserMessage ? "right-0" : "left-0"
                  } mt-2 w-56 rounded-2xl shadow-2xl bg-slate-800/80 backdrop-blur-xl border border-white/10 ring-1 ring-black/5 divide-y divide-white/10 z-50`}
                >
                  <div className="py-2">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleCopyToClipboard}
                          className={`${
                            active ? "bg-white/10 text-cyan-300" : "text-white"
                          } flex items-center space-x-3 w-full text-left px-4 py-3 text-sm transition-colors duration-200`}
                        >
                          <DocumentDuplicateIcon className="w-5 h-5" />
                          <span>Copy message</span>
                        </button>
                      )}
                    </Menu.Item>
                    {isUserMessage && onEdit && (
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={() => setIsEditing(true)}
                            className={`${
                              active
                                ? "bg-white/10 text-purple-300"
                                : "text-white"
                            } flex items-center space-x-3 w-full text-left px-4 py-3 text-sm transition-colors duration-200`}
                          >
                            <PencilIcon className="w-5 h-5" />
                            <span>Edit message</span>
                          </button>
                        )}
                      </Menu.Item>
                    )}
                  </div>
                  <div className="py-2">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => onDelete(message.id)}
                          className={`${
                            active ? "bg-red-500/20" : ""
                          } flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 transition-colors duration-200`}
                        >
                          <TrashIcon className="w-5 h-5" />
                          <span>Delete message</span>
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        )}
      </div>
    </fieldset>
  );
};

export default Message;
