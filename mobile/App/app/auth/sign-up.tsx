import { Link, router } from 'expo-router';
import { Eye, EyeOff, User } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../../components/ui/card';
import { Form, FormField } from '../../components/ui/form';
import { useToast } from '../../components/ui/toast';
import { useAuth } from '../../hooks/use-auth';
import { useZodForm } from '../../hooks/use-form';
import { signUpSchema, type SignUpFormData } from '../../libs/validation-schemas';

export default function SignUpScreen() {
  const { showSuccess, showError } = useToast();
  const { signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const form = useZodForm(signUpSchema);

  const onSubmit = async (data: SignUpFormData) => {
    try {
      await signUp(data);
      showSuccess('Welcome!', 'Your account has been created successfully.');
      router.replace('/(tabs)');
    } catch (error: any) {
      showError('Sign up failed', error.message || 'Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-gradient-to-b from-purple-50 via-white to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header with improved styling */}
      <View className="items-center pb-8 pt-20">
        <View className="mb-6 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-600 p-5 shadow-2xl shadow-purple-500/30">
          <User size={36} color="white" />
        </View>
        <Text className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">
          Create Account
        </Text>
        <Text className="px-4 text-center text-lg text-gray-600 dark:text-gray-400">
          Join us and start your AI journey today!
        </Text>
      </View>

      {/* Form Card with enhanced styling */}
      <View className="flex-1 px-6">
        <Card className="rounded-3xl border border-white/20 bg-white/90 p-8 shadow-2xl backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/90">
          <Form>
            {/* Name Field */}
            <View className="mb-6">
              <Text className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Full Name
              </Text>
              <View className="relative">
                <FormField
                  control={form.control}
                  name="name"
                  placeholder="Enter your full name"
                  autoCapitalize="words"
                  className=" "
                />
              </View>
            </View>

            {/* Email Field */}
            <View className="mb-6">
              <Text className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
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
            <View className="mb-8">
              <Text className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Password
              </Text>
              <View className="relative">
                <FormField
                  control={form.control}
                  name="password"
                  placeholder="Create a password"
                  secureTextEntry={!showPassword}
                  className=""
                />
                <TouchableOpacity
                  className="absolute right-3 top-2 rounded-full p-2"
                  onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={20} color="#6B7280" />
                  ) : (
                    <Eye size={20} color="#6B7280" />
                  )}
                </TouchableOpacity>
              </View>
              <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Password must be at least 6 characters long
              </Text>
            </View>

            <TouchableOpacity
              onPress={form.handleSubmit(onSubmit)}
              disabled={!form.formState.isValid || form.formState.isSubmitting}
              className="rounded-xl border-0 bg-blue-500 py-3">
              <Text className="text-center text-lg font-semibold text-white dark:text-white ">
                Sign Up
              </Text>
            </TouchableOpacity>

            {/* Sign In Section */}
            <View className="mt-6 flex-row items-center justify-center border-t border-gray-200 pt-6 dark:border-gray-700">
              <Text className="mb-4 text-center text-gray-600 dark:text-gray-400">
                Already have an account?
              </Text>
              <Link href="/auth/sign-in" asChild>
                <TouchableOpacity className=" mb-4 rounded-lg px-4 py-3">
                  <Text className="text-base font-semibold text-purple-500 dark:text-purple-400">
                    Sign In
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Form>
        </Card>

        {/* App Version/Footer */}
        <View className="mt-8 items-center">
          <Text className="text-xs text-gray-400 dark:text-gray-500">Xemora v1.0.0</Text>
        </View>
      </View>
    </View>
  );
}
