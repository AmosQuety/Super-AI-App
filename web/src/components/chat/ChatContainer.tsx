// web/src/components/chat/ChatContainer.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import Message from "./Message";
import InputArea from "./InputArea";
import Sidebar from "./Sidebar";
import { Bot, RefreshCw, WifiOff } from "lucide-react";

import { useQuery, useMutation, useLazyQuery } from "@apollo/client/react";

console.log("useLazyQuery exists?", typeof useLazyQuery);

import { GET_CHATS, CREATE_CHAT, GET_CHAT_HISTORY } from "../../graphql/chats";
import { GENERATE_GEMINI_CONTENT } from "../../graphql/gemini"; // NEW: Import Gemini mutation
import { toast } from "react-toastify";
import Header from "./Header";

// Define TypeScript interfaces for better type safety
export interface MessageType {
  id: string;
  conversationId?: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  attachment?: File | null;
}

interface ChatSession {
  id: string;
  conversationId: string;
  title: string;
  createdAt: string;
}

interface Props {
  token: string;
  userInfo: { id: string; username: string };
}

const ChatContainer: React.FC<Props> = ({ token, userInfo }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode] = useState(true); // Kept for components that might use it
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // GraphQL Queries and Mutations
  const {
    data: chatsData,
    loading: chatsLoading,
    error: chatsError,
    refetch: refetchChats,
  } = useQuery(GET_CHATS, {
    variables: { userId: userInfo.id },
    skip: !userInfo.id,
  });

  const [getChatHistory, { data: historyData, loading: historyLoading }] =
    useLazyQuery(GET_CHAT_HISTORY);

  const [createChat, { loading: sending }] = useMutation(CREATE_CHAT);
  
  // NEW: Add Gemini mutation
  const [generateGeminiContent, { loading: aiThinking }] = useMutation(GENERATE_GEMINI_CONTENT);

  // Load messages when a conversation is selected from the sidebar
  useEffect(() => {
    if (conversationId && userInfo.id) {
      getChatHistory({
        variables: {
          chatId: conversationId,
        },
      });
    }
  }, [conversationId, userInfo.id, getChatHistory]);

  // Update messages state when history data is fetched
  useEffect(() => {
    if (historyData?.chatHistory) {
      const formattedMessages: MessageType[] = historyData.chatHistory.messages.map(
        (msg: any) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.role === "user" ? "user" : "bot",
          timestamp: new Date(msg.createdAt),
          attachment: null,
        })
      );
      setMessages(formattedMessages);
    } else {
      setMessages([]);
    }
  }, [historyData]);

  // Auto-scroll to the bottom of the chat window when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, sending, aiThinking]);

  // Handle dark mode (already works with Tailwind's dark mode strategy)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handleSendMessage = async (text: string, attachment?: File) => {
      const trimmedText = text.trim();

    if (text.trim() === "" && !attachment) {
      toast.warn("Please enter a message or add an attachment.", {
        position: "top-right",
        autoClose: 2000,
        theme: "dark",
        style: {
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
        },
      });
      return;
    }

      // Fix: Ensure we don't send empty prompts
  if (trimmedText === "") {
    // Only attachment, no text - handle accordingly
    console.log("Sending attachment only");
  }

    const userMessage: MessageType = {
      id: `user-${Date.now()}`,
      text: trimmedText,
      sender: "user",
      timestamp: new Date(),
      attachment: attachment || undefined,
    };

    // Add user message to the UI immediately
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    try {
      // Step 1: Get AI response from Gemini/Custom responses
      const { data: aiData } = await generateGeminiContent({
        variables: { prompt: text },
      });

      if (aiData?.generateGeminiContent?.success) {
        const aiMessage: MessageType = {
          id: `ai-${Date.now()}`,
          text: aiData.generateGeminiContent.generatedText,
          sender: "bot",
          timestamp: new Date(),
        };

        // Add AI message to the UI
        setMessages((prevMessages) => [...prevMessages, aiMessage]);

        // Step 2: Save both messages to the database
        const messagesForDb = [
          { role: "user", content: text },
          { role: "assistant", content: aiData.generateGeminiContent.generatedText },
        ];

        const { data: chatData } = await createChat({
          variables: {
            userId: userInfo.id,
            title: conversationId ? undefined : text.substring(0, 50) + "...",
            messages: messagesForDb,
          },
        });

        // If this is a new conversation, set the conversation ID
        if (!conversationId && chatData?.createChat) {
          setConversationId(chatData.createChat.id);
          refetchChats(); // Refresh the sidebar
        }

        toast.success("Message sent successfully!", {
          position: "top-right",
          autoClose: 2000,
          theme: "dark",
          style: {
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "white",
          },
        });

      } else {
        throw new Error(aiData?.generateGeminiContent?.message || "Failed to generate AI response");
      }

    } catch (error) {
      console.error("Error sending message:", error);
      
      toast.error("Failed to get AI response. Please try again.", {
        theme: "dark",
        style: {
          background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)",
          color: "white",
        },
      });

      // Remove the user message from UI if the whole process failed
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
    }
  };

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
    toast.info("Message removed from view.", {
      theme: "dark",
      style: {
        background: "linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)",
        color: "white",
      },
    });
  }, []);

  const handleConversationSelected = (selectedId: string) => {
    if (conversationId !== selectedId) {
      setMessages([]); // Clear messages to show loading state
      setConversationId(selectedId);
    }
    // On mobile, close sidebar after selection
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleCreateNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("You are back online!", {
        position: "top-right",
        autoClose: 2000,
        theme: "dark",
        style: {
          background: "linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)",
          color: "white",
        },
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline.", {
        position: "top-right",
        autoClose: 2000,
        theme: "dark",
        style: {
          background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)",
          color: "white",
        },
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const renderConnectionStatus = () => {
    if (!isOnline) {
      return (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <WifiOff className="w-4 h-4" />
            <span>Offline - Check your connection</span>
            <button
              onClick={() => window.location.reload()}
              name="refresh"
              title="Refresh connection"
              className="ml-2 p-1 bg-white/20 rounded hover:bg-white/30"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  if (chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-ping opacity-75"></div>
            <div className="relative w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-full"></div>
            </div>
          </div>
          <div className="text-lg font-medium text-gray-900 dark:text-white">
            Loading conversations...
          </div>
          <div className="mt-2 text-gray-600 dark:text-gray-400">
            Preparing your chat experience
          </div>
        </div>
      </div>
    );
  }

  if (chatsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Unable to Load Chats
          </div>
          <div className="text-gray-600 dark:text-gray-400 mb-4">
            {chatsError.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors duration-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-gray-900 via-purple-900 to-slate-900 text-white transition-all duration-500">
      {renderConnectionStatus()}
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-10 opacity-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/30 to-pink-500/20 rounded-full mix-blend-screen filter blur-3xl animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/30 to-blue-500/20 rounded-full mix-blend-screen filter blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-gradient-to-r from-indigo-500/30 to-purple-500/20 rounded-full mix-blend-screen filter blur-3xl animate-pulse delay-500"></div>
        </div>
      </div>

      <Header
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Backdrop for mobile sidebar */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            aria-hidden="true"
          ></div>
        )}

        <Sidebar
          isOpen={isSidebarOpen}
          onConversationSelected={handleConversationSelected}
          onCreateNewConversation={handleCreateNewConversation}
          chatSessions={chatsData?.chats || []}
          userId={userInfo.id}
          activeConversationId={conversationId}
        />

        <main
          className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
            isSidebarOpen ? "lg:ml-64" : "ml-0"
          }`}
        >
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-transparent hover:scrollbar-thumb-purple-400/70"
          >
            {(() => {
              if (historyLoading) {
                return (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full animate-ping opacity-75"></div>
                        <div className="relative bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full w-16 h-16 animate-pulse flex items-center justify-center">
                          <div className="w-12 h-12 bg-slate-800 rounded-full"></div>
                        </div>
                      </div>
                      <div className="text-lg font-medium bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                        Loading conversation history...
                      </div>
                    </div>
                  </div>
                );
              } else if (messages.length === 0 && !historyLoading) {
                return (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-md">
                      <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
                        <Bot className="w-12 h-12 text-blue-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                        Start a Conversation
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Select a chat from the sidebar or begin typing to start
                        your AI conversation.
                      </p>
                    </div>
                  </div>
                );
              } else {
                return messages.map((message) => (
                  <Message
                    key={message.id}
                    message={message}
                    isDarkMode={isDarkMode}
                    onDelete={handleDeleteMessage}
                  />
                ));
              }
            })()}
            
            {/* UPDATED: Show loading state for both sending and AI thinking */}
            {(sending || aiThinking) && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg max-w-[70%]">
                  <div className="flex items-center space-x-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {aiThinking ? "AI is thinking..." : "Sending..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <InputArea
            onSendMessage={handleSendMessage}
            disabled={sending || historyLoading || aiThinking} // UPDATED: Disable during AI thinking too
          />
        </main>
      </div>
    </div>
  );
};

export default ChatContainer;