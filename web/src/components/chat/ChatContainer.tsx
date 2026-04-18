// web/src/components/chat/ChatContainer.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import Message from "./Message";
import InputArea from "./InputArea";
import Sidebar from "./Sidebar";
import ContextPanel from "./ContextPanel";
import { Bot, WifiOff, Menu, ArrowDown, Sparkles, Zap, MessageSquare, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 
import { useQuery, useMutation, useLazyQuery } from "@apollo/client/react";
import { useSearchParams } from "react-router-dom";
import { GET_CHATS, CREATE_CHAT, GET_CHAT_HISTORY, SEND_MESSAGE_WITH_RESPONSE } from "../../graphql/chats";
import { toast} from "react-toastify";
import type { ToastOptions } from 'react-toastify';
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../contexts/useTheme";
import { useToast } from '../ui/toastContext';
import { GET_DOCUMENT_LIFECYCLE, UPLOAD_DOCUMENT } from "../../graphql/chats";
import { useBrowserNotification } from "../../hooks/useBrowserNotification";
import { logger } from "../../utils/logger";
import { useNetworkQuality } from "../../hooks/useNetworkQuality";
import * as offlineQueue from "../../lib/offlineQueue";

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

interface UploadDocumentData {
  uploadDocument: {
    success: boolean;
    message: string;
    fileUrl?: string | null;
    documentId?: string | null;
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

// Custom hook for message skeletons
const MessageSkeleton = () => (
  <div className="space-y-4 w-full max-w-4xl mx-auto p-4 opacity-50">
    {[1, 2, 3].map((i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} w-full`}>
        <div className={`
          flex items-end space-x-2 max-w-[70%]
          ${i % 2 === 0 ? 'flex-row-reverse space-x-reverse' : 'flex-row'}
        `}>
          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 animate-pulse" />
          <div className="space-y-2 w-full">
            <div className={`h-10 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse w-[${Math.random() * 50 + 150}px]`} />
            {i % 2 !== 0 && <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />}
          </div>
        </div>
      </div>
    ))}
  </div>
);

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
  const { requestPermission, notifyWhenReady } = useBrowserNotification();
  const network = useNetworkQuality();
  
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
  const [searchParams] = useSearchParams();
  const urlChatId = searchParams.get("chatId");

  const [conversationId, setConversationId] = useState<string | null>(urlChatId);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user: authUser } = useAuth();

  // Auto-select chat from URL
  useEffect(() => {
    if (urlChatId && urlChatId !== conversationId) {
      setAllMessages([]); // Clear current messages to prevent ghosting
      setConversationId(urlChatId);
    }
  }, [urlChatId, conversationId, setAllMessages]);  
  const [aiState, setAiState] = useState<"idle" | "thinking" | "responding">("idle");
  const [showContextPanel, setShowContextPanel] = useState(false);
  // Track uploaded docs for context panel
  const [activeDocs, setActiveDocs] = useState<Array<{id: string; filename: string; status: 'ready'|'processing'|'failed'; selected: boolean}>>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  
  // Always prefer the authenticated user from context over the prop to avoid placeholder IDs
  const currentUser = {
    id: authUser?.id || userInfo.id,
    username: authUser?.name || authUser?.email || userInfo.username,
  };

  const isValidUserId = !!currentUser.id && currentUser.id !== 'user-123';

  // 1. Get Chats List
  const {
    data: chatsData,
    loading: chatsLoading,
    error: chatsError,
    refetch: refetchChats,
  } = useQuery<ChatData>(GET_CHATS, {
    variables: { userId: currentUser.id },
    skip: !isValidUserId,
    fetchPolicy: "cache-first" // Smart cache-first, refetched manually on mutation
  });
  
  useEffect(() => {
    if (chatsError) {
        logger.error("Failed to load chats:", chatsError);
        toast.error("Failed to load conversations.", { theme: "dark" });
    }
  }, [chatsError]);

  // 2. Get Chat History (Lazy Query)
  const [getChatHistory, { data: historyData, loading: historyLoading, error: historyError }] =
    useLazyQuery<HistoryData>(GET_CHAT_HISTORY, {
        fetchPolicy: "network-only", // Critical for ensuring no start flickering with old data
        notifyOnNetworkStatusChange: true
    });

  // Handle History Error via Effect (Replacement for onError)
  useEffect(() => {
    if (historyError) {
        logger.error("History Error:", historyError);
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
        logger.error("Create Chat Error:", error);
        toast.error("Failed to create chat.", { theme: "dark" });
    }
  });

  const [uploadDocument] = useMutation<UploadDocumentData>(UPLOAD_DOCUMENT);

  // ── Sync Active Context documents ───────────────────────────────────────
  const { data: docLifecycleData } = useQuery<{ me: { documents: any[] } }>(GET_DOCUMENT_LIFECYCLE, {
    variables: { userId: currentUser.id },
    skip: !isValidUserId,
    fetchPolicy: "cache-and-network",
    // Smart network-adaptive polling interval
    pollInterval: network.isOffline ? 0 : network.is2G ? 20000 : network.is3G ? 5000 : 10000, 
  });

  useEffect(() => {
    if (docLifecycleData?.me?.documents) {
      setActiveDocs(prev => {
        const prevIds = new Set(prev.map(d => d.id));
        const incoming = docLifecycleData.me.documents.map((d: any) => ({
          id: d.id,
          filename: d.filename || "Untitled",
          status: (d.status.toLowerCase() as any) || "ready",
          selected: true, // always default new docs to selected
        }));

        // Auto-select any newly arrived docs
        const newlyReadyIds = incoming
          .filter((d: any) => d.status === 'ready' && !prevIds.has(d.id))
          .map((d: any) => d.id);

        if (newlyReadyIds.length > 0) {
          setSelectedDocIds(prev => {
            const next = new Set(prev);
            newlyReadyIds.forEach((id: string) => next.add(id));
            return next;
          });
        }

        // Merge: preserve existing selection state
        return incoming.map((d: any) => ({
          ...d,
          selected: selectedDocIds.has(d.id) || newlyReadyIds.includes(d.id),
        }));
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docLifecycleData]);

  const handleToggleDoc = useCallback((id: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setActiveDocs(prev => prev.map(d => d.id === id ? { ...d, selected: !d.selected } : d));
  }, []);
  
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

  // Fetch history when conversation changes
  useEffect(() => {
    // Only fetch if we have a conversationId and a valid, non-placeholder userId
    if (conversationId && isValidUserId) {
      getChatHistory({
        variables: { chatId: conversationId },
      });
    }
  }, [conversationId, isValidUserId, getChatHistory]);

  // Update messages from history data
  useEffect(() => {
    if (historyLoading) {
        // Keeps old messages until new ones load? No, we cleared them in handleConversationSelected.
        return; 
    }

    if (historyData?.chatHistory?.messages) {
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
  }, [historyData, historyError, setAllMessages, historyLoading]);

  // Auto-Scroll Logic (Smart Sticky Scroll) - Optimized to prevent jumps
  useLayoutEffect(() => {
     // Only scroll if we were already at bottom or it's a new message (loading state change)
    if (isAtBottom && chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isAtBottom, historyLoading, aiState]); 

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    
    // If user is more than 100px from bottom, show arrow
    const isBottom = distanceToBottom < 100;
    setIsAtBottom(isBottom);
    setShowScrollButton(!isBottom);
  }, []);

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
    const userContent = trimmedText || (attachment ? `[Attached: ${attachment.name}]` : '');

    if (trimmedText === "" && !attachment) {
      toast.warn("Please enter a message or add an attachment.", { theme: "dark" });
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // If offline, push straight to the module store and stop.
    if (network.isOffline) {
      offlineQueue.enqueue(userContent, attachment);
      setIsAtBottom(true);
      toast.info("Queued. Will send when reconnected.", { theme: "dark" });
      return;
    }

    const optimisticMessage = addOptimisticMessage({
      tempId,
      text: userContent,
      sender: "user",
      attachment: attachment || undefined,
      conversationId: conversationId || undefined,
    });

    try {
      let currentConversationId = conversationId;
      let uploadedAttachmentUrl: string | undefined;

      if (attachment) {
        updateMessageStatus(tempId, {
          status: "sending",
          error: "Uploading attachment...",
        });

        const { data: uploadData } = await uploadDocument({ variables: { file: attachment } });
        const uploadResult = uploadData?.uploadDocument;

        if (!uploadResult?.success || !uploadResult.fileUrl) {
          throw new Error(uploadResult?.message || "Attachment upload failed.");
        }

        uploadedAttachmentUrl = uploadResult.fileUrl;
      }

      if (!currentConversationId) {
        // toast.info("Creating new conversation...", { autoClose: 1500, theme: "dark" });

        const { data: chatData } = await createChat({
          variables: {
            userId: currentUser.id,
            title: userContent.substring(0, 40) + (userContent.length > 40 ? "..." : ""),
            messages: [{
              role: "user",
              content: userContent,
              fileName: attachment?.name,
              fileUri: uploadedAttachmentUrl,
              fileMimeType: attachment?.type,
            }],
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
          content: userContent,
          fileName: attachment?.name,
          fileUri: uploadedAttachmentUrl,
          fileMimeType: attachment?.type,
          activeDocumentIds: [...selectedDocIds].filter(id =>
            activeDocs.find(d => d.id === id && d.status === 'ready')
          ),
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
          text: userContent,
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
        notifyWhenReady('Chat response ready', {
          body: 'Your AI response is ready. You can come back whenever you want.',
        });
      } else {
        throw new Error("Did not receive a valid AI response.");
      }

    } catch (error) {
      logger.error("Error sending message:", error);
      
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
  }, [conversationId, currentUser.id, createChat, sendMessage, refetchChats, addOptimisticMessage, updateMessageStatus, replaceTempMessage, addMessage, showError, requestPermission, notifyWhenReady]);

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
    // Only update if actually changing conversation to avoid unnecessary re-renders/fetches
    if (conversationId !== selectedId) {
      setAllMessages([]); // Clear current messages to prevent ghosting
      setConversationId(selectedId);
      setAiState("idle");
    }
    // Always close sidebar on mobile if a selection is made
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [conversationId, setAllMessages]);

  const handleCreateNewConversation = useCallback(() => {
    setConversationId(null);
    setAllMessages([]);
    setAiState("idle");
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [setAllMessages]);

  const [offlineQ, setOfflineQ] = useState(offlineQueue.getQueue());
  
  useEffect(() => {
    // Keep local component state in sync with the module-level offline queue
    const syncOfflineQueue = () => setOfflineQ([...offlineQueue.getQueue()]);
    // The queue store calls listeners when a flush happens
    const unsubscribe = offlineQueue.onFlush((pendingMessages) => {
      syncOfflineQueue();
      if (pendingMessages.length > 0) {
        toast.info(`Sending ${pendingMessages.length} offline message(s)...`, { theme: "dark" });
        // Very basic flush implementation — send each consecutively.
        // Full conflict/retry handling would go here in Phase 5+.
        pendingMessages.forEach((msg, idx) => {
          setTimeout(() => handleSendMessage(msg.text, msg.attachment), idx * 1000);
        });
      }
    });

    // Also sync if the component remounts or user types
    const interval = setInterval(syncOfflineQueue, 1000);
    return () => { unsubscribe(); clearInterval(interval); };
  }, [handleSendMessage]);

  const renderConnectionStatus = useMemo(() => {
    if (network.isOffline) {
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
  }, [network.isOffline]);

  if (chatsLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white animate-pulse">Loading workspace...</div>;

  return (
     <div className="h-screen w-screen flex bg-theme-primary text-theme-primary overflow-hidden relative font-sans selection:bg-indigo-500/30">
      {renderConnectionStatus}
      
      {/* Subtle Background Mesh */}
      <div className={`fixed inset-0 -z-10 ${
        theme === 'dark' 
          ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-theme-secondary to-theme-primary' 
          : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-theme-primary to-theme-secondary'
      }`} />

      <div className="flex flex-1 relative z-10 w-full max-w-full">
        <Sidebar
          isOpen={isSidebarOpen}
          onConversationSelected={handleConversationSelected}
          onCreateNewConversation={handleCreateNewConversation}
          chatSessions={sidebarChats} 
          userId={userInfo.id}
          activeConversationId={conversationId}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 flex flex-col min-w-0 h-full relative transition-all duration-300">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0D1117]/95 backdrop-blur border-b border-white/[0.07] z-20">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm text-white tracking-wide">Xemora AI</span>
            <div className="w-9" />
          </div>

          <div 
             ref={chatContainerRef} 
             onScroll={handleScroll} 
             className="flex-1 overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
          >
            <div className="max-w-3xl mx-auto w-full min-h-full flex flex-col pt-2 md:pt-4 pb-44 px-4 md:px-6">
              {historyLoading ? (
                <MessageSkeleton />
              ) : messages.length === 0 ? (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="flex flex-col items-center justify-center my-auto min-h-[50vh] text-center space-y-8"
                 >
                    <div className="relative group">
                       <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000"></div>
                       <div className="relative w-24 h-24 bg-theme-secondary rounded-full flex items-center justify-center border border-theme-light shadow-theme-xl">
                          <Bot className="w-12 h-12 text-indigo-500" />
                       </div>
                    </div>
                    
                    <div className="space-y-3 max-w-md">
                      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-theme-primary to-theme-tertiary">
                        How can I help you today?
                      </h2>
                      <p className="text-theme-tertiary">
                        I can help you analyze data, generate code, write copy, or just chat.
                      </p>
                    </div>

                    {/* Suggestions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                      {[
                        { icon: Sparkles, text: "Generate a react landing page", color: "text-amber-500" },
                        { icon: Zap, text: "Explain quantum computing", color: "text-blue-500" },
                        { icon: MessageSquare, text: "Write a professional email", color: "text-green-500" },
                        { icon: Bot, text: "Refactor this code snippet", color: "text-purple-500" }
                      ].map((item, idx) => (
                        <button 
                          key={idx}
                          onClick={() => handleSendMessage(item.text)}
                          className="flex items-center space-x-3 p-4 bg-theme-secondary border border-theme-light rounded-xl hover:bg-theme-tertiary transition-all text-left shadow-theme-sm hover:shadow-theme-md group"
                        >
                          <div className={`p-2 rounded-lg bg-theme-tertiary ${item.color} group-hover:scale-110 transition-transform`}>
                            <item.icon className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-theme-secondary">{item.text}</span>
                        </button>
                      ))}
                    </div>
                 </motion.div>
              ) : (
                <div className="space-y-6">
                  {/* Rendering Offline Queued Messages */}
                  <AnimatePresence initial={false}>
                    {offlineQ.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                         <div className="flex justify-end w-full p-4">
                            <div className="flex flex-col items-end max-w-[85%] md:max-w-[70%] space-y-1">
                               <div className="flex items-center space-x-2 text-xs text-amber-500 font-medium mb-1 pl-2 font-mono">
                                  <span>Queued Offline</span>
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                               </div>
                               <div className="px-5 py-3 rounded-2xl rounded-tr-sm bg-[#161B22]/60 border border-white/[0.05] shadow-lg text-[15px] prose prose-invert prose-p:leading-relaxed overflow-hidden break-words w-full">
                                  {msg.attachment && (
                                     <div className="flex items-center gap-2 p-2 mb-2 rounded border border-white/10 bg-white/5 opacity-70">
                                       <span className="text-xs truncate">{msg.attachment.name}</span>
                                     </div>
                                  )}
                                  {msg.text}
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    ))}

                    {/* Pending & Confirmed Messages */}
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Message
                          message={message}
                          onDelete={handleDeleteMessage}
                          onRetry={handleRetryMessage}
                          onSuggestionClick={(suggestion) => handleSendMessage(suggestion)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Thinking Indicator */}
              {aiState !== "idle" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start py-4"
                >
                  <div className="flex items-center space-x-3 bg-theme-secondary border border-theme-light px-4 py-3 rounded-2xl shadow-theme-sm text-sm text-theme-secondary">
                     {aiState === "thinking" ? (
                       <div className="flex space-x-1">
                          <span className="animate-bounce delay-0">●</span>
                          <span className="animate-bounce delay-150">●</span>
                          <span className="animate-bounce delay-300">●</span>
                       </div>
                     ) : <Zap className="w-4 h-4 animate-pulse text-indigo-500" />}
                     <span className="font-medium">
                       {aiState === "thinking" ? "Thinking..." : "Generating response..."}
                     </span>
                  </div>
                </motion.div>
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
                    className="absolute bottom-36 left-1/2 -translate-x-1/2 p-2.5 bg-[#1C2128] border border-white/10 text-white rounded-full shadow-xl z-30 hover:-translate-y-1 transition-all"
                >
                    <ArrowDown size={18} />
                </motion.button>
            )}
          </AnimatePresence>

          {/* ── Floating input — no solid shelf, pure gradient fade ── */}
          <div className="fixed bottom-0 left-0 w-full lg:pl-72 z-20 pointer-events-none">
            {/* Soft gradient so content fades smoothly into the bar */}
            <div className="pointer-events-none h-24 bg-gradient-to-t from-[#0D1117]/90 to-transparent" />
            {/* Input sits in a transparent strip — backdrop-blur provides depth */}
            <div className="backdrop-blur-md px-4 md:px-8 pb-1 pt-1 pointer-events-auto bg-transparent">
              <div className="max-w-3xl mx-auto">
                <InputArea
                  onSendMessage={handleSendMessage}
                  disabled={historyLoading || aiState !== "idle"}
                  isOnline={!network.isOffline}
                  onToggleContext={() => setShowContextPanel(p => !p)}
                  contextOpen={showContextPanel}
                  activeDocs={activeDocs.filter(d => d.status === 'ready').length}
                />
              </div>
            </div>
          </div>
        </main>

        {/* ── Right Context Panel ── */}
        <ContextPanel
          isOpen={showContextPanel}
          onClose={() => setShowContextPanel(false)}
          activeDocs={activeDocs}
          historyLoading={historyLoading}
          onToggleDoc={handleToggleDoc}
          onUploadSuccess={(msg) => {
            toast.success(msg, { theme: 'dark' });
          }}
          onUploadError={(msg) => {
            toast.error(msg, { theme: 'dark' });
          }}
        />
      </div>
    </div>
  );
};

export default ChatContainer;