// src/components/chat/Sidebar.tsx
import React, { useState, useMemo } from "react";
import { Plus, Search, LogOut, User, ChevronLeft } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { motion, type Variants } from "framer-motion";

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
  onCloseMobile?: () => void; // Added for explicit mobile closing
}

// Helper to group dates
const groupSessionsByDate = (sessions: ChatSession[]) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups: Record<string, ChatSession[]> = {
    "Today": [],
    "Yesterday": [],
    "Previous 7 Days": [],
    "Older": []
  };

  sessions.forEach(session => {
    const date = new Date(session.createdAt);
    
    if (date.toDateString() === today.toDateString()) {
      groups["Today"].push(session);
    } else if (date.toDateString() === yesterday.toDateString()) {
      groups["Yesterday"].push(session);
    } else if (date > lastWeek) {
      groups["Previous 7 Days"].push(session);
    } else {
      groups["Older"].push(session);
    }
  });

  return groups;
};

const Sidebar: React.FC<ChatHistorySidebarProps> = ({
  isOpen,
  onConversationSelected,
  onCreateNewConversation,
  chatSessions,
  activeConversationId,
  onCloseMobile
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { user, signOut } = useAuth();
  

  const filteredSessions = useMemo(() => {
    const sessionsCopy = [...chatSessions];
    return sessionsCopy
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((session) =>
        (session.title || "Untitled Chat").toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [chatSessions, searchTerm]);

  const groupedSessions = useMemo(() => {
    // If searching, don't group, just show flat list or single group
    if (searchTerm) return { "Search Results": filteredSessions };
    return groupSessionsByDate(filteredSessions);
  }, [filteredSessions, searchTerm]);

  // Animation variants
  const sidebarVariants: Variants = {
    open: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
    closed: { x: "-100%", opacity: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0 }
  };

  return (
    <>
      <motion.aside
        initial="closed"
        animate={isOpen ? "open" : "closed"}
        variants={sidebarVariants}
        className={`
          fixed inset-y-0 left-0 z-40 w-80 h-full flex flex-col
          bg-white/80 dark:bg-gray-950/90 backdrop-blur-xl
          border-r border-gray-200/50 dark:border-white/10
          lg:relative lg:translate-x-0 lg:opacity-100 lg:block
          ${!isOpen ? "lg:hidden" : ""} 
          shadow-2xl lg:shadow-none
        `}
      >
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header Area */}
          <div className="p-5 space-y-4 pt-6 lg:pt-24">
            <div className="flex items-center justify-between lg:justify-end">
               {/* Mobile Close Button */}
               <button 
                 onClick={onCloseMobile}
                 className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
               >
                 <ChevronLeft className="w-5 h-5" />
               </button>
            </div>

            {/* New Chat Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCreateNewConversation}
              className="w-full group relative flex items-center justify-center space-x-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium py-2.5 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>New Conversation</span>
              <div className="absolute inset-0 rounded-lg bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>

             {/* Search */}
             <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-900/50 border border-transparent dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 transition-all"
              />
            </div>
          </div>

          {/* Chat List - Grouped */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-800">
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-6"
            >
              {Object.entries(groupedSessions).map(([groupName, sessions]) => (
                sessions.length > 0 && (
                  <motion.div key={groupName} variants={itemVariants} className="space-y-1">
                    <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {groupName}
                    </h3>
                    <div className="space-y-1">
                      {sessions.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => {
                            onConversationSelected(session.id);
                            // Mobile close is handled by parent or we can call onCloseMobile here if provided, 
                            // but ChatContainer handles it via logic. We'll verify that.
                          }}
                          className={`
                            w-full relative group flex flex-col items-start p-3 rounded-xl transition-all duration-200
                            ${activeConversationId === session.id
                              ? "bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
                            }
                          `}
                        >
                          {/* Active Indicator Bar */}
                          {activeConversationId === session.id && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-full"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2 }}
                            />
                          )}

                          <div className="flex w-full justify-between items-start pl-2">
                             <span className="font-medium text-sm truncate pr-2 w-full text-left">
                                {session.title || "New Conversation"}
                             </span>
                          </div>
                          {/* <span className="text-[10px] opacity-60 pl-2 mt-0.5">
                             {new Date(session.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span> */}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )
              ))}

              {filteredSessions.length === 0 && (
                <div className="text-center py-10 px-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No conversations found</p>
                </div>
              )}
            </motion.div>
          </div>

           {/* User Footer */}
           <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-white/5 backdrop-blur-sm">
            <div className="flex items-center justify-between group">
               <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5">
                     <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                     </div>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {user?.name || "Admin User"}
                     </span>
                     <span className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</span>
                  </div>
               </div>
               
               <button
                 onClick={signOut}
                 className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                 title="Sign Out"
               >
                 <LogOut className="w-5 h-5" />
               </button>
            </div>
           </div>
        </div>
      </motion.aside>
      
      {/* Mobile Overlay */}
      {isOpen && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={onCloseMobile}
           className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}
    </>
  );
};

export default Sidebar;