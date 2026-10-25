// app/features/account/assistant-settings.tsx
import { useMutation, useQuery } from '@apollo/client/react';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useToast } from '../../../components/ui/toast';
import { useSaveFailureToast, useScreenFocusRef } from '../../../hooks/use-account-save';
import {
  MAX_FREE_TEXT,
  PREFERENCE_CHOICES,
  arePreferencesEqual,
  preferencesFromServer,
  preferencesInput,
  type Preferences,
} from '../../../libs/profile';
import { PROFILE_DETAILS, UPDATE_PREFERENCES } from '../../../services/graphql/operations';

type ServerPreferences = Partial<Record<keyof Preferences, string | null>> | null;

const TEXT_FIELDS: {
  key: 'role' | 'domain' | 'goals' | 'language';
  label: string;
  hint: string;
}[] = [
  { key: 'language', label: 'Reply language', hint: 'For example English or French' },
  { key: 'role', label: 'Your role', hint: 'For example product manager' },
  { key: 'domain', label: 'Your field or tools', hint: 'For example mobile apps, React Native' },
  { key: 'goals', label: 'What you are working toward', hint: 'For example launching in November' },
];

export default function AssistantSettingsScreen() {
  const { showSuccess } = useToast();
  const showSaveFailure = useSaveFailureToast();
  const isScreenFocused = useScreenFocusRef();
  const { data, loading, error, refetch } = useQuery<{ me: { preferences: ServerPreferences } }>(
    PROFILE_DETAILS,
    { fetchPolicy: 'network-only' }
  );
  const [savePreferences, { loading: isSaving }] = useMutation(UPDATE_PREFERENCES);

  const [saved, setSaved] = useState<Preferences | null>(null);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const isSavingRef = useRef(false);

  // The form starts from what the server holds, once, and is not overwritten while being edited.
  useEffect(() => {
    if (data?.me && saved === null) {
      const fromServer = preferencesFromServer(data.me.preferences);
      setSaved(fromServer);
      setDraft(fromServer);
    }
  }, [data, saved]);

  if (error && !draft) {
    return (
      <View testID="settings-error" className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Text accessibilityRole="alert" className="mb-4 text-center text-base text-gray-700">
          Could not load your settings. Check your connection and try again.
        </Text>
        <Button
          title="Try again"
          accessibilityLabel="Try loading your settings again"
          onPress={() => {
            refetch().catch(() => undefined);
          }}
        />
      </View>
    );
  }

  if (loading || !draft || !saved) {
    return (
      <View
        testID="settings-loading"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Loading your settings"
        className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const hasChanges = !arePreferencesEqual(draft, saved);

  const save = async () => {
    if (isSavingRef.current || !hasChanges) return;
    isSavingRef.current = true;
    try {
      const input = preferencesInput(draft);
      await savePreferences({ variables: { preferences: input } });
      setSaved(input);
      setDraft(input);
      showSuccess('Saved', 'The assistant will use these settings in new replies.');
      if (isScreenFocused.current && router.canGoBack()) router.back();
    } catch (error) {
      showSaveFailure('Could not save your settings', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        <Card className="p-6">
          <Text className="mb-4 text-sm text-gray-600">
            These settings shape how the chat assistant talks to you. They are sent to our server
            with your chat messages.
          </Text>

          {(Object.keys(PREFERENCE_CHOICES) as (keyof typeof PREFERENCE_CHOICES)[]).map((key) => (
            <View key={key} className="mb-5">
              <Text className="mb-2 text-sm font-medium text-gray-700">
                {PREFERENCE_CHOICES[key].title}
              </Text>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={PREFERENCE_CHOICES[key].title}
                className="flex-row flex-wrap gap-2">
                {PREFERENCE_CHOICES[key].options.map((option) => {
                  const selected = draft[key] === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      testID={`pref-${key}-${option.value}`}
                      onPress={() => setDraft({ ...draft, [key]: option.value })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${PREFERENCE_CHOICES[key].title}: ${option.label}`}
                      className={`min-h-[44px] justify-center rounded-full border px-4 ${
                        selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                      }`}>
                      <Text
                        className={`text-sm font-semibold ${
                          selected ? 'text-white' : 'text-gray-800'
                        }`}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {TEXT_FIELDS.map(({ key, label, hint }) => (
            <View key={key} className="mb-4">
              <Text className="mb-2 text-sm font-medium text-gray-700">{label}</Text>
              <TextInput
                testID={`pref-${key}`}
                accessibilityLabel={label}
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                placeholder={hint}
                placeholderTextColor="#6b7280"
                value={draft[key]}
                onChangeText={(value) => setDraft({ ...draft, [key]: value })}
                maxLength={MAX_FREE_TEXT}
                multiline={key === 'goals'}
                autoCapitalize="sentences"
              />
              <Text
                accessibilityLabel={`${draft[key].length} of ${MAX_FREE_TEXT} characters`}
                className="mt-1 text-right text-xs text-gray-600">
                {draft[key].length}/{MAX_FREE_TEXT}
              </Text>
            </View>
          ))}

          <Button
            testID="settings-save"
            accessibilityLabel="Save assistant settings"
            title="Save"
            loading={isSaving}
            disabled={isSaving || !hasChanges}
            onPress={save}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
