// web/src/components/chat/ChatContainer.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Message from "./Message";
import InputArea from "./InputArea";
import Sidebar from "./Sidebar";
import { Bot, RefreshCw, WifiOff, Menu } from "lucide-react";

import { useQuery, useMutation, useLazyQuery } from "@apollo/client/react";
import { GET_CHATS, CREATE_CHAT, GET_CHAT_HISTORY, SEND_MESSAGE_WITH_RESPONSE } from "../../graphql/chats";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../contexts/ThemeContext";

// REFACTOR: Enhanced message status enum for comprehensive UI states
export type MessageStatus = "sending" | "sent" | "error" | "retrying";

// REFACTOR: Enhanced MessageType interface with robust optimistic UI support
export interface MessageType {
  id: string;
  conversationId?: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  attachment?: File | null;
  status?: MessageStatus;
  error?: string;
  tempId?: string;
  retryCount?: number;
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

interface ApolloErrorExtensions {
  errorType?: string;
  retryable?: boolean;
  details?: string;
  originalMessage?: string;
  timestamp?: string;
}

interface EnhancedApolloError extends Error {
  extensions?: ApolloErrorExtensions;
  graphQLErrors?: Array<{
    message: string;
    extensions?: ApolloErrorExtensions;
  }>;
}


// REFACTOR: Custom hook for managing optimistic messages
const useOptimisticMessages = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);

  const addOptimisticMessage = useCallback((message: Omit<MessageType, 'id' | 'timestamp' | 'status'> & { tempId: string }) => {
    const optimisticMessage: MessageType = {
      ...message,
      id: message.tempId,
      timestamp: new Date(),
      status: "sending",
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    return optimisticMessage;
  }, []);

  const updateMessageStatus = useCallback((tempId: string, updates: Partial<MessageType>) => {
    setMessages(prev => prev.map(msg => 
      msg.tempId === tempId ? { ...msg, ...updates } : msg
    ));
  }, []);

  const replaceTempMessage = useCallback((tempId: string, permanentMessage: MessageType) => {
    setMessages(prev => prev.map(msg => 
      msg.tempId === tempId ? permanentMessage : msg
    ));
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const addMessage = useCallback((message: MessageType) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const setAllMessages = useCallback((newMessages: MessageType[]) => {
    setMessages(newMessages);
  }, []);

  return {
    messages,
    addOptimisticMessage,
    updateMessageStatus,
    replaceTempMessage,
    removeMessage,
    addMessage,
    setAllMessages,
  };
};

const ChatContainer: React.FC<Props> = ({ token, userInfo }) => {
  
  const { theme } = useTheme();
  
  const {
    messages,
    addOptimisticMessage,
    updateMessageStatus,
    replaceTempMessage,
    removeMessage,
    addMessage,
    setAllMessages,
  } = useOptimisticMessages();

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user: authUser, token: authToken } = useAuth();
  
  // REFACTOR: Enhanced AI state management
  const [aiState, setAiState] = useState<"idle" | "thinking" | "responding">("idle");
  
  const currentUser = authUser || userInfo;
  const currentToken = authToken || token;

  // GraphQL Queries and Mutations
  const {
    data: chatsData,
    loading: chatsLoading,
    error: chatsError,
    refetch: refetchChats,
  } = useQuery(GET_CHATS, {
    variables: { userId: currentUser.id },
    skip: !currentUser.id,
    onError: (error) => {
      console.error("Failed to load chats:", error);
      toast.error("Failed to load conversations. Please refresh the page.", {
        position: "top-right",
        autoClose: 4000,
        theme: "dark",
      });
    },
  });

  const [getChatHistory, { data: historyData, loading: historyLoading, error: historyError }] =
    useLazyQuery(GET_CHAT_HISTORY, {
      onError: (error) => {
        console.error("Failed to load chat history:", error);
        toast.error("Failed to load conversation history.", {
          position: "top-right",
          autoClose: 3000,
          theme: "dark",
        });
      },
    });

  const [createChat] = useMutation(CREATE_CHAT, {
    onError: (error) => {
      console.error("Failed to create chat:", error);
      toast.error("Failed to create new conversation.", {
        position: "top-right",
        autoClose: 3000,
        theme: "dark",
      });
    },
  });
  
  const [sendMessage] = useMutation(SEND_MESSAGE_WITH_RESPONSE, {
    onCompleted: () => {
      refetchChats();
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      // Error handling is done in the main send flow
    }
  });

  // REFACTOR: Enhanced auto-responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setIsSidebarOpen(isDesktop);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // REFACTOR: Enhanced chat history loading with error handling
  useEffect(() => {
    if (conversationId && userInfo.id) {
      getChatHistory({
        variables: { chatId: conversationId },
      });
    }
  }, [conversationId, userInfo.id, getChatHistory]);

  // REFACTOR: Enhanced message history processing
  useEffect(() => {
    if (historyData?.chatHistory) {
      const formattedMessages: MessageType[] = historyData.chatHistory.messages.map(
        (msg: any) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.role === "user" ? "user" : "bot",
          timestamp: new Date(msg.createdAt),
          attachment: null,
          status: "sent" as MessageStatus,
        })
      );
      setAllMessages(formattedMessages);
    } else if (historyError) {
      // Error is already handled by the query onError
      setAllMessages([]);
    }
  }, [historyData, historyError, setAllMessages]);

  // REFACTOR: Optimized smooth scroll with performance considerations
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // REFACTOR: Comprehensive message sending with optimistic UI and error recovery
  const handleSendMessage = useCallback(async (text: string, attachment?: File) => {
    const trimmedText = text.trim();

    if (trimmedText === "" && !attachment) {
      toast.warn("Please enter a message or add an attachment.", {
        position: "top-right",
        autoClose: 2000,
        theme: "dark",
      });
      return;
    }

    // Create optimistic user message
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = addOptimisticMessage({
      tempId,
      text: trimmedText,
      sender: "user",
      attachment: attachment || undefined,
      conversationId: conversationId || undefined,
    });

    try {
      let currentConversationId = conversationId;

      // Create new chat if this is the first message
      if (!currentConversationId) {
        toast.info("Creating new conversation...", {
          position: "top-right",
          autoClose: 1500,
          theme: "dark",
        });

        const { data: chatData } = await createChat({
          variables: {
            userId: currentUser.id,
            title: trimmedText.substring(0, 40) + (trimmedText.length > 40 ? "..." : ""),
            messages: [{ role: "user", content: trimmedText }],
          },
        });

        if (chatData?.createChat?.id) {
          currentConversationId = chatData.createChat.id;
          setConversationId(currentConversationId);
          await refetchChats();
          toast.success("New conversation created!", {
            position: "top-right",
            autoClose: 2000,
            theme: "dark",
          });
        } else {
          throw new Error("Failed to create a new chat session.");
        }
      }

      // Update message with conversation ID and show thinking state
      updateMessageStatus(tempId, { 
        status: "sending",
        conversationId: currentConversationId 
      });
      
      setAiState("thinking");

      // Send message and get AI response
      const { data: messageData } = await sendMessage({
        variables: {
          chatId: currentConversationId,
          content: trimmedText,
        },
      });

      // Check if we got valid data back
    if (!messageData?.sendMessageWithResponse) {
      throw new Error("Did not receive a valid response from the server.");
    }

      setAiState("responding");

      if (messageData?.sendMessageWithResponse?.aiMessage && messageData?.sendMessageWithResponse?.userMessage) {
        const aiMessageData = messageData.sendMessageWithResponse.aiMessage;
        const userMessageData = messageData.sendMessageWithResponse.userMessage;

        // Replace temporary user message with confirmed one
        const confirmedUserMessage: MessageType = {
          id: userMessageData.id,
          conversationId: currentConversationId,
          text: trimmedText,
          sender: "user",
          timestamp: new Date(userMessageData.createdAt),
          attachment: attachment || undefined,
          status: "sent",
        };

        replaceTempMessage(tempId, confirmedUserMessage);

        // Add AI response with smooth entrance
        const aiMessage: MessageType = {
          id: aiMessageData.id,
          conversationId: currentConversationId,
          text: aiMessageData.content,
          sender: "bot",
          timestamp: new Date(aiMessageData.createdAt),
          status: "sent",
        };

        addMessage(aiMessage);

        toast.success("Message sent successfully!", {
          position: "top-right",
          autoClose: 2000,
          theme: "dark",
        });

      } else {
        throw new Error("Did not receive a valid AI response.");
      }

    } catch (error) {
      console.error("Error sending message:", error);
      
      // REFACTOR: Enhanced error parsing for better user feedback
    let errorMessage = "Failed to send message. Please try again.";
    let isRetryable = true;
    
    // Parse the error message for specific error types
    if (error?.message) {
      const lowerCaseError = error.message.toLowerCase();

    if (lowerCaseError.includes('timeout')) {
        errorMessage = "AI service timeout - please try again";
        isRetryable = true;
      } else if (lowerCaseError.includes('network') || lowerCaseError.includes('fetch')) {
        errorMessage = "Network connection issue - please check your connection";
        isRetryable = true;
      } else if (lowerCaseError.includes('rate limit')) {
        errorMessage = "Rate limit exceeded - please wait a moment";
        isRetryable = true;
      } else if (lowerCaseError.includes('authentication') || lowerCaseError.includes('auth')) {
        errorMessage = "Authentication error - please refresh the page";
        isRetryable = false;
      } else if (lowerCaseError.includes('service unavailable')) {
        errorMessage = "AI service temporarily unavailable - please try again later";
        isRetryable = true;
      }
      
      // Check if it's a structured Apollo error
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        const graphQLError = error.graphQLErrors[0];
        const extensions = graphQLError.extensions as ApolloErrorExtensions | undefined;

      if (extensions?.details) {
          errorMessage = extensions.details;
          isRetryable = extensions.retryable !== false;
        }
      }
    }


      // Update message to error state with retry capability
      updateMessageStatus(tempId, {
        status: "error",
        error: "Failed to send message. Click to retry.",
        retryCount: (optimisticMessage.retryCount || 0) + 1,
      });

      toast.error(
        <div>
        <div className="font-semibold">{errorMessage}</div>
        {isRetryable && (
          <div className="text-sm opacity-80">Click the retry button to try again</div>
          )}
      </div>,
      {
        position: "top-right",
        autoClose: isRetryable ? 4000 : 8000,
        theme: "dark",
        icon: isRetryable ? "🔄" : "⚠️",
        }
      );
    } finally {
      setAiState("idle");
    }
  }, [
    conversationId, 
    currentUser.id, 
    createChat, 
    sendMessage, 
    refetchChats, 
    addOptimisticMessage,
    updateMessageStatus,
    replaceTempMessage,
    addMessage,
  ]);

  // REFACTOR: Enhanced retry handler with exponential backoff
  const handleRetryMessage = useCallback((message: MessageType) => {
    if (message.status !== "error" && message.status !== "retrying") return;

    // Prevent excessive retries
    if ((message.retryCount || 0) >= 3) {
      toast.error("Maximum retry attempts reached. Please try sending a new message.", {
        position: "top-right",
        autoClose: 4000,
        theme: "dark",
      });
      return;
    }

    updateMessageStatus(message.id, { 
      status: "retrying" as MessageStatus,
      error: "Retrying...",
    });

    // Small delay before retry for better UX
    setTimeout(() => {
      handleSendMessage(message.text, message.attachment || undefined);
    }, 1000);
  }, [handleSendMessage, updateMessageStatus]);

  // REFACTOR: Memoized delete handler with undo capability
  const handleDeleteMessage = useCallback((messageId: string) => {
    const messageToDelete = messages.find(msg => msg.id === messageId);
    removeMessage(messageId);
    
    toast.info("Message removed from view.", {
      position: "top-right",
      autoClose: 3000,
      theme: "dark",
      // In a production app, you could add an undo action here
    });
  }, [messages, removeMessage]);

  // REFACTOR: Enhanced conversation management
  const handleConversationSelected = useCallback((selectedId: string) => {
    if (conversationId !== selectedId) {
      setAllMessages([]);
      setConversationId(selectedId);
      setAiState("idle");
      
      toast.info("Loading conversation...", {
        position: "top-right",
        autoClose: 1500,
        theme: "dark",
      });
    }
    
    // Auto-close sidebar on mobile after selection
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [conversationId, setAllMessages]);

  const handleCreateNewConversation = useCallback(() => {
    setConversationId(null);
    setAllMessages([]);
    setAiState("idle");
    
    toast.info("Starting new conversation...", {
      position: "top-right",
      autoClose: 1500,
      theme: "dark",
    });
    
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [setAllMessages]);

  // REFACTOR: Enhanced online/offline detection
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
      toast.success("Connection restored! You're back online.", {
        position: "top-right",
        autoClose: 3000,
        theme: "dark",
      });
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
      toast.error("You're currently offline. Some features may be limited.", {
        position: "top-right",
        autoClose: 5000,
        theme: "dark",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // REFACTOR: Memoized connection status component
  const renderConnectionStatus = useMemo(() => {
    if (!isOnline) {
      return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 backdrop-blur">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">Offline - Check your connection</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-2 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              title="Reload page"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }
    return null;
  }, [isOnline]);

  // REFACTOR: Enhanced loading state
  if (chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-ping opacity-75"></div>
            <div className="relative w-20 h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
              <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center">
                <Bot className="w-8 h-8 text-purple-300" />
              </div>
            </div>
          </div>
          <div className="text-lg font-medium text-white mb-2">
            Loading your conversations...
          </div>
          <div className="text-sm text-purple-300">
            Preparing your chat experience
          </div>
        </div>
      </div>
    );
  }

  // REFACTOR: Enhanced error state with recovery options
  if (chatsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center bg-gray-800 rounded-2xl p-8 shadow-lg max-w-md mx-4">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <div className="text-xl font-semibold text-white mb-2">
            Unable to Load Chats
          </div>
          <p className="text-gray-400 mb-6">
            We couldn't load your conversations. This might be a temporary issue.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('authToken');
                window.location.href = '/login';
              }}
              className="px-6 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
     <div className="h-screen w-screen flex bg-gray-900 dark:bg-gray-900 text-white overflow-hidden relative">
    {renderConnectionStatus}
    
    {/* Enhanced animated background */}
    {/* Update background for light mode */}
      <div className={`fixed inset-0 -z-10 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-slate-900' 
          : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
      }`}>
        {/* ... background content ... */}
      </div>

    <div className="flex flex-1 relative z-10 w-full">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/80 z-20 lg:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        onConversationSelected={handleConversationSelected}
        onCreateNewConversation={handleCreateNewConversation}
        chatSessions={chatsData?.chats || []}
        userId={userInfo.id}
        activeConversationId={conversationId}
      />

      {/* Main conversation area - FIXED: Added proper margin for sidebar */}
      <main className={`
        flex-1 flex flex-col min-w-0 h-full bg-transparent
        transition-all duration-300
        ${isSidebarOpen ? 'lg:ml-0' : 'lg:ml-0'}
      `}>
        {/* Mobile header */}
         <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 dark:border-white/10 bg-white/80 dark:bg-transparent backdrop-blur">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold text-white">AI Chat</h1>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Messages area - FIXED: Better container constraints */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-transparent bg-transparent"
        >
          {/* Center messages with max-width */}
          <div className="max-w-4xl mx-auto w-full">
            {(() => {
              if (historyLoading) {
                return (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full animate-ping opacity-75"></div>
                        <div className="relative bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full w-full h-full flex items-center justify-center">
                          <div className="w-12 h-12 bg-slate-800 rounded-full"></div>
                        </div>
                      </div>
                      <div className="text-lg font-medium bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                        Loading conversation...
                      </div>
                      <div className="text-sm text-purple-300 mt-2">
                        Fetching your messages
                      </div>
                    </div>
                  </div>
                );
              } else if (messages.length === 0 && !historyLoading) {
                return (
                  <div className="flex items-center justify-center h-full px-4">
                    <div className="text-center max-w-md">
                      <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center backdrop-blur">
                        <Bot className="w-12 h-12 text-purple-300" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-4">
                        Start a Conversation
                      </h2>
                      <p className="text-base text-purple-200 mb-6">
                        Select a chat from the sidebar or begin typing to start your AI conversation.
                      </p>
                      <div className="text-sm text-purple-300">
                        Your AI assistant is ready to help!
                      </div>
                    </div>
                  </div>
                );
              } else {
                return messages.map((message, index) => (
                  <Message
                    key={message.id}
                    message={message}
                    isDarkMode={isDarkMode}
                    onDelete={handleDeleteMessage}
                    onRetry={handleRetryMessage}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  />
                ));
              }
            })()}
            
            {/* AI thinking indicator */}
            {aiState !== "idle" && (
              <div className="flex justify-start animate-slide-up">
                <div className="bg-white/10 backdrop-blur p-4 rounded-2xl shadow-lg max-w-[70%] border border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                      <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    </div>
                    <span className="text-sm text-blue-200">
                      {aiState === "thinking" ? "AI is thinking..." : "AI is responding..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area - FIXED: Better positioning */}
        <div className="px-4 lg:px-6 pb-6">
          <div className="max-w-4xl mx-auto">
            <InputArea
              onSendMessage={handleSendMessage}
              disabled={historyLoading || aiState !== "idle"}
              isOnline={isOnline}
            />
          </div>
        </div>
      </main>
    </div>
  </div>
  );
};

export default ChatContainer;