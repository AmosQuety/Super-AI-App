// app/(tabs)/index.tsx
import { useQuery } from '@apollo/client/react';
import { router, type Href } from 'expo-router';
import { ChevronRight, Image, ListChecks, MessageSquare, Mic } from 'lucide-react-native';
import type { ComponentType } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/use-auth';
import { RECENT_CHATS } from '../../services/graphql/operations';
import { formatDate } from '../../utils/formatters';

const RECENT_CHATS_LIMIT = 3;

interface RecentChat {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface EntryCard {
  title: string;
  description: string;
  route: Href;
  color: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
}

const ENTRY_CARDS: EntryCard[] = [
  {
    title: 'Chat',
    description: 'Text conversations',
    route: '/features/chats',
    color: '#3B82F6',
    Icon: MessageSquare,
  },
  {
    title: 'Image',
    description: 'Visual AI',
    route: '/features/image',
    color: '#8B5CF6',
    Icon: Image,
  },
  {
    title: 'Voice',
    description: 'Spoken conversations',
    route: '/features/voice',
    color: '#10B981',
    Icon: Mic,
  },
];

function mostRecent(chats: RecentChat[]): RecentChat[] {
  return [...chats]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, RECENT_CHATS_LIMIT);
}

function EntryCardButton({ card }: { card: EntryCard }) {
  const { Icon } = card;
  return (
    <TouchableOpacity
      onPress={() => router.push(card.route)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${card.title}: ${card.description}`}
      className="min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <Icon size={28} color={card.color} />
      <Text className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
        {card.title}
      </Text>
    </TouchableOpacity>
  );
}

function RecentChatRow({ chat }: { chat: RecentChat }) {
  const title = chat.title?.trim() || 'Untitled chat';
  return (
    <TouchableOpacity
      onPress={() => router.push(`/features/chats/${chat.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open chat ${title}, updated ${formatDate(chat.updatedAt)}`}
      className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <View className="flex-1 pr-3">
        <Text numberOfLines={1} className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </Text>
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {formatDate(chat.updatedAt)}
        </Text>
      </View>
      <ChevronRight size={18} color="#6B7280" />
    </TouchableOpacity>
  );
}

interface RecentChatsSectionProps {
  chats: RecentChat[];
  loading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

function RecentChatsSection({ chats, loading, hasError, onRetry }: RecentChatsSectionProps) {
  if (hasError) {
    return (
      <View className="items-center rounded-xl border border-red-200 bg-red-50 p-4">
        <Text className="mb-3 text-center text-red-700">
          Could not load your chats. Pull to retry
        </Text>
        <TouchableOpacity
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading your chats"
          className="min-h-[44px] items-center justify-center rounded-lg bg-red-600 px-5">
          <Text className="font-semibold text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && chats.length === 0) {
    return (
      <View
        className="min-h-[44px] items-center justify-center py-4"
        accessibilityLabel="Loading your chats">
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  if (chats.length === 0) {
    return <Text className="py-2 text-gray-600 dark:text-gray-400">No conversations yet</Text>;
  }

  return (
    <View className="gap-3">
      {chats.map((chat) => (
        <RecentChatRow key={chat.id} chat={chat} />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { data, loading, error, refetch } = useQuery<{ chats: RecentChat[] }>(RECENT_CHATS, {
    variables: { userId: user?.id ?? '' },
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const firstName = user?.name?.trim().split(' ')[0];
  const retry = () => {
    refetch().catch(() => undefined);
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={retry} />}>
      <View className="px-6">
        <Text
          accessibilityRole="header"
          className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
          {firstName ? `Hello, ${firstName}` : 'Hello'}
        </Text>

        <View className="mb-8 flex-row gap-4">
          {ENTRY_CARDS.map((card) => (
            <EntryCardButton key={card.title} card={card} />
          ))}
        </View>

        <Text
          accessibilityRole="header"
          className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
          Recent chats
        </Text>
        <RecentChatsSection
          chats={mostRecent(data?.chats ?? [])}
          loading={loading}
          hasError={Boolean(error)}
          onRetry={retry}
        />

        <TouchableOpacity
          testID="home-tasks"
          onPress={() => router.push('/features/tasks')}
          accessibilityRole="button"
          accessibilityLabel="Open AI tasks"
          className="mt-8 min-h-[44px] flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <View className="flex-row items-center">
            <ListChecks size={20} color="#6B7280" />
            <Text className="ml-3 text-base font-semibold text-gray-900 dark:text-white">
              AI tasks
            </Text>
          </View>
          <ChevronRight size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
