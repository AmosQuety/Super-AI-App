// hooks/use-auth.tsx
import React,{ createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthCredentials, User } from '../libs/types';
import { apiService } from '../services/api';
import { storageService } from '../services/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (credentials: AuthCredentials & { name: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { name?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  refreshUser: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
    
  }, []);

  const checkAuthStatus = async () => {
  try {
    const token = await storageService.getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    const isAuthenticated = await apiService.isAuthenticated();
    if (isAuthenticated) {
      try {
        const userData = await apiService.getCurrentUser();
        setUser(userData);
         await storageService.setUser(userData); 
      } catch (userError) {
        console.error('Failed to fetch user data:', userError);
        // Token might be invalid, clear it
        await storageService.clearAuth();
      }
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    await storageService.clearAuth();
  } finally {
    setIsLoading(false);
  }
};

  const signIn = async (credentials: AuthCredentials) => {
    try {
      setIsLoading(true);
      const response = await apiService.login(credentials);
      setUser(response.user);
      await storageService.setUser(response.user); 
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (credentials: AuthCredentials & { name: string }) => {
    try {
      setIsLoading(true);
      const response = await apiService.register(credentials);
      setUser(response.user);
      await storageService.setUser(response.user);
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await apiService.logout();
      setUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: { name?: string; email?: string }) => {
    try {
      const updatedUser = await apiService.updateProfile(updates);
      setUser(updatedUser);
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      return await apiService.changePassword(currentPassword, newPassword);
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      if (await apiService.isAuthenticated()) {
        const userData = await apiService.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      console.error('User refresh failed:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    updateProfile,
    changePassword,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}