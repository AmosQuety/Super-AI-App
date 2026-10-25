// app/features/chats/[id].tsx - PROFESSIONAL STYLED VERSION
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFilePicker } from '../../../hooks/use-file-picker';
import { FileProcessor } from '../../../services/file-processor';
import { claimFirstMessage, describeSendFailure, type SendFailure } from '../../../libs/chat-start';

// GraphQL operations
const GET_CHAT_HISTORY = gql`
  query GetChatHistory($chatId: ID!, $limit: Int, $offset: Int) {
    chatHistory(chatId: $chatId, limit: $limit, offset: $offset) {
      messages {
        id
        role
        content
        imageUrl
        fileName
        fileUri
        fileMimeType
        createdAt
      }
      hasMore
    }
  }
`;

const SEND_MESSAGE_WITH_RESPONSE = gql`
  mutation SendMessageWithResponse(
    $chatId: ID!
    $content: String!
    $imageUrl: String
    $fileName: String
    $fileUri: String
    $fileMimeType: String
  ) {
    sendMessageWithResponse(
      chatId: $chatId
      content: $content
      imageUrl: $imageUrl
      fileName: $fileName
      fileUri: $fileUri
      fileMimeType: $fileMimeType
    ) {
      userMessage {
        id
        role
        content
        imageUrl
        fileName
        fileUri
        fileMimeType
        createdAt
      }
      aiMessage {
        id
        role
        content
        createdAt
      }
      usedCustomResponse
    }
  }
`;

type Message = {
  id: string;
  role: string;
  content: string;
  imageUrl?: string;
  fileName?: string;
  fileUri?: string;
  fileMimeType?: string;
  createdAt: string;
};

interface FileInfo {
  uri: string;
  name: string;
  type: string;
  size: number;
}

interface ProcessedFile {
  type: 'text' | 'image' | 'document';
  content: string;
  fileUrl?: string;
  metadata: any;
  needsBackendProcessing: boolean;
}

