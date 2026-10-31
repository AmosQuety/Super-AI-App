import { useQuery } from '@apollo/client/react';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Loading } from '../../components/ui/loading';
import { useToast } from '../../components/ui/toast';
import { useSaveFailureToast } from '../../hooks/use-account-save';
import { useAuth } from '../../hooks/use-auth';
import { usageStats } from '../../libs/profile';
import { PROFILE_DETAILS } from '../../services/graphql/operations';

export default function ProfileScreen() {
  const { user, signOut, signOutOtherSessions, isLoading } = useAuth();
  const { showSuccess, showInfo } = useToast();
  const showSaveFailure = useSaveFailureToast();
  const [isEndingSessions, setIsEndingSessions] = useState(false);
  const isEndingSessionsRef = useRef(false);
  const { data: details, refetch } = useQuery<{ me: Parameters<typeof usageStats>[0] }>(
    PROFILE_DETAILS,
    { fetchPolicy: 'cache-first' }
  );
  // The tab stays mounted, so refresh the counts each time it comes into view.
  useFocusEffect(
    useCallback(() => {
      refetch().catch(() => undefined);
    }, [refetch])
  );
  const stats = usageStats(details?.me ?? null);

  const endOtherSessions = async () => {
    if (isEndingSessionsRef.current) return;
    isEndingSessionsRef.current = true;
    setIsEndingSessions(true);
    try {
      const outcome = await signOutOtherSessions();
      if (outcome === 'stored') {
        showSuccess('Other devices signed out', 'You stay signed in on this device.');
      } else if (outcome === 'storage_failed') {
        // The other devices were signed out, but this one could not keep its new session.
        showInfo('Other devices signed out', 'Please sign in again on this device.');
      }
      // 'session_changed': the user signed out while this ran, so there is nothing to confirm.
    } catch (error) {
      showSaveFailure('Could not sign out other devices', error);
    } finally {
      isEndingSessionsRef.current = false;
      setIsEndingSessions(false);
    }
  };

  if (isLoading) {
    return <Loading fullScreen message="Loading profile..." />;
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-gray-900">
      <ScrollView contentContainerClassName="p-6">
        <Card className="p-6">
          <Text className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
            Profile
          </Text>

          <View className="space-y-4">
            <View>
              <Text className="text-gray-600 dark:text-gray-400">Name</Text>
              <Text className="text-lg text-gray-900 dark:text-white">
                {user?.name || 'Guest User'}
              </Text>
            </View>

            <View>
              <Text className="text-gray-600 dark:text-gray-400">ID</Text>
              <Text className="text-lg text-gray-900 dark:text-white">{user?.id || 'N/A'}</Text>
            </View>

            <View>
              <Text className="text-gray-600 dark:text-gray-400">Email</Text>
              <Text className="text-lg text-gray-900 dark:text-white">
                {user?.email || 'guest@example.com'}
              </Text>
            </View>

            <View>
              <Text className="text-gray-600 dark:text-gray-400">Member Since</Text>
              <Text className="text-lg text-gray-900 dark:text-white">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
          </View>

          <View testID="profile-stats" className="mt-6 flex-row flex-wrap gap-3">
            {[
              { label: 'Chats', value: stats.chats },
              { label: 'Messages', value: stats.messages },
              { label: 'Voice jobs', value: stats.voiceJobs },
              { label: 'Documents', value: stats.documents },
            ].map((item) => (
              <View
                key={item.label}
                accessible
                accessibilityLabel={`${item.label}: ${item.value ?? 'not available'}`}
                className="w-[47%] rounded-xl border border-gray-200 bg-gray-50 p-3">
                <Text className="text-2xl font-bold text-gray-900">{item.value ?? '–'}</Text>
                <Text className="text-sm text-gray-600">{item.label}</Text>
              </View>
            ))}
          </View>

          <Button
            testID="profile-edit-name"
            title="Edit name"
            variant="outline"
            className="mt-6"
            onPress={() => router.push('/features/account/edit-name')}
          />
          <Button
            testID="profile-assistant-settings"
            title="Assistant settings"
            variant="outline"
            className="mt-3"
            onPress={() => router.push('/features/account/assistant-settings')}
          />
          <Button
            testID="profile-change-password"
            title="Change password"
            variant="outline"
            className="mt-3"
            onPress={() => router.push('/features/account/change-password')}
          />
          <Button
            testID="profile-sign-out-others"
            title="Sign out other devices"
            accessibilityHint="Signs out every other phone and browser. You stay signed in here."
            variant="outline"
            className="mt-3"
            loading={isEndingSessions}
            disabled={isEndingSessions}
            onPress={endOtherSessions}
          />
          <Button
            title="Sign Out"
            variant="outline"
            className="mt-3"
            disabled={isEndingSessions}
            onPress={signOut}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
