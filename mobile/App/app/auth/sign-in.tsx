import { Link, router } from 'expo-router';
import { Eye, EyeOff,  Mail } from 'lucide-react-native';
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
  const form = useZodForm(signInSchema, {
   
  });

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
      
      <View className="items-center pt-20 pb-8">
        <View className="bg-blue-500 p-4 rounded-2xl mb-4">
          <Mail size={32} color="white" />
        </View>
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome Back
        </Text>
        <Text className="text-lg text-gray-600 dark:text-gray-400 mt-2">
          Sign in to your account
        </Text>
      </View>

      {/* Form Card */}
      <View className="flex-1 px-6">
        <Card className="p-6 rounded-3xl bg-white dark:bg-gray-800 shadow-lg">
          <Form>
            {/* Email Field */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                  variant="outline"
                  className="absolute right-2 top-1 p-2"
                  onPress={() => setShowPassword(!showPassword)}
                >
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
              className="bg-blue-500 border-0 rounded-lg py-3"
            />
          </Form>

          {/* Sign Up Link */}
          <View className="flex-row justify-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Text className="text-gray-600 dark:text-gray-400">
              Don't have an account?
            </Text>
            <Link href="/auth/sign-up" asChild>
              <TouchableOpacity variant="outline" className="p-1 mb-7">
                <Text className="text-blue-500 font-semibold ml-1">
                  Sign Up
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </Card>
      </View>
      
      {/* </LinearGradient> */}
    </View>
  );
}