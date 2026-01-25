// web/src/components/chat/ChatContainer.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import Message from "./Message";
import InputArea from "./InputArea";
import Sidebar from "./Sidebar";
import { Bot, RefreshCw, WifiOff, Menu, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 
import { useQuery, useMutation, useLazyQuery } from "@apollo/client/react";
import { GET_CHATS, CREATE_CHAT, GET_CHAT_HISTORY, SEND_MESSAGE_WITH_RESPONSE } from "../../graphql/chats";
import { toast} from "react-toastify";
import type { ToastOptions } from 'react-toastify';
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../contexts/useTheme";
import { useToast } from '../ui/toastContext';

export type MessageStatus = "sending" | "sent" | "error" | "retrying";

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

interface ChatData {
  chats: Array<{
    id: string;
    title: string;
    createdAt: string;
  }>;
}

interface CreateChatData {
  createChat: {
    id: string;
    title: string;
  };
}

interface SendMessageData {
  sendMessageWithResponse: {
    userMessage: {
      id: string;
      content: string;
      createdAt: string;
    };
    aiMessage: {
      id: string;
      content: string;
      createdAt: string;
    };
  };
}

interface HistoryMessage {
  id: string;
  content: string;
  role: string;
  createdAt: string;
}

interface HistoryData {
  chatHistory: {
    messages: HistoryMessage[];
  };
}

interface Props {
  token: string;
  userInfo: { id: string; username: string };
}

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

const ChatContainer: React.FC<Props> = ({ userInfo }) => {
  const { theme } = useTheme();
  const { showError } = useToast();
  
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
  const [showScrollButton, setShowScrollButton] = useState(false); 
  const [isAtBottom, setIsAtBottom] = useState(true);  
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user: authUser } = useAuth();
  
  const [aiState, setAiState] = useState<"idle" | "thinking" | "responding">("idle");
  
  const currentUser = authUser || userInfo;

  // 1. Get Chats List
  const {
    data: chatsData,
    loading: chatsLoading,
    error: chatsError,
    refetch: refetchChats,
  } = useQuery<ChatData>(GET_CHATS, {
    variables: { userId: currentUser.id },
    skip: !currentUser.id,
  });
  
  useEffect(() => {
    if (chatsError) {
        console.error("Failed to load chats:", chatsError);
        toast.error("Failed to load conversations.", { theme: "dark" });
    }
  }, [chatsError]);

  // 2. Get Chat History (Lazy Query)
  // FIX 1: Removed onError from options object
  const [getChatHistory, { data: historyData, loading: historyLoading, error: historyError }] =
    useLazyQuery<HistoryData>(GET_CHAT_HISTORY);

  // Handle History Error via Effect (Replacement for onError)
  useEffect(() => {
    if (historyError) {
        console.error("History Error:", historyError);
        let errorMessage = "An unexpected error occurred";
        if (historyError instanceof Error) {
            errorMessage = historyError.message;
        }
        if (showError) showError('Error', errorMessage);
        else toast.error("Failed to load history.", { theme: "dark" });
    }
  }, [historyError, showError]);

  const [createChat] = useMutation<CreateChatData>(CREATE_CHAT, {
    onError: (error) => {
        console.error("Create Chat Error:", error);
        toast.error("Failed to create chat.", { theme: "dark" });
    }
  });
  
  const [sendMessage] = useMutation<SendMessageData>(SEND_MESSAGE_WITH_RESPONSE, {
    onCompleted: () => refetchChats(),
  });

  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setIsSidebarOpen(isDesktop);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (conversationId && userInfo.id) {
      getChatHistory({
        variables: { chatId: conversationId },
      });
    }
  }, [conversationId, userInfo.id, getChatHistory]);

  useEffect(() => {
    if (historyData?.chatHistory?.messages) {
      // FIX 2: Removed explicit ': HistoryMessage' type annotation on 'msg'
      // This allows TypeScript to infer the correct type (which might include partials)
      const formattedMessages: MessageType[] = historyData.chatHistory.messages.map(
        (msg) => ({
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
      setAllMessages([]);
    }
  }, [historyData, historyError, setAllMessages]);

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

  // REMOVED redundant scroll logic that causes flickering
  // useEffect(() => {
  //   scrollToBottom();
  // }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    
    // If user is more than 100px from bottom, show arrow
    const isBottom = distanceToBottom < 100;
    setIsAtBottom(isBottom);
    setShowScrollButton(!isBottom);
  }, []);

  // 2. Auto-Scroll Logic (Smart Sticky Scroll)
  useLayoutEffect(() => {
    if (isAtBottom && chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isAtBottom]); // Run when messages change

  // 3. Manual "Go Down" Button Click
  const scrollToBottomManual = () => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: "smooth"
        });
        setShowScrollButton(false);
        setIsAtBottom(true);
    }
  };

  // Sidebar Chats Data
  const sidebarChats = useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats.map(chat => ({
      ...chat,
      conversationId: chat.id 
    }));
  }, [chatsData]);

  const handleSendMessage = useCallback(async (text: string, attachment?: File) => {
    const trimmedText = text.trim();

    if (trimmedText === "" && !attachment) {
      toast.warn("Please enter a message or add an attachment.", { theme: "dark" });
      return;
    }

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

      if (!currentConversationId) {
        toast.info("Creating new conversation...", { autoClose: 1500, theme: "dark" });

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
        } else {
          throw new Error("Failed to create a new chat session.");
        }
      }

      updateMessageStatus(tempId, { 
        status: "sending",
        conversationId: currentConversationId || undefined
      });
      
      setAiState("thinking");

      const { data: messageData } = await sendMessage({
        variables: {
          chatId: currentConversationId,
          content: trimmedText,
        },
      });

      const response = messageData?.sendMessageWithResponse;

      if (!response) {
        throw new Error("Did not receive a valid response from the server.");
      }

      setAiState("responding");

      if (response.aiMessage && response.userMessage) {
        const confirmedUserMessage: MessageType = {
          id: response.userMessage.id,
          conversationId: currentConversationId || undefined,
          text: trimmedText,
          sender: "user",
          timestamp: new Date(response.userMessage.createdAt),
          attachment: attachment || undefined,
          status: "sent",
        };

        replaceTempMessage(tempId, confirmedUserMessage);

        const aiMessage: MessageType = {
          id: response.aiMessage.id,
          conversationId: currentConversationId || undefined,
          text: response.aiMessage.content,
          sender: "bot",
          timestamp: new Date(response.aiMessage.createdAt),
          status: "sent",
        };

        addMessage(aiMessage);
      } else {
        throw new Error("Did not receive a valid AI response.");
      }

    } catch (error) {
      console.error("Error sending message:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isRetryable = !errorMessage.includes("Authentication");

      updateMessageStatus(tempId, {
        status: "error",
        error: "Failed to send message.",
        retryCount: (optimisticMessage.retryCount || 0) + 1,
      });

      toast.error("Failed to send message.", {
        theme: "dark",
        icon: isRetryable ? "🔄" : "⚠️",
      } as unknown as ToastOptions);

      if (showError) showError('Error', errorMessage);

    } finally {
      setAiState("idle");
    }
  }, [conversationId, currentUser.id, createChat, sendMessage, refetchChats, addOptimisticMessage, updateMessageStatus, replaceTempMessage, addMessage, showError]);

  const handleRetryMessage = useCallback((message: MessageType) => {
    if (message.status !== "error" && message.status !== "retrying") return;

    if ((message.retryCount || 0) >= 3) {
      toast.error("Maximum retry attempts reached.", { theme: "dark" });
      return;
    }

    updateMessageStatus(message.id, { 
      status: "retrying",
      error: "Retrying...",
    });

    setTimeout(() => {
      handleSendMessage(message.text, message.attachment || undefined);
    }, 1000);
  }, [handleSendMessage, updateMessageStatus]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    removeMessage(messageId);
    toast.info("Message removed.", { autoClose: 2000, theme: "dark" });
  }, [removeMessage]);

  const handleConversationSelected = useCallback((selectedId: string) => {
    if (conversationId !== selectedId) {
      setAllMessages([]);
      setConversationId(selectedId);
      setAiState("idle");
    }
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [conversationId, setAllMessages]);

  const handleCreateNewConversation = useCallback(() => {
    setConversationId(null);
    setAllMessages([]);
    setAiState("idle");
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [setAllMessages]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success("Back online!", { theme: "dark" }); };
    const handleOffline = () => { setIsOnline(false); toast.error("You are offline.", { theme: "dark" }); };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const renderConnectionStatus = useMemo(() => {
    if (!isOnline) {
      return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 backdrop-blur">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">Offline</span>
            <button onClick={() => window.location.reload()} className="ml-2 p-1 bg-white/20 rounded-full">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }
    return null;
  }, [isOnline]);

  if (chatsLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;

  return (
     <div className="h-screen w-screen flex bg-gray-900 dark:bg-gray-900 text-white overflow-hidden relative">
      {renderConnectionStatus}
      
      <div className={`fixed inset-0 -z-10 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-slate-900' 
          : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
      }`} />

      <div className="flex flex-1 relative z-10 w-full">
        {isSidebarOpen && (
          <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/80 z-20 lg:hidden" />
        )}

        <Sidebar
          isOpen={isSidebarOpen}
          onConversationSelected={handleConversationSelected}
          onCreateNewConversation={handleCreateNewConversation}
          chatSessions={sidebarChats} 
          userId={userInfo.id}
          activeConversationId={conversationId}
        />

        <main className="flex-1 flex flex-col min-w-0 h-full bg-transparent transition-all duration-300 relative">
          <div className="lg:hidden flex items-center justify-between p-4 bg-white/10 backdrop-blur">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold">AI Chat</h1>
            <div className="w-10"></div>
          </div>

          <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
            <div className="max-w-4xl mx-auto w-full min-h-full flex flex-col justify-start">
              {historyLoading ? (
                <div className="flex justify-center text-purple-300">Loading conversation...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bot className="w-10 h-10 text-purple-300" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Start a Conversation</h2>
                  <p className="text-gray-400">Ask me anything!</p>
                </div>
              ) : (
                
                messages.map((message) => (
                  <Message
                    key={message.id}
                    message={message}
                    onDelete={handleDeleteMessage}
                    onRetry={handleRetryMessage}
                    
                  />
                ))
              )

              }
              
              {aiState !== "idle" && (
                <div className="flex justify-start py-4">
                  <div className="bg-white/10 p-3 rounded-2xl flex items-center gap-2 text-blue-200 text-sm">
                     <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"/>
                        <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce delay-75"/>
                        <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce delay-150"/>
                     </div>
                     {aiState === "thinking" ? "Thinking..." : "Typing..."}
                  </div>
                </div>
              )}
            </div>
          </div>


          <AnimatePresence>
            {showScrollButton && (
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onClick={scrollToBottomManual}
                    className="absolute bottom-24 right-8 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg z-50 transition-colors"
                >
                    <ArrowDown size={20} />
                    {/* Optional: Add badge for new messages count if you track it */}
                </motion.button>
            )}
          </AnimatePresence>

          <div className="p-4 md:p-6">
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