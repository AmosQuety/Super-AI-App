// hooks/use-auth.tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { AuthCredentials, User } from '../libs/types';
import { isSessionExpired, msUntilExpiry } from '../libs/session';
import { onSessionEnded } from '../libs/session-events';
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
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ends a session the app knows is no longer valid; clears storage and the Apollo cache.
  const endExpiredSession = useCallback(async () => {
    await apiService.logout();
    setUser(null);
  }, []);

  // The server rejected the session (see libs/apollo-client.ts), which already cleared storage.
  useEffect(() => onSessionEnded(() => setUser(null)), []);

  useEffect(() => {
    checkAuthStatus();
    // Runs once on launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSignOutAtExpiry(user, endExpiredSession);

  const checkAuthStatus = async () => {
    try {
      const token = await storageService.getAuthToken();
      if (!token) return;

      // An expired token must never be sent: sign out before any query runs.
      if (isSessionExpired(token)) {
        await endExpiredSession();
        return;
      }

      const userData = await apiService.getCurrentUser();
      setUser(userData);
      await storageService.setUser(userData);
    } catch (error) {
      // Keep the stored login: a network or server failure is not proof the session is invalid.
      // A real rejection (UNAUTHENTICATED) is handled by the Apollo error link.
      console.error('Auth check failed:', error);
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// setTimeout cannot wait longer than this (about 24.8 days).
const MAX_TIMER_MS = 2_147_483_647;

// While signed in, signs out when the token expires and re-checks when the app returns
// to the foreground (timers do not run reliably while the app is in the background).
function useSignOutAtExpiry(user: User | null, endExpiredSession: () => Promise<void>) {
  useEffect(() => {
    if (!user) return;

    let expiryTimer: ReturnType<typeof setTimeout> | undefined;

    const signOutIfExpired = async () => {
      const token = await storageService.getAuthToken();
      if (isSessionExpired(token)) await endExpiredSession();
    };

    const scheduleExpiryCheck = async () => {
      const token = await storageService.getAuthToken();
      clearTimeout(expiryTimer);
      // The callback re-checks, so a capped (early) timer never signs out a valid session.
      expiryTimer = setTimeout(signOutIfExpired, Math.min(msUntilExpiry(token), MAX_TIMER_MS));
    };

    scheduleExpiryCheck();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') signOutIfExpired();
    });

    return () => {
      clearTimeout(expiryTimer);
      appStateSubscription.remove();
    };
  }, [user, endExpiredSession]);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
