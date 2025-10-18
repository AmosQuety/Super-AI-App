import { Link, router } from 'expo-router';
import { Eye, EyeOff,  User } from 'lucide-react-native';
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
      <View className="items-center pt-20 pb-8">
        <View className="bg-gradient-to-br from-purple-500 to-pink-600 p-5 rounded-3xl mb-6 shadow-2xl shadow-purple-500/30">
          <User size={36} color="white" />
        </View>
        <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Create Account
        </Text>
        <Text className="text-lg text-gray-600 dark:text-gray-400 text-center px-4">
          Join us and start your AI journey today!
        </Text>
      </View>

      {/* Form Card with enhanced styling */}
      <View className="flex-1 px-6">
        <Card className="p-8 rounded-3xl bg-white/90 dark:bg-gray-800/90 shadow-2xl border border-white/20 dark:border-gray-700/50 backdrop-blur-sm">
          <Form>
            {/* Name Field */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                  variant="ghost"
                  className="absolute right-3 top-2 p-2 rounded-full"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#6B7280" />
                  ) : (
                    <Eye size={20} color="#6B7280" />
                  )}
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Password must be at least 6 characters long
              </Text>
            </View>

            <TouchableOpacity
              onPress={form.handleSubmit(onSubmit)}
              disabled={!form.formState.isValid || form.formState.isSubmitting}
              loading={form.formState.isSubmitting}
              className='bg-blue-500 border-0 rounded-xl py-3'
              >
              <Text className="text-lg text-center text-white dark:text-white font-semibold ">
                Sign Up
              </Text>
            </TouchableOpacity>

           
           
            {/* Sign In Section */}
            <View className="items-center flex-row justify-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Text className="text-gray-600 dark:text-gray-400 text-center mb-4">
                Already have an account?
              </Text>
              <Link href="/auth/sign-in" asChild>
                <TouchableOpacity 
                  variant="outline" 
                  className=" py-3 px-4 rounded-lg mb-4"
                >
                  <Text className="text-purple-500 dark:text-purple-400 font-semibold text-base">
                    Sign In
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Form>
        </Card>

        {/* App Version/Footer */}
        <View className="items-center mt-8">
          <Text className="text-gray-400 dark:text-gray-500 text-xs">
            Super AI App v1.0.0
          </Text>
        </View>
      </View>
    </View>
  );
}