// src/components/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { useToast } from '../ui/toastContext';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInFormData } from '../../lib/validation-schemas';
import { FaceCapture } from "./FaceCapture"; // Import component
import { ScanFace } from "lucide-react"; 

export default function LoginScreen() {
  const { showSuccess, showError } = useToast();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();
  
  const [isFaceMode, setIsFaceMode] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange'
  });

  const onSubmit = async (data: SignInFormData) => {
    try {
      setIsLoading(true);
      await signIn(data);
      showSuccess('Welcome back!', 'You have successfully signed in.');
      navigate('/chat');
    } catch (error: any) {
      showError('Sign in failed', error.message || 'Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

   const handleFaceLogin = async (file: File) => {
    try {
      setLoading(true);
      const message = await loginWithFace(file);
      
      addToast({
        type: 'success',
        title: 'Access Granted',
        message: message || "Welcome back!",
      });
      navigate("/");
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Verification Failed',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Logo Section */}
          <div className="text-center">
            <div className="mx-auto bg-blue-500 p-4 rounded-2xl w-16 h-16 flex items-center justify-center mb-4">
              <Mail size={32} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome Back
            </h2>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
              Sign in to your account
            </p>
          </div>

          {isFaceMode ? (
          // FACE LOGIN MODE
          <FaceCapture 
            onCapture={handleFaceLogin}
            onCancel={() => setIsFaceMode(false)}
            loading={loading}
            mode="login"
          />
        ) : (
          // PASSWORD LOGIN MODE
          <>
           <form onSubmit={/* your submit handler */ e => e.preventDefault()} className="space-y-4">
              {/* ... Your existing Email/Password Inputs ... */}
              
              {/* Add Face Login Trigger Button */}
              <button
                type="button"
                onClick={() => setIsFaceMode(true)}
                className="w-full py-3 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition flex items-center justify-center gap-2"
              >
                <ScanFace size={20} />
                Login with Face ID
              </button>

              {/* ... Submit Button ... */}
            </form>
          </>
        )}

          {/* Form Card */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg">
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    {...register('email')}
                    type="email"
                    id="email"
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={!isValid || isLoading}
                className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="text-blue-500 font-semibold hover:text-blue-600 transition-colors"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}