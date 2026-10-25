// app/features/tasks/index.tsx
import { useQuery } from '@apollo/client/react';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { GET_MY_TASKS } from '../../../services/graphql/operations';
import {
  featureLabel,
  isActiveStatus,
  progressPercent,
  statusLabel,
  taskDestination,
  taskSummary,
  timeAgo,
  type TaskRecord,
} from '../../../libs/tasks';

const TASKS_LIMIT = 12;
const POLL_INTERVAL_MS = 15_000;

const STATUS_COLORS: Record<string, { text: string; background: string }> = {
  queued: { text: '#92400e', background: '#fef3c7' },
  processing: { text: '#1d4ed8', background: '#dbeafe' },
  completed: { text: '#166534', background: '#dcfce7' },
  failed: { text: '#991b1b', background: '#fee2e2' },
  canceled: { text: '#374151', background: '#e5e7eb' },
};

function statusColors(status: string) {
  return STATUS_COLORS[status] ?? { text: '#374151', background: '#e5e7eb' };
}

function TaskRow({ task }: { task: TaskRecord }) {
  const destination = taskDestination(task);
  const colors = statusColors(task.status);
  const label = featureLabel(task.feature);
  const status = statusLabel(task.status);
  const active = isActiveStatus(task.status);

  const content = (
    <View className="rounded-2xl border border-gray-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-gray-900">{label}</Text>
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: colors.background }}>
          <Text className="text-xs font-semibold" style={{ color: colors.text }}>
            {status}
          </Text>
        </View>
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">{timeAgo(task.updatedAt)}</Text>
        {destination ? <Ionicons name="chevron-forward" size={16} color="#9ca3af" /> : null}
      </View>
      {active ? (
        <View
          className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${label} progress`}
          accessibilityValue={{ min: 0, max: 100, now: progressPercent(task) }}>
          <View
            className="h-2 rounded-full bg-blue-500"
            style={{ width: `${progressPercent(task)}%` }}
          />
        </View>
      ) : null}
      {task.status === 'failed' ? (
        // The stored error text is internal wording; the user gets a plain sentence instead.
        <Text className="mt-2 text-sm text-red-700">This task did not finish.</Text>
      ) : null}
    </View>
  );

  if (!destination) {
    return (
      <View testID="task-row" accessible accessibilityLabel={taskSummary(task)}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      testID="task-row"
      onPress={() => router.push(destination as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${taskSummary(task)}. Open`}
      activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

export default function TasksScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery<{
    myTasks: TaskRecord[];
  }>(GET_MY_TASKS, {
    variables: { limit: TASKS_LIMIT, includeArchived: false },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
  });

  // Poll only while this screen is in front and the app is in the foreground, so a hidden
  // screen or a backgrounded app does not keep the radio awake. Coming back shows fresh data
  // at once instead of waiting for the next tick.
  const hasBeenFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const refreshNow = () => {
        refetch().catch(() => undefined);
      };
      startPolling(POLL_INTERVAL_MS);
      if (hasBeenFocused.current) refreshNow();
      hasBeenFocused.current = true;

      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          startPolling(POLL_INTERVAL_MS);
          refreshNow();
        } else {
          stopPolling();
        }
      });
      return () => {
        subscription.remove();
        stopPolling();
      };
    }, [refetch, startPolling, stopPolling])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch {
      // The error state below reports it.
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const tasks = data?.myTasks ?? [];

  if (loading && tasks.length === 0) {
    return (
      <View
        testID="tasks-loading"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Loading your tasks"
        className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <View
        testID="tasks-error"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Text className="mb-4 text-center text-base text-gray-700">
          Could not load your tasks. Check your connection and try again.
        </Text>
        <TouchableOpacity
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel="Retry loading your tasks"
          className="min-h-[44px] items-center justify-center rounded-2xl bg-blue-500 px-8">
          <Text className="font-semibold text-white">Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      testID="tasks-list"
      className="flex-1 bg-gray-50"
      data={tasks}
      keyExtractor={(task) => task.id}
      renderItem={({ item }) => <TaskRow task={item} />}
      ItemSeparatorComponent={() => <View className="h-3" />}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <View testID="tasks-empty" className="flex-1 items-center justify-center py-20">
          <Text className="text-center text-lg font-semibold text-gray-700">No tasks yet</Text>
          <Text className="mt-2 text-center text-sm text-gray-600">
            Things the AI works on for you will appear here.
          </Text>
        </View>
      }
    />
  );
}
