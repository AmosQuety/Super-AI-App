// src/components/auth/RegisterScreen.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User } from 'lucide-react';
import { useToast } from '../ui/toastContext';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpFormData } from '../../lib/validation-schemas';
import { FaceCapture } from "./FaceCapture"; 
import { useMutation } from '@apollo/client/react'; 
import { gql } from '@apollo/client';

const REGISTER_USER_FACE = gql`
  mutation RegisterUserFace($image: Upload!) {
    registerUserFace(image: $image) {
      success
      message
    }
  }
`;

export default function RegisterScreen() {
  const { showSuccess, showError } = useToast();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // VIEW CONTROL
  const [showFaceEnroll, setShowFaceEnroll] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);

  // Hook for adding face
  const [registerFace] = useMutation(REGISTER_USER_FACE);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange'
  });

  // STEP 1: CREATE ACCOUNT
  const onSubmit = async (data: SignUpFormData) => {
    try {
      setIsLoading(true);
      await signUp(data);
      
      // SUCCESS! Now switch to Face Enrollment View
      showSuccess('Account Created!', 'One last step: Secure your account.');
      setShowFaceEnroll(true);
      
    } catch (error: any) {
      showError('Sign up failed', error.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: ENROLL FACE
  const handleFaceEnroll = async (file: File) => {
    try {
      setFaceLoading(true);
      // We rely on the token already being in localStorage from the signUp() step
      const { data } = await registerFace({ variables: { image: file } });
      
      if (data.registerUserFace.success) {
        showSuccess('Biometrics Enabled', 'You can now use Face ID to login.');
        navigate('/chat');
      } else {
        showError('Enrollment Failed', data.registerUserFace.message);
      }
    } catch (err: any) {
      showError('Error', err.message);
    } finally {
      setFaceLoading(false);
    }
  };

  const skipEnrollment = () => {
    navigate('/chat');
  };

  // ------------------------------------------
  // VIEW 2: FACE ENROLLMENT (Post-Signup)
  // ------------------------------------------
  if (showFaceEnroll) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800 rounded-3xl p-8 shadow-xl border border-slate-700 text-center animate-in fade-in zoom-in duration-300">
          <div className="mb-6">
            <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
               <User className="text-purple-400 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Secure Your Account 📸</h2>
            <p className="text-slate-400 text-sm">
              Register your face now to enable instant login next time.
            </p>
          </div>
          
          <FaceCapture 
            onCapture={handleFaceEnroll}
            onCancel={skipEnrollment} 
            loading={faceLoading}
            mode="register"
          />
          
          <button 
            onClick={skipEnrollment}
            className="mt-8 text-slate-500 hover:text-slate-300 text-xs uppercase tracking-widest hover:underline transition-all"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------
  // VIEW 1: REGISTRATION FORM
  // ------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          
          <div className="text-center">
            <div className="mx-auto bg-gradient-to-br from-purple-500 to-pink-600 p-5 rounded-3xl w-20 h-20 flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/30">
              <User size={36} className="text-white" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Create Account
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Join us and start your AI journey today!
            </p>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50">
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                <input {...register('name')} type="text" placeholder="John Doe" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white" />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                <input {...register('email')} type="email" placeholder="you@example.com" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white" />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={!isValid || isLoading} className="w-full bg-blue-500 text-white py-3 px-4 rounded-xl hover:bg-blue-600 transition-colors font-semibold text-lg disabled:opacity-50">
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">Already have an account?</p>
              <Link to="/login" className="text-purple-500 font-semibold hover:text-purple-600">Sign In</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}