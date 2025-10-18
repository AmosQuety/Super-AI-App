// app/features/chats/new.tsx - PROFESSIONAL STYLED VERSION
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { router } from 'expo-router';
import { useAuth } from '../../../hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';

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

  const [createChat, { loading }] = useMutation(CREATE_CHAT);

  const handleCreateChat = async () => {
    if (!initialMessage.trim()) {
      Alert.alert('Empty Message', 'Please enter a message to start the conversation');
      return;
    }
    
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please sign in to create a chat');
      return;
    }

    try {
      const result = await createChat({
        variables: {
          userId: user.id,
          title: title.trim() || undefined,
          messages: [
            {
              role: 'user',
              content: initialMessage.trim(),
            },
          ],
        },
      });

      if (result.data?.createChat) {
        router.replace(`/features/chats/${result.data.createChat.id}`);
      }
    } catch (error: any) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', error.message || 'Failed to create chat');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          className="flex-1"
          contentContainerStyle={{ padding: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-8">
            <View className="bg-blue-50 rounded-full w-16 h-16 justify-center items-center mb-4">
              <Ionicons name="sparkles" size={32} color="#3b82f6" />
            </View>
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              New Conversation
            </Text>
            <Text className="text-gray-500 text-base">
              Start chatting with AI assistant
            </Text>
          </View>

          {/* Title Input */}
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Ionicons name="pricetag-outline" size={20} color="#6b7280" />
              <Text className="text-gray-700 font-semibold ml-2 text-base">
                Title (Optional)
              </Text>
            </View>
            <View 
              className="bg-white rounded-2xl overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <TextInput
                className="px-4 py-4 text-gray-800 text-base"
                placeholder="e.g., Project Ideas, Daily Chat..."
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>
            <View className="flex-row justify-between items-center mt-2 px-1">
              <Text className="text-gray-400 text-xs">
                Give your conversation a memorable name
              </Text>
              <Text className="text-gray-400 text-xs">
                {title.length}/100
              </Text>
            </View>
          </View>

          {/* Message Input */}
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#6b7280" />
              <Text className="text-gray-700 font-semibold ml-2 text-base">
                Your Message <Text className="text-red-500">*</Text>
              </Text>
            </View>
            <View 
              className="bg-white rounded-2xl overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <TextInput
                className="px-4 py-4 text-gray-800 text-base"
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
            <View className="flex-row justify-between items-center mt-2 px-1">
              <Text className="text-gray-400 text-xs">
                {initialMessage.trim() ? '✓ Ready to send' : 'Required to start'}
              </Text>
              <Text className={`text-xs ${
                initialMessage.length > 900 ? 'text-orange-500' : 'text-gray-400'
              }`}>
                {initialMessage.length}/1000
              </Text>
            </View>
          </View>

          {/* Suggestions */}
          <View className="mb-6">
            <Text className="text-gray-600 text-sm font-medium mb-3">
              💡 Try asking about:
            </Text>
            <View className="flex-row flex-wrap">
              {[
                'Code help',
                'Writing tips',
                'Learning topics',
                'Creative ideas',
              ].map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  className="bg-blue-50 rounded-full px-4 py-2 mr-2 mb-2"
                  onPress={() => setInitialMessage(suggestion)}
                  activeOpacity={0.7}
                >
                  <Text className="text-blue-600 text-sm font-medium">
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mt-4 space-y-3">
            {/* Create Button */}
            <TouchableOpacity
              className={`rounded-2xl py-4 justify-center items-center ${
                initialMessage.trim() && !loading
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
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
              activeOpacity={0.8}
            >
              {loading ? (
                <View className="flex-row items-center">
                  <Text className="text-white font-bold text-base mr-2">Creating</Text>
                  <View className="w-2 h-2 rounded-full bg-white mr-1 opacity-100" />
                  <View className="w-2 h-2 rounded-full bg-white mr-1 opacity-60" />
                  <View className="w-2 h-2 rounded-full bg-white opacity-30" />
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="paper-plane" size={20} color="white" />
                  <Text className="text-white font-bold text-base ml-2">
                    Start Conversation
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              className="rounded-2xl py-4 justify-center items-center bg-white border-2 border-gray-200"
              onPress={() => router.back()}
              disabled={loading}
              activeOpacity={0.8}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              <Text className="text-gray-600 font-semibold text-base">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}