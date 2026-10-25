// app/features/chats/new.tsx - PROFESSIONAL STYLED VERSION
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';
import { titleFromMessage } from '../../../libs/chat-start';

const CREATE_CHAT = gql`
  mutation CreateChat($userId: ID!, $title: String, $messages: [MessageInput!]!) {
    createChat(userId: $userId, title: $title, messages: $messages) {
      id
      title
      createdAt
      messages {
        id
        role
        content
        createdAt
      }
    }
  }
`;

export default function NewChatScreen() {
  const [title, setTitle] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const { user } = useAuth();

  const [createChat, { loading }] = useMutation<{ createChat: { id: string } }>(CREATE_CHAT);

  const handleCreateChat = async () => {
    if (!initialMessage.trim()) {
      Alert.alert('Empty Message', 'Please enter a message to start the conversation');
      return;
    }

    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please sign in to create a chat');
      return;
    }

    const firstMessage = initialMessage.trim();

    try {
      // The chat is created empty on purpose: the chat screen sends the first message through
      // sendMessageWithResponse, which saves it and asks for the reply. Seeding it here as well
      // would store the message twice and show it to the model twice.
      const result = await createChat({
        variables: {
          userId: user.id,
          title: title.trim() || titleFromMessage(firstMessage),
          messages: [],
        },
        refetchQueries: ['GetChats', 'RecentChats'],
      });

      if (result.data?.createChat) {
        router.replace({
          pathname: '/features/chats/[id]',
          params: { id: result.data.createChat.id, firstMessage },
        });
      }
    } catch (error: any) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', error.message || 'Failed to create chat');
    }
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24 }}
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="mb-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="sparkles" size={32} color="#3b82f6" />
            </View>
            <Text className="mb-2 text-3xl font-bold text-gray-900">New Conversation</Text>
            <Text className="text-base text-gray-500">Start chatting with AI assistant</Text>
          </View>

          {/* Title Input */}
          <View className="mb-6">
            <View className="mb-3 flex-row items-center">
              <Ionicons name="pricetag-outline" size={20} color="#6b7280" />
              <Text className="ml-2 text-base font-semibold text-gray-700">Title (Optional)</Text>
            </View>
            <View
              className="overflow-hidden rounded-2xl bg-white"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}>
              <TextInput
                className="px-4 py-4 text-base text-gray-800"
                placeholder="e.g., Project Ideas, Daily Chat..."
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>
            <View className="mt-2 flex-row items-center justify-between px-1">
              <Text className="text-xs text-gray-400">Give your conversation a memorable name</Text>
              <Text className="text-xs text-gray-400">{title.length}/100</Text>
            </View>
          </View>

          {/* Message Input */}
          <View className="mb-6">
            <View className="mb-3 flex-row items-center">
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#6b7280" />
              <Text className="ml-2 text-base font-semibold text-gray-700">
                Your Message <Text className="text-red-500">*</Text>
              </Text>
            </View>
            <View
              className="overflow-hidden rounded-2xl bg-white"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}>
              <TextInput
                className="px-4 py-4 text-base text-gray-800"
                style={{
                  minHeight: 120,
                  textAlignVertical: 'top',
                }}
                placeholder="What would you like to discuss?&#10;&#10;Ask questions, share ideas, or request help with anything..."
                placeholderTextColor="#9ca3af"
                value={initialMessage}
                onChangeText={setInitialMessage}
                multiline
                maxLength={1000}
              />
            </View>
            <View className="mt-2 flex-row items-center justify-between px-1">
              <Text className="text-xs text-gray-400">
                {initialMessage.trim() ? '✓ Ready to send' : 'Required to start'}
              </Text>
              <Text
                className={`text-xs ${
                  initialMessage.length > 900 ? 'text-orange-500' : 'text-gray-400'
                }`}>
                {initialMessage.length}/1000
              </Text>
            </View>
          </View>

          {/* Suggestions */}
          <View className="mb-6">
            <Text className="mb-3 text-sm font-medium text-gray-600">💡 Try asking about:</Text>
            <View className="flex-row flex-wrap">
              {['Code help', 'Writing tips', 'Learning topics', 'Creative ideas'].map(
                (suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    className="mb-2 mr-2 rounded-full bg-blue-50 px-4 py-2"
                    onPress={() => setInitialMessage(suggestion)}
                    activeOpacity={0.7}>
                    <Text className="text-sm font-medium text-blue-600">{suggestion}</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mt-4 space-y-3">
            {/* Create Button */}
            <TouchableOpacity
              className={`items-center justify-center rounded-2xl py-4 ${
                initialMessage.trim() && !loading ? 'bg-blue-500' : 'bg-gray-300'
              }`}
              style={
                initialMessage.trim() && !loading
                  ? {
                      shadowColor: '#3b82f6',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    }
                  : {}
              }
              onPress={handleCreateChat}
              disabled={!initialMessage.trim() || loading}
              activeOpacity={0.8}>
              {loading ? (
                <View className="flex-row items-center">
                  <Text className="mr-2 text-base font-bold text-white">Creating</Text>
                  <View className="mr-1 h-2 w-2 rounded-full bg-white opacity-100" />
                  <View className="mr-1 h-2 w-2 rounded-full bg-white opacity-60" />
                  <View className="h-2 w-2 rounded-full bg-white opacity-30" />
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="paper-plane" size={20} color="white" />
                  <Text className="ml-2 text-base font-bold text-white">Start Conversation</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              className="items-center justify-center rounded-2xl border-2 border-gray-200 bg-white py-4"
              onPress={() => router.back()}
              disabled={loading}
              activeOpacity={0.8}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}>
              <Text className="text-base font-semibold text-gray-600">Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
