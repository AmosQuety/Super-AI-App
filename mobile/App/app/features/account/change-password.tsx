import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
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
import {
  changePasswordSchema,
  MIN_PASSWORD_LENGTH,
  type ChangePasswordFormData,
} from '../../../libs/validation-schemas';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function ChangePasswordScreen() {
  const { changePassword } = useAuth();
  const { showSuccess, showError } = useToast();
  const [showPasswords, setShowPasswords] = useState(false);
  const form = useZodForm(changePasswordSchema, EMPTY_FORM);

  const onSubmit = async ({ currentPassword, newPassword }: ChangePasswordFormData) => {
    try {
      await changePassword(currentPassword, newPassword);
      form.reset(EMPTY_FORM);
      showSuccess('Password changed', 'Use your new password the next time you sign in.');
      router.back();
    } catch (error) {
      // The server's message is specific ("Current password is incorrect"); show it as is.
      showError('Could not change password', error instanceof Error ? error.message : undefined);
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
              hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
              disabled={!form.formState.isValid || form.formState.isSubmitting}
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
      />
      {hint ? <Text className="-mt-2 mb-2 text-xs text-gray-500">{hint}</Text> : null}
    </View>
  );
}
