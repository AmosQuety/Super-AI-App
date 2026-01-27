// src/components/auth/RegisterScreen.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, ScanFace } from 'lucide-react';
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

interface RegisterFaceData {
  registerUserFace: {
    success: boolean;
    message: string;
  };
}

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
  const [registerFace] = useMutation<RegisterFaceData>(REGISTER_USER_FACE);

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
      
    } catch (error: unknown) {
       let errorMessage = "An unexpected error occurred";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      showError('Sign up failed', errorMessage);
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
      
      if (data?.registerUserFace.success) {
        showSuccess('Biometrics Enabled', 'You can now use Face ID to login.');
        navigate('/chat');
      } else {
        const msg = data?.registerUserFace.message || "Unknown error";
        showError('Enrollment Failed', msg);
      }
    } catch (err: unknown) {
       let errorMessage = "An unexpected error occurred";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }

      showError('Error', errorMessage);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-700/50 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
               <User className="text-white w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Secure Your Account 📸</h2>
            <p className="text-gray-400 text-sm">
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
            className="mt-8 text-gray-500 hover:text-gray-300 text-xs uppercase tracking-widest hover:underline transition-all"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo Section */}
          <div className="mb-6">
            <Link to="/" className="inline-block">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                <ScanFace className="w-8 h-8 text-white" />
              </div>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Join Xemora</h1>
          <p className="text-gray-400 font-medium">Start your Unified AI journey today</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-700/50">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                {...register('name')}
                type="text"
                placeholder="John Doe"
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
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

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={!isValid || isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        </div>

        {/* Sign In Link */}
        <p className="text-center text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition">
            Sign In
          </Link>
        </p>

        {/* Trust Footer */}
        <div className="mt-8 flex justify-center gap-4 text-xs text-gray-500 border-t border-slate-800 pt-6">
          <Link to="#" className="hover:text-gray-400 underline decoration-slate-700">Privacy Policy</Link>
          <Link to="#" className="hover:text-gray-400 underline decoration-slate-700">Terms of Service</Link>
          <Link to="#" className="hover:text-gray-400 underline decoration-slate-700">Security Center</Link>
        </div>
      </div>
    </div>
  );
}