// app/features/account/edit-name.tsx
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useToast } from '../../../components/ui/toast';
import { useSaveFailureToast, useScreenFocusRef } from '../../../hooks/use-account-save';
import { useAuth } from '../../../hooks/use-auth';
import { MAX_NAME_LENGTH, nameProblem } from '../../../libs/profile';

export default function EditNameScreen() {
  const { user, updateProfile } = useAuth();
  const { showSuccess } = useToast();
  const showSaveFailure = useSaveFailureToast();
  const isScreenFocused = useScreenFocusRef();
  const [name, setName] = useState(user?.name ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Two quick taps can arrive before the button re-renders as disabled; only one save may run.
  const isSavingRef = useRef(false);

  const save = async () => {
    if (isSavingRef.current) return;
    const found = nameProblem(name);
    setProblem(found);
    if (found) return;

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const applied = await updateProfile({ name: name.trim() });
      if (!applied) return;
      showSuccess('Name saved', 'Your name was updated.');
      if (isScreenFocused.current && router.canGoBack()) router.back();
    } catch (error) {
      showSaveFailure('Could not save your name', error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const unchanged = name.trim() === (user?.name ?? '').trim();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        <Card className="p-6">
          <Text className="mb-2 text-sm font-medium text-gray-700">Name</Text>
          <TextInput
            testID="edit-name-input"
            accessibilityLabel="Name"
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setProblem(null);
            }}
            maxLength={MAX_NAME_LENGTH + 20}
            accessibilityHint={problem ?? undefined}
            autoCapitalize="words"
            selectTextOnFocus
            autoComplete="name"
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <View className="mb-4 mt-1 flex-row justify-between">
            {problem ? (
              <Text
                testID="edit-name-problem"
                accessibilityLiveRegion="polite"
                className="flex-1 text-xs text-red-700">
                {problem}
              </Text>
            ) : (
              <View className="flex-1" />
            )}
            <Text
              accessibilityLabel={`${name.trim().length} of ${MAX_NAME_LENGTH} characters`}
              className="text-xs text-gray-600">
              {name.trim().length}/{MAX_NAME_LENGTH}
            </Text>
          </View>
          <Text className="mb-6 text-xs text-gray-600">
            This is the name the assistant uses for you. Your email cannot be changed in the app
            yet.
          </Text>
          <Button
            testID="edit-name-save"
            accessibilityLabel="Save name"
            title="Save"
            loading={isSaving}
            disabled={isSaving || unchanged}
            onPress={save}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