function ChatDetailScreen() {
  const { id, firstMessage: firstMessageParam } = useLocalSearchParams();
  const chatId = Array.isArray(id) ? id[0] : id;
  const firstMessage = Array.isArray(firstMessageParam) ? firstMessageParam[0] : firstMessageParam;
  const [message, setMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<FileInfo | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  // Synchronous twin of isSending: two taps can arrive before a re-render disables the button.
  const isSendingRef = useRef(false);
  const [failedSend, setFailedSend] = useState<{
    text: string;
    file: FileInfo | null;
    failure: SendFailure;
  } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const { pickFile } = useFilePicker();

  // Get initial messages
  const { data, loading, error, fetchMore } = useQuery<{
    chatHistory: { messages: Message[]; hasMore: boolean };
  }>(GET_CHAT_HISTORY, {
    variables: { chatId, limit: 50, offset: 0 },
    skip: !chatId,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
  });

  useEffect(() => {
    // History that arrives while a message is in flight would erase it from the screen.
    if (data?.chatHistory?.messages && !isSendingRef.current) {
      setAllMessages(data.chatHistory.messages);
    }
  }, [data?.chatHistory?.messages]);

  const [sendMessageWithResponse] = useMutation<{
    sendMessageWithResponse: {
      userMessage: Message;
      aiMessage: Message;
      usedCustomResponse: boolean;
    };
  }>(SEND_MESSAGE_WITH_RESPONSE);

  const hasMore = data?.chatHistory?.hasMore || false;

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (allMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [allMessages.length]);

  const handleAttachFile = async () => {
    if (isProcessingFile || isSending) return;

    try {
      setIsProcessingFile(true);
      const fileInfo = await pickFile();

      if (fileInfo) {
        console.log('📎 File selected:', fileInfo);

        const maxSize = 10 * 1024 * 1024;
        if (fileInfo.size > maxSize) {
          Alert.alert('File Too Large', 'Please select a file smaller than 10MB');
          return;
        }

        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (!allowedTypes.includes(fileInfo.type)) {
          Alert.alert('Unsupported File Type', 'Please select an image, PDF, or document file');
          return;
        }

        setAttachedFile(fileInfo);
        console.log('✅ File attached successfully');
      }
    } catch (error: any) {
      console.error('❌ File picker error:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    console.log('🗑️ File attachment removed');
  };

  // Sends one message and shows the reply. Used for typed messages, for the first message of a
  // new chat and for Retry, so there is a single place that talks to the server.
  const deliver = useCallback(
    async (userMessage: string, currentFile: FileInfo | null) => {
      if (!chatId || isSendingRef.current) return;
      isSendingRef.current = true;
      setIsSending(true);
      setFailedSend(null);

      const tempId = `temp-${Date.now()}`;
      try {
        const tempUserMessage: Message = {
          id: tempId,
          role: 'user',
          content: userMessage || `📎 ${currentFile?.name}`,
          createdAt: new Date().toISOString(),
          ...(currentFile && {
            fileName: currentFile.name,
            fileMimeType: currentFile.type,
          }),
        };

        setAllMessages((prev) => [...prev, tempUserMessage]);

        let processedFile: ProcessedFile | null = null;

        if (currentFile) {
          try {
            console.log('🔄 Processing file...');
            processedFile = await FileProcessor.processFileForAI(currentFile);
            console.log('✅ File processed:', processedFile);
          } catch (fileError: any) {
            console.error('❌ File processing error:', fileError);
            Alert.alert(
              'File Processing Failed',
              'The file could not be processed, but your message will still be sent.'
            );
          }
        }

        const messagePayload = {
          chatId,
          content: userMessage || '',
          ...(processedFile &&
            processedFile.fileUrl && {
              imageUrl: processedFile.type === 'image' ? processedFile.fileUrl : undefined,
              fileName: processedFile.metadata.fileName,
              fileUri: processedFile.fileUrl,
              fileMimeType: processedFile.metadata.mimeType,
            }),
        };

        const { data: responseData } = await sendMessageWithResponse({
          variables: messagePayload,
        });

        if (responseData?.sendMessageWithResponse) {
          const {
            userMessage: realUserMsg,
            aiMessage,
            usedCustomResponse,
          } = responseData.sendMessageWithResponse;

          console.log(usedCustomResponse ? '✅ Used custom response' : '🤖 Used Gemini AI');

          setAllMessages((prev) => {
            const withoutTemp = prev.filter((msg) => msg.id !== tempId);
            return [...withoutTemp, realUserMsg, aiMessage];
          });
        }
      } catch (error: unknown) {
        // The failure is shown in the chat with a Retry, so the user is told what happened
        // without losing the message. A retry sends it again, which is the only way it is resent.
        console.warn('Sending a message failed:', error);
        setAllMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        setFailedSend({
          text: userMessage,
          file: currentFile,
          failure: describeSendFailure(error),
        });
      } finally {
        isSendingRef.current = false;
        setIsSending(false);
      }
    },
    [chatId, sendMessageWithResponse]
  );

  const sendMessage = useCallback(async () => {
    const hasMessage = message.trim().length > 0;
    const hasFile = attachedFile !== null;

    if (!hasMessage && !hasFile) {
      Alert.alert('Empty Message', 'Please enter a message or attach a file');
      return;
    }

    if (!chatId || isSendingRef.current) return;

    const userMessage = message.trim();
    const currentFile = attachedFile;

    setMessage('');
    setAttachedFile(null);
    await deliver(userMessage, currentFile);
  }, [message, chatId, attachedFile, deliver]);

  const retryFailedSend = useCallback(() => {
    if (!failedSend) return;
    void deliver(failedSend.text, failedSend.file);
  }, [failedSend, deliver]);

  // A new chat arrives with its first message in the route. It is sent here, once.
  const deliverRef = useRef(deliver);
  deliverRef.current = deliver;
  useEffect(() => {
    const text = firstMessage?.trim();
    if (!chatId || !text) return;
    if (!claimFirstMessage(chatId)) return;
    void deliverRef.current(text, null);
  }, [chatId, firstMessage]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isTemp = item.id.startsWith('temp-');

    return (
      <View className={`mx-4 my-2 flex-row text-lg ${isUser ? 'justify-end' : 'justify-start'}`}>
        {/* AI Avatar */}
        {!isUser && (
          <View
            testID="chat-avatar-assistant"
            accessible
            accessibilityLabel="Assistant"
            className="mr-2 mt-1 h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
            <Ionicons name="sparkles" size={16} color="white" />
          </View>
        )}

        <View
          className={`max-w-[75%] rounded-2xl px-4 py-3 ${
            isUser
              ? 'rounded-br-md bg-blue-500'
              : 'rounded-bl-md border border-gray-200 bg-gray-100'
          } ${isTemp ? 'opacity-70' : ''}`}
          style={{
            shadowColor: isUser ? '#3b82f6' : '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isUser ? 0.2 : 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}>
          {/* Image if present */}
          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              className="mb-2 h-48 w-full rounded-xl"
              resizeMode="cover"
              style={{
                borderWidth: 1,
                borderColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              }}
            />
          )}

          {/* File attachment */}
          {item.fileName && !item.imageUrl && (
            <View
              className={`mb-2 flex-row items-center rounded-lg p-2 ${
                isUser ? 'bg-blue-400/30' : 'bg-gray-200'
              }`}>
              <Ionicons name="document-attach" size={14} color={isUser ? '#dbeafe' : '#6b7280'} />
              <Text
                className={`ml-2 flex-1 text-xs font-medium ${
                  isUser ? 'text-blue-50' : 'text-gray-700'
                }`}
                numberOfLines={1}>
                {item.fileName}
              </Text>
            </View>
          )}

          {/* Message content */}
          {item.content && (
            <Text
              className={`text-[15px] leading-5 ${isUser ? 'text-white' : 'text-gray-800'}`}
              style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto' }}>
              {item.content}
            </Text>
          )}

          {/* Timestamp */}
          <View className="mt-1 flex-row items-center justify-end">
            <Text className={`text-[11px] ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>

            {isTemp && (
              <ActivityIndicator
                size="small"
                color={isUser ? '#93c5fd' : '#6b7280'}
                className="ml-2"
              />
            )}

            {isUser && !isTemp && (
              <Ionicons name="checkmark-done" size={14} color="#bfdbfe" style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>

        {/* User Avatar */}
        {isUser && (
          <View
            testID="chat-avatar-user"
            accessible
            accessibilityLabel="You"
            className="ml-2 mt-1 h-8 w-8 items-center justify-center rounded-full bg-blue-500">
            <Ionicons name="person" size={16} color="white" />
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={allMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          if (hasMore && allMessages.length > 0 && !loading) {
            fetchMore({
              variables: { offset: allMessages.length },
            });
          }
        }}
        onEndReachedThreshold={0.1}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 16,
          flexGrow: 1,
        }}
        ListFooterComponent={
          isSending ? (
            <View
              testID="chat-thinking"
              accessible
              accessibilityLabel="Assistant is thinking"
              className="mx-4 my-2 flex-row items-center">
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-purple-500">
                <Ionicons name="sparkles" size={16} color="white" />
              </View>
              <View className="flex-row items-center rounded-2xl rounded-bl-md border border-gray-200 bg-gray-100 px-4 py-3">
                <ActivityIndicator size="small" color="#6b7280" />
                <Text className="ml-2 text-sm text-gray-500">Thinking…</Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isSending ? null : (
            <View className="flex-1 items-center justify-center py-20">
              <View
                className="mb-4 rounded-full bg-white p-6"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                }}>
                <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
              </View>
              {error ? (
                <Text
                  testID="chat-load-error"
                  className="px-8 text-center text-lg font-semibold text-gray-500">
                  {describeSendFailure(error).message}
                </Text>
              ) : (
                <>
                  <Text className="text-center text-lg font-semibold text-gray-400">
                    No messages yet
                  </Text>
                  <Text className="mt-2 text-center text-sm text-gray-400">
                    Start the conversation with AI!
                  </Text>
                </>
              )}
            </View>
          )
        }
      />

      {/* Failed send: say what happened and offer Retry */}
      {failedSend && (
        <View
          testID="chat-send-error"
          accessibilityRole="alert"
          className="mx-4 mb-2 flex-row items-center rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text className="ml-2 flex-1 text-sm text-red-700">{failedSend.failure.message}</Text>
          {failedSend.failure.canRetry ? (
            <TouchableOpacity
              testID="chat-retry"
              accessibilityRole="button"
              accessibilityLabel="Retry sending"
              onPress={retryFailedSend}
              disabled={isSending}
              className="ml-2 min-h-[44px] justify-center px-2">
              <Text className="text-sm font-semibold text-red-700">Retry</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={() => setFailedSend(null)}
              className="ml-2 min-h-[44px] justify-center px-2">
              <Text className="text-sm font-semibold text-red-700">Dismiss</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* File Attachment Preview */}
      {attachedFile && (
        <View
          className="mx-4 mb-2 rounded-2xl bg-white shadow-md"
          style={{
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}>
          {/* Success indicator */}
          <View className="flex-row items-center px-4 pb-2 pt-3">
            <View className="mr-2 h-2 w-2 rounded-full bg-green-500" />
            <Text className="text-xs font-semibold text-green-600">Ready to send</Text>
          </View>

          {/* File card */}
          <View className="flex-row items-center px-4 pb-3">
            {/* File icon */}
            <View className="mr-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-3">
              <Ionicons
                name={
                  attachedFile.type.startsWith('image/')
                    ? 'image'
                    : attachedFile.type === 'application/pdf'
                      ? 'document-text'
                      : 'document'
                }
                size={24}
                color="#10b981"
              />
            </View>

            {/* File info */}
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                {attachedFile.name}
              </Text>
              <Text className="mt-0.5 text-xs text-gray-500">
                {attachedFile.type.split('/')[1].toUpperCase()} •{' '}
                {(attachedFile.size / 1024).toFixed(1)} KB
              </Text>
            </View>

            {/* Remove button */}
            <TouchableOpacity
              onPress={removeAttachedFile}
              disabled={isSending}
              className="ml-2 rounded-full bg-red-50 p-2"
              activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input Area - FIXED FOR KEYBOARD */}
      <View
        className="mb-12 border-t border-gray-200 bg-white px-4 py-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }}>
        <View className="flex-row items-end">
          {/* Attach Button */}
          <TouchableOpacity
            onPress={handleAttachFile}
            disabled={isSending || isProcessingFile}
            className="mb-2 mr-2">
            {isProcessingFile ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <Ionicons name="add" size={24} color={isSending ? '#9ca3af' : '#6b7280'} />
              </View>
            )}
          </TouchableOpacity>

          {/* Text Input */}
          <View className="mr-2 flex-1">
            <TextInput
              className="max-h-24 rounded-3xl bg-gray-100 px-4 py-3 text-gray-800"
              placeholder={attachedFile ? 'Add a caption...' : 'Message AI...'}
              placeholderTextColor="#9ca3af"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              editable={!isSending}
              style={{
                fontSize: 15,
                fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
              }}
            />
          </View>

          {/* Send Button */}
          <TouchableOpacity
            onPress={sendMessage}
            disabled={(!message.trim() && !attachedFile) || isSending}
            className={`mb-2 h-10 w-10 items-center justify-center rounded-full ${
              (message.trim() || attachedFile) && !isSending ? 'bg-blue-500' : 'bg-gray-300'
            }`}
            style={{
              shadowColor: '#3b82f6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: (message.trim() || attachedFile) && !isSending ? 0.3 : 0,
              shadowRadius: 4,
              elevation: (message.trim() || attachedFile) && !isSending ? 4 : 0,
            }}>
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default ChatDetailScreen;
