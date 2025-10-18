// app/features/chats/index.tsx - PROFESSIONAL STYLED VERSION
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/use-auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Message } from 'libs/types';

const GET_CHATS = gql`
  query GetChats($userId: ID!) {
    chats(userId: $userId) {
      id
      title
      createdAt
      messages {
        id
        content
        fileName
      }
    }
  }
`;

const DELETE_CHAT = gql`
  mutation DeleteChat($chatId: ID!) {
    deleteChat(chatId: $chatId)
  }
`;

type Chat = {
  id: string;
  title: string;
  createdAt: string;
  messages: {
    id: string;
    content: string;
    fileName?: string;
  }[];
};

const ChatListScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [deletingChats, setDeletingChats] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);

  const { user, isLoading: authLoading } = useAuth(); 
  const insets = useSafeAreaInsets();

  const { data, loading, error, refetch, fetchMore } = useQuery<{ chats: Chat[] }>(GET_CHATS, {
    variables: { userId: user?.id || '' },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const chats: Chat[] = React.useMemo(() => data?.chats || [], [data]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat => 
        chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.messages[0]?.content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredChats(filtered);
    }
  }, [chats, searchQuery]);

  const [deleteChat] = useMutation(DELETE_CHAT, {
    onError: (error) => {
      console.error('Delete mutation error:', error);
      Alert.alert('Error', 'Failed to delete chat');
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleDeleteChat = async (chatId: string) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this conversation?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel' 
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingChats(prev => new Set(prev).add(chatId));
            try {
              await deleteChat({ variables: { chatId } });
              await refetch();
            } catch (error) {
              console.error('Delete error:', error);
            } finally {
              setDeletingChats(prev => {
                const newSet = new Set(prev);
                newSet.delete(chatId);
                return newSet;
              });
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
    });
  };

  const getLastMessagePreview = (messages: Message[]) => {
    if (!messages || messages.length === 0) return 'No messages yet';
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.fileName) {
      return `📎 ${lastMessage.fileName}`;
    }
    
    return lastMessage.content.length > 60 
      ? lastMessage.content.substring(0, 60) + '...'
      : lastMessage.content;
  };

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      onPress={() => router.push(`/features/chats/${item.id}`)}
      onLongPress={() => handleDeleteChat(item.id)}
      disabled={deletingChats.has(item.id)}
      className="bg-white mx-4 mb-3 rounded-2xl p-4"
      activeOpacity={0.7}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text 
            className="text-gray-900 font-semibold text-base" 
            numberOfLines={1}
          >
            {item.title || 'New Conversation'}
          </Text>
        </View>
        <Text className="text-gray-400 text-xs font-medium">
          {formatDate(item.createdAt)}
        </Text>
      </View>
      
      <View className="flex-row items-center">
        <Text 
          className="text-gray-500 text-sm flex-1" 
          numberOfLines={2}
        >
          {getLastMessagePreview(item.messages)}
        </Text>
        {deletingChats.has(item.id) ? (
          <ActivityIndicator size="small" color="#3B82F6" className="ml-2" />
        ) : (
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        )}
      </View>
    </TouchableOpacity>
  );

  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-500 mt-4 font-medium">Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center px-6">
        <View className="bg-white rounded-3xl p-8 items-center" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 5,
        }}>
          <View className="bg-blue-50 rounded-full p-6 mb-6">
            <Ionicons name="lock-closed-outline" size={48} color="#3b82f6" />
          </View>
          <Text className="text-gray-900 text-2xl font-bold text-center mb-2">
            Sign In Required
          </Text>
          <Text className="text-gray-500 text-center mb-6 text-base">
            Please sign in to view and manage your conversations
          </Text>
          <TouchableOpacity
            className="bg-blue-500 rounded-2xl px-8 py-4 w-full"
            onPress={() => router.push('/auth/sign-in')}
            style={{
              shadowColor: '#3b82f6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-center text-base">
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !refreshing && chats.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="px-6 py-6 bg-white border-b border-gray-100">
          <Text className="text-3xl font-bold text-gray-900">Chats</Text>
        </View>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-500 mt-4 font-medium">Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && chats.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="px-6 py-6 bg-white border-b border-gray-100">
          <Text className="text-3xl font-bold text-gray-900">Chats</Text>
        </View>
        <View className="flex-1 justify-center items-center px-6">
          <View className="bg-white rounded-3xl p-8 items-center" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5,
          }}>
            <View className="bg-red-50 rounded-full p-6 mb-4">
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            </View>
            <Text className="text-red-500 text-xl font-bold text-center mb-2">
              Connection Error
            </Text>
            <Text className="text-gray-500 text-sm text-center mb-6">
              {error.message}
            </Text>
            <TouchableOpacity
              className="bg-blue-500 rounded-2xl px-8 py-3"
              onPress={onRefresh}
            >
              <Text className="text-white font-semibold">Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header with Search */}
      <View className="bg-white border-b border-gray-100 px-6 py-4">
        <Text className="text-3xl font-bold text-gray-900 mb-4">Chats</Text>
        
        {/* Search Bar */}
        <View 
          className="flex-row items-center bg-gray-100 rounded-2xl px-4 py-3"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-3 text-gray-800 text-base"
            placeholder="Search conversations..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          paddingTop: 16,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
        onEndReached={() => {
          if (filteredChats.length > 0 && !loading) {
            fetchMore({
              variables: { offset: chats.length },
            });
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading && (
            <View className="flex-1 justify-center items-center py-20">
              <View className="bg-white rounded-full p-8 mb-6" style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 5,
              }}>
                <Ionicons 
                  name={searchQuery ? "search-outline" : "chatbubbles-outline"} 
                  size={64} 
                  color="#9ca3af" 
                />
              </View>
              <Text className="text-gray-400 text-xl font-bold text-center mb-2">
                {searchQuery ? 'No Results' : 'No Conversations Yet'}
              </Text>
              <Text className="text-gray-400 text-center text-base px-6">
                {searchQuery 
                  ? 'Try adjusting your search terms' 
                  : 'Start a new conversation with AI'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && filteredChats.length > 0 ? (
            <ActivityIndicator size="small" color="#3B82F6" className="py-4" />
          ) : null
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        className="absolute right-6 bg-blue-500 rounded-full w-16 h-16 justify-center items-center"
        style={{ 
          bottom: (insets.bottom || 12) + 24,
          shadowColor: '#3b82f6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}
        onPress={() => router.push('/features/chats/new')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default ChatListScreen;