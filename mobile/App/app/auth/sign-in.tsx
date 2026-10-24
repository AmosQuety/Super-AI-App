import { Link, router } from 'expo-router';
import { Eye, EyeOff, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Form, FormField } from '../../components/ui/form';
import { useToast } from '../../components/ui/toast';
import { useAuth } from '../../hooks/use-auth';
import { useZodForm } from '../../hooks/use-form';
import { signInSchema, type SignInFormData } from '../../libs/validation-schemas';

export default function SignInScreen() {
  const { showSuccess, showError } = useToast();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const form = useZodForm(signInSchema, {});

  const onSubmit = async (data: SignInFormData) => {
    try {
      await signIn(data);
      showSuccess('Welcome back!', 'You have successfully signed in.');
      router.replace('/(tabs)');
    } catch (error: any) {
      showError('Sign in failed', error.message || 'Please check your credentials.');
    }
  };

  return (
    <View className="flex-1 bg-blue-50 dark:bg-gray-900">
      <View className="items-center pb-8 pt-20">
        <View className="mb-4 rounded-2xl bg-blue-500 p-4">
          <Mail size={32} color="white" />
        </View>
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</Text>
        <Text className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Sign in to your account
        </Text>
      </View>

      {/* Form Card */}
      <View className="flex-1 px-6">
        <Card className="rounded-3xl bg-white p-6 shadow-lg dark:bg-gray-800">
          <Form>
            {/* Email Field */}
            <View className="mb-6">
              <Text className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Address
              </Text>
              <View className="relative">
                <FormField
                  control={form.control}
                  name="email"
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className=""
                />
              </View>
            </View>

            {/* Password Field */}
            <View className="mb-6">
              <Text className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </Text>
              <View className="relative">
                <FormField
                  control={form.control}
                  name="password"
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  className=""
                />
                <TouchableOpacity
                  className="absolute right-2 top-1 p-2"
                  onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={18} color="#6B7280" />
                  ) : (
                    <Eye size={18} color="#6B7280" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <Button
              title="Sign In"
              onPress={form.handleSubmit(onSubmit)}
              disabled={!form.formState.isValid || form.formState.isSubmitting}
              loading={form.formState.isSubmitting}
              className="rounded-lg border-0 bg-blue-500 py-3"
            />
          </Form>

          {/* Sign Up Link */}
          <View className="mt-6 flex-row justify-center border-t border-gray-200 pt-6 dark:border-gray-700">
            <Text className="text-gray-600 dark:text-gray-400">Don&apos;t have an account?</Text>
            <Link href="/auth/sign-up" asChild>
              <TouchableOpacity className="mb-7 p-1">
                <Text className="ml-1 font-semibold text-blue-500">Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </Card>
      </View>

      {/* </LinearGradient> */}
    </View>
  );
}
