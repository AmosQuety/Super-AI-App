import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Form, FormField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';
import { useAuth } from '../../../hooks/use-auth';
import { useZodForm } from '../../../hooks/use-form';
import { useScreenCaptureBlock } from '../../../hooks/use-screen-capture-block';
import { ApiError } from '../../../services/api';
import {
  changePasswordSchema,
  PASSWORD_HINT,
  type ChangePasswordFormData,
} from '../../../libs/validation-schemas';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function ChangePasswordScreen() {
  const { changePassword } = useAuth();
  useScreenCaptureBlock('change-password');
  const { showSuccess, showError } = useToast();
  const [showPasswords, setShowPasswords] = useState(false);
  const form = useZodForm(changePasswordSchema, EMPTY_FORM);

  // Two quick taps can arrive before the button re-renders as disabled; only one request may run.
  const isSubmittingRef = useRef(false);

  const onSubmit = async ({ currentPassword, newPassword }: ChangePasswordFormData) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (!result.success) {
        throw new Error(result.message || 'The password was not changed.');
      }
      form.reset(EMPTY_FORM);
      showSuccess('Password changed', 'Use your new password the next time you sign in.');
      if (router.canGoBack()) router.back();
    } catch (error) {
      // The server no longer accepts the session: the app is already taking the user to Sign In,
      // so an error message about this form would only confuse.
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') return;
      // The server's message is specific ("Current password is incorrect"); show it as is.
      // A wrong current password is the one thing to retype, so clear only that field.
      form.setValue('currentPassword', '');
      showError('Could not change password', error instanceof Error ? error.message : undefined);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="p-6" keyboardShouldPersistTaps="handled">
        <Card className="p-6">
          <Form>
            <PasswordField
              control={form.control}
              name="currentPassword"
              label="Current password"
              hidden={!showPasswords}
              autoComplete="current-password"
            />
            <PasswordField
              control={form.control}
              name="newPassword"
              label="New password"
              hidden={!showPasswords}
              autoComplete="new-password"
              hint={PASSWORD_HINT}
            />
            <PasswordField
              control={form.control}
              name="confirmPassword"
              label="Confirm new password"
              hidden={!showPasswords}
              autoComplete="new-password"
            />

            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: showPasswords }}
              accessibilityLabel="Show passwords"
              onPress={() => setShowPasswords((shown) => !shown)}
              className="mb-6 min-h-[44px] flex-row items-center">
              {showPasswords ? (
                <EyeOff size={20} color="#6B7280" />
              ) : (
                <Eye size={20} color="#6B7280" />
              )}
              <Text className="ml-2 text-sm text-gray-600">Show passwords</Text>
            </TouchableOpacity>

            <Button
              testID="change-password-submit"
              accessibilityLabel="Change password"
              title="Change password"
              loading={form.formState.isSubmitting}
              disabled={form.formState.isSubmitting}
              onPress={form.handleSubmit(onSubmit)}
            />
          </Form>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface PasswordFieldProps {
  control: ReturnType<typeof useZodForm<typeof changePasswordSchema>>['control'];
  name: keyof ChangePasswordFormData;
  label: string;
  hidden: boolean;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
}

function PasswordField({ control, name, label, hidden, autoComplete, hint }: PasswordFieldProps) {
  return (
    <View className="mb-2">
      <Text className="mb-2 text-sm font-medium text-gray-700">{label}</Text>
      <FormField
        control={control}
        name={name}
        placeholder={label}
        accessibilityLabel={label}
        secureTextEntry={hidden}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        // Keeps the keyboard from learning or suggesting a password that is shown on screen.
        keyboardType={!hidden && Platform.OS === 'android' ? 'visible-password' : 'default'}
      />
      {hint ? <Text className="-mt-2 mb-2 text-xs text-gray-500">{hint}</Text> : null}
    </View>
  );
}
