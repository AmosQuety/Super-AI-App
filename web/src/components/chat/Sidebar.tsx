// src/components/chat/Sidebar.tsx
import React, { useState, useMemo } from "react";
import { Plus, Search, MessageSquare, LogOut, User } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../ui/toastContext";


interface ChatSession {
  id: string;
  conversationId: string;
  title: string;
  createdAt: string;
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
  onConversationSelected,
  onCreateNewConversation,
  chatSessions,
  activeConversationId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { user, signOut } = useAuth();
  const {  showError } = useToast();

  const filteredSessions = useMemo(() => {
    const sessionsCopy = [...chatSessions];
    return sessionsCopy
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((session) =>
        (session.title || "Untitled Chat").toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [chatSessions, searchTerm]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (error:unknown) {
      let errorMessage = "An unexpected error occurred";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      showError('Date Formatting Error', errorMessage);
      return "Invalid Date";
    }
  };

  return (
    <aside 
      className={`
        bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 
        w-72 md:w-80 h-full flex flex-col 
        fixed inset-y-0 left-0 transform transition-transform duration-300 ease-in-out z-30 
        border-r border-gray-200 dark:border-gray-800 
        lg:relative lg:z-auto lg:translate-x-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        shadow-2xl lg:shadow-none
      `}
    >
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="mt-15 mb-6 flex justify-between text-center">
            
            <h1 className="font-semibold text-2xl text-gray-700 dark:text-gray-300">Chat History</h1>
          </div>
          
          {/* New Chat Button */}
          <button 
            onClick={onCreateNewConversation}
            className="flex items-center justify-center space-x-2 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-all duration-300 shadow-lg hover:shadow-blue-500/30 mb-6"
          >
            <Plus className="h-5 w-5" />
            <span>New Chat</span>
          </button>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 pl-10 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-all duration-300"
            />
          </div>
        </div>

        {/* Chat List - Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="space-y-2">
            {filteredSessions.length > 0 ? (
              filteredSessions.map((session) => (
                <button 
                  key={session.id} 
                  onClick={() => onConversationSelected(session.id)}
                  className={`
                    w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 
                    rounded-xl cursor-pointer transition-all duration-200 group
                    border-l-4
                    ${activeConversationId === session.id 
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm" 
                      : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                    }
                  `}
                >
                  <div className={`
                    font-medium truncate transition-colors text-sm mb-1
                    ${activeConversationId === session.id 
                      ? "text-blue-600 dark:text-blue-400" 
                      : "text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                    }
                  `}>
                    {session.title || "Untitled Chat"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(session.createdAt)}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-gray-500 dark:text-gray-400 py-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50"/>
                <p className="font-medium mb-1 text-gray-600 dark:text-gray-300">No chats found</p>
                <p className="text-sm">
                  {searchTerm ? `No results for "${searchTerm}"` : "Start a new conversation"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User Info Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => window.location.href = "/profile"} // or use navigate if you have router access
                className="flex items-center space-x-3 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-800 p-4 rounded-xl transition-colors"
              >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10 shadow-sm">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name || "User"}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email || ""}
                </span>
              </div>
              </button>
            </div>
            <button 
              onClick={signOut} 
              className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex-shrink-0" 
              aria-label="Sign out" 
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
    </aside>
  );
};

export default Sidebar;