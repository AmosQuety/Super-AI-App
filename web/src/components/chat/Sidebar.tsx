import React, { useState } from "react";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface ChatSession {
  id: string;
  conversationId: string;
  title: string;
  createdAt: string; // This will now be a proper ISO string from GraphQL
}

interface ChatHistorySidebarProps {
  isOpen: boolean;
  onConversationSelected: (conversationId: string) => void;
  onCreateNewConversation: () => void;
  chatSessions: ChatSession[];
  userId: string;
  activeConversationId: string | null;
}

const Sidebar: React.FC<ChatHistorySidebarProps> = ({
  isOpen,
  userId,
  onConversationSelected,
  onCreateNewConversation,
  chatSessions,
  activeConversationId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter chat sessions based on search term
  const filteredSessions = chatSessions.filter((session) =>
    (session.title || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Much simpler now that we get proper ISO strings from GraphQL
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  return (
    <aside
      className={`
        bg-slate-900/70 backdrop-blur-xl text-gray-200 w-64 flex-shrink-0 p-4 flex flex-col
        fixed inset-y-0 left-0 h-full
        transform transition-transform duration-300 ease-in-out z-30
        border-r border-white/10
        lg:z-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      <div className="pt-20 flex flex-col flex-1 overflow-y-hidden">
        <h2 className="text-xl font-semibold mb-4 text-white">Chat History</h2>

        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 pl-10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/50 bg-white/5 text-gray-100 placeholder-gray-400"
          />
        </div>

        <button
          onClick={onCreateNewConversation}
          className="flex items-center justify-center space-x-2 w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-400 transition-all duration-300 transform hover:scale-105 shadow-lg mb-4"
        >
          <PlusIcon className="h-5 w-5" />
          <span>New Chat</span>
        </button>

        
<ul className="overflow-y-auto flex-grow space-y-2 -mr-2 pr-2 scrollbar-thin scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 scrollbar-track-transparent">
  {filteredSessions.length > 0 ? (
    filteredSessions.map((session) => (
      <li key={session.id}> 
        <button
          type="button"
          onClick={() => onConversationSelected(session.id)}
          className={`w-full text-left p-3 hover:bg-white/10 rounded-xl cursor-pointer transition-all duration-200 group ${
            activeConversationId === session.conversationId
              ? "bg-blue-500/30 font-semibold border-l-4 border-cyan-400"
              : "border-l-4 border-transparent"
          }`}
          tabIndex={0}
        >
          <div className="font-medium truncate text-white group-hover:text-cyan-300 transition-colors duration-200">
            {session.title}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {formatDate(session.createdAt)}
          </div>
        </button>
      </li>
    ))
  ) : (
    <li key="no-chats" className="text-gray-500 py-2 px-3 text-center">No chats found.</li>
  )}
</ul>

        <div className="pt-4 mt-auto border-t border-white/10">
          <div className="text-sm text-gray-400">
            User ID: <span className="font-mono text-gray-300">{userId}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
