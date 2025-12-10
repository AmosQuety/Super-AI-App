// src/components/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, ScanFace } from 'lucide-react';
import { useToast } from '../ui/toastContext';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInFormData } from '../../lib/validation-schemas';
import { FaceCapture } from "./FaceCapture";

export default function LoginScreen() {
  const { showSuccess, showError } = useToast();
  const { signIn, loginWithFace } = useAuth(); // ✅ Added loginWithFace here
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFaceMode, setIsFaceMode] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);

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
      setFaceLoading(true);
      const message = await loginWithFace(file);
      showSuccess('Access Granted', message || "Welcome back!"); // ✅ Using consistent toast methods
      navigate("/chat");
    } catch (error: any) {
      showError('Verification Failed', error.message); // ✅ Using consistent toast methods
    } finally {
      setFaceLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo Section */}
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
              <Mail className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Sign in to your account</p>
        </div>

        {isFaceMode ? (
          // FACE LOGIN MODE
          <FaceCapture
            onCapture={handleFaceLogin}
            onCancel={() => setIsFaceMode(false)}
            loading={faceLoading}
            mode="login"
          />
        ) : (
          // PASSWORD LOGIN MODE
          <>
            {/* Form Card */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-700/50">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="you@example.com"
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
                  )}
                </div>

                {/* Face Login Button */}
                <button
                  type="button"
                  onClick={() => setIsFaceMode(true)}
                  className="w-full py-3 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition flex items-center justify-center gap-2"
                >
                  <ScanFace className="w-5 h-5" />
                  Login with Face ID
                </button>
                <p className="text-center text-xs text-gray-500 mt-2">
                  * Face ID must be enabled in your profile settings first.
                </p>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={!isValid || isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>

            {/* Sign Up Link */}
            <p className="text-center text-gray-400 mt-6">
              Don't have an account?{' '}
              
              <Link to="/register" className="text-purple-400 hover:text-purple-300 font-medium transition">
                Sign Up
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}